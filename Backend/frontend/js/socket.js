// Global socket instance used by admin.js and tickets.js
let socket = null;

/**
 * Initializes the Socket.io connection using the saved JWT token.
 * Returns the active socket, or null if no token is found.
 */
function initializeSocket() {
  const token = localStorage.getItem('token');
  if (!token) return null;

  socket = io({ auth: { token } });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
}

/**
 * Joins a ticket-specific socket room so real-time messages
 * are scoped to that ticket only.
 */
function joinTicketRoom(ticketId) {
  if (socket) socket.emit('join_ticket', { ticketId });
}

/**
 * Leaves a ticket room (called when navigating away from a ticket).
 */
function leaveTicketRoom(ticketId) {
  if (socket) socket.emit('leave_ticket', { ticketId });
}
