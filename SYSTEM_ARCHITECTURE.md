## Mermaid Architecture Diagram

```mermaid
graph TB
   subgraph MasterPC["MASTER PC"]
      Backend["Node.js + Express backend\nBackend folder\nserver.js"]
      Frontend["Frontend files\nHTML / CSS / JS\nBackend/frontend/"]
      MySQL["MySQL database\nticketing"]
   end

   subgraph StaffPC["STAFF PC"]
      App["C# WinForms launcher\nTicketing system Desktop App folder"]
      Config["config.txt\nTARGET_URL = Master PC IP"]
      Browser["Embedded Chromium browser\nclient renderer\nLocalStorage JWT"]
      WebBrowser["Regular browser\nChrome / Edge / Firefox"]
   end

   Network["LAN / TCP"]

   App -->|reads Master PC address| Config
   App -->|starts the embedded browser| Browser
   WebBrowser -->|user types Master PC URL| Frontend
   Browser -->|HTTP GET\nrequest frontend files from Master PC| Frontend
   Frontend -->|HTML / CSS / JS\nrendered in browser| Browser
   Frontend -->|HTML / CSS / JS\nrendered in browser| WebBrowser
   Browser -->|REST API requests\nsend login, ticket, and chat data| Backend
   WebBrowser -->|REST API requests\nsend login, ticket, and chat data| Backend
   Backend -->|JSON responses\nreturn login, ticket, and message data| Browser
   Backend -->|JSON responses\nreturn login, ticket, and message data| WebBrowser
   Browser -->|WebSocket events\nsend and receive live updates| Backend
   WebBrowser -->|WebSocket events\nsend and receive live updates| Backend
   Backend -->|query and save data| MySQL
   MySQL -->|records and query results| Backend
   Browser --- Network
   WebBrowser --- Network
   Backend --- Network

   style MasterPC fill:#2c3e50,stroke:#3498db,stroke-width:3px,color:#fff
   style StaffPC fill:#2c3e50,stroke:#2ecc71,stroke-width:3px,color:#fff
   style Network fill:#2c3e50,stroke:#f39c12,stroke-width:3px,color:#fff
```

### MASTER PC (Server Machine)

#### Backend Server (Node.js + Express)
- **Port**: 5000 (HTTP server)
- **Framework**: Express.js
- **Runtime**: Node.js
- **Entry Point**: `server.js`
- **Serves**: Frontend static files from `Backend/frontend/` + REST APIs + WebSocket server
- **Execution**: 
  - Can run as PM2-managed process
  - Can run as native executable (.exe) compiled from Node.js
  - Reads `.env` file for configuration (DB credentials, port, IP address)

#### Route Layer (`/Backend/routes/`)
Three main API route groups:

1. **Auth Routes** (`authRoutes.js`)
   - `POST /api/auth/login` → Login with username/password
   - `POST /api/auth/register` → Create new user account
   - Returns: JWT token (24-hour expiry)

2. **Ticket Routes** (`ticketRoutes.js`)
   - `GET /api/tickets` → Fetch all visible tickets (filtered by role)
   - `GET /api/tickets/:ticketId` → Get single ticket details
   - `POST /api/tickets` → Create new support ticket
   - `PATCH /api/tickets/:ticketId` → Update ticket status/priority/assignment (admin only)
   - `DELETE /api/tickets/:ticketId` → Delete ticket and all messages (admin only)

3. **Chat Routes** (`chatRoutes.js`)
   - `GET /api/chat/tickets/:ticketId/messages` → Load message history
   - `POST /api/chat/tickets/:ticketId/read` → Mark ticket as read
   - `DELETE /api/chat/messages/:messageId` → Delete own message only

#### Authentication & Authorization
- **Method**: JWT (JSON Web Token)
- **Location**: `middleware/authMiddleware.js`
- **Token Storage (Client)**: Browser LocalStorage
- **Token Lifetime**: 24 hours
- **Validation**: Every API request and WebSocket connection requires valid JWT
- **Roles**: 
  - `admin` — full access to all tickets, can assign/reassign, delete
  - `user` — can see only own tickets, create tickets, send messages

