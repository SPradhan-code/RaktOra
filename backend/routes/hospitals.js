const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../utils/auditLogger');

// All hospital routes require authentication and 'hospital' role
router.use(authenticateToken);
router.use(requireRole(['hospital', 'admin']));

// ============================================================================
// 1. GET CURRENT HOSPITAL PROFILE (GET /api/hospitals/me)
// ============================================================================
router.get('/me', async (req, res, next) => {
  try {
    const hospital = await queryOne(
      `SELECT h.*, u.full_name, u.email, u.phone, u.state, u.city, u.pincode
       FROM Hospitals h
       JOIN Users u ON h.user_id = u.id
       WHERE h.user_id = ?`,
      [req.user.id]
    );

    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    return res.json({ success: true, hospital });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. UPDATE HOSPITAL PROFILE (PUT /api/hospitals/profile)
// ============================================================================
router.put('/profile', async (req, res, next) => {
  try {
    const { contact_person, phone, full_address, pincode, latitude, longitude } = req.body;
    const hospital = await queryOne('SELECT id FROM Hospitals WHERE user_id = ?', [req.user.id]);

    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    await execute(
      `UPDATE Hospitals 
       SET contact_person = ?, phone = ?, full_address = ?, pincode = ?, latitude = ?, longitude = ?
       WHERE id = ?`,
      [contact_person || '', phone || '', full_address || '', pincode || '', latitude || null, longitude || null, hospital.id]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'hospital_profile_updated',
      entityType: 'Hospital',
      entityId: hospital.id,
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Hospital profile updated successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. GET HOSPITAL'S BLOOD & EMERGENCY REQUESTS (GET /api/hospitals/requests)
// ============================================================================
router.get('/requests', async (req, res, next) => {
  try {
    const hospital = await queryOne('SELECT id FROM Hospitals WHERE user_id = ?', [req.user.id]);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    const requests = await query(
      `SELECT * FROM BloodRequests WHERE hospital_id = ? OR requester_id = ? ORDER BY id DESC`,
      [hospital.id, req.user.id]
    );

    return res.json({ success: true, requests });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 4. CREATE OFFICIAL HOSPITAL REQUEST (POST /api/hospitals/requests)
// ============================================================================
router.post('/requests', async (req, res, next) => {
  try {
    const hospital = await queryOne('SELECT * FROM Hospitals WHERE user_id = ?', [req.user.id]);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found' });
    }

    if (hospital.verification_status !== 'VERIFIED' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only VERIFIED hospitals can create official blood or emergency requests. Your verification status is currently ' + hospital.verification_status
      });
    }

    const { patient_name, blood_group, component, units_needed, urgency_level, contact_number, required_by_date, latitude, longitude } = req.body;

    if (!patient_name || !blood_group || !units_needed) {
      return res.status(400).json({ success: false, message: 'Patient name, blood group, and units required are mandatory.' });
    }

    const validComponents = ['WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP'];
    const selectedComponent = validComponents.includes(component) ? component : 'WHOLE_BLOOD';

    const reqResult = await execute(
      `INSERT INTO BloodRequests (
        requester_id, hospital_id, patient_name, blood_group, component, units_needed, units_fulfilled,
        hospital_name, hospital_address, city, state, urgency_level, status, contact_number, required_by_date, latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?)`,
      [
        req.user.id,
        hospital.id,
        patient_name.trim(),
        blood_group,
        selectedComponent,
        parseInt(units_needed),
        hospital.name,
        hospital.full_address,
        hospital.city,
        hospital.state,
        urgency_level || 'Urgent',
        contact_number || hospital.phone,
        required_by_date || null,
        latitude || hospital.latitude,
        longitude || hospital.longitude
      ]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'hospital_request_created',
      entityType: 'BloodRequest',
      entityId: reqResult.insertId,
      newValue: { patient_name, blood_group, component: selectedComponent, units_needed, urgency_level },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Official hospital request created successfully',
      requestId: reqResult.insertId
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
