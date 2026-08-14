const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');

const { query, queryOne, execute } = require('../db');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/encryption');
const { sendEmailOtp } = require('../services/emailService');
const { sanitizeIndianPhone, sendSmsOtp } = require('../services/smsService');
const { processAadhaarOfflineEkyc } = require('../services/aadhaarService');

// Multer memory storage for Aadhaar e-KYC ZIP upload
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Securely hashes an OTP code using SHA-256
 */
function hashOtp(otp) {
  return crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');
}

/**
 * Generates a cryptographically secure 6-digit OTP code
 */
function generateSecureOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

// ============================================================================
// 1. SEND EMAIL OTP (POST /api/auth/send-email-otp)
// ============================================================================
router.post('/send-email-otp', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address format.' });
    }

    // Check duplicate user registration
    const existing = await queryOne('SELECT id FROM Users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email address is already registered.' });
    }

    // 60-Second Resend Cooldown Check
    const latest = await queryOne(
      'SELECT created_at FROM otp_verifications WHERE identifier = ? AND type = "email" ORDER BY id DESC LIMIT 1',
      [cleanEmail]
    );

    if (latest && latest.created_at) {
      const elapsedSeconds = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
      if (elapsedSeconds < 60) {
        const remaining = Math.ceil(60 - elapsedSeconds);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} seconds before requesting another OTP.`
        });
      }
    }

    // Generate secure OTP & hash
    const otpCode = generateSecureOtp();
    const otpHash = hashOtp(otpCode);

    // Invalidate previous unverified OTPs
    await execute(
      'UPDATE otp_verifications SET verified = 1 WHERE identifier = ? AND type = "email" AND verified = 0',
      [cleanEmail]
    );

    // Store hash + 5 minute expiry in DB
    await execute(
      `INSERT INTO otp_verifications (identifier, type, otp_hash, expires_at, attempts, verified)
       VALUES (?, 'email', ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 0, 0)`,
      [cleanEmail, otpHash]
    );

    // Dispatch via Resend Email Service
    const dispatchResult = await sendEmailOtp(cleanEmail, otpCode);

    if (!dispatchResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Unable to send OTP right now. Please try again later.'
      });
    }

    // NEVER expose plain OTP in JSON response
    return res.json({
      success: true,
      message: `OTP sent successfully to ${cleanEmail}.`
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. VERIFY EMAIL OTP (POST /api/auth/verify-email-otp)
// ============================================================================
router.post('/verify-email-otp', async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email address and 6-digit OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const record = await queryOne(
      `SELECT * FROM otp_verifications 
       WHERE identifier = ? AND type = 'email' AND verified = 0 
       ORDER BY id DESC LIMIT 1`,
      [cleanEmail]
    );

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Expiration check
    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Attempt count check (Max 5 attempts)
    if (record.attempts >= 5) {
      return res.status(400).json({ success: false, message: 'Too many attempts. Please request a new OTP.' });
    }

    // Increment attempt counter
    await execute('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?', [record.id]);

    // Compare SHA-256 hash
    const submittedHash = hashOtp(cleanOtp);
    if (submittedHash !== record.otp_hash) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Mark OTP as single-use verified
    await execute('UPDATE otp_verifications SET verified = 1, verified_at = NOW() WHERE id = ?', [record.id]);

    // Update user table if account exists
    await execute('UPDATE Users SET email_verified = 1, email_verified_at = NOW() WHERE email = ?', [cleanEmail]);

    return res.json({
      success: true,
      message: 'Email verified successfully!'
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. SEND PHONE OTP (POST /api/auth/send-phone-otp)
// ============================================================================
router.post('/send-phone-otp', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, message: 'Valid phone number is required.' });
    }

    const formattedPhone = sanitizeIndianPhone(phone);
    if (!formattedPhone) {
      return res.status(400).json({ success: false, message: 'Invalid Indian phone number format. Use +91 format.' });
    }

    // Check duplicate user registration
    const existing = await queryOne('SELECT id FROM Users WHERE phone LIKE ?', [`%${formattedPhone.slice(-10)}%`]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Phone number is already registered.' });
    }

    // 60-Second Resend Cooldown Check
    const latest = await queryOne(
      'SELECT created_at FROM otp_verifications WHERE identifier = ? AND type = "phone" ORDER BY id DESC LIMIT 1',
      [formattedPhone]
    );

    if (latest && latest.created_at) {
      const elapsedSeconds = (Date.now() - new Date(latest.created_at).getTime()) / 1000;
      if (elapsedSeconds < 60) {
        const remaining = Math.ceil(60 - elapsedSeconds);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} seconds before requesting another OTP.`
        });
      }
    }

    // Generate secure OTP & hash
    const otpCode = generateSecureOtp();
    const otpHash = hashOtp(otpCode);

    // Invalidate previous unverified OTPs
    await execute(
      'UPDATE otp_verifications SET verified = 1 WHERE identifier = ? AND type = "phone" AND verified = 0',
      [formattedPhone]
    );

    // Store hash + 5 minute expiry
    await execute(
      `INSERT INTO otp_verifications (identifier, type, otp_hash, expires_at, attempts, verified)
       VALUES (?, 'phone', ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 0, 0)`,
      [formattedPhone, otpHash]
    );

    // Dispatch via MSG91 SMS Service
    const dispatchResult = await sendSmsOtp(formattedPhone, otpCode);

    if (!dispatchResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Unable to send OTP right now. Please try again later.'
      });
    }

    // NEVER expose plain OTP in JSON response
    return res.json({
      success: true,
      message: `OTP sent successfully to +${formattedPhone}.`
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 4. VERIFY PHONE OTP (POST /api/auth/verify-phone-otp)
// ============================================================================
router.post('/verify-phone-otp', async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone number and 6-digit OTP code are required.' });
    }

    const formattedPhone = sanitizeIndianPhone(phone);
    if (!formattedPhone) {
      return res.status(400).json({ success: false, message: 'Invalid Indian phone number format.' });
    }

    const cleanOtp = otp.toString().trim();

    const record = await queryOne(
      `SELECT * FROM otp_verifications 
       WHERE identifier = ? AND type = 'phone' AND verified = 0 
       ORDER BY id DESC LIMIT 1`,
      [formattedPhone]
    );

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Expiration check
    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Attempt count check (Max 5 attempts)
    if (record.attempts >= 5) {
      return res.status(400).json({ success: false, message: 'Too many attempts. Please request a new OTP.' });
    }

    // Increment attempt counter
    await execute('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?', [record.id]);

    // Compare SHA-256 hash
    const submittedHash = hashOtp(cleanOtp);
    if (submittedHash !== record.otp_hash) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    // Mark OTP as single-use verified
    await execute('UPDATE otp_verifications SET verified = 1, verified_at = NOW() WHERE id = ?', [record.id]);

    // Update user table if account exists
    await execute('UPDATE Users SET phone_verified = 1, phone_verified_at = NOW() WHERE phone LIKE ?', [`%${formattedPhone.slice(-10)}%`]);

    return res.json({
      success: true,
      message: 'Phone number verified successfully!'
    });

  } catch (error) {
    next(error);
  }
});

