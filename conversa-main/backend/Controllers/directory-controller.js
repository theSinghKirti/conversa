const User = require("../Models/User.js");

/**
 * Escapes regex special characters to prevent regex NoSQL injection.
 */
const escapeRegex = (str) => {
  if (typeof str !== "string") return "";
  return str.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Sanitizes input to ensure it is a string and trims it, preventing NoSQL operator injection.
 */
const cleanStringInput = (val) => {
  if (typeof val === "string") return val.trim();
  return "";
};

/**
 * GET /directory/members
 *
 * Query params:
 *   search, city, state, occupation, bloodGroup, education, page, limit, sort
 */
const listMembers = async (req, res) => {
  try {
    const search = cleanStringInput(req.query.search).slice(0, 100);
    const city = cleanStringInput(req.query.city);
    const state = cleanStringInput(req.query.state);
    const occupation = cleanStringInput(req.query.occupation);
    const bloodGroup = cleanStringInput(req.query.bloodGroup);
    const education = cleanStringInput(req.query.education);

    // Validate and normalize pagination
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 50) limit = 50;
    const skip = (page - 1) * limit;

    // Validate sort option
    const VALID_SORTS = ["name_asc", "name_desc", "newest", "city_asc"];
    const sortOption = cleanStringInput(req.query.sort) || "name_asc";
    if (!VALID_SORTS.includes(sortOption)) {
      return res.status(400).json({
        success: false,
        error: "Invalid sort option.",
      });
    }

    const sortMap = {
      name_asc: { name: 1 },
      name_desc: { name: -1 },
      newest: { createdAt: -1 },
      city_asc: { city: 1 },
    };
    const sortOrder = sortMap[sortOption];

    // Build query criteria
    const query = {
      role: "MEMBER",
      accountStatus: "ACTIVE",
      isBot: { $ne: true },
      isDeleted: { $ne: true },
      memberId: { $ne: null, $exists: true },
    };

    // Filter fields (case-insensitive exact matches or partial match where appropriate)
    if (city) {
      query.city = { $regex: new RegExp(`^${escapeRegex(city)}$`, "i") };
    }
    if (state) {
      query.state = { $regex: new RegExp(`^${escapeRegex(state)}$`, "i") };
    }
    if (occupation) {
      query.occupation = { $regex: new RegExp(`^${escapeRegex(occupation)}$`, "i") };
    }
    if (bloodGroup) {
      query.bloodGroup = { $regex: new RegExp(`^${escapeRegex(bloodGroup)}$`, "i") };
    }
    if (education) {
      query.education = { $regex: new RegExp(`^${escapeRegex(education)}$`, "i") };
    }

    // Search query matches multiple fields
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      query.$or = [
        { name: searchRegex },
        { memberId: searchRegex },
        { city: searchRegex },
        { state: searchRegex },
        { occupation: searchRegex },
        { organisation: searchRegex },
        { education: searchRegex },
      ];
    }

    // Execute queries in parallel
    const [users, total] = await Promise.all([
      User.find(query)
        .sort(sortOrder)
        .skip(skip)
        .limit(limit)
        .select("memberId name profilePic about city state occupation organisation education bloodGroup directoryVisibility")
        .lean(),
      User.countDocuments(query),
    ]);

    // Apply directoryVisibility rules to the fields returned in the list
    const members = users.map((m) => {
      const visibility = m.directoryVisibility || {};
      return {
        memberId: m.memberId,
        name: m.name,
        profilePic: m.profilePic,
        about: m.about,
        city: m.city,
        state: m.state,
        occupation: m.occupation,
        organisation: visibility.showOrganisation !== false ? m.organisation : null,
        education: visibility.showEducation !== false ? m.education : null,
        bloodGroup: visibility.showBloodGroup !== false ? m.bloodGroup : null,
      };
    });

    return res.status(200).json({
      success: true,
      members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        search: search || "",
        city: city || "",
        state: state || "",
        occupation: occupation || "",
        bloodGroup: bloodGroup || "",
        education: education || "",
      },
    });
  } catch (error) {
    console.error("listMembers error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

/**
 * GET /directory/members/:memberId
 */
const getMemberDetail = async (req, res) => {
  try {
    const memberId = cleanStringInput(req.params.memberId).toUpperCase();

    const m = await User.findOne({
      memberId,
      role: "MEMBER",
      accountStatus: "ACTIVE",
      isBot: { $ne: true },
      isDeleted: { $ne: true },
    })
      .select("memberId name profilePic about city state occupation organisation education bloodGroup communityDetails email phone directoryVisibility")
      .lean();

    if (!m) {
      return res.status(404).json({
        success: false,
        error: "Member not found or not active.",
      });
    }

    const visibility = m.directoryVisibility || {};

    // Apply visibility masks server-side
    const member = {
      memberId: m.memberId,
      name: m.name,
      profilePic: m.profilePic,
      about: m.about,
      city: m.city,
      state: m.state,
      occupation: m.occupation,
      organisation: visibility.showOrganisation !== false ? m.organisation : null,
      education: visibility.showEducation !== false ? m.education : null,
      bloodGroup: visibility.showBloodGroup !== false ? m.bloodGroup : null,
      communityDetails: visibility.showCommunityDetails !== false ? m.communityDetails : null,
      email: visibility.showEmail === true ? m.email : null,
      phone: visibility.showPhone === true ? m.phone : null,
    };

    return res.status(200).json({
      success: true,
      member,
    });
  } catch (error) {
    console.error("getMemberDetail error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

/**
 * GET /directory/me/privacy
 */
const getMyPrivacySettings = async (req, res) => {
  try {
    // req.currentUser attached by requireActiveAccount middleware
    const user = req.currentUser;

    const visibility = user.directoryVisibility || {};

    return res.status(200).json({
      success: true,
      directoryVisibility: {
        showEmail: visibility.showEmail === true,
        showPhone: visibility.showPhone === true,
        showOrganisation: visibility.showOrganisation !== false,
        showEducation: visibility.showEducation !== false,
        showBloodGroup: visibility.showBloodGroup !== false,
        showCommunityDetails: visibility.showCommunityDetails !== false,
      },
    });
  } catch (error) {
    console.error("getMyPrivacySettings error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

/**
 * PATCH /directory/me/privacy
 */
const updateMyPrivacySettings = async (req, res) => {
  try {
    const user = req.currentUser;

    const allowedFields = [
      "showEmail",
      "showPhone",
      "showOrganisation",
      "showEducation",
      "showBloodGroup",
      "showCommunityDetails",
    ];

    const updates = {};
    const visibility = user.directoryVisibility || {};

    // Validate and extract only boolean visibility fields
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        if (typeof req.body[key] !== "boolean") {
          return res.status(400).json({
            success: false,
            error: `Field '${key}' must be a boolean value.`,
          });
        }
        updates[key] = req.body[key];
      }
    }

    // If no valid parameters passed, return current
    if (Object.keys(updates).length === 0) {
      return res.status(200).json({
        success: true,
        directoryVisibility: {
          showEmail: visibility.showEmail === true,
          showPhone: visibility.showPhone === true,
          showOrganisation: visibility.showOrganisation !== false,
          showEducation: visibility.showEducation !== false,
          showBloodGroup: visibility.showBloodGroup !== false,
          showCommunityDetails: visibility.showCommunityDetails !== false,
        },
      });
    }

    // Perform database update
    const updateQuery = {};
    for (const [k, v] of Object.entries(updates)) {
      updateQuery[`directoryVisibility.${k}`] = v;
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateQuery },
      { new: true }
    );

    const newVisibility = updatedUser.directoryVisibility || {};

    return res.status(200).json({
      success: true,
      message: "Directory privacy settings updated successfully.",
      directoryVisibility: {
        showEmail: newVisibility.showEmail === true,
        showPhone: newVisibility.showPhone === true,
        showOrganisation: newVisibility.showOrganisation !== false,
        showEducation: newVisibility.showEducation !== false,
        showBloodGroup: newVisibility.showBloodGroup !== false,
        showCommunityDetails: newVisibility.showCommunityDetails !== false,
      },
    });
  } catch (error) {
    console.error("updateMyPrivacySettings error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

module.exports = {
  listMembers,
  getMemberDetail,
  getMyPrivacySettings,
  updateMyPrivacySettings,
};
