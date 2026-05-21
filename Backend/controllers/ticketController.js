const ticketModel = require('../models/ticketmodels');    // imports ticket database queries


// POST /api/chat/tickets
// Creates a new support ticket. Only the logged-in user can create tickets for themselves.
const createTicket = async (req, res) => {
    try {
        const userId = req.user.id;
        const { subject, category } = req.body;

        if (req.user.role === 'admin') {
            return res.status(403).json({ message: 'Admins cannot create tickets' });
        }

        if (!subject || subject.trim() === '') {
            return res.status(400).json({ message: 'Subject is required to create a ticket' });
        }

        const ticket = await ticketModel.createTicket(userId, subject.trim(), category || 'General');

        // Notify all connected admins in real-time about the new ticket
        const io = req.app.get('io');
        if (io) {
            io.to('admins').emit('ticket_created', ticket);
        }

        res.status(201).json(ticket);

    } catch (err) {
        console.error('Error creating ticket:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


// GET /api/chat/tickets
// Admin: returns all tickets (optionally filtered by ?status= or ?mine=true)
// User:  returns only their own tickets
const getTickets = async (req, res) => {
    try {
        let tickets;

        if (req.user.role === 'admin') {
            // Admins get all tickets, frontend handles real-time filtering
            tickets = await ticketModel.getAllTickets();
        } else {
            // Regular user: only their own tickets
            tickets = await ticketModel.getTicketsByUser(req.user.id);
        }

        res.json(tickets);

    } catch (err) {
        console.error('Error fetching tickets:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


// GET /api/chat/tickets/:ticketId
// Returns a single ticket. Admin can see any. User can only see their own.
const getTicket = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const ticket = await ticketModel.getTicketById(ticketId);

        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        // Security: regular users can only view their own tickets
        if (req.user.role !== 'admin' && Number(ticket.user_id) !== Number(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        res.json(ticket);

    } catch (err) {
        console.error('Error fetching ticket:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


// PATCH /api/chat/tickets/:ticketId
// Admin-only. Updates status, priority, category, or assigned_admin_id.
const updateTicket = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const { status, priority, category, assigned_admin_id } = req.body;

        const ticket = await ticketModel.getTicketById(ticketId);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        console.log('PATCH /api/tickets/' + ticketId + ' body=', req.body);

        const updated = await ticketModel.updateTicket(ticketId, {
            status,
            priority,
            category,
            assigned_admin_id,
        });

        if (!updated) {
            // No fields were updated (possibly empty body) — return meaningful response
            return res.status(400).json({ message: 'No valid fields provided for update' });
        }

        // Notify the ticket room (admins + the specific user) of the status update
        const io = req.app.get('io');
        if (io) {
            io.to(`ticket_${ticketId}`).emit('ticket_updated', updated);
            io.to('admins').emit('ticket_updated', updated);
        }

        res.json(updated);

    } catch (err) {
        console.error('Error updating ticket:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


// PATCH /api/tickets/:ticketId/subject
// User-only. Allows a ticket owner to edit their ticket subject.
const updateTicketSubject = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const { subject } = req.body;

        const ticket = await ticketModel.getTicketById(ticketId);
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        if (Number(ticket.user_id) !== Number(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        if (req.user.role === 'admin') {
            return res.status(403).json({ message: 'Admins cannot use this endpoint' });
        }

        const updated = await ticketModel.updateTicketSubject(ticketId, subject);
        if (!updated) {
            return res.status(400).json({ message: 'Subject is required' });
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`ticket_${ticketId}`).emit('ticket_updated', updated);
            io.to('admins').emit('ticket_updated', updated);
        }

        res.json(updated);
    } catch (err) {
        console.error('Error updating ticket subject:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


// DELETE /api/tickets/:ticketId
// Admin-only. Deletes a ticket and its related messages.
const deleteTicket = async (req, res) => {
    try {
        const ticketId = req.params.ticketId;
        const deleted = await ticketModel.deleteTicket(ticketId);

        if (!deleted) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        const io = req.app.get('io');
        if (io) {
            io.to('admins').emit('ticket_deleted', { id: Number(ticketId) });
            io.to(`ticket_${ticketId}`).emit('ticket_deleted', { id: Number(ticketId) });
        }
 
        res.json({ message: 'Ticket deleted', id: Number(ticketId) });
    } catch (err) {
        console.error('Error deleting ticket:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


module.exports = {
    createTicket,
    getTickets,
    getTicket,
    updateTicket,
    updateTicketSubject,
    deleteTicket,
};
