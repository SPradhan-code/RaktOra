const express = require('express');
const router = express.Router();
const { query, execute } = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET USER NOTIFICATIONS
router.get('/', async (req, res, next) => {
  try {
    const notifications = await query(
      'SELECT * FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );

    return res.json({ success: true, count: notifications.length, notifications });
  } catch (error) {
    next(error);
  }
});

// MARK NOTIFICATION AS READ
router.patch('/:id/read', async (req, res, next) => {
  try {
    await execute(
      'UPDATE Notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    return res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
