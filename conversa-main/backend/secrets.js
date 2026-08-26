const dotenv = require("dotenv");
dotenv.config({ path: ".env" });

const isProduction = process.env.NODE_ENV === "production";
const LOCAL_FRONTEND_URL = "http://localhost:5173";

const splitOrigins = (value = "") =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const JWT_SECRET = process.env.JWT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
const LEGAL_EMBEDDING_PROVIDER = process.env.LEGAL_EMBEDDING_PROVIDER;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN;
const HUGGINGFACE_EMBEDDING_MODEL = process.env.HUGGINGFACE_EMBEDDING_MODEL || "BAAI/bge-large-en-v1.5";
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Conversa";
const EMAIL_FROM = process.env.EMAIL_FROM;
const AWS_BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET = process.env.AWS_SECRET;
const FRONTEND_URL =
  process.env.FRONTEND_URL || (isProduction ? "" : LOCAL_FRONTEND_URL);

const ALLOWED_ORIGINS = Array.from(
  new Set([
    "http://localhost:5173",
    "https://conversa-nu-taupe.vercel.app",
    ...splitOrigins(CORS_ORIGIN),
    FRONTEND_URL,
    !isProduction ? LOCAL_FRONTEND_URL : "",
  ].filter(Boolean))
);

const validateEnv = () => {
  const required = ["MONGO_URI", "JWT_SECRET"];
  if (isProduction) required.push("FRONTEND_URL");

  const missingRequired = required.filter((name) => !process.env[name]);
  if (missingRequired.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingRequired.join(", ")}`
    );
  }

  const optional = [
    "CORS_ORIGIN",
    "MONGO_DB_NAME",
    "EMAIL",
    "PASSWORD",
    "BREVO_API_KEY",
    "EMAIL_FROM_NAME",
    "EMAIL_FROM",
    "AWS_BUCKET_NAME",
    "AWS_ACCESS_KEY",
    "AWS_SECRET",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "LEGAL_EMBEDDING_PROVIDER",
    "HUGGINGFACE_API_KEY",
    "HUGGINGFACE_EMBEDDING_MODEL",
    "GROQ_API_KEY",
    "GROQ_MODEL",
  ];
  const missingOptional = optional.filter((name) => !process.env[name]);
  if (missingOptional.length > 0) {
    console.warn(
      `Optional environment variables not set: ${missingOptional.join(", ")}`
    );
  }

  if (isProduction) {
    if (!process.env.MONGO_DB_NAME) {
      console.warn("Production MONGO_DB_NAME is not set. The backend will rely on the database configured in MONGO_URI or Mongoose defaults.");
    }

    if (typeof MONGO_URI === "string" && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(MONGO_URI)) {
      console.warn("Production MONGO_URI appears to target localhost. Verify the deployment database configuration.");
    }

    if (typeof FRONTEND_URL === "string" && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(FRONTEND_URL)) {
      console.warn("Production FRONTEND_URL appears to target localhost. Verify the deployment frontend configuration.");
    }

    if (typeof CORS_ORIGIN === "string" && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(CORS_ORIGIN)) {
      console.warn("Production CORS_ORIGIN appears to include localhost. Verify CORS configuration for the deployed frontend.");
    }
  }
};

module.exports = {
  CORS_ORIGIN,
  ALLOWED_ORIGINS,
  MONGO_URI,
  MONGO_DB_NAME,
  JWT_SECRET,
  AWS_ACCESS_KEY,
  AWS_SECRET,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  LEGAL_EMBEDDING_PROVIDER,
  HUGGINGFACE_API_KEY,
  HUGGINGFACE_EMBEDDING_MODEL,
  GROQ_API_KEY,
  GROQ_MODEL,
  EMAIL,
  PASSWORD,
  BREVO_API_KEY,
  EMAIL_FROM_NAME,
  EMAIL_FROM,
  AWS_BUCKET_NAME,
  FRONTEND_URL,
  validateEnv,
};
