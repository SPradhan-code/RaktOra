const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../utils/auditLogger');

router.use(authenticateToken);

/**
 * Helper to generate unique Unit ID
 */
function generateUnitId(bloodGroup, component) {
  const cleanBg = bloodGroup.replace('+', 'P').replace('-', 'N');
  const rand = crypto.randomInt(10000, 99999);
  return `UNT-${cleanBg}-${component.slice(0, 4)}-${rand}`;
}

/**
 * State Transition Matrix Validator
 */
function isValidStateTransition(fromStatus, toStatus, testingStatus = 'PASSED') {
  if (fromStatus === toStatus) return true;

  const allowedMap = {
    'COLLECTED': ['TESTING', 'QUARANTINED', 'DISCARDED'],
    'TESTING': testingStatus === 'PASSED' ? ['AVAILABLE', 'QUARANTINED', 'DISCARDED'] : ['QUARANTINED', 'DISCARDED'],
    'AVAILABLE': ['RESERVED', 'ISSUED', 'EXPIRED', 'DISCARDED', 'QUARANTINED'],
    'RESERVED': ['ISSUED', 'AVAILABLE', 'DISCARDED'],
    'ISSUED': ['TRANSFUSED', 'DISCARDED'],
    'TRANSFUSED': [], // Terminal
    'EXPIRED': ['DISCARDED'], // Terminal
    'DISCARDED': [], // Terminal
    'QUARANTINED': ['TESTING', 'DISCARDED']
  };

  const allowedNext = allowedMap[fromStatus] || ['AVAILABLE', 'RESERVED', 'ISSUED', 'EXPIRED', 'DISCARDED'];
  return allowedNext.includes(toStatus);
}

