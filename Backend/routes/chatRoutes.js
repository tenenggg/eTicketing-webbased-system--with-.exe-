const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/authMiddleware');


// ============================================================
// MESSAGE ROUTES (scoped to a ticket)
// ============================================================

// Get all messages for a ticket thread
router.get('/tickets/:ticketId/messages', authenticateToken, chatController.getMessages);

// Delete a specific message (sender only)
router.delete('/messages/:messageId', authenticateToken, chatController.deleteMessage);

// Mark messages in a ticket as read (both admins and users)
router.post('/tickets/:ticketId/read', authenticateToken, chatController.markAsRead);


module.exports = router;
