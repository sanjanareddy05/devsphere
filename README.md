# DevSphere

A distributed developer collaboration platform — real-time chat, workspaces, and channels, built with a microservices architecture.

## Architecture

```
                        ┌─────────────┐
                        │   Frontend  │  React + Vite + TS
                        │  :5173      │  Tailwind, Zustand
                        └──────┬──────┘
                               │ HTTP / WebSocket
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ Auth Service │ │ API Gateway  │ │ Chat Service │
        │    :3001     │ │    :3000     │ │    :3002     │
        │  JWT + bcrypt│ │ Workspaces  │ │ Socket.IO    │
        └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
               │                │                 │
               ▼                ▼                 ▼
        ┌──────────┐     ┌──────────┐     ┌──────────┐
        │ Postgres │     │  Redis   │     │  MongoDB │
        │  :5432   │     │  :6379   │     │  :27017  │
        └──────────┘     └──────────┘     └──────────┘
```

## Services

| Service | Port | Stack | Responsibility |
|---|---|---|---|
| `auth-service` | 3001 | Express, Postgres, bcrypt, JWT | Register, login, token refresh |
| `api-gateway` | 3000 | Express, Postgres, Redis | Workspaces, channels, rate limiting |
| `chat-service` | 3002 | Express, Socket.IO, MongoDB | Real-time messaging, presence |
| `frontend` | 5173 | React, Vite, Tailwind, Zustand | UI |

## Quick Start

### Prerequisites

- Node.js v20+
- Docker Desktop

### 1. Clone and install

```bash
git clone <your-repo>
cd devsphere
npm run install:all
```

### 2. Start infrastructure

```bash
npm run infra:up
# Starts: Postgres, MongoDB, Redis
```

### 3. Set up environment variables

```bash
# Copy and fill in each service
cp services/auth-service/.env.example services/auth-service/.env
cp services/api-gateway/.env.example services/api-gateway/.env
cp services/chat-service/.env.example services/chat-service/.env
```

### 4. Run database migrations

```bash
cd services/auth-service
npm run db:migrate
```

If you need to override the default database URL, set `DATABASE_URL` before running the script or update `services/auth-service/package.json`.

### 5. Start all services (separate terminals)

```bash
# Terminal 1
npm run auth

# Terminal 2
npm run gateway

# Terminal 3
npm run chat

# Terminal 4
npm run frontend
```

Open http://localhost:5173 → Register → Create a workspace → Invite members → Start chatting.

Note: The invite experience now supports a token-based invite link and acceptance flow. If SMTP is configured, the service will also attempt to send an email with the acceptance link; otherwise it returns the link directly in the API response and UI.

## Key Engineering Decisions

### Auth — Two-Token Pattern
- **Access token** (15 min) sent as `Authorization: Bearer` header
- **Refresh token** (7 days) stored in `httpOnly` cookie, never accessible to JS
- Refresh tokens are **hashed** in the DB (SHA-256); raw token never stored
- **Rotation** on every refresh call prevents token reuse attacks

### Workspace Creation — SQL Transaction
Creating a workspace atomically creates the workspace row + owner membership in a `BEGIN/COMMIT` block. Either both succeed or neither does.

### Message Pagination — Cursor-based
`GET /channels/:id/messages?cursor=<lastId>&limit=30` returns messages older than the cursor ID. Unlike offset pagination, this is consistent when new messages arrive during scroll — you won't skip or repeat messages.

### Chat Scalability — Socket.IO Redis Adapter (Phase 2)
In Phase 2, adding the Redis adapter makes Socket.IO work across multiple chat-service instances — events published to one instance are forwarded to all others via Redis pub/sub.

### MongoDB for Messages
Chat messages are high-write, schema-flexible, and rarely updated. MongoDB's document model and horizontal scalability make it a better fit than Postgres here.

## API Reference

### Auth Service (`:3001`)

```
POST /auth/register    { email, password, name }   → 201 { user, accessToken }
POST /auth/login       { email, password }          → 200 { user, accessToken }
POST /auth/refresh     (cookie)                     → 200 { accessToken }
POST /auth/logout                                   → 200
GET  /auth/me          (Bearer)                     → 200 { user }
```

### API Gateway (`:3000`)

```
POST   /workspaces                    create workspace
GET    /workspaces                    list my workspaces
GET    /workspaces/:id                workspace detail
POST   /workspaces/:id/invite         invite member (admin only)
GET    /workspaces/:id/members        list members
POST   /workspaces/:id/channels       create channel (admin only)
GET    /workspaces/:id/channels       list channels
```

### Chat Service (`:3002`)

**REST:**
```
GET /channels/:id/messages?cursor=<id>&limit=30    message history
```

**WebSocket events (client → server):**
```
join_channel    { channelId }
send_message    { channelId, workspaceId, content }
typing          { channelId }
stop_typing     { channelId }
add_reaction    { messageId, channelId, emoji }
```

**WebSocket events (server → client):**
```
message:new     { _id, channelId, senderId, senderName, content, createdAt }
typing          { userId, userName, channelId }
stop_typing     { userId, channelId }
presence        { userId, status: 'online' | 'offline' }
reaction:updated { messageId, emoji, userId }
```

## Roadmap

- **Phase 2** — Redis presence, rate-limit store, Socket.IO horizontal scaling
- **Phase 3** — Kafka async notifications (email + in-app)
- **Phase 4** — Collaborative documents (Yjs CRDT)
- **Phase 5** — Elasticsearch full-text search + Python ML recommendations
- **Phase 6** — Analytics dashboard, CI hardening, cloud deployment (AWS ECS / Render)
