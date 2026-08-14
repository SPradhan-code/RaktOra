const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { calculateDonorEligibility } = require('../services/eligibilityEngine');
const { logAuditAction } = require('../utils/auditLogger');

router.use(authenticateToken);

// ============================================================================
// 1. GET DONOR'S APPOINTMENTS (GET /api/appointments/me)
// ============================================================================
router.get('/me', requireRole(['donor', 'admin']), async (req, res, next) => {
  try {
    const donor = await queryOne('SELECT id FROM Donors WHERE user_id = ?', [req.user.id]);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor profile not found' });
    }

    const appointments = await query(
      `SELECT a.*, b.name as blood_bank_name, b.full_address, b.phone as bank_phone, b.city, b.state
       FROM appointments a
       JOIN BloodBanks b ON a.blood_bank_id = b.id
       WHERE a.donor_id = ?
       ORDER BY a.date DESC, a.start_time ASC`,
      [donor.id]
    );

    return res.json({ success: true, appointments });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. BOOK APPOINTMENT WITH ELIGIBILITY CHECK (POST /api/appointments)
// ============================================================================
router.post('/', requireRole(['donor', 'admin']), async (req, res, next) => {
  try {
    const donor = await queryOne('SELECT * FROM Donors WHERE user_id = ?', [req.user.id]);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor profile not found' });
    }

    const { blood_bank_id, date, start_time, end_time, healthQuestionnaire } = req.body;

    if (!blood_bank_id || !date || !start_time) {
      return res.status(400).json({ success: false, message: 'Blood bank, date, and time slot are required.' });
    }

    // 1. Enforce Donor Eligibility Check
    const eligibility = calculateDonorEligibility(donor, healthQuestionnaire || {});
    if (!eligibility.isEligible && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Ineligible to book appointment: ' + eligibility.reasons.join(' '),
        eligibility
      });
    }

    // 2. Prevent Double Booking on the same date
    const existing = await queryOne(
      `SELECT id FROM appointments 
       WHERE donor_id = ? AND date = ? AND status IN ('BOOKED', 'CONFIRMED')`,
      [donor.id, date]
    );

    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have an active appointment scheduled for this date.' });
    }

    const endTimeVal = end_time || `${parseInt(start_time.split(':')[0]) + 1}:00`;

    const apptResult = await execute(
      `INSERT INTO appointments (donor_id, blood_bank_id, date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, 'BOOKED')`,
      [donor.id, blood_bank_id, date, start_time, endTimeVal]
    );

    // Notify donor via in-app notification
    await execute(
      `INSERT INTO Notifications (user_id, title, message, type)
       VALUES (?, 'Appointment Booked', ?, 'info')`,
      [req.user.id, `Your blood donation appointment is scheduled for ${date} at ${start_time}.`]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'appointment_booked',
      entityType: 'Appointment',
      entityId: apptResult.insertId,
      newValue: { blood_bank_id, date, start_time },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Donation appointment booked successfully!',
      appointmentId: apptResult.insertId
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. RESCHEDULE APPOINTMENT (PATCH /api/appointments/:id/reschedule)
// ============================================================================
router.patch('/:id/reschedule', async (req, res, next) => {
  try {
    const { date, start_time, end_time } = req.body;
    if (!date || !start_time) {
      return res.status(400).json({ success: false, message: 'New date and start time are required.' });
    }

    const appt = await queryOne('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const endTimeVal = end_time || `${parseInt(start_time.split(':')[0]) + 1}:00`;

    await execute(
      `UPDATE appointments SET date = ?, start_time = ?, end_time = ?, status = 'RESCHEDULED' WHERE id = ?`,
      [date, start_time, endTimeVal, appt.id]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'appointment_rescheduled',
      entityType: 'Appointment',
      entityId: appt.id,
      oldValue: { date: appt.date, start_time: appt.start_time },
      newValue: { date, start_time },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Appointment rescheduled successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 4. CANCEL APPOINTMENT (PATCH /api/appointments/:id/cancel)
// ============================================================================
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const appt = await queryOne('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    await execute(`UPDATE appointments SET status = 'CANCELLED' WHERE id = ?`, [appt.id]);

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'appointment_cancelled',
      entityType: 'Appointment',
      entityId: appt.id,
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 5. GET BLOOD BANK'S APPOINTMENTS (GET /api/appointments/bank)
// ============================================================================
router.get('/bank', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const bank = await queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
    if (!bank && req.user.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Blood Bank profile not found' });
    }

    const bankId = bank ? bank.id : req.query.blood_bank_id;

    const appointments = await query(
      `SELECT a.*, d.blood_group, d.age, d.gender, u.full_name as donor_name, u.phone as donor_phone, u.email as donor_email
       FROM appointments a
       JOIN Donors d ON a.donor_id = d.id
       JOIN Users u ON d.user_id = u.id
       WHERE a.blood_bank_id = ?
       ORDER BY a.date DESC, a.start_time ASC`,
      [bankId]
    );

    return res.json({ success: true, appointments });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 6. BLOOD BANK UPDATE APPOINTMENT STATUS (PATCH /api/appointments/:id/status)
// ============================================================================
router.patch('/:id/status', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const appt = await queryOne('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if (!appt) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    await execute(`UPDATE appointments SET status = ? WHERE id = ?`, [status, appt.id]);

    // If COMPLETED, record completed donation & update donor stats
    if (status === 'COMPLETED') {
      await execute(
        `UPDATE Donors SET total_donations = total_donations + 1, last_donation_date = ? WHERE id = ?`,
        [appt.date, appt.donor_id]
      );

      const certCode = `CERT-RKTR-${Date.now().toString().slice(-6)}`;
      await execute(
        `INSERT INTO DonationHistory (donor_id, blood_bank_id, units_donated, donation_date, certificate_code)
         VALUES (?, ?, 1, ?, ?)`,
        [appt.donor_id, appt.blood_bank_id, appt.date, certCode]
      );
    }

    await logAuditAction({
      actorUserId: req.user.id,
      action: `appointment_${status.toLowerCase()}`,
      entityType: 'Appointment',
      entityId: appt.id,
      oldValue: { status: appt.status },
      newValue: { status },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: `Appointment status updated to ${status}` });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
