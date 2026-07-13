const crypto = require("crypto");
const mongoose = require("mongoose");

const POST_CATEGORIES = [
  "ANNOUNCEMENT",
  "GENERAL",
  "HELP_REQUEST",
  "OPPORTUNITY",
  "EVENT",
  "COMMUNITY_NOTICE",
];

const POST_STATUSES = ["ACTIVE", "HIDDEN", "DELETED"];

const generatePostId = () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(6);
  const token = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `POST-${token}`;
};

const CommunityPostSchema = new mongoose.Schema(
  {
    postId: {
      type: String,
      unique: true,
      required: true,
      default: generatePostId,
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
    category: {
      type: String,
      enum: POST_CATEGORIES,
      default: "GENERAL",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: POST_STATUSES,
      default: "ACTIVE",
      required: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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
    replyCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

CommunityPostSchema.index({ status: 1, createdAt: -1 });
CommunityPostSchema.index({ category: 1, createdAt: -1 });
CommunityPostSchema.index({ isPinned: -1, createdAt: -1 });
CommunityPostSchema.index({ text: "text", authorName: "text", authorMemberId: "text" });

module.exports = {
  CommunityPost: mongoose.model("CommunityPost", CommunityPostSchema),
  POST_CATEGORIES,
  POST_STATUSES,
};
