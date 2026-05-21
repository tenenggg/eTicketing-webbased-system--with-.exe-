const ticketModel = require('../models/ticketmodels');  // imports ticket database queries
const chatModel = require('../models/chatmodels');     // imports message database queries


// GET /api/chat/tickets/:ticketId/messages
// Returns the message thread for a ticket.
const getMessages = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        // Verify ticket exists and user has access
        const ticket = await ticketModel.getTicketById(ticketId);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        if (req.user.role !== 'admin' && Number(ticket.user_id) !== Number(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const messages = await chatModel.getMessagesByTicket(ticketId);
        res.json(messages);

    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


// POST /api/chat/tickets/:ticketId/read
// Admin-only. Marks all unread messages in a ticket as read.
const markAsRead = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const adminId = req.user.id;

        await chatModel.markMessagesAsRead(ticketId, adminId);
        res.json({ message: 'Messages marked as read' });

    } catch (err) {
        console.error('Error marking as read:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


// DELETE /api/chat/messages/:messageId
// Only the original sender can delete their message.
const deleteMessage = async (req, res) => {
    try {
        const messageId = req.params.messageId;
        const currentUserId = req.user.id;

        const message = await chatModel.getMessageById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Security: only the sender can delete their own message
        if (Number(message.sender_id) !== Number(currentUserId)) {
            return res.status(403).json({ message: 'Forbidden: You can only delete your own messages' });
        }

        await chatModel.deleteMessage(messageId);

        // Notify everyone in that ticket room in real-time
        const io = req.app.get('io');
        if (io) {
            io.to(`ticket_${message.ticket_id}`).emit('message_deleted', { messageId });
            io.to('admins').emit('message_deleted', { messageId });
        }

        res.json({ message: 'Message deleted successfully' });

    } catch (err) {
        console.error('Error deleting message:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


module.exports = {
    getMessages,
    markAsRead,
    deleteMessage,
};