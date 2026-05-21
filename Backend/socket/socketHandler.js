const jwt = require('jsonwebtoken');                          // module to handle JSON Web Tokens for security
const { handleUserMessage, handleAdminReply } = require('./socketController'); // imports socket business logic


// Socket authentication middleware
// Runs before any socket connection is established
const socketAuthMiddleware = (socket, next) => {
    const token = socket.handshake.auth.token;                  // extracts the JWT token from the handshake

    if (!token) {                                               // checks if token is missing
        return next(new Error('Authentication error: No token provided')); // rejects connection if no token
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => { // verifies the JWT token
        if (err) return next(new Error('Authentication error: Invalid token')); // rejects if verification fails
        socket.user = decoded;                                    // stores decoded user info in the socket object
        next();                                                   // allows the connection to proceed
    });
};


// Registers all socket events for a single connected client
const registerSocketEvents = (socket, io, onlineUsers) => {
    console.log(`User connected: ${socket.user.username} (${socket.user.id})`); // logs the connection info
    onlineUsers.set(socket.user.id, socket.id);                 // adds the user to the online tracking map

    if (socket.user.role === 'admin') {                         // checks if the connected user is an admin
        socket.join('admins');                                    // admins always receive all ticket notifications
    }


    // -------------------------------------------------------
    // Join a specific ticket room to receive its messages
    // Client emits: join_ticket  { ticketId }
    // -------------------------------------------------------
    socket.on('join_ticket', ({ ticketId }) => {
        const room = `ticket_${ticketId}`;
        socket.join(room);
        console.log(`${socket.user.username} joined room: ${room}`);
    });


    // -------------------------------------------------------
    // Leave a ticket room (user navigates away from a ticket)
    // Client emits: leave_ticket  { ticketId }
    // -------------------------------------------------------
    socket.on('leave_ticket', ({ ticketId }) => {
        const room = `ticket_${ticketId}`;
        socket.leave(room);
        console.log(`${socket.user.username} left room: ${room}`);
    });


    // -------------------------------------------------------
    // User sends a message inside a ticket thread
    // Client emits: send_message  { ticketId, content }
    // -------------------------------------------------------
    socket.on('send_message', (data) =>
        handleUserMessage(socket, io, data)
    );


    // -------------------------------------------------------
    // Admin sends a reply (public or internal note)
    // Client emits: admin_reply  { ticketId, content, isInternal }
    // -------------------------------------------------------
    socket.on('admin_reply', (data) =>
        handleAdminReply(socket, io, onlineUsers, data)
    );


    // -------------------------------------------------------
    // Cleanup on disconnect
    // -------------------------------------------------------
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.user.username}`); // logs who disconnected
        onlineUsers.delete(socket.user.id);                       // removes them from the online tracker
    });
};


// Initializes socket.io: applies auth middleware and registers events on each connection
const initSocket = (io, onlineUsers) => {
    io.use(socketAuthMiddleware);                               // applies auth check before every connection
    io.on('connection', (socket) =>                            // triggered when a new client connects
        registerSocketEvents(socket, io, onlineUsers)
    );
};


module.exports = { initSocket };