#### Real-time Communication (Socket.io)
- **Protocol**: WebSocket (with HTTP fallback)
- **Port**: Same as backend (5000)
- **Auth**: JWT token verified on connection handshake
- **Events**:
  - `join_ticket` — user enters ticket chat room
  - `leave_ticket` — user exits ticket chat room
  - `send_message` — user sends message (persisted to DB)
  - `admin_reply` — admin sends reply or internal note (persisted to DB)
  - Broadcasts new messages to all connected users in that ticket room

#### Controllers (`/Backend/controllers/`)

1. **Auth Controller** (`authController.js`)
   - `login(username, password)` → Validates credentials, returns JWT
   - `register(username, password, role)` → Creates user, hashes password with bcryptjs

2. **Ticket Controller** (`ticketController.js`)
   - `createTicket(userId, subject, category)` → Inserts new ticket, generates ticket_number (TKT-XXXX)
   - `getTickets(userId, role)` → Filters: admins see all, users see their own
   - `getTicket(ticketId, userId)` → Returns ticket + metadata + unread count
   - `updateTicket(ticketId, status, priority, assignedAdmin)` → Admin only
   - `deleteTicket(ticketId)` → Deletes ticket + all messages via CASCADE

3. **Chat Controller** (`chatController.js`)
   - `sendUserMessage(ticketId, userId, content)` → Persists message, broadcasts via Socket.io
   - `sendAdminReply(ticketId, adminId, content, isInternal)` → Internal notes visible to admins only
   - `markAsRead(ticketId, userId)` → Updates read status
   - `deleteMessage(messageId, userId)` → Sender only (checks sender_id == userId)

#### Socket Controller (`/Backend/socket/socketController.js`)
Handles business logic for Socket.io events:
- Validates user permissions
- Persists messages to DB
- Broadcasts to correct audience (ticket room or admin room)
- Updates unread counters
- Tracks online users

#### Database Connection (`/Backend/config/db.js`)
- **Pool Size**: 10 concurrent connections
- **Credentials**: Read from `.env` file
- **Connection String**: `mysql://user:password@localhost:3306/ticketing`
- **Query Execution**: Uses prepared statements to prevent SQL injection

---

### MySQL Database (Master PC)

**Port**: 3306 (local to Master PC, not exposed to network)

#### Database: `ticketing`

##### Table: `users`
```
id              INT PRIMARY KEY AUTO_INCREMENT
username        VARCHAR(50) UNIQUE NOT NULL
password_hash   VARCHAR(255) NOT NULL (bcryptjs hashed)
role            VARCHAR(20) CHECK (role IN 'admin', 'user')
```
- Stores both admin and regular user accounts
- Passwords never stored in plain text
- Seed data: admin / user1 / user2 / user3 (all password: 'password123')

##### Table: `tickets`
```
id                  INT PRIMARY KEY AUTO_INCREMENT
ticket_number       VARCHAR(20) UNIQUE NOT NULL (e.g., TKT-0001)
user_id             INT FOREIGN KEY → users(id)
assigned_admin_id   INT FOREIGN KEY → users(id) OR NULL (unassigned)
subject             VARCHAR(255) NOT NULL
category            VARCHAR(50) DEFAULT 'General'
status              VARCHAR(20) DEFAULT 'Open'
                    CHECK (status IN 'Open', 'In Progress', 'On-Hold', 'Closed')
priority            VARCHAR(10) DEFAULT 'Medium'
                    CHECK (priority IN 'Low', 'Medium', 'High', 'Urgent')
created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at          DATETIME AUTO-UPDATE
closed_at           DATETIME NULL (set when status = 'Closed')
```
- Each ticket is tied to one user (creator)
- Admins can assign tickets to themselves or leave unassigned
- Status tracks ticket lifecycle
- Timestamps for auditing

##### Table: `messages`
```
id          INT PRIMARY KEY AUTO_INCREMENT
ticket_id   INT FOREIGN KEY → tickets(id) ON DELETE CASCADE
sender_id   INT FOREIGN KEY → users(id) ON DELETE CASCADE
content     TEXT NOT NULL
is_read     TINYINT(1) DEFAULT 0
created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
```
- Messages belong to a specific ticket
- Sender can be user or admin
- If a message sender or ticket is deleted, all related messages cascade delete
- `is_read` flag tracks whether the message has been viewed

---

### STAFF PC (Client Machine)

#### What's Installed on Staff PC
**Only one folder is installed locally:** `Ticketing system Desktop App`

