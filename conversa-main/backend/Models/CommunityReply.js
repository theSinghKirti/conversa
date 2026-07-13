const crypto = require("crypto");
const mongoose = require("mongoose");

const REPLY_STATUSES = ["ACTIVE", "HIDDEN", "DELETED"];

const generateReplyId = () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(6);
  const token = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `RPL-${token}`;
};

const CommunityReplySchema = new mongoose.Schema(
  {
    replyId: {
      type: String,
      unique: true,
      required: true,
      default: generateReplyId,
      immutable: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommunityPost",
      required: true,
      immutable: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    authorMemberId: {
      type: String,
      required: true,
      trim: true,
      immutable: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      immutable: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: REPLY_STATUSES,
      default: "ACTIVE",
      required: true,
    },
    hiddenAt: {
      type: Date,
      default: null,
    },
    hiddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true }
);

CommunityReplySchema.index({ post: 1, status: 1, createdAt: 1 });

module.exports = {
  CommunityReply: mongoose.model("CommunityReply", CommunityReplySchema),
  REPLY_STATUSES,
};
