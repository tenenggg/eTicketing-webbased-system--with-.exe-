const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');


// Create a new support ticket (any authenticated user)
router.post('/', authenticateToken, ticketController.createTicket);

// Get all tickets (admin sees all, users see their own — logic inside controller)
router.get('/', authenticateToken, ticketController.getTickets);

// Get a single ticket by ID
router.get('/:ticketId', authenticateToken, ticketController.getTicket);

// User-only: edit ticket subject
router.patch('/:ticketId/subject', authenticateToken, ticketController.updateTicketSubject);

// Update ticket status, priority, category, or assigned admin (admin only)
router.patch('/:ticketId', authenticateToken, authorizeRoles('admin'), ticketController.updateTicket);

// Admin-only: delete a ticket
router.delete('/:ticketId', authenticateToken, authorizeRoles('admin'), ticketController.deleteTicket);


module.exports = router;