Inside that folder, the staff PC contains only these files:
1. `eTicketing.exe` — C# WinForms desktop wrapper with embedded Chromium browser
2. `config.txt` — Configuration file with Master PC IP address

**NO frontend files stored locally** — they are downloaded from Master PC at runtime

#### Desktop Client (C# WinForms + CefSharp)
- **Runtime**: .NET Framework 4.6.2 (ensures Windows 7 compatibility)
- **Browser Engine**: CefSharp 89.0.170 (embedded Chromium)
- **Architecture**: Native Windows executable (.exe)
- **Development**: Built in Visual Studio Community
- **Size**: Lightweight compared to Electron (no full Node.js runtime)
- **Role**: Wrapper only — launches embedded browser and points it to Master PC

#### Configuration (`config.txt`)
```
TARGET_URL=http://192.168.1.105:5000
```
- Single configuration file (no code recompilation needed)
- Allows same executable to target different Master PCs
- Points to Master PC's backend server on LAN
- Staff PC must be on same network and able to reach Master PC IP

#### Execution Flow
1. User double-clicks `eTicketing.exe` on Staff PC
2. C# WinForms application starts
3. Reads `config.txt` for Master PC target URL
4. Launches embedded Chromium window
5. **Makes HTTP GET request to Master PC**: `http://[Master-IP]:5000/`
6. **Master PC responds** with frontend files (HTML/CSS/JS)
7. Chromium **renders** those files inside native window
8. All subsequent interactions (API calls, WebSocket) go back to Master PC

#### Embedded Browser
- **Downloads and renders** SPA from Master PC
- Executes JavaScript in Chromium sandbox
- Has access to LocalStorage (for JWT token)
- Communicates with backend via HTTP and WebSocket
- **Important**: No frontend files stored on Staff PC

#### Frontend Layer (`/Backend/frontend/` on Master PC Only)

**Location**: `C:\eTicketing\Backend\frontend\` on Master PC
**Served by**: Express.js backend on port 5000
**Access**: Downloaded on-demand when Staff PC connects

##### HTML Files
- `index.html` — Root page with routing logic
- `login.html` — Login/register forms
- `dashboard.html` — Ticket list for admins or user's tickets
- `workspace.html` — Chat interface for a specific ticket

##### JavaScript (`/Backend/frontend/js/`)
- **api.js** — HTTP request wrappers (REST API calls to backend)
- **auth.js** — JWT token management, login/register handlers
- **dashboard.js** — Ticket list UI, filtering, selection, deletion
- **workspace.js** — Chat UI, message sending/receiving, ticket details management
- **socket.js** — Socket.io client connection and event handlers
- **register.js** — User registration flow

##### CSS (`/Backend/frontend/css/`)
- **styles.css** — Complete styling for all pages, dark theme

#### Key Frontend Interactions

**Login Flow:**
1. User enters username/password on `login.html`
2. JavaScript calls `POST /api/auth/login`
3. Backend returns JWT token
4. Token stored in LocalStorage
5. Redirected to `dashboard.html` or `workspace.html` depending on role

**Viewing Tickets:**
1. Dashboard loads all visible tickets (filtered by role)
2. Admins see all tickets with selection checkboxes
3. Users see only their own tickets
4. Click on ticket → navigate to `workspace.html?id=TICKET_ID`

**Real-time Chat:**
1. User enters a ticket's workspace
2. JavaScript emits `join_ticket` via Socket.io
3. Server adds user to that ticket's room
4. User types message and clicks send
5. `send_message` event sent via Socket.io
6. Backend persists message to DB
7. Backend broadcasts message to all users in that ticket room
8. All connected clients receive message in real-time

**Admin Operations:**
1. Admin selects multiple tickets on dashboard
2. Can change status, priority, or assign to self
3. Or delete selected tickets (triggers cascade delete of messages)
4. Can send internal notes visible only to admins

---

## 🌐 Network Communication

### Master PC → Staff PC (and vice versa)

#### TCP Port 5000 (Primary Communication Channel)

**1. HTTP (Stateless REST API)**
- **Direction**: Bidirectional
- **Method**: HTTPS or HTTP (over LAN, typically HTTP)
- **Format**: JSON request/response
- **Auth**: JWT token in Authorization header
- **Examples**:
  - `GET /api/tickets` — Fetch all visible tickets
  - `POST /api/chat/tickets/123/messages` — Send message to ticket 123
  - `PATCH /api/tickets/123` — Update ticket status

**2. WebSocket (Persistent Real-time Connection)**
- **Direction**: Bidirectional persistent connection
- **Protocol**: WebSocket upgrade from HTTP
- **Auth**: JWT token in handshake
- **Purpose**: Real-time message delivery, online user presence
- **Events**:
  - Client → Server: `send_message`, `admin_reply`, `join_ticket`, `leave_ticket`
  - Server → Clients: `new_message`, `message_deleted`, `ticket_updated`, `user_online`, `user_offline`

#### Network Topology
```
Staff PC 1 ─┐
            ├─────── LAN (TCP/IP) ─────┬─── MySQL Port 3306 (localhost only)
