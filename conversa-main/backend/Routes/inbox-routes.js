const express = require("express");
const router = express.Router();

const fetchuser = require("../middleware/fetchUser.js");
const requireActiveAccount = require("../middleware/requireActiveAccount.js");
const {
  listPosts,
  createPost,
  getPostDetail,
  deleteOwnPost,
  listReplies,
  createReply,
  deleteOwnReply,
} = require("../Controllers/inbox-controller.js");

const inboxGuard = [fetchuser, requireActiveAccount];

router.get("/posts", inboxGuard, listPosts);
router.post("/posts", inboxGuard, createPost);
router.get("/posts/:postId", inboxGuard, getPostDetail);
router.delete("/posts/:postId", inboxGuard, deleteOwnPost);
router.get("/posts/:postId/replies", inboxGuard, listReplies);
router.post("/posts/:postId/replies", inboxGuard, createReply);
router.delete("/replies/:replyId", inboxGuard, deleteOwnReply);

module.exports = router;
