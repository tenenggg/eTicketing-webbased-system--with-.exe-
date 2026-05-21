# Backend (eTicketing)

This folder contains the eTicketing API server, authentication logic, chat endpoints, Socket.io events, and static frontend hosting.

## Responsibilities

- Expose REST APIs for authentication and chat operations
- Validate JWTs and enforce role-based access
- Manage real-time communication through Socket.io
- Persist users and messages in MySQL
- Serve static frontend files from `Backend/frontend`

## Folder Map

```text
config/       -> DB pool configuration
controllers/  -> Route handlers (auth + chat)
middleware/   -> JWT auth and role authorization
models/       -> SQL query layer
routes/       -> API route definitions
frontend/     -> Static web UI served by Express
server.js     -> App bootstrap + Socket.io wiring
```

## Environment Variables

Create `Backend/.env` from `Backend/.env.example`:

```bash
copy .env.example .env
```

Then set your real values in `Backend/.env`:

```env
PORT=5000
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ticketing
JWT_SECRET=replace_with_a_strong_secret
IP_ADDRESS=127.0.0.1
```

Notes:
- `JWT_SECRET` must be unique and strong in production.
- `IP_ADDRESS` controls the bind address for server startup.

## Install And Run

```bash
cd Backend
npm install
npm start
```

## Build Executable

```bash
npm run build
```

This uses `pkg` to generate a Windows executable (`eticketingServer.exe`).

## API Endpoints

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`

### Tickets

- `GET /api/tickets` (Fetch all visible tickets)
- `POST /api/tickets` (Create a new ticket)
- `GET /api/tickets/:ticketId` (Get single ticket details)
- `PATCH /api/tickets/:ticketId` (Update status/priority/assignment)

### Messages

- `GET /api/chat/tickets/:ticketId/messages` (Load ticket chat history)
- `POST /api/chat/tickets/:ticketId/read` (Mark ticket as read)
- `DELETE /api/chat/messages/:messageId` (Sender only)

## Socket Events

Inbound events:
- `send_message` from user/admin
- `admin_reply` from admin

Outbound events:
- `receive_message`
- `message_sent`
- `message_error`
- `message_deleted`

Authentication:
- Socket handshake requires JWT in `socket.handshake.auth.token`.

## Database

Schema and seed data are in `database/setup.sql`.

Main tables:
- `users`
- `tickets`
- `messages`

Seed users:
- `admin1`
- `user1`
- `user2`

Default seed password:
- `password123`

Change these immediately in real deployments.

## Operational Notes

- PM2 is recommended for persistent backend process management.
- Ensure firewall allows backend port (default 5000).
- If backend and client are on different origins, keep CORS policy aligned.
