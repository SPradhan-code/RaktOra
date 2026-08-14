const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { calculateDonorEligibility } = require('../services/eligibilityEngine');
const { calculateHaversineDistance, isBloodCompatible } = require('../utils/geoUtils');

// ============================================================================
// 1. GET DONOR ELIGIBILITY (GET /api/donors/eligibility/check)
// ============================================================================
router.get('/eligibility/check', authenticateToken, requireRole(['donor', 'admin']), async (req, res, next) => {
  try {
    const donor = await queryOne('SELECT * FROM Donors WHERE user_id = ?', [req.user.id]);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor profile not found' });
    }

    const eligibility = calculateDonorEligibility(donor, req.query || {});
    return res.json({ success: true, eligibility });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. SEARCH NEARBY DONORS BY GPS (GET /api/donors/nearby)
// ============================================================================
router.get('/nearby', async (req, res, next) => {
  try {
    const { latitude, longitude, blood_group, max_distance_km } = req.query;
    const reqLat = parseFloat(latitude);
    const reqLon = parseFloat(longitude);
    const maxDist = parseFloat(max_distance_km) || 50; // Default 50km radius

    const allDonors = await query(`
      SELECT 
        d.id, d.user_id, u.full_name, u.state, u.city,
        d.blood_group, d.age, d.gender, d.weight, d.is_available,
        d.last_donation_date, d.total_donations, d.profile_pic,
        COALESCE(u.emergency_alerts_enabled, 1) as emergency_alerts_enabled,
        COALESCE(u.available_for_donation, 1) as available_for_donation,
        COALESCE(d.latitude, u.latitude) as latitude,
        COALESCE(d.longitude, u.longitude) as longitude
      FROM Donors d
      JOIN Users u ON d.user_id = u.id
      WHERE u.is_verified = 1 AND d.is_available = 1 AND COALESCE(u.available_for_donation, 1) = 1
    `);

    const rankedDonors = [];

    allDonors.forEach(donor => {
      let dist = null;
      if (reqLat && reqLon && donor.latitude && donor.longitude) {
        dist = calculateHaversineDistance(reqLat, reqLon, parseFloat(donor.latitude), parseFloat(donor.longitude));
      }

      const compatible = isBloodCompatible(donor.blood_group, blood_group);
      const eligibility = calculateDonorEligibility(donor);

      // 🛡️ SANITIZE EXACT GPS COORDINATES & PRIVATE CONTACT FOR PRIVACY
      const sanitizedDonor = {
        id: donor.id,
        user_id: donor.user_id,
        full_name: donor.full_name,
        blood_group: donor.blood_group,
        city: donor.city,
        state: donor.state,
        is_available: donor.is_available === 1,
        total_donations: donor.total_donations,
        compatible,
        eligibility: eligibility.status,
        approx_distance: dist !== null ? `${dist} km away` : `${donor.city}, ${donor.state}`
      };

      if (dist === null || dist <= maxDist) {
        rankedDonors.push(sanitizedDonor);
      }
    });

    // Ranking algorithm: Compatible -> Eligible -> Distance
    rankedDonors.sort((a, b) => {
      if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
      if ((a.eligibility === 'ELIGIBLE') !== (b.eligibility === 'ELIGIBLE')) return a.eligibility === 'ELIGIBLE' ? -1 : 1;
      return 0;
    });

    return res.json({
      success: true,
      count: rankedDonors.length,
      donors: rankedDonors
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. SEARCH DONORS (GET /api/donors/search)
// ============================================================================
router.get('/search', async (req, res, next) => {
  try {
    const { blood_group, state, city, is_available } = req.query;

    let sql = `
      SELECT 
        d.id, d.user_id, u.full_name, u.state, u.city,
        d.blood_group, d.age, d.gender, d.is_available,
        d.last_donation_date, d.total_donations, d.profile_pic
      FROM Donors d
      JOIN Users u ON d.user_id = u.id
      WHERE u.is_verified = 1 AND COALESCE(u.available_for_donation, 1) = 1
    `;
    const params = [];

    if (blood_group && blood_group !== 'All' && blood_group !== 'All Blood Groups') {
      sql += ` AND d.blood_group = ?`;
      params.push(blood_group);
    }

    if (state && state !== 'All States' && state !== 'All') {
      sql += ` AND u.state = ?`;
      params.push(state);
    }

    if (city && city.trim() !== '') {
      sql += ` AND LOWER(u.city) LIKE LOWER(?)`;
      params.push(`%${city.trim()}%`);
    }

    if (is_available !== undefined && is_available !== '' && is_available !== null) {
      if (is_available === 'true' || is_available === '1' || is_available === true) {
        sql += ` AND d.is_available = 1`;
      }
    }

    sql += ` ORDER BY d.total_donations DESC, d.id DESC LIMIT 50`;

    const donors = await query(sql, params);
    
    // Privacy sanitization: No exact phone, email or address in public search results
    const sanitized = donors.map(d => ({
      id: d.id,
      user_id: d.user_id,
      full_name: d.full_name,
      blood_group: d.blood_group,
      city: d.city,
      state: d.state,
      is_available: d.is_available === 1,
      total_donations: d.total_donations,
      profile_pic: d.profile_pic
    }));

    return res.json({ success: true, count: sanitized.length, donors: sanitized });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 4. GET & UPDATE PRIVACY & NOTIFICATION PREFERENCES
// ============================================================================
router.get('/privacy-preferences', authenticateToken, async (req, res, next) => {
  try {
    const userRec = await queryOne(
      `SELECT COALESCE(emergency_alerts_enabled, 1) as emergency_alerts_enabled, 
              COALESCE(available_for_donation, 1) as available_for_donation 
       FROM Users WHERE id = ?`,
      [req.user.id]
    );

    let prefRec = await queryOne('SELECT * FROM notification_preferences WHERE user_id = ?', [req.user.id]);
    if (!prefRec) {
      await execute(
        `INSERT INTO notification_preferences (user_id, emergency_sms, emergency_email, emergency_push, appointment_reminders, camp_notifications)
         VALUES (?, 1, 1, 1, 1, 1)`,
        [req.user.id]
      );
      prefRec = { emergency_sms: 1, emergency_email: 1, emergency_push: 1, appointment_reminders: 1, camp_notifications: 1 };
    }

    return res.json({
      success: true,
      preferences: {
        emergency_alerts_enabled: userRec ? userRec.emergency_alerts_enabled === 1 : true,
        available_for_donation: userRec ? userRec.available_for_donation === 1 : true,
        emergency_sms: prefRec.emergency_sms === 1,
        emergency_email: prefRec.emergency_email === 1,
        emergency_push: prefRec.emergency_push === 1,
        appointment_reminders: prefRec.appointment_reminders === 1,
        camp_notifications: prefRec.camp_notifications === 1
      }
    });
  } catch (error) {
    next(error);
  }
});

router.put('/privacy-preferences', authenticateToken, async (req, res, next) => {
  try {
    const { 
      emergency_alerts_enabled, available_for_donation, 
      emergency_sms, emergency_email, emergency_push, appointment_reminders, camp_notifications 
    } = req.body;

    if (emergency_alerts_enabled !== undefined || available_for_donation !== undefined) {
      await execute(
        `UPDATE Users SET 
          emergency_alerts_enabled = COALESCE(?, emergency_alerts_enabled),
          available_for_donation = COALESCE(?, available_for_donation)
         WHERE id = ?`,
        [
          emergency_alerts_enabled !== undefined ? (emergency_alerts_enabled ? 1 : 0) : null,
          available_for_donation !== undefined ? (available_for_donation ? 1 : 0) : null,
          req.user.id
        ]
      );

      // Sync with Donors table is_available
      if (available_for_donation !== undefined) {
        await execute('UPDATE Donors SET is_available = ? WHERE user_id = ?', [available_for_donation ? 1 : 0, req.user.id]);
      }
    }

    await execute(
      `INSERT INTO notification_preferences (user_id, emergency_sms, emergency_email, emergency_push, appointment_reminders, camp_notifications)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         emergency_sms = VALUES(emergency_sms),
         emergency_email = VALUES(emergency_email),
         emergency_push = VALUES(emergency_push),
         appointment_reminders = VALUES(appointment_reminders),
         camp_notifications = VALUES(camp_notifications)`,
      [
        req.user.id,
        emergency_sms ? 1 : 0,
        emergency_email ? 1 : 0,
        emergency_push ? 1 : 0,
        appointment_reminders ? 1 : 0,
        camp_notifications ? 1 : 0
      ]
    );

    return res.json({
      success: true,
      message: 'Donor privacy & notification preferences updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 5. UPDATE DONOR PROFILE (PUT /api/donors/profile)
// ============================================================================
router.put('/profile', authenticateToken, requireRole(['donor', 'admin']), async (req, res, next) => {
  try {
    const { blood_group, age, gender, weight, address, profile_pic, is_available, latitude, longitude, health_notes } = req.body;

    const donor = await queryOne('SELECT id FROM Donors WHERE user_id = ?', [req.user.id]);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor profile not found' });
    }

    await execute(
      `UPDATE Donors 
       SET blood_group = COALESCE(?, blood_group),
           age = COALESCE(?, age),
           gender = COALESCE(?, gender),
           weight = COALESCE(?, weight),
           address = COALESCE(?, address),
           profile_pic = COALESCE(?, profile_pic),
           is_available = COALESCE(?, is_available),
           latitude = COALESCE(?, latitude),
           longitude = COALESCE(?, longitude),
           health_notes = COALESCE(?, health_notes)
       WHERE user_id = ?`,
      [
        blood_group || null,
        age || null,
        gender || null,
        weight || null,
        address || null,
        profile_pic || null,
        is_available !== undefined ? (is_available ? 1 : 0) : null,
        latitude || null,
        longitude || null,
        health_notes || null,
        req.user.id
      ]
    );

    if (latitude || longitude) {
      await execute('UPDATE Users SET latitude = ?, longitude = ? WHERE id = ?', [latitude || null, longitude || null, req.user.id]);
    }

    const updatedDonor = await queryOne(
      `SELECT d.*, u.full_name, u.email, u.phone, u.state, u.city 
       FROM Donors d JOIN Users u ON d.user_id = u.id WHERE d.user_id = ?`,
      [req.user.id]
    );

    return res.json({ success: true, message: 'Donor profile updated successfully', donor: updatedDonor });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 6. TOGGLE AVAILABILITY STATUS (PATCH /api/donors/availability)
// ============================================================================
router.patch('/availability', authenticateToken, requireRole(['donor', 'admin']), async (req, res, next) => {
  try {
    const { is_available } = req.body;

    await execute(
      'UPDATE Donors SET is_available = ? WHERE user_id = ?',
      [is_available ? 1 : 0, req.user.id]
    );

    await execute(
      'UPDATE Users SET available_for_donation = ? WHERE id = ?',
      [is_available ? 1 : 0, req.user.id]
    );

    return res.json({
      success: true,
      message: `Availability updated to ${is_available ? 'Available' : 'Unavailable'}`,
      is_available: !!is_available
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