// ============================================================================
// 1. GET BLOOD UNITS & EXPIRY ALERTS FOR BLOOD BANK (GET /api/bloodunits)
// ============================================================================
router.get('/', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    let bankId;
    if (req.user.role === 'admin' && req.query.blood_bank_id) {
      bankId = req.query.blood_bank_id;
    } else {
      const bank = await db.queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
      if (!bank) {
        return res.status(404).json({ success: false, message: 'Blood Bank profile not found' });
      }
      bankId = bank.id;
    }

    // Auto-update expired units in DB
    await db.execute(
      `UPDATE blood_units 
       SET status = 'EXPIRED' 
       WHERE blood_bank_id = ? AND status IN ('AVAILABLE', 'TESTING') AND expiry_date < CURRENT_DATE()`,
      [bankId]
    );

    const units = await db.query(
      `SELECT * FROM blood_units WHERE blood_bank_id = ? ORDER BY expiry_date ASC`,
      [bankId]
    );

    // Summary calculation
    const today = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(today.getDate() + 3);

    let expiringSoonCount = 0;
    let expiredCount = 0;
    let availableCount = 0;

    units.forEach(u => {
      const expDate = new Date(u.expiry_date);
      if (u.status === 'AVAILABLE') {
        availableCount++;
        if (expDate >= today && expDate <= threeDaysLater) {
          expiringSoonCount++;
        }
      } else if (u.status === 'EXPIRED') {
        expiredCount++;
      }
    });

    return res.json({
      success: true,
      units,
      summary: {
        total: units.length,
        available: availableCount,
        expiringSoon: expiringSoonCount,
        expired: expiredCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. ATOMIC BLOOD UNIT REGISTRATION (POST /api/bloodunits)
// ============================================================================
/**
 * Registers blood units and synchronizes the aggregate stock table atomically.
 */
router.post('/', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const bank = await db.queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
    if (!bank && req.user.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Blood Bank profile not found' });
    }
    const bankId = bank ? bank.id : req.body.blood_bank_id;

    const { blood_group, component, collection_date, expiry_date, quantity, donation_id, testing_status } = req.body;

    if (!blood_group || !collection_date || !expiry_date) {
      return res.status(400).json({ success: false, message: 'Blood group, collection date, and expiry date are required.' });
    }

    const validComponents = ['WHOLE_BLOOD', 'PRBC', 'PLATELETS', 'FFP', 'CRYOPRECIPITATE', 'SDP'];
    const comp = validComponents.includes(component) ? component : 'WHOLE_BLOOD';
    const count = parseInt(quantity, 10) || 1;
    const testStatus = testing_status || 'PASSED';
    const initialStatus = testStatus === 'PASSED' ? 'AVAILABLE' : 'TESTING';

    const insertedIds = await db.withTransaction(async (conn) => {
      const ids = [];
      for (let i = 0; i < count; i++) {
        const uId = generateUnitId(blood_group, comp);
        const insertSql = `
          INSERT INTO blood_units (unit_id, blood_group, component, collection_date, expiry_date, blood_bank_id, status, testing_status, donation_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        let resIns;
        if (typeof conn.execute === 'function') {
          [resIns] = await conn.execute(insertSql, [uId, blood_group, comp, collection_date, expiry_date, bankId, initialStatus, testStatus, donation_id || null]);
        } else {
          resIns = await conn.query(insertSql, [uId, blood_group, comp, collection_date, expiry_date, bankId, initialStatus, testStatus, donation_id || null]);
        }
        ids.push(resIns.insertId || resIns.insertId);
      }

      // Also update aggregate stock matrix in BloodStock atomically
      if (initialStatus === 'AVAILABLE') {
        const stockSql = `
          INSERT INTO BloodStock (blood_bank_id, blood_group, component, units_available)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE units_available = units_available + ?
        `;
        if (typeof conn.execute === 'function') {
          await conn.execute(stockSql, [bankId, blood_group, comp, count, count]);
        } else {
          await conn.query(stockSql, [bankId, blood_group, comp, count, count]);
        }
      }

      return ids;
    });

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'blood_units_created',
      entityType: 'BloodUnit',
      entityId: insertedIds[0],
      newValue: { count, blood_group, component: comp, collection_date, expiry_date, status: initialStatus },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: `Successfully registered ${count} blood unit(s)`,
      count
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. ATOMIC UNIT LIFECYCLE STATUS (PATCH /api/bloodunits/:id/status)
// ============================================================================
/**
 * Updates blood unit lifecycle status and synchronizes BloodStock counts atomically with row locking.
 */
router.patch('/:id/status', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const { status, testing_status } = req.body;
    const validStatuses = ['COLLECTED', 'TESTING', 'AVAILABLE', 'RESERVED', 'ISSUED', 'TRANSFUSED', 'EXPIRED', 'DISCARDED', 'QUARANTINED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    let bankId = null;
    if (req.user.role === 'blood_bank') {
      const bank = await db.queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
      if (!bank) {
        return res.status(404).json({ success: false, message: 'Blood Bank profile not found' });
      }
      bankId = bank.id;
    }

    const auditInfo = await db.withTransaction(async (conn) => {
      // 1. Lock blood unit row
      const selectSql = 'SELECT * FROM blood_units WHERE id = ? FOR UPDATE';
      let unit;
      if (typeof conn.execute === 'function') {
        const [rows] = await conn.execute(selectSql, [req.params.id]);
        unit = rows[0];
      } else {
        const rows = await conn.query(selectSql, [req.params.id]);
        unit = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
      }

      if (!unit) {
        const err = new Error('Blood unit not found');
        err.statusCode = 404;
        throw err;
      }

      // Object-Level Authorization
      if (bankId && unit.blood_bank_id !== bankId) {
        const err = new Error('Forbidden: You do not have permission to manage blood units of another facility.');
        err.statusCode = 403;
        throw err;
      }

      const newTestStatus = testing_status || unit.testing_status || 'PASSED';

      // Enforce State Transition Rules
      if (!isValidStateTransition(unit.status, status, newTestStatus)) {
        const err = new Error(`Invalid state transition from ${unit.status} to ${status}.`);
        err.statusCode = 400;
        throw err;
      }

      // Prevent issuing expired or un-tested units
      if (status === 'ISSUED' && new Date() > new Date(unit.expiry_date)) {
        const err = new Error('Cannot issue an expired blood unit.');
        err.statusCode = 400;
        throw err;
      }

      if (status === 'AVAILABLE' && newTestStatus !== 'PASSED') {
        const err = new Error('Unit cannot become AVAILABLE until medical testing is PASSED.');
        err.statusCode = 400;
        throw err;
      }

      // 2. Update blood unit status
      const updateUnitSql = 'UPDATE blood_units SET status = ?, testing_status = ? WHERE id = ?';
      if (typeof conn.execute === 'function') {
        await conn.execute(updateUnitSql, [status, newTestStatus, unit.id]);
      } else {
        await conn.query(updateUnitSql, [status, newTestStatus, unit.id]);
      }

      // 3. Keep aggregate stock in sync
      if (unit.status === 'AVAILABLE' && status !== 'AVAILABLE') {
        // Unit was available, now transitioning out -> decrement stock
        const decSql = `
          UPDATE BloodStock SET units_available = GREATEST(0, units_available - 1)
          WHERE blood_bank_id = ? AND blood_group = ? AND component = ?
        `;
        if (typeof conn.execute === 'function') {
          await conn.execute(decSql, [unit.blood_bank_id, unit.blood_group, unit.component]);
        } else {
          await conn.query(decSql, [unit.blood_bank_id, unit.blood_group, unit.component]);
        }
      } else if (unit.status !== 'AVAILABLE' && status === 'AVAILABLE') {
        // Unit is now becoming available -> increment stock
        const incSql = `
          INSERT INTO BloodStock (blood_bank_id, blood_group, component, units_available)
          VALUES (?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE units_available = units_available + 1
        `;
        if (typeof conn.execute === 'function') {
          await conn.execute(incSql, [unit.blood_bank_id, unit.blood_group, unit.component]);
        } else {
          await conn.query(incSql, [unit.blood_bank_id, unit.blood_group, unit.component]);
        }
      }

      return { unitId: unit.id, oldStatus: unit.status, newStatus: status, oldTest: unit.testing_status, newTest: newTestStatus };
    });

    await logAuditAction({
      actorUserId: req.user.id,
      action: `blood_unit_${status.toLowerCase()}`,
      entityType: 'BloodUnit',
      entityId: auditInfo.unitId,
      oldValue: { status: auditInfo.oldStatus, testing_status: auditInfo.oldTest },
      newValue: { status: auditInfo.newStatus, testing_status: auditInfo.newTest },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: `Blood unit status updated to ${status}` });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
});

// ============================================================================
// 4. ATOMIC FEFO FULFILLMENT ROUTE (POST /api/bloodunits/fefo-issue)
// ============================================================================
router.post('/fefo-issue', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const { blood_bank_id, blood_group, component, units_needed } = req.body;

    let bankId = blood_bank_id;
    if (req.user.role === 'blood_bank') {
      const bank = await db.queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
      if (!bank) {
        return res.status(404).json({ success: false, message: 'Blood Bank profile not found' });
      }
      bankId = bank.id;
    } else if (!bankId) {
      return res.status(400).json({ success: false, message: 'blood_bank_id is required for administrative issuance' });
    }

    const comp = component || 'WHOLE_BLOOD';
    const needed = parseInt(units_needed, 10) || 1;

    if (needed <= 0) {
      return res.status(400).json({ success: false, message: 'units_needed must be a positive integer greater than 0' });
    }

    if (!blood_group) {
      return res.status(400).json({ success: false, message: 'blood_group is required' });
    }

    // 🛡️ Atomic FEFO Transaction with Row-Level Exclusive Lock (FOR UPDATE)
    const issuedUnits = await db.withTransaction(async (conn) => {
      // 1. Fetch and row-lock eligible, non-expired, tested available units in FEFO order (earliest expiry first)
      const selectSql = `
        SELECT id, unit_id, blood_group, component, collection_date, expiry_date, status, testing_status, blood_bank_id
        FROM blood_units 
        WHERE blood_bank_id = ? AND blood_group = ? AND component = ? 
          AND status = 'AVAILABLE' AND testing_status = 'PASSED' AND expiry_date >= CURRENT_DATE()
        ORDER BY expiry_date ASC 
        LIMIT ? FOR UPDATE
      `;

      let availableUnits;
      if (typeof conn.execute === 'function') {
        const [rows] = await conn.execute(selectSql, [bankId, blood_group, comp, needed]);
        availableUnits = rows;
      } else {
        const rows = await conn.query(selectSql, [bankId, blood_group, comp, needed]);
        availableUnits = Array.isArray(rows[0]) ? rows[0] : rows;
      }

      // 2. Strict Stock Sufficiency Check inside Transaction
      if (!availableUnits || availableUnits.length < needed) {
        const availableCount = availableUnits ? availableUnits.length : 0;
        const err = new Error(`Insufficient FEFO unexpired stock available. Requested ${needed}, found ${availableCount} available.`);
        err.statusCode = 400;
        throw err;
      }

      // 3. Atomically update unit lifecycle status to ISSUED
      const unitIds = availableUnits.map(u => u.id);
      for (const uId of unitIds) {
        const updateSql = `UPDATE blood_units SET status = 'ISSUED' WHERE id = ?`;
        if (typeof conn.execute === 'function') {
          await conn.execute(updateSql, [uId]);
        } else {
          await conn.query(updateSql, [uId]);
        }
      }

      // 4. Atomically decrement aggregate stock matrix in BloodStock
      const stockSql = `
        UPDATE BloodStock SET units_available = GREATEST(0, units_available - ?)
        WHERE blood_bank_id = ? AND blood_group = ? AND component = ?
      `;
      if (typeof conn.execute === 'function') {
        await conn.execute(stockSql, [needed, bankId, blood_group, comp]);
      } else {
        await conn.query(stockSql, [needed, bankId, blood_group, comp]);
      }

      return availableUnits;
    });

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'fefo_units_issued',
      entityType: 'BloodUnit',
      newValue: { count: needed, blood_group, component: comp, issuedUnits: issuedUnits.map(u => u.unit_id) },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `FEFO issued ${needed} unit(s) successfully`,
      issuedUnits
    });

  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
});

module.exports = router;
