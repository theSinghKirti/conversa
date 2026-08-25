# Legal Advisory Deployment

## Backend

Required production env vars:
- `MONGO_URI`
- `MONGO_DB_NAME`
- `JWT_SECRET`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `GEMINI_API_KEY`

Recommended backend deployment order:
1. Deploy the backend with explicit production env vars.
2. Verify it boots without localhost Mongo or localhost frontend URLs.
3. Run `GET /api/legal-advisory/health/data` with an admin token.
4. Confirm the counts are correct.

## Ingestion

Run explicit ingestion in the target environment only:
- `npm run ingest:legal`
- `npm run ingest:knowledge`
- `npm run ingest:precedents`

The ingestion scripts use the environment they are executed in and will not silently fall back to localhost in production.

## Frontend

Required Vercel env var:
- `VITE_API_URL=<deployed-backend-base-url>`

Production frontend build sequence:
1. Set `VITE_API_URL` to the deployed backend base URL.
2. Build and deploy the frontend.
3. Verify the frontend can call `POST /api/legal-advisory/analyze`.

## Verification

Expected data health counts after ingestion:
- `legalKnowledgeChunks: 39`
- `legalPrecedents: 8`

Use the health endpoint to verify database identity and collection counts without exposing credentials or document contents.