Staff PC 2 ─┤                           │
            │                       Master PC
Staff PC N ─┘                       (Express Server)
                                     Port 5000
```

### Data Transmission Example: Send Message

1. **Staff PC (User types message)**
   - JavaScript captures input
   - Reads JWT from LocalStorage
   - Emits Socket.io event: `{ ticketId: 123, content: "Hello admin" }`

2. **Network (LAN)**
   - WebSocket frame sent over TCP to `[Master-IP]:5000`

3. **Master PC (Backend receives)**
   - Socket.io server receives event
   - Validates JWT token
   - `socketController.handleUserMessage()` called
   - Message is inserted into `messages` table

4. **Master PC (Database)**
   - `INSERT INTO messages (ticket_id, sender_id, content, created_at) VALUES (123, 2, "Hello admin", NOW())`

5. **Master PC (Broadcasting)**
   - Backend queries all online admins from `onlineUsers` map
   - Backend queries all users in that ticket's room
   - Emits `new_message` event to all of them

6. **Network (LAN)**
   - WebSocket frame sent back to all connected staff PCs

7. **Staff PC (All clients receive)**
   - Socket.io event received: `{ messageId: 999, sender: "user1", content: "Hello admin", timestamp: "..." }`
   - JavaScript updates DOM
   - New message appears in chat window in real-time

---

## 🔐 Security & Authentication

### JWT Token Flow

**1. Login (Stateless Authentication)**
```
Staff PC                           Master PC
  │                                   │
  ├─ POST /api/auth/login ────────────>│
  │  { username, password }            │
  │                                    │
  │                            1. Hash password
  │                            2. Compare with DB
  │                            3. If match:
  │                         JWT.sign({ id, username, role })
  │                                    │
  │  <────── Return JWT ────────────────┤
  │  { token: "eyJhbGc..." }            │
  │                                    │
  └─ Store in LocalStorage             │
     (Valid for 24 hours)
```

**2. Authenticated Requests**
```
Staff PC                           Master PC
  │                                   │
  ├─ GET /api/tickets ────────────────>│
  │  Headers: { Authorization: "Bearer eyJhbGc..." }
  │                                    │
  │                            Middleware:
  │                            JWT.verify(token)
  │                            Extract user info
  │                            Check permissions
  │                                    │
  │  <────── Return data ───────────────┤
  │  { tickets: [...] }
```

### Password Security
- **Hashing**: bcryptjs with salt rounds = 10
- **Storage**: Only hash stored in DB, never plain text
- **Verification**: Password hashed again and compared during login
- **Seed Users**: Hashes provided, cannot be reversed to original password

### Role-Based Access Control (RBAC)
- **Auth Middleware**: `authorizeRoles('admin')` check on sensitive routes
- **Controller Logic**: Additional checks in business logic
- **DB Layer**: Foreign key constraints and cascading deletions
- **Frontend**: Conditional UI rendering based on `currentUser.role`

---

## 📊 Data Flow Diagrams

### Flow 1: User Creates Ticket

```
Staff PC (User Role)
  │
  ├─ Click "+ Create Ticket"
  │
  ├─ Fill form: subject, category
  │
  ├─ POST /api/tickets
  │  { subject: "Login not working", category: "Technical" }
  │  ├─ JWT token in header ✓
  │  └─ Validated by Auth Middleware
  │
  └─ Backend (Master PC)
     │
     ├─ Generate ticket_number (TKT-XXXX)
     │
     ├─ INSERT INTO tickets
     │  (user_id, ticket_number, subject, category, status='Open', priority='Medium')
     │
     ├─ MySQL returns INSERT ID
     │
     └─ Return response to Staff PC
        { id: 123, ticket_number: "TKT-0042", subject: "...", created_at: "..." }
        
        │
        └─ Redirect to workspace.html?id=123 (chat interface)
