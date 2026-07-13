require('dotenv').config();
const mongoose = require('mongoose');
const {MONGO_URI, MONGO_DB_NAME} = require('../secrets.js');
const MembershipApplication = require('../Models/MembershipApplication.js');
const User = require('../Models/User.js');

(async()=>{
  await mongoose.connect(MONGO_URI, {dbName: MONGO_DB_NAME});
  const apps = await MembershipApplication.find({
    email: { $in: ['audit.test@example.com', 'reject.test@example.com'] }
  }).lean();
  console.log('TEST APPS:', apps.map(a => a.applicationId + ' status=' + a.status));

  const users = await User.find({
    email: { $regex: 'audit.test' }
  }).lean();
  console.log('TEST USERS:', users.map(u => u._id + ' isDeleted=' + u.isDeleted + ' email=' + u.email.substring(0, 40)));

  // Count members with no bot/conversation (critical bug)
  const { Conversation } = await (async () => {
    const Conversation = require('../Models/Conversation.js');
    return { Conversation };
  })();

  const members = await User.find({ role: 'MEMBER', accountStatus: 'ACTIVE', isBot: { $ne: true }, isDeleted: { $ne: true } }).lean();
  for (const m of members) {
    const botEmail = m.email + 'bot';
    const bot = await User.findOne({ email: botEmail, isBot: true });
    const convos = await Conversation.countDocuments({ members: m._id });
    if (!bot || convos === 0) {
      console.log('MEMBER WITH NO BOT/CONV:', m.name, '| bot:', !!bot, '| convos:', convos);
    }
  }

  await mongoose.disconnect();
})().catch(console.error);
