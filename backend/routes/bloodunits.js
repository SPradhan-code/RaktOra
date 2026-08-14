const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query, queryOne, execute } = require('../db');
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
      const bank = await queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
      if (!bank) {
        return res.status(404).json({ success: false, message: 'Blood Bank profile not found' });
      }
      bankId = bank.id;
    }

    // Auto-update expired units in DB
    await execute(
      `UPDATE blood_units 
       SET status = 'EXPIRED' 
       WHERE blood_bank_id = ? AND status IN ('AVAILABLE', 'TESTING') AND expiry_date < CURRENT_DATE()`,
      [bankId]
    );

    const units = await query(
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
// 2. ADD INDIVIDUAL / BULK BLOOD UNITS (POST /api/bloodunits)
// ============================================================================
router.post('/', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const bank = await queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]);
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
    const count = parseInt(quantity) || 1;
    const testStatus = testing_status || 'PASSED';
    const initialStatus = testStatus === 'PASSED' ? 'AVAILABLE' : 'TESTING';

    const insertedIds = [];
    for (let i = 0; i < count; i++) {
      const uId = generateUnitId(blood_group, comp);
      const resIns = await execute(
        `INSERT INTO blood_units (unit_id, blood_group, component, collection_date, expiry_date, blood_bank_id, status, testing_status, donation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uId, blood_group, comp, collection_date, expiry_date, bankId, initialStatus, testStatus, donation_id || null]
      );
      insertedIds.push(resIns.insertId);
    }

    // Also update aggregate stock matrix in BloodStock
    if (initialStatus === 'AVAILABLE') {
      await execute(
        `INSERT INTO BloodStock (blood_bank_id, blood_group, component, units_available)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE units_available = units_available + ?`,
        [bankId, blood_group, comp, count, count]
      );
    }

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
// 3. UPDATE UNIT LIFECYCLE STATUS (PATCH /api/bloodunits/:id/status)
// ============================================================================
router.patch('/:id/status', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const { status, testing_status } = req.body;
    const validStatuses = ['COLLECTED', 'TESTING', 'AVAILABLE', 'RESERVED', 'ISSUED', 'TRANSFUSED', 'EXPIRED', 'DISCARDED', 'QUARANTINED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const unit = await queryOne('SELECT * FROM blood_units WHERE id = ?', [req.params.id]);
    if (!unit) {
      return res.status(404).json({ success: false, message: 'Blood unit not found' });
    }

    const newTestStatus = testing_status || unit.testing_status || 'PASSED';

    // 🛡️ Enforce State Transition Rules
    if (!isValidStateTransition(unit.status, status, newTestStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid state transition from ${unit.status} to ${status}.`
      });
    }

    // Prevent issuing expired or un-tested units
    if (status === 'ISSUED' && new Date() > new Date(unit.expiry_date)) {
      return res.status(400).json({ success: false, message: 'Cannot issue an expired blood unit.' });
    }

    if (status === 'AVAILABLE' && newTestStatus !== 'PASSED') {
      return res.status(400).json({ success: false, message: 'Unit cannot become AVAILABLE until medical testing is PASSED.' });
    }

    await execute(
      'UPDATE blood_units SET status = ?, testing_status = ? WHERE id = ?', 
      [status, newTestStatus, unit.id]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: `blood_unit_${status.toLowerCase()}`,
      entityType: 'BloodUnit',
      entityId: unit.id,
      oldValue: { status: unit.status, testing_status: unit.testing_status },
      newValue: { status, testing_status: newTestStatus },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: `Blood unit status updated to ${status}` });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 4. FEFO FULFILLMENT ROUTE (POST /api/bloodunits/fefo-issue)
// ============================================================================
router.post('/fefo-issue', requireRole(['blood_bank', 'admin']), async (req, res, next) => {
  try {
    const { blood_bank_id, blood_group, component, units_needed } = req.body;

    const bankId = blood_bank_id || (await queryOne('SELECT id FROM BloodBanks WHERE user_id = ?', [req.user.id]))?.id;
    const comp = component || 'WHOLE_BLOOD';
    const needed = parseInt(units_needed) || 1;

    // Fetch FEFO ordered compatible & passed units (earliest expiry first)
    const availableUnits = await query(
      `SELECT * FROM blood_units 
       WHERE blood_bank_id = ? AND blood_group = ? AND component = ? 
         AND status = 'AVAILABLE' AND testing_status = 'PASSED' AND expiry_date >= CURRENT_DATE()
       ORDER BY expiry_date ASC 
       LIMIT ?`,
      [bankId, blood_group, comp, needed]
    );

    if (availableUnits.length < needed) {
      return res.status(400).json({
        success: false,
        message: `Insufficient FEFO unexpired stock available. Requested ${needed}, found ${availableUnits.length} available.`
      });
    }

    // Issue units
    const unitIds = availableUnits.map(u => u.id);
    for (const uId of unitIds) {
      await execute(`UPDATE blood_units SET status = 'ISSUED' WHERE id = ?`, [uId]);
    }

    // Decrement aggregate stock matrix
    await execute(
      `UPDATE BloodStock SET units_available = GREATEST(0, units_available - ?)
       WHERE blood_bank_id = ? AND blood_group = ? AND component = ?`,
      [needed, bankId, blood_group, comp]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: 'fefo_units_issued',
      entityType: 'BloodUnit',
      newValue: { count: needed, blood_group, component: comp, issuedUnits: availableUnits.map(u => u.unit_id) },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `FEFO issued ${needed} unit(s) successfully`,
      issuedUnits: availableUnits
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
