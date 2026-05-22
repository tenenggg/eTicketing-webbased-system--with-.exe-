## Mermaid Architecture Diagram

```mermaid
graph TB
   subgraph MasterPC["MASTER PC"]
      Backend["Node.js + Express backend\nBackend folder\nserver.js"]
      Frontend["Frontend files\nHTML / CSS / JS\nBackend/frontend/"]
      MySQL["MySQL database\nticketing"]
   end

   subgraph StaffPC["STAFF PC"]
      App["C# WinForms launcher\n(embedded .exe reads config.txt internally)\nTicketing system Desktop App folder"]
      ClientBrowser["Embedded Client Browser\n(launched by .exe)\nLocalStorage JWT"]
      WebBrowser["Regular browser\nChrome / Edge / Firefox"]
   end

   Network["LAN / TCP (wired or wireless)"]

   App -->|starts embedded browser with TARGET_URL| ClientBrowser

   ClientBrowser -->|connect to TARGET_URL from config| Network
   WebBrowser -->|user types http://IP:PORT| Network

   Network -->|HTTP GET / REST / WebSocket| Backend
   Network -->|request frontend files| Frontend
   Frontend -->|HTML / CSS / JS\nrendered in browser| ClientBrowser
   Frontend -->|HTML / CSS / JS\nrendered in browser| WebBrowser
   Backend -->|JSON responses / WS frames| Network
   Network -->|responses / WS frames| ClientBrowser
   Network -->|responses / WS frames| WebBrowser
   ClientBrowser -->|WebSocket events\nsend and receive live updates| Network
   WebBrowser -->|WebSocket events\nsend and receive live updates| Network
   Backend -->|query and save data| MySQL
   MySQL -->|records and query results| Backend

   %% Note: Client requests (embedded or regular) travel over the LAN/network to the Master PC. If the client runs on the Master PC, requests may use localhost instead of LAN.
   %% WS frames: WebSocket "frames" are the low-level data packets (text or binary) exchanged over a WebSocket connection that carry messages such as JSON payloads.

   style MasterPC fill:#2c3e50,stroke:#3498db,stroke-width:3px,color:#fff
   style StaffPC fill:#2c3e50,stroke:#2ecc71,stroke-width:3px,color:#fff
   style Network fill:#2c3e50,stroke:#f39c12,stroke-width:3px,color:#fff
```


### Ticket Chat Flowcharts

#### Admin Ticket Chat Flow

```mermaid
flowchart TD
   A[Admin logs in] --> B[Dashboard loads visible tickets]
   B --> C[Search / filter / sort tickets]
   C --> D[Select a ticket]
   D --> E[Open workspace.html?id=TICKET_ID]
   E --> F[Socket connects with JWT]
   F --> G[join_ticket event]
   G --> H[Load ticket details and message history]
   H --> I[POST /api/chat/tickets/:ticketId/read]
   I --> J[Mark unread messages as read]
   J --> K[Admin reviews messages]
   K --> L{Take an action}
   L --> M[Send reply with admin_reply]
   L --> N[Change status / priority / assigned admin]
   L --> O[Delete own message]
   M --> P[Socket server saves message]
   P --> Q[Broadcast receive_message to ticket room and admins]
   N --> R[PATCH /api/tickets/:ticketId]
   R --> S[Broadcast ticket_updated]
   O --> T[DELETE /api/chat/messages/:messageId]
   T --> U[Broadcast message_deleted]
   Q --> V[Workspace refreshes message list]
   S --> W[Workspace refreshes ticket details]
   U --> V
```

#### User Ticket Chat Flow

```mermaid
flowchart TD
   A[User logs in] --> B[Dashboard loads only own tickets]
   B --> C[Search / filter / sort tickets]
   C --> D[Select a ticket]
   D --> E[Open workspace.html?id=TICKET_ID]
   E --> F[Socket connects with JWT]
   F --> G[join_ticket event]
   G --> H[Load ticket details and message history]
   H --> I[GET /api/chat/tickets/:ticketId/messages]
   I --> J{Ticket closed?}
   J -- No --> K[Type message in chat box]
   J -- Yes --> L[Chat input hidden and closed banner shown]
   K --> M[Send message with send_message]
   M --> N[Socket server validates ownership]
   N --> O[Socket server saves message]
   O --> P[Broadcast receive_message to ticket room and admins]
   P --> Q[Workspace refreshes message list]
   Q --> R{Need to remove own message?}
   R -- Yes --> S[DELETE /api/chat/messages/:messageId]
   S --> T[Broadcast message_deleted]
   R -- No --> U[Keep chatting or go back to dashboard]
   T --> Q
```


Client → Server:

HTTP requests (REST verbs: GET/POST/PATCH/DELETE) — typically include Authorization: Bearer <JWT>.
WebSocket frames/messages over the persistent socket (Socket.io emits events which are carried as WS frames when using WebSocket transport).
Server → Client:

HTTP responses (status + headers) with a JSON body for REST endpoints.
WebSocket frames/messages pushed over the socket for live updates (server can push anytime).
Notes:

WebSocket is bidirectional — either side can send frames without a prior request.
Socket.io usually uses WebSocket but may fall back to HTTP polling; its events map to messages/frames when WebSocket is used.
JWT must be verified on both HTTP routes (middleware) and on the socket handshake (e.g., io.use(...)).
GPT-5 mini • 0x