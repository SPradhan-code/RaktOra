const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ============================================================================
// 1. LIST DONATION CAMPS (GET /api/camps)
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    const { status, state, city } = req.query;

    let sql = `
      SELECT c.*, b.name as blood_bank_name
      FROM DonationCamps c
      LEFT JOIN BloodBanks b ON c.blood_bank_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      sql += ` AND c.status = ?`;
      params.push(status);
    }

    if (state && state !== 'All States' && state !== 'All') {
      sql += ` AND c.state = ?`;
      params.push(state);
    }

    if (city && city.trim() !== '') {
      sql += ` AND LOWER(c.city) LIKE LOWER(?)`;
      params.push(`%${city.trim()}%`);
    }

    sql += ` ORDER BY c.date ASC`;

    const camps = await query(sql, params);
    return res.json({ success: true, count: camps.length, camps });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. CREATE NEW DONATION CAMP (POST /api/camps)
// ============================================================================
router.post('/', authenticateToken, requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const { 
      organizer_name, camp_title, date, time_start, time_end, 
      venue_address, city, state, expected_donors 
    } = req.body;

    if (!organizer_name || !camp_title || !date || !time_start || !time_end || !venue_address || !city || !state) {
      return res.status(400).json({ 
        success: false, 
        message: 'Required fields missing: organizer_name, camp_title, date, time_start, time_end, venue_address, city, state are mandatory.' 
      });
    }

    let bankId = null;
    if (req.user.role === 'blood_bank') {
      const bank = await queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
      if (bank) bankId = bank.id;
    }

    const result = await execute(
      `INSERT INTO DonationCamps 
        (blood_bank_id, organizer_name, camp_title, date, time_start, time_end, venue_address, city, state, expected_donors, registered_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'Upcoming')`,
      [
        bankId,
        organizer_name,
        camp_title,
        date,
        time_start,
        time_end,
        venue_address,
        city,
        state,
        expected_donors || 100
      ]
    );

    const newCamp = await queryOne('SELECT * FROM DonationCamps WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Donation Camp published successfully!',
      camp: newCamp
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. REGISTER FOR DONATION CAMP (POST /api/camps/:id/register)
// ============================================================================
router.post('/:id/register', authenticateToken, async (req, res, next) => {
  try {
    const campId = req.params.id;

    const camp = await queryOne('SELECT * FROM DonationCamps WHERE id = ?', [campId]);
    if (!camp) {
      return res.status(404).json({ success: false, message: 'Donation Camp not found' });
    }

    // Check existing registration
    const existing = await queryOne(
      'SELECT id FROM CampRegistrations WHERE camp_id = ? AND donor_user_id = ?',
      [campId, req.user.id]
    );

    if (existing) {
      return res.status(400).json({ success: false, message: 'You are already registered for this donation camp.' });
    }

    await execute(
      'INSERT INTO CampRegistrations (camp_id, donor_user_id, status) VALUES (?, ?, "Registered")',
      [campId, req.user.id]
    );

    // Increment registered count
    await execute(
      'UPDATE DonationCamps SET registered_count = registered_count + 1 WHERE id = ?',
      [campId]
    );

    return res.json({
      success: true,
      message: `Successfully registered for ${camp.camp_title}! Details sent to your contact.`
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
