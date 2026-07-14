const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema(
  {
    members: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: [
        {
          validator: function (val) {
            return val && val.length === 2;
          },
          message: "A conversation must have exactly 2 members.",
        },
        {
          validator: function (val) {
            if (!val) return false;
            const strings = val.map(id => id.toString());
            return new Set(strings).size === strings.length;
          },
          message: "Conversation members must be unique.",
        }
      ]
    },
    latestmessage: {
      type: String,
      default: "",
    },
    unreadCounts: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        count: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Conversation = mongoose.model("Conversation", ConversationSchema);
module.exports = Conversation;
