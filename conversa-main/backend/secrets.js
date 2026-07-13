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
const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
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
    "AWS_BUCKET_NAME",
    "AWS_ACCESS_KEY",
    "AWS_SECRET",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
  ];
  const missingOptional = optional.filter((name) => !process.env[name]);
  if (missingOptional.length > 0) {
    console.warn(
      `Optional environment variables not set: ${missingOptional.join(", ")}`
    );
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
  EMAIL,
  PASSWORD,
  AWS_BUCKET_NAME,
  FRONTEND_URL,
  validateEnv,
};