```

### Flow 2: Admin Assigns Ticket & Sends Reply

```
Staff PC (Admin Role)
  │
  ├─ View dashboard with all tickets
  │
  ├─ Click ticket TKT-0042
  │
  ├─ Opens workspace.html
  │  (Socket.io: emit join_ticket { ticketId: 123 })
  │
  ├─ Admin clicks "Assign to Me"
  │  │
  │  └─ PATCH /api/tickets/123
  │     { assigned_admin_id: 5 } (admin's ID)
  │     └─ Update DB: UPDATE tickets SET assigned_admin_id=5 WHERE id=123
  │
  ├─ Admin types reply: "Check your browser cache"
  │
  ├─ Socket.io: emit admin_reply
  │  { ticketId: 123, content: "Check...", isInternal: false }
  │
  └─ Backend (Master PC)
     │
     ├─ socketController.handleAdminReply()
     │
     ├─ INSERT INTO messages
     │  (ticket_id, sender_id, content, created_at)
     │  Values (123, 5, "Check...", NOW())
     │
     ├─ Broadcast to all users in "ticket_123" room
     │
     └─ Staff PC (All connected clients)
        │
        ├─ Receive new_message event
        │
        ├─ Update chat UI (message appears instantly)
        │
        └─ If message is unread, mark unread count
```

### Flow 3: Real-time Chat Between User & Admin

```
Timeline:
T0:00  User opens ticket TKT-0042 in workspace
       └─ Emits: join_ticket { ticketId: 123 }
       └─ Backend adds user to "ticket_123" room
       
T0:15  User types "I restarted, but still broken"
       └─ Emits: send_message { ticketId: 123, content: "..." }
       └─ Backend: INSERT message, broadcasts to admins + ticket room
       
T0:20  Admin joins same ticket
       └─ Emits: join_ticket { ticketId: 123 }
       └─ Backend loads chat history from DB
       └─ Displays all previous messages
       
T0:45  Admin sends reply: "Let me check your account"
       └─ Emits: admin_reply { ... }
       └─ Backend: INSERT message, broadcasts
       └─ User sees reply instantly in chat
       
T1:00  Admin changes status to "In Progress"
       └─ PATCH /api/tickets/123 { status: "In Progress" }
       └─ Backend: UPDATE tickets SET status='In Progress'
       └─ Broadcast ticket_updated event
       └─ All clients see status change in real-time
```

---

## 🔄 Master PC Setup (Server)

### Deployment Checklist

1. **Install MySQL 8.x**
   - Create database: `ticketing`
   - Run `database/setup.sql` to create tables

2. **Install Node.js**
   - Or use pre-built executable if available

3. **Setup Backend**
   - Copy `Backend/` folder to `C:\eTicketing\Backend`
   - Create `.env` file with:
     ```
     PORT=5000
     DB_USER=root
     DB_PASSWORD=your_password
     DB_HOST=localhost
     DB_PORT=3306
     DB_NAME=ticketing
     JWT_SECRET=your_secret_key_here
     IP_ADDRESS=192.168.1.100  (Master PC's LAN IP)
     ```

4. **Start Backend**
   - Option A: `npm start` (requires Node.js)
   - Option B: Run executable (pre-compiled)
   - Option C: PM2: `pm2 start server.js --name "eticketing"`

5. **Firewall**
   - Allow port 5000 (TCP) in Windows Firewall
   - Staff PCs must be on same network and able to reach Master PC IP

---

## 👥 Staff PC Setup (Clients)

### Deployment Checklist

1. **Distribute C# WinForms Client**
   - Copy the `Ticketing system Desktop App` folder to the staff PC
   - That folder should contain only `eTicketing.exe` and `config.txt`

2. **Create/Update `config.txt`**
   ```
   TARGET_URL=http://192.168.1.100:5000
   ```
   (Use Master PC's actual LAN IP)

3. **Run Application**
   - Double-click `eTicketing.exe`
   - Desktop app launches with embedded browser
   - Frontend loads from the Master PC backend over the LAN

4. **Create Shortcut (Optional)**
   - Right-click .exe → Send to Desktop (create shortcut)
   - Users can pin to Start menu

---

## 📋 API Endpoints Summary

### Authentication
- `POST /api/auth/login` — Login with credentials
- `POST /api/auth/register` — Register new account

### Tickets
- `GET /api/tickets` — List all visible tickets
- `GET /api/tickets/:ticketId` — Get single ticket
- `POST /api/tickets` — Create new ticket
- `PATCH /api/tickets/:ticketId` — Update status/priority/assigned admin (admin only)
- `DELETE /api/tickets/:ticketId` — Delete ticket (admin only)
- `PATCH /api/tickets/:ticketId/subject` — Update ticket subject (user only)

### Chat Messages
- `GET /api/chat/tickets/:ticketId/messages` — Load message history
- `POST /api/chat/tickets/:ticketId/read` — Mark ticket as read
- `DELETE /api/chat/messages/:messageId` — Delete own message

### Socket.io Events
- **Client → Server**:
  - `join_ticket { ticketId }` — User enters ticket room
  - `leave_ticket { ticketId }` — User exits ticket room
  - `send_message { ticketId, content }` — User sends message
  - `admin_reply { ticketId, content, isInternal }` — Admin sends reply

- **Server → Clients**:
  - `new_message { messageId, sender, content, timestamp }` — New message received
  - `message_deleted { messageId }` — Message was deleted
  - `ticket_updated { ticketId, status, priority, assignedAdmin }` — Ticket changed
  - `user_online { userId, username }` — User came online
  - `user_offline { userId }` — User went offline

---

## 🎯 Key Design Decisions

1. **Single Backend on Master PC**
   - Simplifies data consistency
   - No need for database replication
   - All business logic in one place

2. **JWT for Stateless Auth**
   - Lightweight, doesn't require server-side session storage
   - Scales well if more admins added
   - Token includes user info (no DB lookup on every request)

3. **Socket.io for Real-time**
   - WebSocket protocol for low-latency messaging
   - Automatic fallback to HTTP long-polling if needed
   - Room-based broadcasting for efficiency

4. **C# WinForms + CefSharp**
   - Supports older Windows versions (Windows 7+)
   - Lightweight compared to Electron
   - Native Windows look and feel
   - Embeds existing web frontend

5. **MySQL on Same Machine**
   - Simplifies setup and maintenance
   - Database only accessible locally (port 3306 not exposed to network)
   - Data stays on secure Master PC

6. **Configuration File (config.txt)**
   - No code recompilation needed for different Master PCs
   - Easy deployment to multiple offices
   - Runtime IP/port changes without rebuilding

---

## 🚀 Scalability Considerations

### Current Setup
- Supports 50-100 concurrent users on typical hardware
- All connected clients share same backend instance
- MySQL connection pool: 10 connections

### If Scaling Needed
1. **Multiple Backends**: Load balance across servers, share single MySQL
2. **Message Queue**: Redis or RabbitMQ for async message processing
3. **Caching**: Redis for user sessions and ticket cache
4. **Database Replication**: MySQL master-slave for read scaling
5. **Separate Admin Nodes**: Run admin-specific backend on different machine

---

## 🔍 Troubleshooting Reference

**Issue**: Staff PC can't connect to Master PC
- **Check**: Master IP in `config.txt` is correct
- **Check**: Windows Firewall allows port 5000
- **Check**: Network connectivity (ping Master PC)
- **Check**: Backend is running on Master PC

**Issue**: Login fails
- **Check**: Correct username/password
- **Check**: User exists in `users` table
- **Check**: Backend logs for authentication errors

**Issue**: Messages not appearing in real-time
- **Check**: WebSocket connection established (check browser DevTools Network tab)
- **Check**: JWT token valid and not expired
- **Check**: Client joined correct ticket room

**Issue**: Database connection errors
- **Check**: MySQL service running on Master PC
- **Check**: `.env` file has correct DB credentials
- **Check**: Network connectivity between backend and MySQL (both on localhost)

---

## 📝 Summary

The eTicketing system follows a **traditional client-server architecture** optimized for:
- **Small to medium company deployments** on a single local network
- **Lightweight client distribution** via desktop executables
- **Real-time collaboration** between users and support staff
- **Data centralization** with single source of truth on Master PC
- **Legacy OS compatibility** (Windows 7+) via .NET Framework 4.6.2

All communication is encrypted over LAN, authenticated via JWT, and data is persisted in a centralized MySQL database on the Master PC.
