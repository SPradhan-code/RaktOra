const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { calculateDonorEligibility } = require('../services/eligibilityEngine');
const { logAuditAction } = require('../utils/auditLogger');

router.use(authenticateToken);

/**
 * Helper to enforce object-level authorization on appointments.
 * Rules:
 * - Non-existent appointment -> 404 Not Found
 * - Admin: Allowed access to any appointment.
 * - Donor: Allowed if appt.donor_id === currentDonor.id.
 * - Blood Bank: Allowed if appt.blood_bank_id === currentBank.id.
 * - Others: 403 Forbidden.
 * - Data is NEVER leaked before authorization succeeds.
 */
async function getAuthorizedAppointment(req, apptId, allowedActors = ['donor', 'blood_bank', 'admin']) {
  const appt = await db.queryOne('SELECT * FROM appointments WHERE id = ?', [apptId]);
  if (!appt) {
    return { status: 404, message: 'Appointment not found', appt: null };
  }

  // 1. Admin Override
  if (req.user.role === 'admin' && allowedActors.includes('admin')) {
    return { status: 200, appt };
  }

  // 2. Donor Object Ownership Check
  if (req.user.role === 'donor' && allowedActors.includes('donor')) {
    const donor = await db.queryOne('SELECT id FROM Donors WHERE user_id = ?', [req.user.id]);
    if (donor && donor.id === appt.donor_id) {
      return { status: 200, appt, donor };
    }
    return { status: 403, message: 'Forbidden: You are not authorized to access or modify this appointment.', appt: null };
  }

  // 3. Blood Bank Facility Ownership Check
  if (req.user.role === 'blood_bank' && allowedActors.includes('blood_bank')) {
    const bank = await db.queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
    if (bank && bank.id === appt.blood_bank_id) {
      return { status: 200, appt, bank };
    }
    return { status: 403, message: 'Forbidden: This appointment belongs to a different blood bank center.', appt: null };
  }

  return { status: 403, message: 'Forbidden: Access denied for your role.', appt: null };
}

