const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");

/**
 * Sanitizes a populated member document when viewed by someone whom that
 * member has blocked. Profile fields become generic placeholders; only the
 * _id and email remain untouched (per product spec).
 * The `blockedUsers` array is always stripped from the output.
 */
function sanitizeForRequester(member, requesterId) {
  const obj = member.toObject ? member.toObject() : { ...member };
  const isBlocked = obj.blockedUsers?.some(
    (id) => id.toString() === requesterId.toString()
  );
  delete obj.blockedUsers; // never expose blockedUsers list to clients

  if (!isBlocked) return obj;

  return {
    _id: obj._id,
    email: obj.email, // email is intentionally NOT sanitized
    name: "Conversa User",
    about: "",
    profilePic: "https://ui-avatars.com/api/?name=Conversa+User&background=6366f1&color=fff&bold=true",
    isOnline: false,
    lastSeen: null,
    isBot: obj.isBot,
    createdAt: null,
    updatedAt: null,
  };
}

const createConversation = async (req, res) => {
  try {
    const { receiverId } = req.body;

    if (!receiverId) {
      return res.status(400).json({
        error: "Receiver ID is required",
      });
    }

    const senderId = req.user.id;

    if (receiverId.toString() === senderId.toString()) {
      return res.status(400).json({
        error: "You cannot start a conversation with yourself.",
      });
    }

    // Validate that the receiver exists and is ACTIVE (or is a Bot)
    const receiver = await User.findById(receiverId);
    if (!receiver || (!receiver.isBot && receiver.accountStatus !== "ACTIVE")) {
      return res.status(404).json({
        error: "Receiver user not found or is inactive",
      });
    }

    // Deduplicate IDs before any query or insert
    const uniqueMembers = [...new Set([senderId.toString(), receiverId.toString()])];

    // Require exactly two distinct member IDs
    if (uniqueMembers.length !== 2) {
      return res.status(400).json({
        error: "A conversation must have exactly two distinct member IDs.",
      });
    }

    // Find an existing personal conversation using those exact two unique IDs
    const conv = await Conversation.findOne({
      members: { $all: uniqueMembers, $size: 2 },
    }).populate("members", "-password");

    if (conv) {
      const sanitizedConv = conv.toObject();
      sanitizedConv.members = conv.members
        .filter((member) => member && member._id.toString() !== senderId)
        .map((member) => sanitizeForRequester(member, senderId));
      return res.status(200).json(sanitizedConv);
    }

    const newConversation = await Conversation.create({
      members: uniqueMembers,
      unreadCounts: uniqueMembers.map((memberId) => ({
        userId: memberId,
        count: 0,
      })),
    });

    await newConversation.populate("members", "-password");

    const sanitizedNew = newConversation.toObject();
    sanitizedNew.members = newConversation.members
      .filter((member) => member && member._id.toString() !== senderId)
      .map((member) => sanitizeForRequester(member, senderId));

    return res.status(200).json(sanitizedNew);
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal Server Error");
  }
};

const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id).populate(
      "members",
      "-password",
    );

    if (!conversation) {
      return res.status(404).json({
        error: "No conversation found",
      });
    }

    const isMember = conversation.members.some(
      (m) => m && m._id.toString() === req.user.id
    );
    if (!isMember) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const sanitized = conversation.toObject();
    sanitized.members = conversation.members
      .filter((m) => m !== null)
      .map((m) =>
        sanitizeForRequester(m, req.user.id)
      );
    res.status(200).json(sanitized);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
};

const getConversationList = async (req, res) => {
  const userId = req.user.id;

  try {
    const currentUser = await User.findById(userId).select("email pinnedConversations");
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const pinnedSet = new Set((currentUser.pinnedConversations || []).map((id) => id.toString()));

    let conversationList = await Conversation.find({
      members: { $in: userId },
    })
      .populate("members", "-password")
      .sort({ updatedAt: -1 });

    if (!conversationList) {
      conversationList = [];
    }

    // Ensure bot user & conversation exists for the user
    let botConv = conversationList.find((c) => c.members.some((m) => m.isBot));
    if (!botConv) {
      const botEmail = (currentUser.email || (userId + "@conversa.local")) + "bot";
      let botUser = await User.findOne({ email: botEmail, isBot: true });
      if (!botUser) {
        botUser = await User.create({
          name: "AI Chatbot",
          email: botEmail,
          password: "AI_CHATBOT_SECURE_DUMMY_PASSWORD",
          authMethod: "OTP_ONLY",
          about: "I am an AI Chatbot to help you",
          profilePic:
            "https://play-lh.googleusercontent.com/Oe0NgYQ63TGGEr7ViA2fGA-yAB7w2zhMofDBR3opTGVvsCFibD8pecWUjHBF_VnVKNdJ",
          isBot: true,
          isEmailVerified: true,
        });
      }

      botConv = await Conversation.create({
        members: [userId, botUser._id],
        unreadCounts: [
          { userId: userId, count: 0 },
          { userId: botUser._id, count: 0 },
        ],
      });

      // Refetch populated conversation
      botConv = await Conversation.findById(botConv._id).populate("members", "-password");
      conversationList.unshift(botConv);
    }

    // Build response: annotate isPinned
    let result = [];
    for (let i = 0; i < conversationList.length; i++) {
      const convId = conversationList[i]._id.toString();

      const conv = conversationList[i].toObject();
      conv.members = conversationList[i].members
        .filter((member) => member && member.id !== userId)
        .map((member) => sanitizeForRequester(member, userId));
      conv.isPinned = pinnedSet.has(convId);
      result.push(conv);
    }

    // Sort: pinned first, then by updatedAt (already sorted by mongo)
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

    res.status(200).json(result);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

const togglePin = async (req, res) => {
  const userId = req.user.id;
  const convId = req.params.id;

  try {
    const conversation = await Conversation.findById(convId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const isMember = conversation.members.some((m) => m.toString() === userId);
    if (!isMember) return res.status(403).json({ error: "Forbidden" });

    const user = await User.findById(userId).select("pinnedConversations");
    const isPinned = user.pinnedConversations.some((id) => id.toString() === convId);

    if (isPinned) {
      await User.findByIdAndUpdate(userId, { $pull: { pinnedConversations: convId } });
      return res.status(200).json({ isPinned: false });
    } else {
      await User.findByIdAndUpdate(userId, { $addToSet: { pinnedConversations: convId } });
      return res.status(200).json({ isPinned: true });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  createConversation,
  getConversation,
  getConversationList,
  togglePin,
};
