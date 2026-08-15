const db = require('../db');

/**
 * Inserts an immutable audit log entry into MySQL
 */
async function logAuditAction({ actorUserId, action, entityType, entityId, oldValue, newValue, ipAddress }) {
  try {
    await db.execute(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        actorUserId || null,
        action,
        entityType,
        entityId || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ipAddress || null
      ]
    );
  } catch (err) {
    console.error('[AUDIT LOG ERROR]:', err.message);
  }
}

module.exports = {
  logAuditAction
};
