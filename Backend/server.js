  const path = require('path');                         // built-in module to handle file paths
  const express = require('express');                   // web framework for Node.js
  const http = require('http');                         // built-in HTTP module to create the server
  const { Server } = require('socket.io');             // Socket.io for real-time communication
  const cors = require('cors');                        // middleware to allow cross-origin requests





  // Environment Configuration
  // When running as an EXE, it looks for .env NEXT TO the .exe file
  const envPath = process.pkg                           // checks if the app is bundled as an executable
    ? path.join(path.dirname(process.execPath), '.env') // joins the exe path with .env
    : path.join(__dirname, '.env');                    // otherwise joins current dir with .env

  require('dotenv').config({ path: envPath });          // loads environment variables from the .env file






  // Route and Socket imports
  const authRoutes    = require('./routes/authRoutes');    // imports authentication API endpoints
  const ticketRoutes  = require('./routes/ticketRoutes');  // imports ticket API endpoints
  const chatRoutes    = require('./routes/chatRoutes');    // imports message API endpoints
  const { initSocket } = require('./socket/socketHandler'); // imports socket initialization logic




  // App and Server initialization
  const app = express();                                // initializes the express application
  const server = http.createServer(app);                // creates an HTTP server using the express app





  // Directory setup
  const baseDir = process.pkg ? path.dirname(process.execPath) : process.cwd(); // gets the root directory of the app
  const frontendDir = path.join(baseDir, 'frontend');    // joins the base directory with the frontend folder





  // Global Middleware
  app.use(cors());                                      // enables CORS for all routes
  app.use(express.static(frontendDir));                 // serves static files (HTML, CSS, JS) from frontend folder
  app.use(express.json());                              // parses incoming JSON requests
  app.use(express.urlencoded({ extended: true }));      // parses URL-encoded form data





  // API Routes
  app.use('/api/auth', authRoutes);                     // attaches authentication routes to /api/auth
  app.use('/api/tickets', ticketRoutes);                // attaches ticket routes to /api/tickets
  app.use('/api/chat', chatRoutes);                     // attaches message routes to /api/chat





  // Catch-all route to serve the frontend
  app.get('*', (req, res) => {                          // handles any route that doesn't match above APIs
    res.sendFile(path.join(frontendDir, 'index.html')); // sends index.html to enable Client-Side Routing
  });





  // Socket.io Setup
  const io = new Server(server, {                       // initializes Socket.io on the created server
    cors: {
      origin: '*',                                      // allows all origins to connect (adjust for production)
      methods: ['GET', 'POST']                          // allowed HTTP methods for handshake
    }
  });
  app.set('io', io);                                    // makes the io instance accessible in request handlers

  const onlineUsers = new Map();                        // map to track userId -> socketId mapping
  initSocket(io, onlineUsers);                          // hands off all socket logic to the socket handler





  // Server Start Configuration
  const PORT = process.env.PORT || 5000;                // uses PORT from .env or defaults to 5000
  const ip_address = process.env.IP_ADDRESS;            // gets specific IP to bind to from .env







  // Starting the server
  server.listen(PORT, ip_address, () => {
    console.log(`🚀 Server running on all interfaces. Access it via http://${ip_address || 'localhost'}:${PORT}`);
  }).on('error', (err) => {                              // handles errors during server startup
    if (err.code === 'EADDRINUSE') {                     // specifically handle "Port already in use"
      console.error(`❌ Error: Port ${PORT} is already in use. Please stop other Node processes.`);
    } else {
      console.error(`❌ Server error:`, err);
    }
    process.exit(1);                                     // shuts down the app on fatal startup errors
  });