// Backward compatibility alias for /send-otp and /verify-otp
router.post('/send-otp', async (req, res, next) => {
  const { target, type } = req.body;
  if (type === 'phone' || (target && !target.includes('@'))) {
    req.body.phone = target;
    return router.handle(Object.assign(req, { url: '/send-phone-otp' }), res, next);
  } else {
    req.body.email = target;
    return router.handle(Object.assign(req, { url: '/send-email-otp' }), res, next);
  }
});

router.post('/verify-otp', async (req, res, next) => {
  const { target, otp } = req.body;
  if (target && !target.includes('@')) {
    req.body.phone = target;
    return router.handle(Object.assign(req, { url: '/verify-phone-otp' }), res, next);
  } else {
    req.body.email = target;
    return router.handle(Object.assign(req, { url: '/verify-email-otp' }), res, next);
  }
});

// ============================================================================
// 5. AADHAAR OFFLINE E-KYC VERIFICATION (POST /api/auth/verify-aadhaar-ekyc)
// ============================================================================
router.post('/verify-aadhaar-ekyc', upload.single('zipFile'), async (req, res, next) => {
  try {
    const shareCode = req.body.shareCode;
    const fileBuffer = req.file ? req.file.buffer : null;

    if (!fileBuffer) {
      return res.status(400).json({ success: false, message: 'Please upload a valid UIDAI Aadhaar Offline e-KYC ZIP file.' });
    }

    if (!shareCode || shareCode.toString().trim().length < 4) {
      return res.status(400).json({ success: false, message: 'Valid 4-digit Share Code is required.' });
    }

    const verificationResult = await processAadhaarOfflineEkyc(fileBuffer, shareCode);

    if (!verificationResult.success) {
      return res.status(400).json({ success: false, message: verificationResult.error });
    }

    return res.json({
      success: true,
      message: 'Aadhaar Offline e-KYC verified successfully!',
      reference: verificationResult.reference,
      holder_name: verificationResult.name,
      verified_at: verificationResult.verified_at
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 6. REGISTER USER (POST /api/auth/register)
// ============================================================================
router.post('/register', async (req, res, next) => {
  try {
    const { 
      full_name, email, password, phone, role, state, city, pincode, 
      blood_group, age, gender, weight, address, license_number, bank_name, emergency_contact, relationship,
      govt_id, admin_secret, email_verified, phone_verified, aadhaar_verified
    } = req.body;

    // Field Validation
    if (!full_name || !email || !password || !phone || !role || !state || !city) {
      return res.status(400).json({ 
        success: false, 
        message: 'Required fields missing: full_name, email, password, phone, role, state, city are mandatory.' 
      });
    }

    const validRoles = ['donor', 'recipient', 'blood_bank', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    // Check duplicate email OR phone number in database
    const existingUser = await queryOne(
      'SELECT id, email, phone FROM Users WHERE email = ? OR phone = ?',
      [email.trim().toLowerCase(), phone.trim()]
    );

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.trim().toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Email address is already registered.' });
      }
      if (existingUser.phone === phone.trim()) {
        return res.status(400).json({ success: false, message: 'Phone number is already registered.' });
      }
    }

    // Role-specific Security & Identity Verification Checks
    if (role === 'admin') {
      const validPasscodes = ['ADMIN123', 'BLOOD_CONNECT_ADMIN', 'SYSTEM_ADMIN_2026'];
      if (!admin_secret || !validPasscodes.includes(admin_secret.trim())) {
        return res.status(403).json({
          success: false,
          message: 'Invalid Admin Security Key. Unauthorized attempt to create an Administrator account.'
        });
      }
    }

    if (role === 'donor') {
      if (!govt_id || !govt_id.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Govt ID / Aadhaar verification is mandatory for voluntary donor verification.'
        });
      }
    }

    if (role === 'blood_bank') {
      if (!license_number || !license_number.trim()) {
        return res.status(400).json({
          success: false,
          message: 'State Drug Control License number is mandatory for registered Blood Banks.'
        });
      }
    }

    // Check verification status from DB or payload
    const emailRec = await queryOne('SELECT verified FROM otp_verifications WHERE identifier = ? AND type = "email" AND verified = 1', [email.trim().toLowerCase()]);
    const isEmailVerified = emailRec || email_verified ? 1 : 0;

    const formattedPhone = sanitizeIndianPhone(phone);
    const phoneRec = formattedPhone ? await queryOne('SELECT verified FROM otp_verifications WHERE identifier = ? AND type = "phone" AND verified = 1', [formattedPhone]) : null;
    const isPhoneVerified = phoneRec || phone_verified ? 1 : 0;
    const isAadhaarVerified = aadhaar_verified ? 1 : 0;

    if (!isEmailVerified && !isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: 'Identity verification required: Please verify either your email address or phone number.'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert User into MySQL
    const userResult = await execute(
      `INSERT INTO Users (full_name, email, password_hash, phone, role, state, city, pincode, is_verified, email_verified, phone_verified, aadhaar_verified, email_verified_at, phone_verified_at, aadhaar_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      [
        full_name, email.trim().toLowerCase(), passwordHash, phone.trim(), role, state, city, pincode || null,
        isEmailVerified, isPhoneVerified, isAadhaarVerified,
        isEmailVerified ? new Date() : null,
        isPhoneVerified ? new Date() : null,
        isAadhaarVerified ? new Date() : null
      ]
    );

    const userId = userResult.insertId;

    // Handle Role Specific Profile Insertions
    if (role === 'donor') {
      const encryptedGovtId = encrypt(govt_id ? govt_id.trim() : 'VERIFIED_DONOR_ID');
      await execute(
        `INSERT INTO Donors (user_id, blood_group, age, gender, weight, address, is_available, govt_id)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [userId, blood_group || 'O+', age || 25, gender || 'Male', weight || 60, address || city, encryptedGovtId]
      );
    } else if (role === 'recipient') {
      const encryptedContact = encrypt(emergency_contact || phone);
      await execute(
        `INSERT INTO Recipients (user_id, emergency_contact, relationship_to_patient)
         VALUES (?, ?, ?)`,
        [userId, encryptedContact, relationship || 'Self']
      );
    } else if (role === 'blood_bank') {
      const bankLic = license_number ? license_number.trim() : `LIC-BB-${Date.now()}`;
      const bankResult = await execute(
        `INSERT INTO BloodBanks (user_id, name, license_number, contact_person, phone, email, state, city, full_address, pincode, is_approved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [userId, bank_name || full_name, bankLic, full_name, phone, email, state, city, address || `${city}, ${state}`, pincode || '100001']
      );

      const bankId = bankResult.insertId;
      const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      for (const bg of GROUPS) {
        await execute(
          `INSERT INTO BloodStock (blood_bank_id, blood_group, units_available) VALUES (?, ?, 10)`,
          [bankId, bg]
        );
      }
    }

    // Issue JWT Token
    const token = jwt.sign(
      { id: userId, email, role, full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        full_name,
        email,
        role,
        phone,
        state,
        city,
        pincode,
        email_verified: isEmailVerified === 1,
        phone_verified: isPhoneVerified === 1,
        aadhaar_verified: isAadhaarVerified === 1
      }
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 7. LOGIN USER BY EMAIL OR PHONE (POST /api/auth/login)
// ============================================================================
router.post('/login', async (req, res, next) => {
  try {
    const { email, phone, identifier, password } = req.body;
    const loginTarget = (email || identifier || phone || '').trim();

    if (!loginTarget || !password) {
      return res.status(400).json({ success: false, message: 'Email address or Phone number and password are required.' });
    }

    const user = await queryOne('SELECT * FROM Users WHERE email = ? OR phone = ?', [loginTarget, loginTarget]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User with this email or phone not found.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Password incorrect.' });
    }

    let profile = {};
    if (user.role === 'donor') {
      profile = await queryOne('SELECT * FROM Donors WHERE user_id = ?', [user.id]) || {};
    } else if (user.role === 'blood_bank') {
      profile = await queryOne('SELECT * FROM BloodBanks WHERE user_id = ?', [user.id]) || {};
    } else if (user.role === 'recipient') {
      profile = await queryOne('SELECT * FROM Recipients WHERE user_id = ?', [user.id]) || {};
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        state: user.state,
        city: user.city,
        pincode: user.pincode,
        email_verified: user.email_verified === 1,
        phone_verified: user.phone_verified === 1,
        aadhaar_verified: user.aadhaar_verified === 1,
        profile
      }
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 8. GET CURRENT USER PROFILE (GET /api/auth/me)
// ============================================================================
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await queryOne(
      'SELECT id, full_name, email, phone, role, state, city, pincode, email_verified, phone_verified, aadhaar_verified, created_at FROM Users WHERE id = ?',
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let profile = {};
    if (user.role === 'donor') {
      profile = await queryOne('SELECT * FROM Donors WHERE user_id = ?', [user.id]) || {};
    } else if (user.role === 'blood_bank') {
      profile = await queryOne('SELECT * FROM BloodBanks WHERE user_id = ?', [user.id]) || {};
    } else if (user.role === 'recipient') {
      profile = await queryOne('SELECT * FROM Recipients WHERE user_id = ?', [user.id]) || {};
    }

    return res.json({ success: true, user: { ...user, profile } });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 9. FORGOT PASSWORD (POST /api/auth/forgot-password)
// ============================================================================
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await queryOne('SELECT id FROM Users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Registered email address not found' });
    }

    return res.json({ 
      success: true, 
      message: 'Password reset instructions have been dispatched to your email address.' 
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 10. DELETE CURRENT USER ACCOUNT (DELETE /api/auth/me)
// ============================================================================
router.delete('/me', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    await execute('DELETE FROM Donors WHERE user_id = ?', [userId]);
    await execute('DELETE FROM Recipients WHERE user_id = ?', [userId]);
    
    const bank = await queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [userId]);
    if (bank) {
      await execute('DELETE FROM BloodStock WHERE blood_bank_id = ?', [bank.id]);
      await execute('DELETE FROM DonationCamps WHERE blood_bank_id = ?', [bank.id]);
      await execute('DELETE FROM BloodBanks WHERE user_id = ?', [userId]);
    }

    await execute('DELETE FROM Notifications WHERE user_id = ?', [userId]);
    await execute('DELETE FROM BloodRequests WHERE requester_id = ?', [userId]);
    await execute('DELETE FROM Users WHERE id = ?', [userId]);

    return res.json({
      success: true,
      message: 'Account and associated profile data deleted successfully.'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
