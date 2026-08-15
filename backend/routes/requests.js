const express = require('express');
const router = express.Router();
const { query, queryOne, execute, withTransaction } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { calculateHaversineDistance, isBloodCompatible } = require('../utils/geoUtils');
const { calculateDonorEligibility } = require('../services/eligibilityEngine');
const { sendSmsOtp } = require('../services/smsService');
const { sendEmailOtp } = require('../services/emailService');
const { logAuditAction } = require('../utils/auditLogger');

const { InMemoryRateLimiter } = require('../utils/rateLimiter');

// Rate Limiter for Emergency Requests & Dispatches (Pruned automatically every 2 mins)
const requestRateLimiter = new InMemoryRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  cleanupIntervalMs: 2 * 60 * 1000
});

// ============================================================================
// 1. CREATE EMERGENCY BLOOD REQUEST (POST /api/requests)
// ============================================================================
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const rateLimitKey = `req_${req.user.id}_${req.ip}`;
    const rateCheck = requestRateLimiter.consume(rateLimitKey, 5, 10 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }

    const { 
      patient_name, blood_group, component, units_needed, hospital_name, hospital_address, 
      city, state, urgency_level, contact_number, required_by_date, latitude, longitude, hospital_id
    } = req.body;

    if (!patient_name || !blood_group || !units_needed || !hospital_name || !city || !state || !contact_number) {
      return res.status(400).json({ 
        success: false, 
        message: 'Required fields missing: patient_name, blood_group, units_needed, hospital_name, city, state, contact_number.' 
      });
    }

    const urgency = urgency_level || 'Urgent';

    // 🛡️ Hospital Verification Check for Critical Emergency Requests
    if (urgency.toLowerCase() === 'critical' || req.user.role === 'hospital') {
      const hospitalRec = await queryOne(
        `SELECT h.verification_status 
         FROM Hospitals h 
         WHERE h.user_id = ? OR h.id = ?`,
        [req.user.id, hospital_id || 0]
      );

      if (!hospitalRec || hospitalRec.verification_status !== 'VERIFIED') {
        return res.status(403).json({
          success: false,
          message: 'Your hospital account must be verified before creating a critical emergency request.'
        });
      }
    }

    const validComponents = ['WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP'];
    const comp = validComponents.includes(component) ? component : 'WHOLE_BLOOD';

    // 🛡️ Duplicate Emergency Request Prevention Check
    const existingActive = await queryOne(
      `SELECT id, created_at FROM BloodRequests 
       WHERE (hospital_id = ? OR requester_id = ?) 
         AND blood_group = ? 
         AND component = ? 
         AND status IN ('Pending', 'In Progress', 'APPROVED', 'MATCHING', 'SUBMITTED', 'VERIFICATION_PENDING')
       LIMIT 1`,
      [hospital_id || req.user.id, req.user.id, blood_group, comp]
    );

    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: 'An active emergency request already exists for this requirement.',
        existing_request_id: existingActive.id
      });
    }

    const initialStatus = (urgency.toLowerCase() === 'critical') ? 'APPROVED' : 'Pending';

    const result = await execute(
      `INSERT INTO BloodRequests 
        (requester_id, hospital_id, patient_name, blood_group, component, units_needed, units_fulfilled, hospital_name, hospital_address, city, state, urgency_level, status, contact_number, required_by_date, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        hospital_id || null,
        patient_name.trim(),
        blood_group,
        comp,
        parseInt(units_needed) || 1,
        hospital_name,
        hospital_address || `${hospital_name}, ${city}`,
        city,
        state,
        urgency,
        initialStatus,
        contact_number,
        required_by_date || null,
        latitude || null,
        longitude || null
      ]
    );

    const newRequest = await queryOne('SELECT * FROM BloodRequests WHERE id = ?', [result.insertId]);

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'emergency_request_created',
      entityType: 'BloodRequest',
      entityId: result.insertId,
      newValue: { patient_name, blood_group, component: comp, units_needed, urgency_level: urgency, status: initialStatus },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Emergency Blood Request created successfully!',
      request: newRequest
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. DISPATCH BATCHED EMERGENCY ALERTS (POST /api/requests/:id/dispatch-batch)
// ============================================================================
router.post('/:id/dispatch-batch', authenticateToken, async (req, res, next) => {
  try {
    const rateLimitKey = `dispatch_${req.user.id}_${req.params.id}`;
    const rateCheck = requestRateLimiter.consume(rateLimitKey, 3, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.'
      });
    }

    const request = await queryOne('SELECT * FROM BloodRequests WHERE id = ?', [req.params.id]);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Emergency request not found' });
    }

    const { batch_size, batch_number } = req.body;
    const limit = parseInt(batch_size) || 10;
    const offset = (parseInt(batch_number) > 1 ? (parseInt(batch_number) - 1) : 0) * limit;

    // Filter Donors: eligible + available + verified + emergency_alerts_enabled = 1 + available_for_donation = 1
    const allDonors = await query(`
      SELECT d.id, d.user_id, u.full_name, u.phone, u.email, d.blood_group, d.age, d.weight, d.last_donation_date, d.is_available,
             COALESCE(u.emergency_alerts_enabled, 1) as emergency_alerts_enabled,
             COALESCE(u.available_for_donation, 1) as available_for_donation,
             COALESCE(d.latitude, u.latitude) as latitude, COALESCE(d.longitude, u.longitude) as longitude,
             COALESCE(np.emergency_sms, 1) as emergency_sms,
             COALESCE(np.emergency_email, 1) as emergency_email,
             COALESCE(np.emergency_push, 1) as emergency_push
      FROM Donors d
      JOIN Users u ON d.user_id = u.id
      LEFT JOIN notification_preferences np ON np.user_id = u.id
      WHERE u.is_verified = 1 
        AND d.is_available = 1 
        AND COALESCE(u.emergency_alerts_enabled, 1) = 1
        AND COALESCE(u.available_for_donation, 1) = 1
    `);

    // Rank compatible & eligible donors by distance
    const rankedDonors = [];
    allDonors.forEach(donor => {
      if (isBloodCompatible(donor.blood_group, request.blood_group)) {
        const eligibility = calculateDonorEligibility(donor);
        if (eligibility.isEligible) {
          let dist = 999;
          if (request.latitude && request.longitude && donor.latitude && donor.longitude) {
            dist = calculateHaversineDistance(parseFloat(request.latitude), parseFloat(request.longitude), parseFloat(donor.latitude), parseFloat(donor.longitude));
          }
          rankedDonors.push({ ...donor, dist });
        }
      }
    });

    rankedDonors.sort((a, b) => a.dist - b.dist);
    const batchDonors = rankedDonors.slice(offset, offset + limit);

    let notifiedCount = 0;

    for (const donor of batchDonors) {
      const dedupKey = `req_${request.id}_donor_${donor.user_id}`;

      // Notification Deduplication Check
      const existingNotif = await queryOne(
        `SELECT id FROM Notifications WHERE user_id = ? AND dedup_key = ?`,
        [donor.user_id, dedupKey]
      );

      if (existingNotif) {
        continue; // Skip duplicate notification
      }

      // 1. In-App / Push Notification
      if (donor.emergency_push !== 0) {
        await execute(
          `INSERT INTO Notifications (user_id, title, message, type, channel, delivery_status, request_id, dedup_key) 
           VALUES (?, ?, ?, 'alert', 'Push', 'SENT', ?, ?)`,
          [
            donor.user_id,
            `🚨 URGENT EMERGENCY: ${request.blood_group} ${request.component || 'Blood'} Needed`,
            `Patient ${request.patient_name} requires ${request.units_needed} unit(s) of ${request.blood_group} at ${request.hospital_name}. Contact: ${request.contact_number}`,
            request.id,
            dedupKey
          ]
        );
      }

      // 2. Email Notification
      if (donor.emergency_email !== 0 && donor.email) {
        sendEmailOtp(donor.email, 'EMERGENCY_ALERT').catch((err) => {
          console.error(`[EMERGENCY ALERT EMAIL ERROR] Failed dispatch to ${donor.email}:`, err.message || err);
        });
      }

      // 3. SMS Notification
      if (donor.emergency_sms !== 0 && donor.phone) {
        sendSmsOtp(donor.phone, 'EMERGENCY').catch((err) => {
          console.error(`[EMERGENCY ALERT SMS ERROR] Failed dispatch to ${donor.phone}:`, err.message || err);
        });
      }

      notifiedCount += 1;
    }

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'emergency_batch_dispatched',
      entityType: 'BloodRequest',
      entityId: request.id,
      newValue: { batch_number: batch_number || 1, notified_count: notifiedCount },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Emergency alert dispatched to Batch ${batch_number || 1} (${notifiedCount} new compatible donors notified).`,
      notified_count: notifiedCount,
      total_compatible: rankedDonors.length
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. RESPOND / PLEDGE TO EMERGENCY REQUEST (POST /api/requests/:id/respond)
// ============================================================================
router.post('/:id/respond', authenticateToken, async (req, res, next) => {
  try {
    const request = await queryOne('SELECT * FROM BloodRequests WHERE id = ?', [req.params.id]);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Emergency request not found' });
    }

    await execute(
      `INSERT INTO emergency_responses (request_id, donor_user_id, response_type) VALUES (?, ?, 'PLEDGED')`,
      [request.id, req.user.id]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'emergency_donor_pledged',
      entityType: 'BloodRequest',
      entityId: request.id,
      newValue: { donor_user_id: req.user.id },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Thank you! Your pledge has been registered for this emergency request.'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 4. LIST BLOOD REQUESTS (GET /api/requests)
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    const { blood_group, component, urgency_level, status, city, state } = req.query;

    let sql = `
      SELECT r.*, u.full_name as requester_name
      FROM BloodRequests r
      JOIN Users u ON r.requester_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (blood_group && blood_group !== 'All' && blood_group !== 'All Blood Groups') {
      sql += ` AND r.blood_group = ?`;
      params.push(blood_group);
    }

    if (component && component !== 'All') {
      sql += ` AND r.component = ?`;
      params.push(component);
    }

    if (urgency_level && urgency_level !== 'All') {
      sql += ` AND r.urgency_level = ?`;
      params.push(urgency_level);
    }

    if (status && status !== 'All') {
      sql += ` AND r.status = ?`;
      params.push(status);
    }

    if (state && state !== 'All States' && state !== 'All') {
      sql += ` AND r.state = ?`;
      params.push(state);
    }

    if (city && city.trim() !== '') {
      sql += ` AND LOWER(r.city) LIKE LOWER(?)`;
      params.push(`%${city.trim()}%`);
    }

    sql += ` ORDER BY CASE WHEN r.urgency_level = 'Critical' THEN 1 WHEN r.urgency_level = 'Urgent' THEN 2 ELSE 3 END, r.created_at DESC`;

    const requests = await query(sql, params);
    
    // Privacy protection: omit internal lat/lng in public lists
    const sanitizedRequests = requests.map(r => {
      const { latitude, longitude, ...rest } = r;
      return rest;
    });

    return res.json({ success: true, count: sanitizedRequests.length, requests: sanitizedRequests });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 5. GET SINGLE REQUEST DETAILS (GET /api/requests/:id)
// ============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const request = await queryOne(
      `SELECT r.*, u.full_name as requester_name
       FROM BloodRequests r
       JOIN Users u ON r.requester_id = u.id
       WHERE r.id = ?`,
      [req.params.id]
    );

    if (!request) {
      return res.status(404).json({ success: false, message: 'Blood Request not found' });
    }

    const { latitude, longitude, ...sanitized } = request;
    return res.json({ success: true, request: sanitized });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 6. UPDATE REQUEST STATUS (PATCH /api/requests/:id/status)
// ============================================================================
router.patch('/:id/status', authenticateToken, async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const validStatuses = [
      'DRAFT', 'SUBMITTED', 'VERIFICATION_PENDING', 'APPROVED', 'MATCHING', 
      'RESERVED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CLOSED', 'REJECTED', 
      'CANCELLED', 'EXPIRED', 'Pending', 'In Progress', 'Fulfilled', 'Cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid request status value' });
    }

    const request = await queryOne('SELECT * FROM BloodRequests WHERE id = ?', [req.params.id]);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Blood Request not found' });
    }

    if (request.requester_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'hospital') {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this request' });
    }

    await execute(
      'UPDATE BloodRequests SET status = ?, status_reason = ? WHERE id = ?', 
      [status, reason || null, req.params.id]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: `request_status_${status.toLowerCase()}`,
      entityType: 'BloodRequest',
      entityId: request.id,
      oldValue: { status: request.status },
      newValue: { status, reason },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: `Request status updated to ${status}` });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 7. ATOMIC FULFILL UNITS (POST /api/requests/:id/fulfill)
// ============================================================================
/**
 * Fulfills requested blood units with ACID transaction & row-level locking.
 * 
 * 🎓 CONCURRENCY & INTEGRITY EXPLANATION:
 * When multiple hospitals or donors attempt to fulfill the same emergency request concurrently,
 * a naive read-modify-write causes "Lost Updates" where both read units_fulfilled=0, add 1, and write 1.
 * 
 * By executing within `withTransaction` and acquiring an exclusive row lock (`SELECT ... FOR UPDATE`),
 * MySQL/InnoDB queues concurrent fulfillment requests, recalculates `units_fulfilled` based on the latest committed
 * state, guarantees that `units_fulfilled` never exceeds `units_needed`, and transitions status to `FULFILLED` safely.
 */
router.post('/:id/fulfill', authenticateToken, async (req, res, next) => {
  try {
    const { units } = req.body;
    const parsedUnits = parseInt(units, 10);

    if (isNaN(parsedUnits) || parsedUnits <= 0) {
      return res.status(400).json({ success: false, message: 'Units must be a positive integer greater than 0.' });
    }
    const addUnits = parsedUnits;

    const updatedRequest = await withTransaction(async (conn) => {
      // 1. Acquire exclusive row lock on target blood request record
      const selectSql = 'SELECT * FROM BloodRequests WHERE id = ? FOR UPDATE';
      let request;
      if (typeof conn.execute === 'function') {
        const [rows] = await conn.execute(selectSql, [req.params.id]);
        request = rows[0];
      } else {
        const rows = await conn.query(selectSql, [req.params.id]);
        request = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
      }

      if (!request) {
        const err = new Error('Emergency request not found');
        err.statusCode = 404;
        throw err;
      }

      // 2. State & Over-Fulfillment Check
      const terminalStatuses = ['FULFILLED', 'CLOSED', 'CANCELLED', 'REJECTED', 'EXPIRED'];
      if (terminalStatuses.includes(request.status)) {
        const err = new Error(`Cannot fulfill request with status '${request.status}'. This request is already completed or closed.`);
        err.statusCode = 400;
        throw err;
      }

      const currentFulfilled = parseInt(request.units_fulfilled, 10) || 0;
      const unitsNeeded = parseInt(request.units_needed, 10) || 1;
      const remainingNeeded = Math.max(0, unitsNeeded - currentFulfilled);

      if (remainingNeeded <= 0) {
        const err = new Error('This request has already been completely fulfilled.');
        err.statusCode = 400;
        throw err;
      }

      const actualUnitsAdded = Math.min(addUnits, remainingNeeded);
      const newFulfilled = currentFulfilled + actualUnitsAdded;
      const newStatus = newFulfilled >= unitsNeeded ? 'FULFILLED' : 'PARTIALLY_FULFILLED';

      // 3. Atomically update request status and fulfilled count
      const updateSql = 'UPDATE BloodRequests SET units_fulfilled = ?, status = ? WHERE id = ?';
      if (typeof conn.execute === 'function') {
        await conn.execute(updateSql, [newFulfilled, newStatus, req.params.id]);
      } else {
        await conn.query(updateSql, [newFulfilled, newStatus, req.params.id]);
      }

      return {
        id: request.id,
        units_fulfilled: newFulfilled,
        status: newStatus,
        units_added: actualUnitsAdded,
        units_needed: unitsNeeded
      };
    });

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'request_fulfilled',
      entityType: 'BloodRequest',
      entityId: updatedRequest.id,
      newValue: {
        units_fulfilled: updatedRequest.units_fulfilled,
        status: updatedRequest.status,
        units_added: updatedRequest.units_added
      },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Successfully contributed ${updatedRequest.units_added} unit(s) to emergency request!`,
      units_fulfilled: updatedRequest.units_fulfilled,
      status: updatedRequest.status
    });

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
});

module.exports = router;
