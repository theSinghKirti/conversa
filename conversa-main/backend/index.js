const express = require("express");
const connectDB = require("./db.js");
const cors = require("cors");
const http = require("http");
const PORT = process.env.PORT || 5500;
const { initSocket } = require("./socket/index.js");
const { startStaleOnlineUsersJob } = require("./jobs/staleOnlineUsers.js");
const { ALLOWED_ORIGINS, validateEnv } = require("./secrets.js");

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
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

// Server setup
const server = http.createServer(app);

// Socket.io setup
initSocket(server); // Initialize socket.io logic

// Start server and connect to database
const start = async () => {
  validateEnv();
  await connectDB(); // connect first
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
  // Start background jobs after DB is ready
  startStaleOnlineUsersJob();
};

start();
