# Conversa Production Deployment Guide

## 1. Backend Deployment (Render)

### Option A: Via Render Web Service (Recommended)
1. Go to [Render Dashboard](https://dashboard.render.com/) $\rightarrow$ Click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository (`conversa`).
3. Configure the service settings:
   - **Name**: `conversa-backend`
   - **Root Directory**: `conversa-main/backend` (or `backend` if repository root is inside the folder)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

4. Set **Environment Variables** in Render Dashboard:
   | Variable | Example / Value | Description |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Enables production mode |
   | `PORT` | `5500` | Port for the Express server |
   | `MONGO_URI` | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority` | MongoDB Atlas Connection String |
   | `MONGO_DB_NAME` | `conversa` | Database name |
   | `JWT_SECRET` | `<random-secure-string>` | Token signing secret |
   | `FRONTEND_URL` | `https://your-frontend.vercel.app` | Deployed Vercel URL |
   | `CORS_ORIGIN` | `https://your-frontend.vercel.app` | Allowed CORS origins (or `*`) |
   | `GEMINI_API_KEY` | `AIzaSy...` or `AQ...` | Google Gemini API Key |
   | `GEMINI_MODEL` | `gemini-3-flash-preview` | Model for Case Intake & Drafter |
   | `HUGGINGFACE_API_KEY`| `hf_...` *(Optional)* | Hugging Face token for `BAAI/bge-m3` |
   | `GROQ_API_KEY` | `gsk_...` *(Optional)* | Groq API key for fast LLM reasoning |

5. Deploy the service. Once deployed, note down your Render backend URL (e.g. `https://conversa-backend.onrender.com`).

---

## 2. Frontend Deployment (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/new) $\rightarrow$ Import your GitHub repository (`conversa`).
2. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `conversa-main/frontend` (or `frontend`)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. Set **Environment Variables** in Vercel:
   | Variable | Value | Description |
   | :--- | :--- | :--- |
   | `VITE_API_URL` | `https://conversa-backend.onrender.com` | Your deployed Render backend base URL (no trailing slash) |
   | `VITE_SOCKET_URL` | `https://conversa-backend.onrender.com` | Socket.IO server base URL |

4. Deploy the frontend.

---

## 3. Database Ingestion (One-Time Setup)

Once the backend is connected to your production MongoDB Atlas database:

1. You can run the ingestion script locally pointing to your production MongoDB URI:
   ```bash
   cd conversa-main/backend
   MONGO_URI="mongodb+srv://..." MONGO_DB_NAME="conversa" GEMINI_API_KEY="..." npm run ingest:legal
   ```
2. **Automatic Auto-Seeding**: If the database is initially empty when the first query arrives, the backend will automatically seed and embed the 39 legal knowledge chunks and 8 precedent cases on demand!

---

## 4. Verification

1. Verify backend health check:
   - `GET https://conversa-backend.onrender.com/health` $\rightarrow$ `{ "success": true, "message": "Server is running" }`
2. Test Legal Advisory in Frontend:
   - Visit `https://your-frontend.vercel.app/legal-advisory`
   - Submit a legal query (e.g. *"Landlord demanding unlawful deposit"* or *"Wrongful employment termination"*).
   - Confirm status shows `SUCCESS` with retrieved legal sources and court precedents.
