const { CommunityPost, POST_CATEGORIES } = require("../Models/CommunityPost.js");
const { CommunityReply } = require("../Models/CommunityReply.js");
const { emitCommunityInbox } = require("../utils/communityInboxSocket.js");

const SORTS = ["newest", "oldest", "most_replied"];

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");

const escapeRegex = (value) => cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getPagination = (query) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 20;
  if (limit > 50) limit = 50;
  return { page, limit, skip: (page - 1) * limit };
};

const getSort = (sort) => {
  if (sort === "oldest") return { isPinned: -1, createdAt: 1 };
  if (sort === "most_replied") return { isPinned: -1, replyCount: -1, createdAt: -1 };
  return { isPinned: -1, createdAt: -1 };
};

const publicAuthor = (doc) => ({
  memberId: doc.authorMemberId,
  name: doc.authorName,
  profilePic: doc.author?.profilePic || "",
});

const publicPost = (post, userId) => ({
  postId: post.postId,
  author: publicAuthor(post),
  category: post.category,
  text: post.text,
  isPinned: Boolean(post.isPinned),
  replyCount: post.replyCount,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
  isOwnPost: userId ? post.author?._id?.toString() === userId.toString() : undefined,
});

const publicReply = (reply, userId) => ({
  replyId: reply.replyId,
  postId: reply.post?.postId,
  author: publicAuthor(reply),
  text: reply.text,
  createdAt: reply.createdAt,
  updatedAt: reply.updatedAt,
  isOwnReply: userId ? reply.author?._id?.toString() === userId.toString() : undefined,
});

const buildPostQuery = (query) => {
  const search = cleanString(query.search).slice(0, 100);
  const category = cleanString(query.category);
  const criteria = { status: "ACTIVE" };

  if (category) {
    if (!POST_CATEGORIES.includes(category)) {
      return { error: "Invalid category." };
    }
    criteria.category = category;
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    criteria.$or = [
      { text: regex },
      { authorName: regex },
      { authorMemberId: regex },
    ];
  }

  return { criteria };
};

const ensureText = (text, max) => {
  const clean = cleanString(text);
  if (!clean) return { error: "Text is required." };
  if (clean.length > max) return { error: `Text must not exceed ${max} characters.` };
  return { value: clean };
};

