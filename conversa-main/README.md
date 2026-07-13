# Conversa — MERN Real-Time Chat Application

<div align="center">

![MongoDB](https://img.shields.io/badge/MongoDB-%2347A248.svg?style=flat&logo=mongodb&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-%23000000.svg?style=flat&logo=express&logoColor=white)
![React](https://img.shields.io/badge/React%2019-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)
![Node.js](https://img.shields.io/badge/Node.js-%23339933.svg?style=flat&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-%23000000.svg?style=flat&logo=socket.io&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-%2306B6D4.svg?style=flat&logo=tailwindcss&logoColor=white)
![Amazon S3](https://img.shields.io/badge/Amazon%20S3-FF9900?style=flat&logo=amazons3&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-AI-4285F4?style=flat&logo=google&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)

A full-stack, production-grade real-time chat application built with the MERN stack and Socket.IO. Features include one-on-one messaging, a personalised AI chatbot powered by Google Gemini, image sharing via AWS S3, email verification, email notifications, and a fully responsive dark/light UI built with React 19, TypeScript, Tailwind CSS v4, and shadcn/ui components.

</div>

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Data Models](#data-models)
- [REST API Reference](#rest-api-reference)
- [Socket.IO Events](#socketio-events)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
  - [Docker (recommended)](#docker-recommended)
  - [Manual (local development)](#manual-local-development)
- [Scripts](#scripts)
- [Security Design](#security-design)
- [Background Jobs](#background-jobs)
- [License](#license)

---

## Features

### Authentication & Email Verification
- **Register / Login** with email and password (bcrypt hashed, JWT issued with 7-day expiry)
- **OTP Login** — request a one-time password sent via Nodemailer / Gmail SMTP; time-limited (5 min), bcrypt-stored
- **Email verification** — after registration (or on first login for existing accounts), users must verify their email with a 6-digit OTP before accessing the dashboard; unverified users are always redirected to `/verify-email`
- **Persistent sessions** — JWT stored in `localStorage`; `auth-token` header used on every API call
- **Account deletion** — soft-anonymises the account (clears name, email, bio, credentials) while preserving conversation history for other participants

### Profile Management
- Update name, about text, and profile picture
- Change password (old password verification required)
- Profile pictures uploaded directly from the browser to AWS S3 via pre-signed POST URLs (max 5 MB, images only); removal resets to a generated ui-avatars.com URL

### Messaging
- **Real-time one-on-one chat** over Socket.IO
- **Text and image messages** — images uploaded to S3 with optional caption text
- **Reply to message** — `replyTo` reference stored per message; displayed as quoted context in the UI
- **Delete for me** — hard-removes a message from your view only (appended to `hiddenFrom`)
- **Delete for everyone** — soft-delete sets `softDeleted: true`; message shows as *"This message was deleted"* tombstone for all members
- **Bulk hide** — hide multiple selected messages at once for yourself
- **Clear chat** — hide the entire conversation history from your view with a single action
- **Star / unstar messages** — bookmark individual messages; view all starred messages in a dedicated page
- **Seen receipts** — `seenBy` array tracks who read each message and when
- **Unread counts** — per-user counters maintained on the `Conversation` document, reset on room join
- **Latest message preview** — `latestmessage` field keeps the chat list up to date in real time

### AI Chatbot
- Every user gets a **personal AI Chatbot** conversation created automatically at registration
- Powered by **Google Gemini** (via `@google/genai`) with configurable model
- **Streaming responses** — bot replies are streamed chunk-by-chunk over Socket.IO (`bot-chunk`, `bot-done`) so text appears progressively
- **Context-aware** — last 19 text messages sent as chat history on every request, giving the bot memory of the conversation
- **Typing indicator** — bot emits `typing` / `stop-typing` while generating
- **Rollback on error** — if the Gemini stream fails, the user message is deleted and `bot-error` is emitted

### Email Notifications
- When a message is received and the recipient is **completely offline** (no open sockets), a branded HTML email is sent with a message preview and a deep-link back to the conversation
- **Fire-and-forget** — the email is never awaited in the socket path, adding zero latency to message delivery
- Users can **toggle email notifications** on/off from the Settings page (`/user/profile`); preference is persisted to the database

### Real-Time Presence & Notifications
- **Online / Offline status** — `isOnline` flag updated on socket connect/disconnect; broadcast to all conversation partners
- **Last seen** — timestamp recorded on disconnect, served via API
- **Multi-device / multi-tab aware** — `Map<userId, Set<socketId>>` tracks all open sockets; user is only marked offline when their *last* socket closes
- **Stale online cleanup** — background cron job runs every hour to force-offline users whose socket disconnect was missed (e.g. server crash)
- **Typing indicators** — `typing` / `stop-typing` events broadcast to the conversation room *and* to the receiver's personal room if they are online but not viewing that chat
- **In-app push notification** — `new-message-notification` event sent to the receiver's personal room when they are not inside the active conversation

### Conversation Management
- **Start a conversation** — search for any registered user; reuses an existing conversation if one already exists
- **Conversations list** — sorted by `updatedAt` descending; pinned conversations always appear at the top
- **Pin / unpin conversations** — per-user; stored as `pinnedConversations` array on the User document
- **Block / unblock users** — `blockedUsers` array on the User document
  - Blocked users cannot send messages (checked server-side before every `send-message` socket event)
  - Blocked users see sanitised profile information (generic name, avatar, and offline status)
- **User discovery** — paginated, searchable, and sortable list of users with whom you have no existing conversation

### UI & UX
- **React 19** with full **TypeScript** type safety
- **Tailwind CSS v4** with **shadcn/ui** component library
- **Dark / Light / System** theme toggle powered by `next-themes`
- Fully **responsive** — optimised for both desktop and mobile
- **React Router v7** nested route layout system (`DashboardLayout` → `ConversationLayout`)
- **Sonner** toast notifications
- **Markdown rendering** in bot messages via `react-markdown` + `remark-gfm`

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS v4, shadcn/ui, React Router v7 |
| **Backend** | Node.js, Express.js 4 |
| **Database** | MongoDB (Mongoose 8) |
| **Real-time** | Socket.IO 4 (server + client) |
| **Authentication** | JSON Web Tokens (jsonwebtoken), bcryptjs |
| **AI** | Google Gemini via `@google/genai` |
| **File Storage** | AWS S3 (pre-signed POST uploads) |
| **Email** | Nodemailer (Gmail SMTP) — OTP login, email verification, message notifications |
| **Containerisation** | Docker, Docker Compose |

---

## Project Structure

```
conversa/
├── docker-compose.yml                 # Orchestrates mongo + backend + frontend
├── .env.example                       # Template for all environment variables
│
├── backend/
│   ├── Dockerfile
│   ├── index.js                       # Express app entry point, HTTP server, Socket.IO init
│   ├── db.js                          # MongoDB connection
│   ├── secrets.js                     # Environment variable exports
│   ├── Controllers/
│   │   ├── auth-controller.js         # register, login, OTP login, authUser,
│   │   │                              #   sendVerificationOtp, verifyEmail
│   │   ├── conversation-controller.js # create, list, get, togglePin
│   │   ├── message-controller.js      # allMessage, delete, bulkHide, star, clear, AI streaming
│   │   └── user-controller.js         # updateProfile, block, S3 presign, user search,
│   │                                  #   deleteAccount, getBlockStatus
│   ├── Models/
│   │   ├── User.js                    # Full user schema (see Data Models)
│   │   ├── Conversation.js            # members, latestmessage, unreadCounts
│   │   └── Message.js                 # seenBy, hiddenFrom, softDeleted, starredBy, replyTo
│   ├── Routes/
│   │   ├── auth-routes.js
│   │   ├── conversation-routes.js
│   │   ├── message-routes.js
│   │   └── user-routes.js
│   ├── socket/
│   │   ├── index.js                   # Socket.IO setup, JWT auth middleware, userSocketMap
│   │   └── handlers.js                # All socket event handlers + email notification trigger
│   ├── middleware/
│   │   └── fetchUser.js               # JWT verification middleware for REST routes
│   ├── utils/
│   │   └── sendMessageEmail.js        # Fire-and-forget offline message email helper
│   ├── jobs/
│   │   └── staleOnlineUsers.js        # Hourly cleanup of stale isOnline flags
│   └── scripts/
│       ├── seed-test-users.js
│       └── delete-test-users.js
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf                     # SPA fallback + asset caching config
    └── src/
        ├── App.tsx                    # Route definitions
        ├── pages/
        │   ├── Home.tsx
        │   ├── Login.tsx              # Password + OTP login tabs
        │   ├── SignUp.tsx
        │   ├── VerifyEmail.tsx        # Post-login email verification gate
        │   ├── Conversations.tsx
        │   ├── ConversationDetail.tsx # Chat view with streaming bot support
        │   ├── StarredMessages.tsx
        │   ├── User.tsx               # Redirect helper
        │   └── UserProfile.tsx        # Profile, password, appearance, notification settings
        ├── components/
        │   ├── layout/
        │   │   ├── DashboardLayout.tsx  # Auth + email-verified guard
        │   │   ├── ConversationLayout.tsx
        │   │   └── DashboardSidebar.tsx
        │   ├── dashboard/             # Chat-specific components
        │   └── ui/                    # shadcn/ui component library
        ├── context/                   # AuthProvider, ChatProvider, ConversationsProvider
        ├── hooks/                     # use-auth, use-chat, use-conversations, use-socket
        └── lib/
            ├── api.ts                 # Centralised HTTP client
            └── socket.ts              # Socket.IO client setup
```

---

## Architecture Overview

```
Browser ──HTTP──▶  Express REST API  ──▶  MongoDB
        ──WS────▶  Socket.IO Server  ──▶  MongoDB
                                     ──▶  Gmail SMTP (offline email notifications)

Socket.IO authentication
  Every socket connection presents a JWT in handshake.auth.token.
  The middleware verifies the token and attaches socket.userId.
  Handlers never trust any client-supplied user ID.

Per-user socket tracking
  userSocketMap: Map<userId, Set<socketId>>
  Tracks all open connections across multiple tabs and devices.
  A user is marked offline only when their last socket disconnects.

Email notification pipeline
  send-message event ──▶ receiver has no open sockets?
                      ──▶ receiver.emailNotificationsEnabled?
                      ──▶ sendMessageEmail() (fire-and-forget, no await)

AI streaming pipeline
  Browser ──send-message──▶  Server detects isBot member
          ◀──bot-chunk───── streams Gemini chunks via Socket.IO
          ◀──bot-done──────  final saved Message document
```

---

## Data Models

### User

| Field | Type | Notes |
|---|---|---|
| `name` | String | 3–50 chars, required |
| `email` | String | unique, lowercase |
| `password` | String | bcrypt hashed |
| `about` | String | bio / status text |
| `profilePic` | String | URL; defaults to ui-avatars.com |
| `isOnline` | Boolean | updated on socket connect / disconnect |
| `lastSeen` | Date | set on disconnect |
| `isEmailVerified` | Boolean | `false` until OTP verification is completed |
| `emailNotificationsEnabled` | Boolean | controls offline email notifications; default `true` |
| `isBot` | Boolean | `true` for AI bot accounts |
| `otp` | String | bcrypt-hashed OTP (shared for login OTP and email verification) |
| `otpExpiry` | Date | OTP expiry timestamp |
| `blockedUsers` | [ObjectId → User] | users this user has blocked |
| `pinnedConversations` | [ObjectId → Conversation] | pinned conversation IDs |
| `isDeleted` | Boolean | soft-delete flag for anonymised accounts |

### Conversation

| Field | Type | Notes |
|---|---|---|
| `members` | [ObjectId → User] | participants (always exactly 2) |
| `latestmessage` | String | preview text for chat list |
| `unreadCounts` | [{userId, count}] | per-member unread counter |
| `timestamps` | auto | `createdAt`, `updatedAt` |

### Message

| Field | Type | Notes |
|---|---|---|
| `conversationId` | ObjectId → Conversation | required |
| `senderId` | ObjectId → User | required |
| `text` | String | required if no `imageUrl` |
| `imageUrl` | String | required if no `text`; S3 URL |
| `seenBy` | [{user, seenAt}] | read receipts |
| `hiddenFrom` | [ObjectId → User] | hard-deleted for these users |
| `softDeleted` | Boolean | `true` = "deleted" tombstone shown to all |
| `starredBy` | [ObjectId → User] | users who starred this message |
| `replyTo` | ObjectId → Message | quoted reply reference |
| `timestamps` | auto | `createdAt`, `updatedAt` |

---

## REST API Reference

All protected routes require the header `auth-token: <JWT>`.

### Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account + personal bot + initial conversation |
| `POST` | `/auth/login` | — | Login with password or OTP (`{ email, password }` or `{ email, otp }`) |
| `POST` | `/auth/getotp` | — | Send OTP to email for OTP-based login |
| `GET` | `/auth/me` | ✅ | Get authenticated user profile |
| `POST` | `/auth/send-verification-otp` | ✅ | Send a 10-min verification OTP to the logged-in user's email |
| `POST` | `/auth/verify-email` | ✅ | Verify email with OTP; sets `isEmailVerified: true` |

### Conversations — `/conversation`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/conversation` | ✅ | Create or retrieve a conversation |
| `GET` | `/conversation` | ✅ | List all conversations (pinned first, then by `updatedAt`) |
| `GET` | `/conversation/:id` | ✅ | Get a single conversation |
| `POST` | `/conversation/:id/pin` | ✅ | Toggle pin on a conversation |

### Messages — `/message`

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/message/starred` | ✅ | Get all messages starred by the current user |
| `GET` | `/message/:id` | ✅ | Get all messages in a conversation (marks as seen) |
| `DELETE` | `/message/bulk/hide` | ✅ | Hide multiple messages for self (`body: { messageIds }`) |
| `DELETE` | `/message/:id` | ✅ | Delete a message (`body: { scope: "me" \| "everyone" }`) |
| `POST` | `/message/clear/:conversationId` | ✅ | Clear entire chat history for self |
| `POST` | `/message/:id/star` | ✅ | Toggle star on a message |

### Users — `/user`

| Method | Path | Auth | Description |
|---|---|---|---|
| `PUT` | `/user/update` | ✅ | Update profile (name, about, profilePic, password, emailNotificationsEnabled) |
| `GET` | `/user/online-status/:id` | ✅ | Get online status of a user |
| `GET` | `/user/non-friends` | ✅ | Paginated, searchable, sortable user discovery |
| `GET` | `/user/presigned-url` | ✅ | Get S3 pre-signed POST URL for image upload |
| `POST` | `/user/block/:id` | ✅ | Block a user |
| `DELETE` | `/user/block/:id` | ✅ | Unblock a user |
| `GET` | `/user/block-status/:id` | ✅ | Get mutual block status between current user and target |
| `DELETE` | `/user/delete` | ✅ | Soft-delete / anonymise the authenticated user's account |

#### `GET /user/non-friends` Query Parameters

| Param | Default | Options |
|---|---|---|
| `search` | `""` | name or email substring |
| `sort` | `name_asc` | `name_asc`, `name_desc`, `last_seen_recent`, `last_seen_oldest` |
| `page` | `1` | integer ≥ 1 |
| `limit` | `20` | 1–50 |

---

## Socket.IO Events

The socket server requires a valid JWT passed in `handshake.auth.token`.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `setup` | — | Join personal room; mark user online; notify friends |
| `join-chat` | `{ roomId }` | Join a conversation room; reset unread count; mark all messages seen |
| `leave-chat` | `roomId` | Leave a conversation room |
| `send-message` | `{ conversationId, text?, imageUrl?, replyTo? }` | Send a message (or trigger AI bot response) |
| `delete-message` | `{ messageId, conversationId, scope }` | Delete a message (`scope: "me" \| "everyone"`) |
| `typing` | `{ conversationId, typer, receiverId }` | Broadcast typing indicator |
| `stop-typing` | `{ conversationId, typer, receiverId }` | Broadcast stop-typing |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `user setup` | `userId` | Confirms setup complete |
| `user-joined-room` | `userId` | Another user entered the conversation room |
| `receive-message` | `Message` | New message delivered to room |
| `new-message-notification` | `{ message, sender, conversation }` | In-app push to receiver's personal room when not in the chat |
| `messages-seen` | `{ conversationId, seenBy, seenAt }` | Notifies sender their messages were read |
| `message-deleted` | `{ messageId, conversationId, softDeleted, latestmessage }` | Tombstone broadcast for scope="everyone"; sidebar preview updated |
| `message-blocked` | `{ conversationId }` | Message rejected due to a block |
| `typing` | `{ conversationId, typer, receiverId? }` | Forwarded typing indicator |
| `stop-typing` | `{ conversationId, typer, receiverId? }` | Forwarded stop-typing indicator |
| `user-online` | `{ userId }` | A contact came online |
| `user-offline` | `{ userId }` | A contact went offline |
| `bot-chunk` | `{ conversationId, tempId, chunk }` | Streamed AI response text chunk |
| `bot-done` | `{ conversationId, tempId, message }` | AI response complete; `message` is the saved document |
| `bot-error` | `{ conversationId, userMessageId? }` | AI response failed; provides rolled-back message ID |

---

## Environment Variables

A single `.env` file at the **project root** is used for both Docker Compose and local development. Copy `.env.example` to `.env` and fill in your values.

```env
# ── Database ──────────────────────────────────────────────────────────────────
# Overridden automatically by docker-compose to point at the mongo service.
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=conversa

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=change_me_to_a_long_random_secret

# ── Google Gemini (AI bot) ────────────────────────────────────────────────────
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3-flash-preview

# ── Email (Gmail SMTP) ────────────────────────────────────────────────────────
# Used for: OTP login, email verification, offline message notifications
EMAIL=your_gmail@gmail.com
PASSWORD=your_gmail_app_password   # use a Gmail App Password, not your account password

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGIN=*                      # restrict to your frontend origin in production

# ── AWS S3 (profile picture uploads) ─────────────────────────────────────────
AWS_BUCKET_NAME=your_s3_bucket_name
AWS_ACCESS_KEY=your_aws_access_key
AWS_SECRET=your_aws_secret_key

# ── App URL (used in email notification deep-links) ───────────────────────────
FRONTEND_URL=http://localhost:5173

# ── Frontend (Vite — baked into the JS bundle at build time) ─────────────────
# Must be the public URL where the backend is reachable FROM THE BROWSER.
VITE_API_URL=http://localhost:5500
```

---

## Getting Started

### Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin).

```bash
# 1. Clone the repo
git clone https://github.com/your-username/conversa.git
cd conversa

# 2. Create your .env from the template
cp .env.example .env
# Edit .env — set JWT_SECRET, GEMINI_API_KEY, EMAIL, PASSWORD, AWS_*, etc.

# 3. Build and start all three services (mongo + backend + frontend)
docker compose up --build -d

# Frontend  →  http://localhost
# Backend   →  http://localhost:5500
# MongoDB   →  localhost:27019 (mapped away from the default 27017)
```

> **`VITE_API_URL`** must be the URL where the backend is reachable **from the user's browser**.  
> For local Docker this is `http://localhost:5500`. For production, use your public API domain.

### Manual (local development)

Requires Node.js ≥ 20 and a running MongoDB instance.

```bash
# Backend
cd backend
cp .env.example .env   # or edit backend/.env directly
npm install
npm run dev            # nodemon — listens on :5500

# Frontend (separate terminal)
cd frontend
# create frontend/src/.env with:  VITE_API_URL=http://localhost:5500
npm install
npm run dev            # Vite dev server — listens on :5173
```

---

## Scripts

### Backend (`backend/`)

| Script | Command | Description |
|---|---|---|
| `start` | `node index.js` | Start production server |
| `dev` | `nodemon index.js` | Start dev server with hot-reload |
| `seed:users` | `node scripts/seed-test-users.js` | Seed a set of test users |
| `delete:users` | `node scripts/delete-test-users.js` | Remove seeded test users |

### Frontend (`frontend/`)

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start Vite dev server |
| `build` | `tsc -b && vite build` | Type-check + production build |
| `preview` | `vite preview` | Preview the production build locally |
| `lint` | `eslint .` | Run ESLint |
| `format` | `prettier --write` | Format all TS/TSX files |
| `typecheck` | `tsc --noEmit` | Type-check without emitting |

---

## Security Design

- **JWT** — tokens are signed with `JWT_SECRET`, expire after 7 days, and are verified on every protected REST route and every socket connection
- **No trusted client IDs** — `senderId` is always taken from the verified JWT (`socket.userId`), never from the client payload
- **bcrypt** — passwords and OTPs are hashed with bcrypt before storage
- **Block enforcement** — the server checks block status before processing every `send-message` event; a blocked sender receives `message-blocked` instead
- **Conversation membership** — every `join-chat` and `send-message` handler verifies the authenticated user is a member of the target conversation
- **Email verification gate** — the `DashboardLayout` component redirects unverified users to `/verify-email` before they can access any chat functionality; bot accounts are pre-verified at creation
- **S3 pre-signed uploads** — the client never receives AWS credentials; uploads go directly to S3 through a short-lived pre-signed POST URL generated server-side
- **Non-root Docker user** — the backend container runs as an unprivileged `appuser`
- **Account anonymisation** — deleted accounts have credentials wiped and PII replaced with generic values; the document is retained (flagged `isDeleted: true`) to preserve conversation context for other participants

---

## Background Jobs

### `staleOnlineUsers` (hourly cron)

Runs every hour and sets `isOnline: false` + updates `lastSeen` for any user whose `isOnline` flag is still `true` but has no active sockets in `userSocketMap`. This recovers from crash scenarios where the `disconnect` event was never fired.

---

## Contributing
Contributions are welcome! Please open an issue or submit a pull request with any improvements or bug fixes.

**Steps to contribute:**
1. Fork the repository and create a new branch for your feature or bug fix.
2. Make your changes with clear commit messages.
3. Ensure all tests pass and the application runs correctly.
4. Submit a pull request describing your changes and why they should be merged.

## License

MIT — see the [LICENSE](LICENSE) file for details.

---

## About the Author

Built by **Pankil Soni**

- Email: pmsoni2016@gmail.com
- LinkedIn: [pankil-soni-5a0541170](https://www.linkedin.com/in/pankil-soni-5a0541170/)
- Kaggle: [pankilsoni](https://www.kaggle.com/pankilsoni)
#   c o n v e r s a  
 