const express = require('express');
const router = express.Router();
const { query, queryOne, execute } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { logAuditAction } = require('../utils/auditLogger');

// Protect all admin routes
router.use(authenticateToken, requireRole(['admin']));

// ============================================================================
// 1. GET ADVANCED OPERATIONAL ANALYTICS (GET /api/admin/analytics)
// ============================================================================
router.get('/analytics', async (req, res, next) => {
  try {
    const { range } = req.query; // 'today', '7days', '30days', '90days', 'all'
    let dateClause = '';
    if (range === 'today') dateClause = ' AND created_at >= CURDATE()';
    else if (range === '7days') dateClause = ' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    else if (range === '90days') dateClause = ' AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
    else dateClause = ' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'; // Default 30 days

    // 1. Donor Metrics & Retention
    const totalDonors = (await queryOne('SELECT COUNT(*) as c FROM Donors')).c;
    const verifiedDonors = (await queryOne('SELECT COUNT(*) as c FROM Users WHERE role = "donor" AND is_verified = 1')).c;
    const activeDonors = (await queryOne('SELECT COUNT(*) as c FROM Donors WHERE is_available = 1')).c;
    const newDonorsThisMonth = (await queryOne('SELECT COUNT(*) as c FROM Users WHERE role = "donor"' + dateClause)).c;
    const repeatDonors = (await queryOne('SELECT COUNT(*) as c FROM Donors WHERE total_donations > 1')).c;

    const donorConversionRate = totalDonors > 0 ? parseFloat(((verifiedDonors / totalDonors) * 100).toFixed(1)) : 0;
    const repeatDonorRate = totalDonors > 0 ? parseFloat(((repeatDonors / totalDonors) * 100).toFixed(1)) : 0;

    // 2. Inventory Metrics & Wastage Rate
    const aggregateUnits = (await queryOne('SELECT COALESCE(SUM(units_available), 0) as total FROM BloodStock')).total;
    const totalTrackedUnits = (await queryOne('SELECT COUNT(*) as c FROM blood_units')).c;
    const availableTracked = (await queryOne('SELECT COUNT(*) as c FROM blood_units WHERE status = "AVAILABLE"')).c;
    const expiringSoonUnits = (await queryOne('SELECT COUNT(*) as c FROM blood_units WHERE status = "AVAILABLE" AND expiry_date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 3 DAY)')).c;
    const expiredUnits = (await queryOne('SELECT COUNT(*) as c FROM blood_units WHERE status = "EXPIRED"')).c;
    const discardedUnits = (await queryOne('SELECT COUNT(*) as c FROM blood_units WHERE status = "DISCARDED"')).c;

    const wastageRate = totalTrackedUnits > 0 
      ? parseFloat((((expiredUnits + discardedUnits) / totalTrackedUnits) * 100).toFixed(1)) 
      : 0;

    // Stock by Group
    const stockByGroup = await query(`
      SELECT blood_group, SUM(units_available) as total_units 
      FROM BloodStock GROUP BY blood_group ORDER BY blood_group
    `);

    // Stock by Component
    const stockByComponent = await query(`
      SELECT component, SUM(units_available) as total_units 
      FROM BloodStock GROUP BY component ORDER BY total_units DESC
    `);

    // 3. Request Metrics & Fulfillment Rate
    const totalRequests = (await queryOne('SELECT COUNT(*) as c FROM BloodRequests WHERE 1=1' + dateClause)).c;
    const emergencyRequests = (await queryOne('SELECT COUNT(*) as c FROM BloodRequests WHERE urgency_level IN ("Urgent", "Critical")' + dateClause)).c;
    const fulfilledRequests = (await queryOne('SELECT COUNT(*) as c FROM BloodRequests WHERE status IN ("FULFILLED", "Fulfilled")' + dateClause)).c;
    const pendingRequests = (await queryOne('SELECT COUNT(*) as c FROM BloodRequests WHERE status IN ("Pending", "MATCHING", "APPROVED", "VERIFICATION_PENDING")' + dateClause)).c;

    const fulfillmentRate = totalRequests > 0 ? parseFloat(((fulfilledRequests / totalRequests) * 100).toFixed(1)) : 0;

    // 4. Average Emergency Response Time Calculation
    const responseRec = await queryOne(`
      SELECT AVG(TIMESTAMPDIFF(MINUTE, r.created_at, er.created_at)) as avg_minutes
      FROM BloodRequests r
      JOIN emergency_responses er ON r.id = er.request_id
    `);
    const avgResponseMinutes = (responseRec && responseRec.avg_minutes !== null) 
      ? `${parseFloat(responseRec.avg_minutes).toFixed(1)} mins` 
      : 'Insufficient data';

    // 5. Most Requested Blood Groups & Components
    const topRequestedGroups = await query(`
      SELECT blood_group, COUNT(*) as count 
      FROM BloodRequests GROUP BY blood_group ORDER BY count DESC LIMIT 8
    `);

    const topRequestedComponents = await query(`
      SELECT component, COUNT(*) as count 
      FROM BloodRequests GROUP BY component ORDER BY count DESC LIMIT 6
    `);

    // 6. Hospital Statistics
    const totalHospitals = (await queryOne('SELECT COUNT(*) as c FROM Hospitals')).c;
    const verifiedHospitals = (await queryOne('SELECT COUNT(*) as c FROM Hospitals WHERE verification_status = "VERIFIED"')).c;
    const pendingHospitals = (await queryOne('SELECT COUNT(*) as c FROM Hospitals WHERE verification_status = "PENDING_VERIFICATION"')).c;
    const activeHospitalRequesters = (await queryOne('SELECT COUNT(DISTINCT hospital_id) as c FROM BloodRequests WHERE hospital_id IS NOT NULL')).c;

    return res.json({
      success: true,
      analytics: {
        donors: { 
          total: totalDonors, 
          verified: verifiedDonors, 
          active: activeDonors, 
          newThisPeriod: newDonorsThisMonth, 
          repeat: repeatDonors,
          conversionRate: donorConversionRate,
          repeatRate: repeatDonorRate
        },
        inventory: { 
          aggregateUnits, 
          trackedUnits: totalTrackedUnits, 
          availableTracked, 
          expiringSoon: expiringSoonUnits, 
          expired: expiredUnits, 
          discarded: discardedUnits, 
          wastageRate,
          stockByGroup, 
          stockByComponent 
        },
        requests: { 
          total: totalRequests, 
          emergency: emergencyRequests, 
          fulfilled: fulfilledRequests, 
          pending: pendingRequests, 
          fulfillmentRate,
          avgResponseTime: avgResponseMinutes,
          topRequestedGroups,
          topRequestedComponents
        },
        hospitals: { 
          total: totalHospitals, 
          verified: verifiedHospitals, 
          pending: pendingHospitals, 
          activeRequesters: activeHospitalRequesters 
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 2. GET SYSTEM DASHBOARD STATS (GET /api/admin/stats)
// ============================================================================
router.get('/stats', async (req, res, next) => {
  try {
    const totalUsers = (await queryOne('SELECT COUNT(*) as count FROM Users')).count;
    const totalDonors = (await queryOne('SELECT COUNT(*) as count FROM Donors')).count;
    const totalBloodBanks = (await queryOne('SELECT COUNT(*) as count FROM BloodBanks')).count;
    const totalHospitals = (await queryOne('SELECT COUNT(*) as count FROM Hospitals')).count;
    const totalRequests = (await queryOne('SELECT COUNT(*) as count FROM BloodRequests')).count;
    const pendingRequests = (await queryOne("SELECT COUNT(*) as count FROM BloodRequests WHERE status IN ('Pending', 'MATCHING')")).count;
    const totalCamps = (await queryOne('SELECT COUNT(*) as count FROM DonationCamps')).count;
    const totalStock = (await queryOne('SELECT COALESCE(SUM(units_available), 0) as total FROM BloodStock')).total;

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalDonors,
        totalBloodBanks,
        totalHospitals,
        totalRequests,
        pendingRequests,
        totalCamps,
        totalStock
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 3. HOSPITALS VERIFICATION MANAGEMENT (GET /api/admin/hospitals)
// ============================================================================
router.get('/hospitals', async (req, res, next) => {
  try {
    const { verification_status } = req.query;

    let sql = `
      SELECT h.*, u.full_name as contact_name, u.email as user_email, u.phone as user_phone, u.created_at as registered_at
      FROM Hospitals h
      JOIN Users u ON h.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (verification_status && verification_status !== 'All') {
      sql += ` AND h.verification_status = ?`;
      params.push(verification_status);
    }

    sql += ` ORDER BY CASE WHEN h.verification_status = 'PENDING_VERIFICATION' THEN 1 ELSE 2 END, h.id DESC`;

    const hospitals = await query(sql, params);
    return res.json({ success: true, count: hospitals.length, hospitals });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 4. APPROVE, REJECT, OR SUSPEND HOSPITAL (PATCH /api/admin/hospitals/:id/status)
// ============================================================================
router.patch('/hospitals/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const hospital = await queryOne('SELECT * FROM Hospitals WHERE id = ?', [req.params.id]);
    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital record not found' });
    }

    await execute('UPDATE Hospitals SET verification_status = ? WHERE id = ?', [status, hospital.id]);

    await logAuditAction({
      actorUserId: req.user.id,
      action: `hospital_${status.toLowerCase()}`,
      entityType: 'Hospital',
      entityId: hospital.id,
      oldValue: { verification_status: hospital.verification_status },
      newValue: { verification_status: status },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Hospital ${hospital.name} status updated to ${status}`
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 5. GET AUDIT LOGS (GET /api/admin/audit-logs)
// ============================================================================
router.get('/audit-logs', async (req, res, next) => {
  try {
    const { action, entity_type, actor_user_id, date } = req.query;

    let sql = `
      SELECT a.*, u.full_name as actor_name, u.email as actor_email, u.role as actor_role
      FROM audit_logs a
      LEFT JOIN Users u ON a.actor_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action && action !== 'All') {
      sql += ` AND a.action = ?`;
      params.push(action);
    }

    if (entity_type && entity_type !== 'All') {
      sql += ` AND a.entity_type = ?`;
      params.push(entity_type);
    }

    if (actor_user_id) {
      sql += ` AND a.actor_user_id = ?`;
      params.push(actor_user_id);
    }

    if (date) {
      sql += ` AND DATE(a.created_at) = ?`;
      params.push(date);
    }

    sql += ` ORDER BY a.id DESC LIMIT 200`;

    const logs = await query(sql, params);
    return res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 6. LIST ALL USERS (GET /api/admin/users)
// ============================================================================
router.get('/users', async (req, res, next) => {
  try {
    const { role, state, city, status } = req.query;

    let sql = `
      SELECT u.id, u.full_name, u.email, u.phone, u.role, u.state, u.city, u.pincode, 
             u.is_verified, u.account_status, u.failed_login_attempts, u.locked_until, u.created_at
      FROM Users u
      WHERE 1=1
    `;
    const params = [];

    if (role && role !== 'All') {
      sql += ` AND u.role = ?`;
      params.push(role);
    }

    if (status && status !== 'All') {
      sql += ` AND u.account_status = ?`;
      params.push(status);
    }

    if (state && state !== 'All States' && state !== 'All') {
      sql += ` AND u.state = ?`;
      params.push(state);
    }

    if (city && city.trim() !== '') {
      sql += ` AND LOWER(u.city) LIKE LOWER(?)`;
      params.push(`%${city.trim()}%`);
    }

    sql += ` ORDER BY u.id DESC LIMIT 100`;

    const users = await query(sql, params);
    return res.json({ success: true, count: users.length, users });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 7. ACTIVATE OR SUSPEND USER ACCOUNT (PATCH /api/admin/users/:id/status)
// ============================================================================
router.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { account_status } = req.body;
    const validStatuses = ['active', 'suspended', 'deactivated'];

    if (!validStatuses.includes(account_status)) {
      return res.status(400).json({ success: false, message: 'Invalid account_status value. Allowed: active, suspended, deactivated' });
    }

    const targetUser = await queryOne('SELECT id, full_name, email, role, account_status FROM Users WHERE id = ?', [req.params.id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (targetUser.role === 'admin' && account_status === 'suspended') {
      return res.status(400).json({ success: false, message: 'Cannot suspend System Administrator account.' });
    }

    await execute(
      'UPDATE Users SET account_status = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [account_status, targetUser.id]
    );

    await logAuditAction({
      actorUserId: req.user.id,
      action: `user_account_${account_status}`,
      entityType: 'User',
      entityId: targetUser.id,
      oldValue: { account_status: targetUser.account_status },
      newValue: { account_status },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Account status for ${targetUser.full_name} (${targetUser.email}) updated to '${account_status}'`
    });

  } catch (error) {
    next(error);
  }
});

// ============================================================================
// 8. TOGGLE USER VERIFICATION (PATCH /api/admin/users/:id/verify)
// ============================================================================
router.patch('/users/:id/verify', async (req, res, next) => {
  try {
    const { is_verified } = req.body;
    const targetUser = await queryOne('SELECT id, full_name, is_verified FROM Users WHERE id = ?', [req.params.id]);

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newVerified = is_verified ? 1 : 0;
    await execute('UPDATE Users SET is_verified = ? WHERE id = ?', [newVerified, targetUser.id]);

    await logAuditAction({
      actorUserId: req.user.id,
      action: newVerified ? 'user_verified' : 'user_unverified',
      entityType: 'User',
      entityId: targetUser.id,
      oldValue: { is_verified: targetUser.is_verified },
      newValue: { is_verified: newVerified },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `User verification status updated to ${newVerified ? 'Verified' : 'Unverified'}`
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
