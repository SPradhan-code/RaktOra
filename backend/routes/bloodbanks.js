const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ============================================================================
// 1. LIST APPROVED BLOOD BANKS (GET /api/bloodbanks)
// ============================================================================
router.get('/', async (req, res, next) => {
  try {
    const { state, city, search } = req.query;

    let sql = `
      SELECT b.*, u.full_name as owner_name, u.email as user_email
      FROM BloodBanks b
      JOIN Users u ON b.user_id = u.id
      WHERE b.is_approved = 1
    `;
    const params = [];

    if (state && state !== 'All States' && state !== 'All') {
      sql += ` AND b.state = ?`;
      params.push(state);
    }

    if (city && city.trim() !== '') {
      sql += ` AND LOWER(b.city) LIKE LOWER(?)`;
      params.push(`%${city.trim()}%`);
    }

    if (search) {
      sql += ` AND (LOWER(b.name) LIKE LOWER(?) OR LOWER(b.license_number) LIKE LOWER(?))`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY b.name ASC`;

    const banks = await query(sql, params);

    // Attach stock matrix for each bank
    for (const bank of banks) {
      const stockRows = await query('SELECT blood_group, units_available FROM BloodStock WHERE blood_bank_id = ?', [bank.id]);
      const stockMap = {};
      stockRows.forEach(row => {
        stockMap[row.blood_group] = row.units_available;
      });
      bank.stock = stockMap;
    }

    return res.json({ success: true, count: banks.length, bloodBanks: banks });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. GET SINGLE BLOOD BANK DETAILS (GET /api/bloodbanks/:id)
// ============================================================================
router.get('/:id', async (req, res, next) => {
  try {
    const bank = await queryOne(
      `SELECT b.*, u.full_name as owner_name, u.email as user_email
       FROM BloodBanks b JOIN Users u ON b.user_id = u.id
       WHERE b.id = ? OR b.user_id = ?`,
      [req.params.id, req.params.id]
    );

    if (!bank) {
      return res.status(404).json({ success: false, message: 'Blood Bank center not found' });
    }

    const stockRows = await query('SELECT blood_group, units_available, updated_at FROM BloodStock WHERE blood_bank_id = ?', [bank.id]);
    const stockMap = {};
    stockRows.forEach(row => {
      stockMap[row.blood_group] = row.units_available;
    });

    bank.stock = stockMap;
    bank.stock_list = stockRows;

    return res.json({ success: true, bloodBank: bank });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. GET CURRENT LOGGED-IN BLOOD BANK STOCK (GET /api/bloodbanks/stock/me)
// ============================================================================
router.get('/stock/me', authenticateToken, requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const bank = await queryOne('SELECT id, name, license_number FROM BloodBanks WHERE user_id = ?', [req.user.id]);
    if (!bank) {
      return res.status(404).json({ success: false, message: 'Blood Bank profile not found' });
    }

    const stock = await query('SELECT id, blood_group, units_available, updated_at FROM BloodStock WHERE blood_bank_id = ? ORDER BY blood_group ASC', [bank.id]);

    return res.json({ success: true, bloodBank: bank, stock });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 4. UPDATE INVENTORY STOCK UNITS (PUT /api/bloodbanks/stock/update)
// ============================================================================
router.put('/stock/update', authenticateToken, requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const { blood_group, units_available } = req.body;

    if (!blood_group || units_available === undefined) {
      return res.status(400).json({ success: false, message: 'blood_group and units_available are required' });
    }

    const bank = await queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
    if (!bank) {
      return res.status(404).json({ success: false, message: 'Blood Bank profile not found' });
    }

    await execute(
      `INSERT INTO BloodStock (blood_bank_id, blood_group, units_available)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE units_available = ?`,
      [bank.id, blood_group, Math.max(0, parseInt(units_available, 10)), Math.max(0, parseInt(units_available, 10))]
    );

    return res.json({
      success: true,
      message: `Stock updated for blood group ${blood_group} to ${units_available} units.`
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
