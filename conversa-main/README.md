# Conversa — Enterprise Verified Community Platform & Multi-Agent AI System

<div align="center">

![MongoDB Atlas](https://img.shields.io/badge/MongoDB%20Atlas-Vector%20Search-%2347A248.svg?style=flat&logo=mongodb&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-%23000000.svg?style=flat&logo=express&logoColor=white)
![React 19](https://img.shields.io/badge/React%2019-%2320232a.svg?style=flat&logo=react&logoColor=%2361DAFB)
![Node.js](https://img.shields.io/badge/Node.js-%23339933.svg?style=flat&logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-%23000000.svg?style=flat&logo=socket.io&logoColor=white)
![TailwindCSS v4](https://img.shields.io/badge/TailwindCSS-v4-%2306B6D4.svg?style=flat&logo=tailwindcss&logoColor=white)
![Amazon S3](https://img.shields.io/badge/Amazon%20S3-FF9900?style=flat&logo=amazons3&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Multi--Agent%20RAG-4285F4?style=flat&logo=google&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)

A full-stack, enterprise-grade verified community operations platform built with the MERN stack, Socket.IO, Google Gemini AI, and MongoDB Vector Search. Features include real-time messaging, directory privacy projection, community inbox, an administrative suite, and a **4-Stage Multi-Agent AI Legal Advisory System**.

</div>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Flowcharts](#architecture--flowcharts)
- [Multi-Agent RAG Legal Advisory Pipeline](#multi-agent-rag-legal-advisory-pipeline)
- [Data Models & Schemas](#data-models--schemas)
- [REST API Reference](#rest-api-reference)
- [Socket.IO Event Specifications](#socketio-event-specifications)
- [Environment Variables](#environment-variables)
- [Getting Started & Local Setup](#getting-started--local-setup)
- [Docker Deployment](#docker-deployment)
- [Scripts & Utility Diagnostics](#scripts--utility-diagnostics)
- [Security & Compliance Design](#security--compliance-design)
- [License](#license)

---

## Overview

Conversa replaces fragmented forms, unverified member lists, and disconnected messaging groups with an integrated community platform. It combines:

1. **Controlled Member Onboarding**: Public application, admin review, automated Member ID generation, and email OTP activation.
2. **Server-Side Privacy Engine**: Member-defined visibility preferences enforced on the database layer.
3. **Real-Time Communication**: Multi-device Socket.IO chat, presence tracking, read receipts, and offline email alerts.
4. **Personal Gemini AI Assistant**: Streaming AI chat with memory rollback.
5. **Multi-Agent Legal Advisory**: A 4-stage RAG pipeline that transforms legal queries into structured counsel backed by RAG vector knowledge and precedent citations.
6. **Community Inbox**: Threaded discussions, categorised posts, search, and admin moderation.
7. **Admin Console**: Active member management, emergency broadcast alerts, security logging, and audit tracking.

---

## Key Features

### 1. Membership Onboarding & Verification
- **Public Membership Application**: `/apply` form with tracking code generation.
- **Admin Review Workflow**: Admins review, approve, or reject applications with explicit status validation.
- **Member ID Generation**: Server-generated unique Member IDs (`MEM-YYYY-XXXX`).
- **Activation Portal**: Email invitation link to `/activate`.
- **Email OTP Verification**: 6-digit OTP stored via `bcryptjs`, 5-minute expiration, attempt limits, and resend cooldowns.
- **Role Guarding**: JWT-authenticated routing enforcing `MEMBER` and `ADMIN` role privileges.

### 2. Real-Time Socket.IO Messaging
- **Multi-Device Socket Tracking**: `userSocketMap` (`Map<userId, Set<socketId>>`) prevents premature offline status marking when multiple tabs are open.
- **Message Types**: Text messages and S3 image attachments (uploaded via pre-signed POST URLs).
- **Message Actions**: Quoted replies (`replyTo`), soft-deletes (`delete for everyone`), hard-deletes (`delete for me`), bulk hiding, chat clearing, and starred message bookmarks.
- **Read Receipts & Unread Counters**: `seenBy` array tracking and real-time counter sync.
- **Offline Email Alerts**: Fire-and-forget branded HTML email notifications delivered when recipients are offline.

### 3. Personal AI Assistant (Google Gemini)
- Automatic creation of an AI bot user and private conversation upon member account setup.
- Powered by `@google/genai` with configurable models (`gemini-2.5-flash`).
- Real-time text chunk streaming over WebSockets (`bot-chunk`, `bot-done`).
- Rolling 19-message conversation memory context window.
- Graceful rollback on generation failure (`bot-error`).

### 4. Multi-Agent Legal Advisory AI System (RAG Pipeline)
- **4-Stage Automated Pipeline**:
  - **Stage 1 (Case Intake Agent)**: Identifies legal domain, case type, structured summary, key entities, and keywords.
  - **Stage 2 (Legal Knowledge RAG)**: Performs hybrid vector search (Gemini `text-embedding-004`) and keyword search over `LegalKnowledgeChunk`.
  - **Stage 3 (Precedent Search Agent)**: Searches court rulings and legal precedents in `LegalPrecedent`.
  - **Stage 3.5 (Evidence Reranker)**: Scores and reranks retrieved legal sources and precedents by domain relevance and metadata consistency.
  - **Stage 4 (Legal Drafter Agent)**: Synthesizes intake data, RAG chunks, and precedent citations into a structured legal advisory response with action steps, required evidence, risk limitations, and formal disclaimers.

### 5. Community Directory & Server-Side Privacy
- Directory search by name, Member ID, location, occupation, and education.
- Filters for city, state, blood group, and occupation.
- Server-side privacy projection: sensitive fields (`email`, `phone`, `organization`, `education`, `bloodGroup`, `communityDetails`) are projected conditionally based on member `privacySettings`.

### 6. Community Inbox & Discussions
- Shared community posts with categories, search, sorting, and pagination.
- Threaded replies and discussion trees.
- Admin moderation controls: pin, hide, restore, and delete posts.

### 7. Administrative Suite & Operations
- Dedicated admin portal (`/admin`) with secure login.
- Metrics dashboard overview.
- Application processing, member status controls, audit logs (`AuditLog`), security event logs (`SecurityLog`), and emergency broadcast alerts (`EmergencyBroadcast`).
- Startup auto-seeding of default admin account.

---

## Architecture & Flowcharts

### System Architecture Diagram

```mermaid
flowchart LR
    subgraph Frontend["React 19 + TS Client"]
        UI[User Interface]
    end

    subgraph Backend["Express + Node.js Server"]
        API[REST API Routes]
        SOCK[Socket.IO Event Engine]
        ORCH[Legal Advisory Multi-Agent Orchestrator]
    end

    subgraph DataServices["Data & AI Layer"]
        DB[(MongoDB Atlas / Vector Search)]
        GEM[Google Gemini API]
        S3[AWS S3 Storage]
        MAIL[Brevo API / SMTP]
    end

    UI -->|REST Calls| API
    UI <-->|WebSockets| SOCK
    API --> DB
    SOCK --> DB
    API --> ORCH
    ORCH --> GEM
    ORCH --> DB
    API --> S3
    SOCK --> MAIL
```

---

## Multi-Agent RAG Legal Advisory Pipeline

```mermaid
flowchart TD
    A[User Legal Query] --> B[Stage 1: Case Intake Agent]
    B -->|Structured Intake JSON| C1[Stage 2: RAG Vector Search]
    B -->|Structured Intake JSON| C2[Stage 3: Precedent Search Agent]
    
    C1 -->|Knowledge Chunks| D[Stage 3.5: Hybrid Evidence Reranker]
    C2 -->|Court Precedents| D
    
    D -->|Ranked Evidence| E[Stage 4: Legal Drafter Agent]
    E -->|Structured JSON Output| F[Persisted Advisory Document & UI Render]
```

---

## Data Models & Schemas

### 1. `User`
- **Identity & Credentials**: `name`, `email`, `password` (bcrypt), `memberId`, `role` (`MEMBER` / `ADMIN`), `accountStatus` (`PENDING`, `ACTIVE`, `REJECTED`).
- **Presence & Settings**: `isOnline`, `lastSeen`, `isEmailVerified`, `emailNotificationsEnabled`, `privacySettings`.
- **Relationships**: `blockedUsers`, `pinnedConversations`.

### 2. `MembershipApplication`
- **Fields**: `applicantName`, `email`, `phone`, `occupation`, `city`, `state`, `trackingCode`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `rejectionReason`, `reviewedBy`.

### 3. `Conversation` & `Message`
- **Conversation**: `members`, `latestmessage`, `unreadCounts`.
- **Message**: `conversationId`, `senderId`, `text`, `imageUrl`, `replyTo`, `seenBy`, `hiddenFrom` (hard-deleted for self), `softDeleted` (tombstone for everyone), `starredBy`.

### 4. `CommunityPost` & `CommunityReply`
- **Post**: `title`, `content`, `category`, `author`, `isPinned`, `isHidden`, `viewsCount`, `repliesCount`.
- **Reply**: `post`, `author`, `content`.

### 5. `LegalAdvisory`, `LegalKnowledgeChunk`, `LegalPrecedent`
- **LegalAdvisory**: `userId`, `query`, `jurisdiction`, `status`, `caseType`, `legalDomain`, `caseSummary`, `issueIdentified`, `generalLegalContext`, `possibleNextSteps`, `documentsToGather`, `limitationsAndUncertainty`, `disclaimer`, `retrievedSources`, `precedents`, `ragSearchStatus`, `precedentSearchStatus`.
- **LegalKnowledgeChunk**: `title`, `content`, `legalDomain`, `source`, `embedding`.
- **LegalPrecedent**: `title`, `citation`, `court`, `judgmentSummary`, `legalDomain`, `embedding`.

---

## REST API Reference

All protected routes require header `auth-token: <JWT>`.

### Authentication (`/auth`)
- `POST /auth/register` — Account registration
- `POST /auth/login` — Login with password or OTP
- `POST /auth/getotp` — Request login OTP
- `GET /auth/me` — Fetch profile of current user
- `POST /auth/send-verification-otp` — Request email verification OTP
- `POST /auth/verify-email` — Verify email OTP

### Application & Activation (`/application`, `/activation`)
- `POST /application/apply` — Submit membership application
- `GET /application/status/:code` — Query application tracking status
- `POST /activation/request-otp` — Request activation OTP
- `POST /activation/verify-otp` — Complete activation and set password

### Messaging & Conversations (`/message`, `/conversation`)
- `POST /conversation` — Create or open conversation
- `GET /conversation` — List user conversations
- `GET /conversation/:id` — Get conversation details
- `POST /conversation/:id/pin` — Toggle conversation pin
- `GET /message/starred` — Get starred messages
- `GET /message/:id` — Get conversation message history
- `DELETE /message/bulk/hide` — Bulk hide messages for self
- `DELETE /message/:id` — Delete message (`scope: "me" | "everyone"`)
- `POST /message/clear/:conversationId` | Clear chat history for self
- `POST /message/:id/star` | Toggle star on message

### Member Directory & User (`/directory`, `/user`)
- `GET /directory/search` — Search & filter directory with privacy projection
- `GET /directory/member/:memberId` — View member profile
- `PUT /user/update` — Update profile & privacy preferences
- `GET /user/presigned-url` — Get S3 pre-signed POST URL for image uploads
- `POST /user/block/:id` — Block user
- `DELETE /user/block/:id` — Unblock user
- `GET /user/non-friends` — User discovery listing
- `DELETE /user/delete` — Soft-delete account

### Legal Advisory AI (`/api/legal-advisory`)
- `POST /api/legal-advisory/analyze` — Run 4-stage legal advisory pipeline
- `GET /api/legal-advisory/health/data` — Diagnostic check for database vector collections

### Community Inbox (`/inbox`)
- `GET /inbox/posts` — List community posts
- `POST /inbox/posts` — Create community post
- `GET /inbox/posts/:postId` — View post and reply thread
- `POST /inbox/posts/:postId/replies` — Post reply

### Admin Operations (`/admin`, `/admin/inbox`)
- `POST /admin/login` — Admin login
- `GET /admin/applications` — List applications
- `POST /admin/applications/:id/approve` — Approve application
- `POST /admin/applications/:id/reject` — Reject application
- `GET /admin/members` — Manage active members
- `GET /admin/audit-logs` — Fetch audit logs
- `GET /admin/security-logs` — Fetch security logs
- `POST /admin/emergency/broadcast` — Dispatch emergency alert
- `PUT /admin/inbox/posts/:id/pin` — Admin pin post
- `PUT /admin/inbox/posts/:id/hide` — Admin hide post

---

## Socket.IO Event Specifications

### Client → Server Events
- `setup`: Initializes socket session and presence.
- `join-chat`: Joins room, marks messages seen, resets unread count.
- `leave-chat`: Leaves conversation room.
- `send-message`: Transmits text/image message or triggers AI bot stream.
- `delete-message`: Deletes message (`scope: "me" | "everyone"`).
- `typing`: Broadcasts typing indicator.
- `stop-typing`: Broadcasts stop typing.

### Server → Client Events
- `receive-message`: Delivers new message to conversation room.
- `new-message-notification`: In-app notification delivered to recipient's personal room.
- `messages-seen`: Confirms read receipt update.
- `message-deleted`: Broadcasts message tombstone update.
- `bot-chunk`: Streams chunk of Gemini AI response text.
- `bot-done`: Delivers final persisted AI response document.
- `bot-error`: Emits generation error and triggers UI rollback.

---

## Environment Variables

### Backend (`backend/.env`)
```env
PORT=5500
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/conversa
MONGO_DB_NAME=conversa
JWT_SECRET=your_jwt_secret_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
EMAIL=your_email@gmail.com
PASSWORD=your_email_app_password
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=*
AWS_BUCKET_NAME=your_s3_bucket
AWS_ACCESS_KEY=your_aws_key
AWS_SECRET=your_aws_secret
ADMIN_EMAIL=admin@conversa.com
ADMIN_PASSWORD=secure_admin_password
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5500
```

---

## Getting Started & Local Setup

### 1. Clone Repo
```bash
git clone https://github.com/theSinghKirti/conversa.git
cd conversa/conversa-main
```

### 2. Backend Execution
```bash
cd backend
npm install
cp .env.example .env
# Update environment variables
npm run dev
```

### 3. Frontend Execution
```bash
cd ../frontend
npm install
cp .env.example .env
npm run dev
```

---

## Docker Deployment

Build and launch all services:
```bash
docker compose up --build -d
```

- Frontend: `http://localhost`
- Backend: `http://localhost:5500`

---

## Scripts & Utility Diagnostics

### Ingesting Legal Knowledge & Precedents
```bash
cd backend
node scripts/ingest-legal-knowledge.js
node scripts/ingest-legal-precedents.js
```

### Testing Pipelines
```bash
node scripts/real-e2e-advisory-test.js
node scripts/diagnose-rag-and-precedents.js
```

---

## Security & Compliance Design

- **JWT Auth**: Signed tokens verified on every protected API route and socket handshake.
- **bcrypt Hashing**: Passwords and 6-digit OTPs hashed prior to persistence.
- **Server-Side Privacy Projection**: Privacy preferences dynamically sanitize returned profile objects.
- **Strict Block Enforcement**: Block status verified server-side prior to processing messages.
- **Audit & Security Logging**: Writable event logs tracking sensitive actions.

---

## License

MIT — see [LICENSE](LICENSE) for details.