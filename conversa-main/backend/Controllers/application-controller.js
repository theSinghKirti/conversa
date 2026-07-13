const crypto = require("crypto");
const User = require("../Models/User.js");
const MembershipApplication = require("../Models/MembershipApplication.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a backend-only application reference such as "APP-X7K29QR3".
 * Uses 6 cryptographically random uppercase alphanumeric characters.
 */
const generateApplicationId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(6);
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `APP-${suffix}`;
};

/**
 * Normalise an Indian phone number to its bare 10-digit form so that
 * "9876543210", "+919876543210", "09876543210" all compare equal.
 */
const normalisePhone = (phone) => {
  const stripped = phone.replace(/[\s\-]/g, "");
  if (stripped.startsWith("+91")) return stripped.slice(3);
  if (stripped.startsWith("91") && stripped.length === 12) return stripped.slice(2);
  if (stripped.startsWith("0") && stripped.length === 11) return stripped.slice(1);
  return stripped;
};

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/**
 * POST /application/apply
 *
 * Public endpoint – no authentication required.
 * Creates a MembershipApplication document with status PENDING.
 * Does NOT create a User, JWT, AI bot, or Conversation.
 */
const submitApplication = async (req, res) => {
  try {
    // ------------------------------------------------------------------
    // 1. Extract only the fields we accept from the client.
    //    Status, applicationId, reviewedBy, reviewedAt, rejectionReason
    //    are never taken from the request body.
    // ------------------------------------------------------------------
    const {
      name,
      email,
      phone,
      city,
      state,
      occupation,
      organisation,
      education,
      bloodGroup,
      communityDetails,
      consentAccepted,
    } = req.body;

    // ------------------------------------------------------------------
    // 2. Validate required fields up-front (before any DB query).
    // ------------------------------------------------------------------
    if (!name || typeof name !== "string" || name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: "Name is required and must be at least 3 characters long.",
      });
    }
    if (name.trim().length > 80) {
      return res.status(400).json({
        success: false,
        error: "Name must not exceed 80 characters.",
      });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ success: false, error: "Email is required." });
    }
    const normalisedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalisedEmail)) {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid email address.",
      });
    }

    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ success: false, error: "Phone number is required." });
    }
    const phoneRegex = /^(\+91[\s-]?|0)?[6-9]\d{9}$/;
    if (!phoneRegex.test(phone.trim())) {
      return res.status(400).json({
        success: false,
        error:
          "Please provide a valid Indian phone number (10 digits, starting with 6–9).",
      });
    }
    const normalisedPhone = normalisePhone(phone.trim());

    if (!city || typeof city !== "string" || !city.trim()) {
      return res.status(400).json({ success: false, error: "City is required." });
    }
    if (!state || typeof state !== "string" || !state.trim()) {
      return res.status(400).json({ success: false, error: "State is required." });
    }
    if (!occupation || typeof occupation !== "string" || !occupation.trim()) {
      return res.status(400).json({ success: false, error: "Occupation is required." });
    }

    // consentAccepted must be boolean true
    if (consentAccepted !== true) {
      return res.status(400).json({
        success: false,
        error: "You must accept the consent terms to submit an application.",
      });
    }

    // Optional bloodGroup – validate only when provided and non-empty
    const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
    if (bloodGroup !== undefined && bloodGroup !== null && bloodGroup !== "") {
      if (!BLOOD_GROUPS.includes(bloodGroup.toString().trim())) {
        return res.status(400).json({
          success: false,
          error: `Blood group must be one of: ${BLOOD_GROUPS.join(", ")}.`,
        });
      }
    }

    // Optional communityDetails length check
    if (communityDetails && communityDetails.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Community details must not exceed 500 characters.",
      });
    }

    // ------------------------------------------------------------------
    // 3. Duplicate checks
    // ------------------------------------------------------------------

    // 3a. Check whether an existing active User already has the same email.
    const existingUser = await User.findOne({ email: normalisedEmail, isDeleted: false });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error:
          "An account already exists with this email address. Please log in instead.",
      });
    }

    // 3b. Check for an existing application with the same email or phone.
    //     Use the normalised 10-digit phone for comparison.
    const BLOCKING_STATUSES = ["PENDING", "APPROVED_PENDING_VERIFICATION", "ACTIVE"];

    const existingByEmail = await MembershipApplication.findOne({
      email: normalisedEmail,
    });

    if (existingByEmail) {
      if (existingByEmail.status === "REJECTED" || existingByEmail.status === "SUSPENDED") {
        return res.status(409).json({
          success: false,
          error:
            "A previous application with this email was not approved. Please contact the administrator for further assistance.",
        });
      }
      if (BLOCKING_STATUSES.includes(existingByEmail.status)) {
        return res.status(409).json({
          success: false,
          error: "An application already exists for this email or phone number.",
          status: existingByEmail.status,
        });
      }
    }

    // For phone: we store the normalised form and also query by it.
    // Existing applications may have stored various phone formats, so we also
    // compare via the regex-normalised value stored at submission time.
    const existingByPhone = await MembershipApplication.findOne({
      phone: normalisedPhone,
    });

    if (existingByPhone) {
      if (existingByPhone.status === "REJECTED" || existingByPhone.status === "SUSPENDED") {
        return res.status(409).json({
          success: false,
          error:
            "A previous application with this phone number was not approved. Please contact the administrator for further assistance.",
        });
      }
      if (BLOCKING_STATUSES.includes(existingByPhone.status)) {
        return res.status(409).json({
          success: false,
          error: "An application already exists for this email or phone number.",
          status: existingByPhone.status,
        });
      }
    }

    // ------------------------------------------------------------------
    // 4. Generate a unique applicationId (retry once on the rare collision).
    // ------------------------------------------------------------------
    let applicationId = generateApplicationId();
    const collision = await MembershipApplication.findOne({ applicationId });
    if (collision) {
      applicationId = generateApplicationId();
    }

    // ------------------------------------------------------------------
    // 5. Build the document – never set status, reviewedBy, reviewedAt,
    //    rejectionReason from client input.
    // ------------------------------------------------------------------
    const applicationData = {
      applicationId,
      name: name.trim(),
      email: normalisedEmail,
      phone: normalisedPhone, // store normalised 10-digit form
      city: city.trim(),
      state: state.trim(),
      occupation: occupation.trim(),
      organisation: organisation ? organisation.trim() : "",
      education: education ? education.trim() : "",
      communityDetails: communityDetails ? communityDetails.trim() : "",
      consentAccepted: true,
      status: "PENDING", // always set by backend
    };

    // Only include bloodGroup if it was supplied and non-empty
    if (bloodGroup && bloodGroup.toString().trim()) {
      applicationData.bloodGroup = bloodGroup.toString().trim();
    }

    const newApplication = await MembershipApplication.create(applicationData);

    // ------------------------------------------------------------------
    // 6. Return a safe, minimal response – no sensitive internal fields.
    // ------------------------------------------------------------------
    return res.status(201).json({
      success: true,
      message:
        "Your membership application has been submitted and is awaiting admin approval.",
      application: {
        applicationId: newApplication.applicationId,
        name: newApplication.name,
        email: newApplication.email,
        status: newApplication.status,
        submittedAt: newApplication.createdAt,
      },
    });
  } catch (error) {
    // Log only a safe summary – not the full applicant body
    console.error("submitApplication error:", error.message);

    // Surface Mongoose validation errors as 400
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        error: messages.join(" "),
      });
    }

    // Duplicate key from MongoDB (race condition on applicationId or email index)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "An application already exists for this email or phone number.",
        status: "PENDING",
      });
    }

    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

module.exports = { submitApplication };
