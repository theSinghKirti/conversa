const { CommunityPost, POST_CATEGORIES, POST_STATUSES } = require("../Models/CommunityPost.js");
const { CommunityReply } = require("../Models/CommunityReply.js");
const {
  publicPost,
  publicReply,
  cleanString,
  escapeRegex,
  getPagination,
  ensureText,
} = require("./inbox-controller.js");
const { emitCommunityInbox } = require("../utils/communityInboxSocket.js");

const SORTS = ["newest", "oldest", "most_replied"];

const adminPost = (post) => ({
  ...publicPost(post),
  status: post.status,
  moderationReason: post.moderationReason || "",
  hiddenAt: post.hiddenAt,
  pinnedAt: post.pinnedAt,
  updatedAt: post.updatedAt,
});

const adminReply = (reply) => ({
  ...publicReply(reply),
  status: reply.status,
  moderationReason: reply.moderationReason || "",
  hiddenAt: reply.hiddenAt,
  updatedAt: reply.updatedAt,
});

const getSort = (sort) => {
  if (sort === "oldest") return { isPinned: -1, createdAt: 1 };
  if (sort === "most_replied") return { isPinned: -1, replyCount: -1, createdAt: -1 };
  return { isPinned: -1, createdAt: -1 };
};

const listAdminPosts = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const status = cleanString(req.query.status);
    const category = cleanString(req.query.category);
    const search = cleanString(req.query.search).slice(0, 100);
    const sort = cleanString(req.query.sort) || "newest";

    if (status && !POST_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status." });
    }
    if (category && !POST_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: "Invalid category." });
    }
    if (!SORTS.includes(sort)) {
      return res.status(400).json({ success: false, error: "Invalid sort option." });
    }

    const criteria = {};
    if (status) criteria.status = status;
    if (category) criteria.category = category;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      criteria.$or = [
        { text: regex },
        { authorName: regex },
        { authorMemberId: regex },
        { moderationReason: regex },
      ];
    }

    const [posts, total] = await Promise.all([
      CommunityPost.find(criteria)
        .sort(getSort(sort))
        .skip(skip)
        .limit(limit)
        .populate("author", "profilePic")
        .lean(),
      CommunityPost.countDocuments(criteria),
    ]);

    return res.status(200).json({
      success: true,
      posts: posts.map(adminPost),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("listAdminPosts error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const pinPost = async (req, res) => {
  try {
    const postId = cleanString(req.params.postId).toUpperCase();
    const pinned = req.body.pinned;
    if (typeof pinned !== "boolean") {
      return res.status(400).json({ success: false, error: "Field 'pinned' must be boolean." });
    }

    const update = pinned
      ? { isPinned: true, pinnedAt: new Date(), pinnedBy: req.user.id }
      : { isPinned: false, pinnedAt: null, pinnedBy: null };

    const post = await CommunityPost.findOneAndUpdate(
      { postId, status: { $ne: "DELETED" } },
      { $set: update },
      { new: true }
    ).populate("author", "profilePic");

    if (!post) return res.status(404).json({ success: false, error: "Post not found." });

    const payload = adminPost(post);
    emitCommunityInbox("community-post-updated", publicPost(post));

    return res.status(200).json({
      success: true,
      message: pinned ? "Community post pinned." : "Community post unpinned.",
      post: payload,
    });
  } catch (error) {
    console.error("pinPost error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const hidePost = async (req, res) => {
  try {
    const postId = cleanString(req.params.postId).toUpperCase();
    const reason = ensureText(req.body.reason, 500);
    if (reason.error) return res.status(400).json({ success: false, error: "Moderation reason is required." });

    const post = await CommunityPost.findOneAndUpdate(
      { postId, status: "ACTIVE" },
      {
        $set: {
          status: "HIDDEN",
          hiddenAt: new Date(),
          hiddenBy: req.user.id,
          moderationReason: reason.value,
          isPinned: false,
          pinnedAt: null,
          pinnedBy: null,
        },
      },
      { new: true }
    ).populate("author", "profilePic");

    if (!post) {
      const exists = await CommunityPost.findOne({ postId }).select("status").lean();
      if (!exists) return res.status(404).json({ success: false, error: "Post not found." });
      return res.status(409).json({ success: false, error: "Only active posts can be hidden." });
    }

    emitCommunityInbox("community-post-hidden", { postId: post.postId });
    return res.status(200).json({
      success: true,
      message: "Community post hidden.",
      post: adminPost(post),
    });
  } catch (error) {
    console.error("hidePost error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const restorePost = async (req, res) => {
  try {
    const postId = cleanString(req.params.postId).toUpperCase();
    const post = await CommunityPost.findOneAndUpdate(
      { postId, status: "HIDDEN" },
      {
        $set: {
          status: "ACTIVE",
          hiddenAt: null,
          hiddenBy: null,
          moderationReason: "",
        },
      },
      { new: true }
    ).populate("author", "profilePic");

    if (!post) {
      const exists = await CommunityPost.findOne({ postId }).select("status").lean();
      if (!exists) return res.status(404).json({ success: false, error: "Post not found." });
      return res.status(409).json({ success: false, error: "Only hidden posts can be restored." });
    }

    emitCommunityInbox("community-post-restored", publicPost(post));
    return res.status(200).json({
      success: true,
      message: "Community post restored.",
      post: adminPost(post),
    });
  } catch (error) {
    console.error("restorePost error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const hideReply = async (req, res) => {
  try {
    const replyId = cleanString(req.params.replyId).toUpperCase();
    const reason = ensureText(req.body.reason, 500);
    if (reason.error) return res.status(400).json({ success: false, error: "Moderation reason is required." });

    const reply = await CommunityReply.findOneAndUpdate(
      { replyId, status: "ACTIVE" },
      {
        $set: {
          status: "HIDDEN",
          hiddenAt: new Date(),
          hiddenBy: req.user.id,
          moderationReason: reason.value,
        },
      },
      { new: true }
    ).populate("author", "profilePic").populate("post", "postId");

    if (!reply) {
      const exists = await CommunityReply.findOne({ replyId }).select("status").lean();
      if (!exists) return res.status(404).json({ success: false, error: "Reply not found." });
      return res.status(409).json({ success: false, error: "Only active replies can be hidden." });
    }

    await CommunityPost.updateOne(
      { _id: reply.post._id, replyCount: { $gt: 0 } },
      { $inc: { replyCount: -1 } }
    );

    emitCommunityInbox("community-reply-hidden", {
      replyId: reply.replyId,
      postId: reply.post.postId,
    });

    return res.status(200).json({
      success: true,
      message: "Community reply hidden.",
      reply: adminReply(reply),
    });
  } catch (error) {
    console.error("hideReply error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const restoreReply = async (req, res) => {
  try {
    const replyId = cleanString(req.params.replyId).toUpperCase();
    const reply = await CommunityReply.findOneAndUpdate(
      { replyId, status: "HIDDEN" },
      {
        $set: {
          status: "ACTIVE",
          hiddenAt: null,
          hiddenBy: null,
          moderationReason: "",
        },
      },
      { new: true }
    ).populate("author", "profilePic").populate("post", "postId status");

    if (!reply) {
      const exists = await CommunityReply.findOne({ replyId }).select("status").lean();
      if (!exists) return res.status(404).json({ success: false, error: "Reply not found." });
      return res.status(409).json({ success: false, error: "Only hidden replies can be restored." });
    }

    if (reply.post.status === "ACTIVE") {
      await CommunityPost.updateOne({ _id: reply.post._id }, { $inc: { replyCount: 1 } });
    }

    emitCommunityInbox("community-reply-restored", publicReply(reply));

    return res.status(200).json({
      success: true,
      message: "Community reply restored.",
      reply: adminReply(reply),
    });
  } catch (error) {
    console.error("restoreReply error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = {
  listAdminPosts,
  pinPost,
  hidePost,
  restorePost,
  hideReply,
  restoreReply,
};
