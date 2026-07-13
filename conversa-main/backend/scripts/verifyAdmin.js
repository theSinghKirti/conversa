const mongoose = require("mongoose");

const uri = process.env.MONGO_URI || "mongodb+srv://kirtisingh10d_db_user:sYgxYI8wgNv5XUII@cluster0.4dttrka.mongodb.net/";
const dbName = process.env.MONGO_DB_NAME || "test";

async function verify() {
  await mongoose.connect(uri, { dbName });
  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }), "users");
  const u = await User.findOne({ email: "kirtisingh10d@gmail.com" }).lean();
  
  if (u) {
    console.log(JSON.stringify({
      found: true,
      email: u.email,
      role: u.role,
      accountStatus: u.accountStatus,
      collection: "users",
      database: dbName
    }, null, 2));
  } else {
    console.log(JSON.stringify({
      found: false,
      email: "kirtisingh10d@gmail.com",
      role: null,
      accountStatus: null,
      collection: "users",
      database: dbName
    }, null, 2));
  }
  await mongoose.disconnect();
}

verify().catch(console.error);
