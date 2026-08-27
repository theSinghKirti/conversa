const express = require("express");
const connectDB = require("./db.js");
const cors = require("cors");
const http = require("http");
const PORT = process.env.PORT || 5500;
const { initSocket } = require("./socket/index.js");
const { startStaleOnlineUsersJob } = require("./jobs/staleOnlineUsers.js");
const { ALLOWED_ORIGINS, validateEnv } = require("./secrets.js");

const app = express();

app.set("trust proxy", 1);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes("*")) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  return false;
};

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "auth-token"],
  })
);
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

// Routes
app.get("/", (req, res) => {
  res.send("Hello World");
});
app.get("/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

// Safe admin existence check — never returns emails, passwords, or tokens.
// Used to verify seeding without exposing secrets.
app.get("/admin/ping", async (req, res) => {
  try {
    const User = require("./Models/User.js");
    const count = await User.countDocuments({ role: "ADMIN", isDeleted: false });
    return res.json({ adminExists: count > 0, adminCount: count });
  } catch (err) {
    return res.status(500).json({ adminExists: false, error: "DB query failed" });
  }
});
app.use("/auth", require("./Routes/auth-routes.js"));
app.use("/user", require("./Routes/user-routes.js"));
app.use("/message", require("./Routes/message-routes.js"));
app.use("/conversation", require("./Routes/conversation-routes.js"));
app.use("/application", require("./Routes/application-routes.js"));
app.use("/inbox", require("./Routes/inbox-routes.js"));
app.use("/admin/inbox", require("./Routes/admin-inbox-routes.js"));
app.use("/admin", require("./Routes/admin-routes.js"));
app.use("/activation", require("./Routes/activation-routes.js"));
app.use("/directory", require("./Routes/directory-routes.js"));
app.use("/api/legal-advisory", require("./Routes/legal-advisory-routes.js"));

// Server setup
const server = http.createServer(app);

// Socket.io setup
initSocket(server); // Initialize socket.io logic

// Start server and connect to database
const start = async () => {
  validateEnv();
  await connectDB(); // connect first

  // Startup diagnostics — safe: never prints secret values
  const dbName = process.env.MONGO_DB_NAME || "(not set — using URI default)";
  console.log(`[startup] Database name  : ${dbName}`);
  console.log(`[startup] ADMIN_EMAIL    : ${process.env.ADMIN_EMAIL    ? "configured" : "NOT SET"}`);
  console.log(`[startup] ADMIN_PASSWORD : ${process.env.ADMIN_PASSWORD ? "configured" : "NOT SET"}`);

  // Auto-seed admin on first deploy (when ADMIN_EMAIL + ADMIN_PASSWORD are set
  // and no admin user exists yet). Safe: skips silently if admin already exists.
  // Does NOT update existing admins — run scripts/seedAdmin.js manually for that.
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    try {
      const bcrypt = require("bcryptjs");
      const User   = require("./Models/User.js");
      const normalisedEmail = process.env.ADMIN_EMAIL.trim().toLowerCase();
      const adminCount = await User.countDocuments({ role: "ADMIN", isDeleted: false });

      if (adminCount === 0) {
        console.log("[startup] No admin found — auto-seeding admin account...");
        const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        await User.findOneAndUpdate(
          { email: normalisedEmail },
          {
            $set: {
              name:            process.env.ADMIN_NAME || "Admin",
              email:           normalisedEmail,
              password:        hash,
              role:            "ADMIN",
              accountStatus:   "ACTIVE",
              authMethod:      "PASSWORD",
              isEmailVerified: true,
              isDeleted:       false,
              about:           "System Administrator",
              profilePic:      `https://ui-avatars.com/api/?name=${encodeURIComponent(process.env.ADMIN_NAME || "Admin")}&background=random&bold=true`,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`[startup] ✅ Admin account ready: ${normalisedEmail}`);
      } else {
        console.log(`[startup] Admin already exists (${adminCount}). Skipping auto-seed.`);
      }
    } catch (seedErr) {
      // Non-fatal: log and continue — do not crash the server
      console.error("[startup] ⚠️  Admin auto-seed failed:", seedErr.message);
    }
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
  // Start background jobs after DB is ready
  startStaleOnlineUsersJob();
};

start();
