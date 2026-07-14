const Conversation = require("../Models/Conversation.js");
const User = require("../Models/User.js");
const Message = require("../Models/Message.js");
const {
  streamAiResponse,
  sendMessageHandler,
  deleteMessageHandler,
} = require("../Controllers/message-controller.js");
const sendMessageEmail = require("../utils/sendMessageEmail.js");
const { COMMUNITY_INBOX_ROOM } = require("../utils/communityInboxSocket.js");

// userSocketMap is Map<userId, Set<socketId>> injected from socket/index.js.
// It is used to determine whether a user still has any open connections before
// marking them offline, so closing one browser tab doesn't falsely show them
// as offline while another tab is still connected.
module.exports = (io, socket, userSocketMap) => {
  // socket.userId is set by the JWT auth middleware in socket/index.js.
  // We never trust a user-supplied ID for security-sensitive operations.
  const currentUserId = socket.userId;

  // ─── Setup ────────────────────────────────────────────────────────────────
  // Client calls this once after connecting to join their personal room and
  // announce they are online.
  socket.on("setup", async () => {
    try {
      socket.join(currentUserId);
      console.log("User joined personal room", currentUserId);
      socket.emit("user setup", currentUserId);

      await User.findByIdAndUpdate(currentUserId, { isOnline: true });

      const conversations = await Conversation.find({
        members: { $in: [currentUserId] },
      });

      // Collect unique friend IDs across all conversations
      const friendIds = new Set();
      conversations.forEach((conversation) => {
        conversation.members.forEach((memberId) => {
          if (memberId.toString() !== currentUserId) {
            friendIds.add(memberId.toString());
          }
        });
      });

      // Notify every online friend via their personal room
      friendIds.forEach((friendId) => {
        io.to(friendId).emit("user-online", { userId: currentUserId });
      });
    } catch (error) {
      console.error("Error in setup handler:", error);
    }
  });

  // ─── Join chat room ────────────────────────────────────────────────────────
  socket.on("join-chat", async (data) => {
    try {
      const { roomId } = data;
      console.log("User joined chat room", roomId);

      const conv = await Conversation.findById(roomId);
      if (!conv) return;

      // Verify the authenticated user is actually a member of this conversation
      const isMember = conv.members.some(
        (m) => m.toString() === currentUserId
      );
      if (!isMember) {
        console.warn(
          `User ${currentUserId} tried to join conversation ${roomId} they are not a member of`
        );
        return;
      }

      socket.join(roomId);

      // Reset unread count for this user
      conv.unreadCounts = conv.unreadCounts.map((unread) => {
        if (unread.userId.toString() === currentUserId) {
          unread.count = 0;
        }
        return unread;
      });
      await conv.save({ timestamps: false });

      // Mark all unseen messages in this conversation as seen by this user
      const seenAt = new Date();
      await Message.updateMany(
        {
          conversationId: roomId,
          senderId: { $ne: currentUserId },
          hiddenFrom: { $ne: currentUserId },
          "seenBy.user": { $ne: currentUserId },
        },
        { $push: { seenBy: { user: currentUserId, seenAt } } }
      );

      // Notify the sender(s) in this room that their messages were seen
      io.to(roomId).emit("messages-seen", {
        conversationId: roomId,
        seenBy: currentUserId,
        seenAt,
      });

      io.to(roomId).emit("user-joined-room", currentUserId);
    } catch (error) {
      console.error("Error in join-chat handler:", error);
    }
  });

  // ─── Leave chat room ───────────────────────────────────────────────────────
  socket.on("leave-chat", (room) => {
    socket.leave(room);
  });

  socket.on("join-community-inbox", async () => {
    try {
      const user = await User.findById(currentUserId).select("role accountStatus isDeleted");
      if (!user || user.isDeleted) {
        socket.emit("community-inbox-error", { error: "Authentication required." });
        return;
      }

      const allowed =
        user.role === "ADMIN" ||
        (user.role === "MEMBER" && user.accountStatus === "ACTIVE");

      if (!allowed) {
        socket.emit("community-inbox-error", { error: "An active membership is required." });
        return;
      }

      socket.join(COMMUNITY_INBOX_ROOM);
      socket.emit("community-inbox-joined", { room: COMMUNITY_INBOX_ROOM });
    } catch (error) {
      console.error("Error in join-community-inbox handler:", error.message);
      socket.emit("community-inbox-error", { error: "Unable to join community inbox." });
    }
  });

  // ─── Send message ──────────────────────────────────────────────────────────
  const handleSendMessage = async (data, callback) => {
    try {
      const { conversationId, text, imageUrl, replyTo } = data;
      console.log("Received message:", {
        conversationId,
        text: text ? text.substring(0, 20) : null,
        hasImage: !!imageUrl
      });

      // Always use the authenticated user as the sender — never trust client-supplied senderId
      const senderId = currentUserId;

      console.log("Step 1: Loading conversation:", conversationId);
      const conversation = await Conversation.findById(conversationId).populate(
        "members"
      );
      if (!conversation) {
        console.log("Step 1 Failed: Conversation not found for ID:", conversationId);
        if (callback) callback({ success: false, error: "Conversation not found" });
        return;
      }
      console.log("Step 1 Success: Conversation loaded. Member records in DB:", conversation.members);

      // Check if conversation record is corrupted (e.g. less than 2 valid members populated)
      const validMembers = (conversation.members || []).filter((m) => m !== null);
      console.log("Step 1.5: Valid members count:", validMembers.length);
      if (validMembers.length < 2) {
        console.log("Step 1.5 Failed: Corrupted conversation members. Valid count is less than 2.");
        if (callback) callback({ success: false, error: "Receiver not found" });
        return;
      }

      // Verify sender is a member of this conversation
      const isMember = validMembers.some(
        (m) => m._id.toString() === senderId
      );
      if (!isMember) {
        console.warn(
          `Step 2 Failed: User ${senderId} tried to send to conversation ${conversationId} they don't belong to`
        );
        if (callback) callback({ success: false, error: "Not a member of this conversation" });
        return;
      }
      console.log("Step 2 Success: Sender membership verified:", senderId);

      // ── AI bot processing ────────────────────────────────────────────────
      // Use the isBot field instead of an email-suffix heuristic.
      const botMember = validMembers.find(
        (member) => member._id.toString() !== senderId && member.isBot
      );

      if (botMember) {
        const botId = botMember._id.toString();
        console.log("Step 3 (AI Bot): Identified AI bot participant:", botId);
        const tempId = `bot-stream-${Date.now()}`;

        try {
          for await (const event of streamAiResponse(text, senderId, conversationId)) {
            if (event.type === "user-message") {
              // Emit real user message (has a proper MongoDB _id)
              io.to(conversationId).emit("receive-message", event.message);
              // Now start the typing indicator (conversationId required by frontend)
              io.to(conversationId).emit("typing", { typer: botId, conversationId });

              console.log("Message saved (AI Bot path):", {
                messageId: event.message._id.toString(),
                conversationId: event.message.conversationId.toString(),
                senderId: event.message.senderId.toString(),
                emittedEvent: "receive-message",
                roomId: conversationId
              });

              if (callback) {
                callback({ success: true, messageId: event.message._id.toString() });
              }
            } else if (event.type === "chunk") {
              io.to(conversationId).emit("bot-chunk", { conversationId, tempId, chunk: event.text });
            } else if (event.type === "done") {
              io.to(conversationId).emit("stop-typing", { typer: botId, conversationId });
              io.to(conversationId).emit("bot-done", { conversationId, tempId, message: event.message });
            } else if (event.type === "error") {
              io.to(conversationId).emit("stop-typing", { typer: botId, conversationId });
              io.to(conversationId).emit("bot-error", {
                conversationId,
                userMessageId: event.userMessageId ?? null,
              });
              if (callback) {
                callback({ success: false, error: "Failed to generate AI response" });
              }
            }
          }
        } catch (err) {
          console.error("Bot streaming error:", err);
          io.to(conversationId).emit("stop-typing", { typer: botId, conversationId });
          io.to(conversationId).emit("bot-error", { conversationId, userMessageId: null });
          if (callback) {
            callback({ success: false, error: err.message });
          }
        }
        return;
      }

      // ── Personal chat processing ─────────────────────────────────────────
      const receiverMember = validMembers.find(
        (member) => member._id.toString() !== senderId
      );
      if (!receiverMember) {
        console.log("Step 3 Failed: Receiver member not found in validMembers");
        if (callback) callback({ success: false, error: "Receiver not found" });
        return;
      }

      const receiverId = receiverMember._id;
      console.log("Step 3 Success: Receiver resolved in valid members list:", receiverId.toString());

      // Verify that user still exists in database
      const receiverExists = await User.exists({ _id: receiverId });
      if (!receiverExists) {
        console.log("Step 3.5 Failed: Receiver user record does not exist in DB:", receiverId.toString());
        if (callback) callback({ success: false, error: "Receiver not found" });
        return;
      }
      console.log("Step 3.5 Success: Receiver verified to exist in DB.");

      // ── Block check ───────────────────────────────────────────────────────
      // Prevent sending if (a) the receiver has blocked the sender, or
      // (b) the sender has blocked the receiver.
      console.log("Step 3.7: Querying block statuses...");
      const [receiverDoc, senderDoc] = await Promise.all([
        User.findById(receiverId, "blockedUsers emailNotificationsEnabled email name"),
        User.findById(senderId, "blockedUsers"),
      ]);
      const isBlockedByReceiver = receiverDoc?.blockedUsers?.some(
        (id) => id.toString() === senderId
      );
      const senderBlockedReceiver = senderDoc?.blockedUsers?.some(
        (id) => id.toString() === receiverId.toString()
      );
      if (isBlockedByReceiver || senderBlockedReceiver) {
        console.log("Step 3.7 Failed: Blocked user relationship found. isBlockedByReceiver:", !!isBlockedByReceiver, "senderBlockedReceiver:", !!senderBlockedReceiver);
        socket.emit("message-blocked", { conversationId });
        if (callback) callback({ success: false, error: "Message blocked by privacy settings" });
        return;
      }
      console.log("Step 3.7 Success: Privacy blocks check passed.");

      // Determine if the receiver currently has the conversation room open.
      // Check ALL of the receiver's sockets so multi-device is handled correctly.
      const receiverSocketIds = userSocketMap.get(receiverId.toString());
      let isReceiverInsideChatRoom = false;

      if (receiverSocketIds) {
        const conversationRoom = io.sockets.adapter.rooms.get(conversationId);
        if (conversationRoom) {
          isReceiverInsideChatRoom = Array.from(receiverSocketIds).some((sid) =>
            conversationRoom.has(sid)
          );
        }
      }
      console.log("Step 3.9: isReceiverInsideChatRoom calculated:", isReceiverInsideChatRoom);

      console.log("Step 4: Attempting to save message to DB via sendMessageHandler...");
      const message = await sendMessageHandler({
        text,
        imageUrl,
        senderId,
        conversationId,
        receiverId,
        isReceiverInsideChatRoom,
        replyTo: replyTo || null,
      });

      console.log("Step 4 Success: Message saved to DB:", {
        messageId: message._id.toString(),
        conversationId: message.conversationId.toString(),
        senderId: message.senderId.toString(),
        emittedEvent: "receive-message",
        roomId: conversationId
      });

      console.log("Step 5: Emitting receive-message to room:", conversationId);
      io.to(conversationId).emit("receive-message", message);
      console.log("Step 5 Success: Event emitted to room.");

      console.log("Step 6: Executing callback acknowledgment...");
      if (callback) {
        callback({ success: true, messageId: message._id.toString() });
      }
      console.log("Step 6 Success: Callback executed.");

      conversation.unreadCounts = conversation.unreadCounts.map((unread) => {
        if (unread.userId.toString() === receiverId.toString()) {
          return { userId: unread.userId, count: unread.count + 1 };
        }
        return unread;
      });

      conversation.latestmessage = text || "sent an image";

      if (!isReceiverInsideChatRoom) {
        console.log("Emitting new message notification to:", receiverId.toString());
        const senderInfo = conversation.members.find(
          (m) => m._id.toString() === senderId
        );
        io.to(receiverId.toString()).emit("new-message-notification", {
          message,
          sender: senderInfo,
          conversation: conversation
        });

        // Fire-and-forget email notification — only when receiver is completely
        // offline (no open sockets) and has email notifications enabled.
        // Never awaited so it adds zero latency to message delivery.
        const isReceiverOffline = !receiverSocketIds || receiverSocketIds.size === 0;
        if (isReceiverOffline && receiverDoc?.emailNotificationsEnabled && receiverDoc?.email) {
          sendMessageEmail(
            { name: receiverDoc.name, email: receiverDoc.email },
            { name: senderInfo.name, profilePic: senderInfo.profilePic },
            text || null,
            conversationId
          );
        }
      }
    } catch (error) {
      console.error("Error in send-message handler:", error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  };

  socket.on("send-message", handleSendMessage);

  // ─── Delete message ────────────────────────────────────────────────────────
  // scope="everyone": soft-delete → shows tombstone to all. Broadcast to room.
  // scope="me":       hard-delete for sender only → no broadcast (only caller hides it).
  const handleDeleteMessage = async (data) => {
    try {
      const { messageId, conversationId, scope } = data;
      const updated = await deleteMessageHandler({
        messageId,
        scope,
        requesterId: currentUserId,
      });
      if (!updated) return;

      if (scope === 'everyone') {
        // Find the newest non-tombstone message to determine the new preview text
        const latestNonDeleted = await Message.findOne({
          conversationId,
          softDeleted: { $ne: true },
        }).sort({ createdAt: -1 });

        // If the tombstone is newer (or no other messages exist) → show tombstone text
        const newLatest =
          !latestNonDeleted ||
          new Date(updated.createdAt) >= new Date(latestNonDeleted.createdAt)
            ? 'This message was deleted'
            : latestNonDeleted.text || 'sent an image';

        // Persist new preview to the conversation document
        await Conversation.findByIdAndUpdate(
          conversationId,
          { latestmessage: newLatest },
          { timestamps: false }
        );

        // Broadcast to every member so they see the tombstone + updated preview in real-time
        io.to(conversationId).emit('message-deleted', {
          messageId,
          conversationId,
          softDeleted: true,
          latestmessage: newLatest,
        });
      } else {
        // scope="me": find the new latest message visible to this user only
        const latestVisible = await Message.findOne({
          conversationId,
          hiddenFrom: { $ne: currentUserId },
        }).sort({ createdAt: -1 });

        const newLatest = latestVisible
          ? (latestVisible.softDeleted ? 'This message was deleted' : (latestVisible.text || 'sent an image'))
          : '';

        // Only emit to the requester so their sidebar preview updates
        socket.emit('message-deleted', {
          messageId,
          conversationId,
          softDeleted: false,
          latestmessage: newLatest,
        });
      }
    } catch (error) {
      console.error('Error in delete-message handler:', error);
    }
  };

  socket.on('delete-message', handleDeleteMessage);

  // ─── Typing indicators ─────────────────────────────────────────────────────
  // Helper: emit a typing event to everyone in the conversation room, and also
  // to the receiver's personal room if they are online but not currently viewing
  // this conversation (so they can show a subtle indicator in the chat list).
  const emitTypingEvent = (event, data) => {
    const { conversationId, receiverId } = data;

    // Always notify users already inside the room
    io.to(conversationId).emit(event, data);

    if (!receiverId) return;

    // Check if receiver is online
    const receiverSockets = userSocketMap.get(receiverId.toString());
    if (!receiverSockets || receiverSockets.size === 0) return; // offline

    // Check if ANY of their sockets are inside the conversation room
    const conversationRoom = io.sockets.adapter.rooms.get(conversationId);
    const isInsideRoom =
      conversationRoom &&
      Array.from(receiverSockets).some((sid) => conversationRoom.has(sid));

    if (!isInsideRoom) {
      // Online but not viewing this chat — emit to their personal room
      io.to(receiverId.toString()).emit(event, data);
    }
  };

  socket.on("typing", (data) => emitTypingEvent("typing", data));

  socket.on("stop-typing", (data) => emitTypingEvent("stop-typing", data));

  // ─── Disconnect ────────────────────────────────────────────────────────────
  // Only mark the user offline when ALL their sockets have disconnected
  // (i.e. they closed every tab/device), not just one of them.
  socket.on("disconnect", async () => {
    console.log("Socket disconnected", socket.id, "user:", currentUserId);
    try {
      // userSocketMap is updated by socket/index.js AFTER this event fires,
      // so at this point the disconnecting socket is still in the set.
      // size <= 1 means this is the last (or only) socket for the user.
      const sockets = userSocketMap.get(currentUserId);
      const isLastSocket = !sockets || sockets.size <= 1;

      if (!isLastSocket) {
        console.log(
          `User ${currentUserId} still has other sockets open — staying online`
        );
        return;
      }

      await User.findByIdAndUpdate(currentUserId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      const conversations = await Conversation.find({
        members: { $in: [currentUserId] },
      });

      // Collect unique friend IDs across all conversations
      const friendIds = new Set();
      conversations.forEach((conversation) => {
        conversation.members.forEach((memberId) => {
          if (memberId.toString() !== currentUserId) {
            friendIds.add(memberId.toString());
          }
        });
      });

      // Notify every online friend via their personal room
      friendIds.forEach((friendId) => {
        io.to(friendId).emit("user-offline", { userId: currentUserId });
      });
    } catch (error) {
      console.error("Error updating user status on disconnect:", error);
    }
  });
};
