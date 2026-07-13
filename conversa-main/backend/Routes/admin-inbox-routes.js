const express = require("express");
const router = express.Router();

const fetchuser = require("../middleware/fetchUser.js");
const requireAdmin = require("../middleware/requireAdmin.js");
const {
  listAdminPosts,
  pinPost,
  hidePost,
  restorePost,
  hideReply,
  restoreReply,
} = require("../Controllers/admin-inbox-controller.js");

const adminGuard = [fetchuser, requireAdmin];

router.get("/posts", adminGuard, listAdminPosts);
router.patch("/posts/:postId/pin", adminGuard, pinPost);
router.patch("/posts/:postId/hide", adminGuard, hidePost);
router.patch("/posts/:postId/restore", adminGuard, restorePost);
router.patch("/replies/:replyId/hide", adminGuard, hideReply);
router.patch("/replies/:replyId/restore", adminGuard, restoreReply);

module.exports = router;