const listPosts = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const sort = cleanString(req.query.sort) || "newest";
    if (!SORTS.includes(sort)) {
      return res.status(400).json({ success: false, error: "Invalid sort option." });
    }

    const built = buildPostQuery(req.query);
    if (built.error) return res.status(400).json({ success: false, error: built.error });

    const [posts, total] = await Promise.all([
      CommunityPost.find(built.criteria)
        .sort(getSort(sort))
        .skip(skip)
        .limit(limit)
        .populate("author", "profilePic")
        .lean(),
      CommunityPost.countDocuments(built.criteria),
    ]);

    return res.status(200).json({
      success: true,
      posts: posts.map((post) => publicPost(post, req.user.id)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("listPosts error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const createPost = async (req, res) => {
  try {
    const user = req.currentUser;
    if (user.role !== "ADMIN" && !user.memberId) {
      return res.status(403).json({ success: false, error: "An active membership is required." });
    }

    const category = cleanString(req.body.category) || "GENERAL";
    if (!POST_CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, error: "Invalid category." });
    }

    const text = ensureText(req.body.text, 2000);
    if (text.error) return res.status(400).json({ success: false, error: text.error });

    const post = await CommunityPost.create({
      author: user._id,
      authorMemberId: user.memberId || "ADMIN",
      authorName: user.name,
      category,
      text: text.value,
    });

    const saved = await CommunityPost.findById(post._id).populate("author", "profilePic").lean();
    const payload = publicPost(saved, user._id);
    emitCommunityInbox("community-post-created", payload);

    return res.status(201).json({
      success: true,
      message: "Community post created successfully.",
      post: {
        postId: post.postId,
        category: post.category,
        text: post.text,
        isPinned: post.isPinned,
        replyCount: post.replyCount,
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    console.error("createPost error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const getPostDetail = async (req, res) => {
  try {
    const postId = cleanString(req.params.postId).toUpperCase();
    const post = await CommunityPost.findOne({ postId, status: "ACTIVE" })
      .populate("author", "profilePic")
      .lean();

    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found." });
    }

    return res.status(200).json({
      success: true,
      post: publicPost(post, req.user.id),
    });
  } catch (error) {
    console.error("getPostDetail error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const deleteOwnPost = async (req, res) => {
  try {
    const postId = cleanString(req.params.postId).toUpperCase();
    const post = await CommunityPost.findOne({ postId });
    if (!post) return res.status(404).json({ success: false, error: "Post not found." });
    if (post.status !== "ACTIVE") {
      return res.status(409).json({ success: false, error: "Post is not active." });
    }
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "You can only delete your own post." });
    }

    post.status = "DELETED";
    post.isPinned = false;
    post.pinnedAt = null;
    post.pinnedBy = null;
    await post.save();

    emitCommunityInbox("community-post-removed", { postId: post.postId });

    return res.status(200).json({
      success: true,
      message: "Community post deleted successfully.",
      postId: post.postId,
    });
  } catch (error) {
    console.error("deleteOwnPost error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const listReplies = async (req, res) => {
  try {
    const postId = cleanString(req.params.postId).toUpperCase();
    const post = await CommunityPost.findOne({ postId, status: "ACTIVE" }).select("_id postId").lean();
    if (!post) return res.status(404).json({ success: false, error: "Post not found." });

    const { page, limit, skip } = getPagination(req.query);
    const sort = cleanString(req.query.sort) === "newest" ? { createdAt: -1 } : { createdAt: 1 };

    const criteria = { post: post._id, status: "ACTIVE" };
    const [replies, total] = await Promise.all([
      CommunityReply.find(criteria)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("author", "profilePic")
        .populate("post", "postId")
        .lean(),
      CommunityReply.countDocuments(criteria),
    ]);

    return res.status(200).json({
      success: true,
      replies: replies.map((reply) => publicReply(reply, req.user.id)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("listReplies error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

const createReply = async (req, res) => {
  try {
    const user = req.currentUser;
    const postId = cleanString(req.params.postId).toUpperCase();
    const text = ensureText(req.body.text, 1000);
    if (text.error) {
      return res.status(400).json({ success: false, error: text.error });
    }

    const post = await CommunityPost.findOneAndUpdate(
      { postId, status: "ACTIVE" },
      { $inc: { replyCount: 1 } },
      { new: true }
    );
    if (!post) {
      return res.status(404).json({ success: false, error: "Post not found." });
    }

    let savedReply;
    try {
      savedReply = await CommunityReply.create({
        post: post._id,
        author: user._id,
        authorMemberId: user.memberId || "ADMIN",
        authorName: user.name,
        text: text.value,
      });
    } catch (error) {
      await CommunityPost.updateOne(
        { _id: post._id, replyCount: { $gt: 0 } },
        { $inc: { replyCount: -1 } }
      );
      throw error;
    }

    const reply = await CommunityReply.findById(savedReply._id)
      .populate("author", "profilePic")
      .populate("post", "postId")
      .lean();
    const payload = publicReply(reply, user._id);
    emitCommunityInbox("community-reply-created", payload);

    return res.status(201).json({
      success: true,
      message: "Community reply created successfully.",
      reply: payload,
    });
  } catch (error) {
    console.error("createReply error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

const deleteOwnReply = async (req, res) => {
  try {
    const replyId = cleanString(req.params.replyId).toUpperCase();
    const reply = await CommunityReply.findOne({ replyId }).populate("post", "postId");
    if (!reply) return res.status(404).json({ success: false, error: "Reply not found." });
    if (reply.status !== "ACTIVE") {
      return res.status(409).json({ success: false, error: "Reply is not active." });
    }
    if (reply.author.toString() !== req.user.id) {
      return res.status(403).json({ success: false, error: "You can only delete your own reply." });
    }

    reply.status = "DELETED";
    await reply.save();
    await CommunityPost.updateOne(
      { _id: reply.post._id, replyCount: { $gt: 0 } },
      { $inc: { replyCount: -1 } }
    );

    emitCommunityInbox("community-reply-removed", {
      replyId: reply.replyId,
      postId: reply.post.postId,
    });

    return res.status(200).json({
      success: true,
      message: "Community reply deleted successfully.",
      replyId: reply.replyId,
    });
  } catch (error) {
    console.error("deleteOwnReply error:", error.message);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

module.exports = {
  listPosts,
  createPost,
  getPostDetail,
  deleteOwnPost,
  listReplies,
  createReply,
  deleteOwnReply,
  publicPost,
  publicReply,
  cleanString,
  escapeRegex,
  getPagination,
  ensureText,
};
