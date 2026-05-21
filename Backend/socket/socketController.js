const ticketModels = require('../models/ticketmodels');  // imports ticket database queries
const chatModels = require('../models/chatmodels');     // imports message database queries


// ---------------------------------------------------------------
// Handles a message sent by a USER inside a ticket thread
// Socket event: 'send_message'
// Data: { ticketId, content }
// ---------------------------------------------------------------
const handleUserMessage = async (socket, io, { ticketId, content }) => {
    console.log(`📩 [User Message] From User ID: ${socket.user.id}, Ticket: ${ticketId}`);

    try {
        // Validate that the ticket exists and belongs to this user
        const ticket = await ticketModels.getTicketById(ticketId);
        if (!ticket) {
            return socket.emit('message_error', { error: 'Ticket not found' });
        }
        if (Number(ticket.user_id) !== Number(socket.user.id)) {
            return socket.emit('message_error', { error: 'You do not have access to this ticket' });
        }

        // Reject messages on closed tickets
        if (ticket.status === 'Closed') {
            return socket.emit('message_error', { error: 'This ticket is closed. Please open a new ticket.' });
        }

        const savedMessage = await chatModels.saveMessage(ticketId, socket.user.id, content);
        console.log(`✅ [User Message] Saved to DB with ID: ${savedMessage.id}`);

        // Broadcast to everyone in the ticket room (user + assigned admin + all admins)
        io.to(`ticket_${ticketId}`).emit('receive_message', savedMessage);
        io.to('admins').emit('receive_message', savedMessage);             // admins not yet in the room also get it
        socket.emit('message_sent', savedMessage);                         // confirm back to sender

    } catch (err) {
        console.error('❌ [User Message] Error:', err);
        socket.emit('message_error', { error: 'Could not send message' });
    }
};


// ---------------------------------------------------------------
// Handles a REPLY sent by an ADMIN inside a ticket thread
// Socket event: 'admin_reply'
// Data: { ticketId, content }
// ---------------------------------------------------------------
const handleAdminReply = async (socket, io, onlineUsers, { ticketId, content }) => {
    console.log(`📩 [Admin Reply] From Admin ID: ${socket.user.id}, Ticket: ${ticketId}`);

    try {
        const ticket = await ticketModels.getTicketById(ticketId);
        if (!ticket) {
            return socket.emit('message_error', { error: 'Ticket not found' });
        }

        const savedMessage = await chatModels.saveMessage(ticketId, socket.user.id, content);
        console.log(`✅ [Admin Reply] Saved to DB with ID: ${savedMessage.id}`);

        // Public reply: send to the ticket room (which includes the user if online)
        io.to(`ticket_${ticketId}`).emit('receive_message', savedMessage);
        io.to('admins').emit('receive_message', savedMessage);

        // Also push directly to the user's socket if they are online but not in the room
        const userSocketId = onlineUsers.get(Number(ticket.user_id));
        if (userSocketId) {
            io.to(userSocketId).emit('receive_message', savedMessage);
        }

        socket.emit('message_sent', savedMessage);                         // confirm back to the admin

    } catch (err) {
        console.error('❌ [Admin Reply] Error:', err);
        socket.emit('message_error', { error: 'Could not send message' });
    }
};


module.exports = {
    handleUserMessage,
    handleAdminReply,
};