// ============================================================================
// 1. GET DONOR'S APPOINTMENTS (GET /api/appointments/me)
// ============================================================================
router.get('/me', requireRole(['donor', 'admin']), async (req, res, next) => {
  try {
    const donor = await db.queryOne('SELECT id FROM Donors WHERE user_id = ?', [req.user.id]);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor profile not found' });
    }

    const appointments = await db.query(
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
// 2. GET SINGLE APPOINTMENT DETAIL (GET /api/appointments/:id)
// ============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const auth = await getAuthorizedAppointment(req, req.params.id, ['donor', 'blood_bank', 'admin']);
    if (auth.status !== 200) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const appointmentDetail = await db.queryOne(
      `SELECT a.*, 
              b.name as blood_bank_name, b.full_address as blood_bank_address, b.phone as bank_phone, b.city as bank_city, b.state as bank_state,
              d.blood_group, d.age, d.gender,
              u.full_name as donor_name, u.phone as donor_phone, u.email as donor_email
       FROM appointments a
       JOIN BloodBanks b ON a.blood_bank_id = b.id
       JOIN Donors d ON a.donor_id = d.id
       JOIN Users u ON d.user_id = u.id
       WHERE a.id = ?`,
      [auth.appt.id]
    );

    return res.json({ success: true, appointment: appointmentDetail || auth.appt });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. BOOK APPOINTMENT WITH ELIGIBILITY CHECK (POST /api/appointments)
// ============================================================================
router.post('/', requireRole(['donor', 'admin']), async (req, res, next) => {
  try {
    const donor = await db.queryOne('SELECT * FROM Donors WHERE user_id = ?', [req.user.id]);
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
    const existing = await db.queryOne(
      `SELECT id FROM appointments 
       WHERE donor_id = ? AND date = ? AND status IN ('BOOKED', 'CONFIRMED')`,
      [donor.id, date]
    );

    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have an active appointment scheduled for this date.' });
    }

    const endTimeVal = end_time || `${parseInt(start_time.split(':')[0]) + 1}:00`;

    const apptResult = await db.execute(
      `INSERT INTO appointments (donor_id, blood_bank_id, date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, ?, 'BOOKED')`,
      [donor.id, blood_bank_id, date, start_time, endTimeVal]
    );

    // Notify donor via in-app notification
    await db.execute(
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
// 4. RESCHEDULE APPOINTMENT (PATCH /api/appointments/:id/reschedule)
// ============================================================================
router.patch('/:id/reschedule', async (req, res, next) => {
  try {
    const { date, start_time, end_time } = req.body;
    if (!date || !start_time) {
      return res.status(400).json({ success: false, message: 'New date and start time are required.' });
    }

    // 🛡️ Object-Level Authorization: Only owning donor, designated blood bank, or admin
    const auth = await getAuthorizedAppointment(req, req.params.id, ['donor', 'blood_bank', 'admin']);
    if (auth.status !== 200) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const endTimeVal = end_time || `${parseInt(start_time.split(':')[0]) + 1}:00`;

    await db.execute(
      `UPDATE appointments SET date = ?, start_time = ?, end_time = ?, status = 'RESCHEDULED' WHERE id = ?`,
      [date, start_time, endTimeVal, auth.appt.id]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'appointment_rescheduled',
      entityType: 'Appointment',
      entityId: auth.appt.id,
      oldValue: { date: auth.appt.date, start_time: auth.appt.start_time },
      newValue: { date, start_time },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Appointment rescheduled successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 5. CANCEL APPOINTMENT (PATCH /api/appointments/:id/cancel)
// ============================================================================
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    // 🛡️ Object-Level Authorization: Only owning donor, designated blood bank, or admin
    const auth = await getAuthorizedAppointment(req, req.params.id, ['donor', 'blood_bank', 'admin']);
    if (auth.status !== 200) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    await db.execute(`UPDATE appointments SET status = 'CANCELLED' WHERE id = ?`, [auth.appt.id]);

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'appointment_cancelled',
      entityType: 'Appointment',
      entityId: auth.appt.id,
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Appointment cancelled successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 6. GET BLOOD BANK'S APPOINTMENTS (GET /api/appointments/bank)
// ============================================================================
router.get('/bank', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    let bankId = null;
    if (req.user.role === 'blood_bank') {
      const bank = await db.queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
      if (!bank) {
        return res.status(404).json({ success: false, message: 'Blood Bank profile not found' });
      }
      bankId = bank.id;
    } else if (req.user.role === 'admin') {
      bankId = req.query.blood_bank_id || null;
    }

    let appointmentsQuery = `
      SELECT a.*, d.blood_group, d.age, d.gender, u.full_name as donor_name, u.phone as donor_phone, u.email as donor_email
      FROM appointments a
      JOIN Donors d ON a.donor_id = d.id
      JOIN Users u ON d.user_id = u.id
    `;
    const params = [];

    if (bankId) {
      appointmentsQuery += ' WHERE a.blood_bank_id = ?';
      params.push(bankId);
    }

    appointmentsQuery += ' ORDER BY a.date DESC, a.start_time ASC';

    const appointments = await db.query(appointmentsQuery, params);

    return res.json({ success: true, appointments });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 7. BLOOD BANK UPDATE APPOINTMENT STATUS (PATCH /api/appointments/:id/status)
// ============================================================================
router.patch('/:id/status', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    // 🛡️ Object-Level Authorization: Only designated blood bank or admin
    const auth = await getAuthorizedAppointment(req, req.params.id, ['blood_bank', 'admin']);
    if (auth.status !== 200) {
      return res.status(auth.status).json({ success: false, message: auth.message });
    }

    const appt = auth.appt;

    await db.execute(`UPDATE appointments SET status = ? WHERE id = ?`, [status, appt.id]);

    // If COMPLETED, record completed donation & update donor stats
    if (status === 'COMPLETED') {
      await db.execute(
        `UPDATE Donors SET total_donations = total_donations + 1, last_donation_date = ? WHERE id = ?`,
        [appt.date, appt.donor_id]
      );

      const certCode = `CERT-RKTR-${Date.now().toString().slice(-6)}`;
      await db.execute(
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
