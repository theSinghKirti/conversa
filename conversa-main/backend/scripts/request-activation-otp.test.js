/**
 * tests/activation-controller.requestActivationOtp.test.js
 *
 * Tests for the requestActivationOtp controller.
 * Uses Jest with manual mocks — no live DB or SMTP connection required.
 *
 * Run:
 *   npx jest scripts/test-request-activation-otp.js --testEnvironment node
 */

"use strict";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock MembershipApplication model
const mockApplication = {
  memberId: "MEM-0001",
  email: "member@example.com",
  status: "APPROVED_PENDING_VERIFICATION",
  activationOtpRequestedAt: null,
  activationOtpHash: null,
  activationOtpExpiresAt: null,
  activationOtpAttempts: 0,
  save: jest.fn().mockResolvedValue(true),
};

jest.mock("../Models/MembershipApplication.js", () => ({
  findOne: jest.fn(),
}));

jest.mock("../utils/emailService.js", () => ({
  sendEmail: jest.fn(),
}));

// bcryptjs is fast in tests; no need to mock
// jwt is not used in requestActivationOtp

const MembershipApplication = require("../Models/MembershipApplication.js");
const { sendEmail } = require("../utils/emailService.js");
const { requestActivationOtp } = require("../Controllers/activation-controller.js");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal Express-like req object */
const makeReq = (body = {}) => ({ body });

/** Build a chainable res mock that captures the last .json() call */
const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

/** Deep-clone the base application mock so each test starts fresh */
const freshApp = (overrides = {}) =>
  Object.assign(
    {},
    mockApplication,
    { save: jest.fn().mockResolvedValue(true) },
    overrides
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("requestActivationOtp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Validation ──────────────────────────────────────────────────────────

  test("returns 400 when memberId is missing", async () => {
    const req = makeReq({ email: "a@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  test("returns 400 when email is missing", async () => {
    const req = makeReq({ memberId: "MEM-0001" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  test("returns 400 when both memberId and email are missing", async () => {
    const req = makeReq({});
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ── 2. Application lookup ──────────────────────────────────────────────────

  test("returns 400 when no application found for memberId+email combo", async () => {
    MembershipApplication.findOne.mockResolvedValue(null);
    const req = makeReq({ memberId: "MEM-9999", email: "nobody@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  // ── 3. Status checks ───────────────────────────────────────────────────────

  test("returns 409 when application status is ACTIVE", async () => {
    MembershipApplication.findOne.mockResolvedValue(freshApp({ status: "ACTIVE" }));
    const req = makeReq({ memberId: "MEM-0001", email: "member@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  test("returns 403 when application status is REJECTED", async () => {
    MembershipApplication.findOne.mockResolvedValue(freshApp({ status: "REJECTED" }));
    const req = makeReq({ memberId: "MEM-0001", email: "member@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns 403 when application status is SUSPENDED", async () => {
    MembershipApplication.findOne.mockResolvedValue(freshApp({ status: "SUSPENDED" }));
    const req = makeReq({ memberId: "MEM-0001", email: "member@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns 400 when application status is PENDING (not yet approved)", async () => {
    MembershipApplication.findOne.mockResolvedValue(freshApp({ status: "PENDING" }));
    const req = makeReq({ memberId: "MEM-0001", email: "member@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("approved"),
      })
    );
  });

  // ── 4. Cooldown ────────────────────────────────────────────────────────────

  test("returns 429 when OTP was requested less than 60 seconds ago", async () => {
    const recentRequest = new Date(Date.now() - 10 * 1000); // 10 seconds ago
    MembershipApplication.findOne.mockResolvedValue(
      freshApp({ activationOtpRequestedAt: recentRequest })
    );
    const req = makeReq({ memberId: "MEM-0001", email: "member@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  // ── 5. Happy path (the previously-crashing flow) ───────────────────────────

  test("returns 200 and sends OTP email on success — EMAIL variable no longer crashes", async () => {
    sendEmail.mockResolvedValue({ success: true, messageId: "mock-id-123" });
    MembershipApplication.findOne.mockResolvedValue(freshApp());

    const req = makeReq({ memberId: "  mem-0001  ", email: "  Member@Example.COM  " });
    const res = makeRes();

    await requestActivationOtp(req, res);

    // Should not 500 any more
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        expiresInSeconds: 300,
      })
    );

    // sendEmail must be called with the normalised (trimmed, lowercase) email
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const emailArg = sendEmail.mock.calls[0][0];
    expect(emailArg.to).toBe("member@example.com");
    expect(emailArg.subject).toMatch(/Activation Code/i);
    expect(emailArg.html).toBeTruthy();
  });

  test("normalises memberId to uppercase and email to lowercase before DB lookup", async () => {
    sendEmail.mockResolvedValue({ success: true });
    MembershipApplication.findOne.mockResolvedValue(freshApp());

    const req = makeReq({ memberId: "  mem-0001  ", email: "  Member@Example.COM  " });
    const res = makeRes();

    await requestActivationOtp(req, res);

    const callArgs = MembershipApplication.findOne.mock.calls[0][0];
    expect(callArgs.memberId).toBe("MEM-0001");
    expect(callArgs.email).toBe("member@example.com");
  });

  // ── 6. Email delivery failure ─────────────────────────────────────────────

  test("returns 500 when sendEmail reports failure", async () => {
    sendEmail.mockResolvedValue({ success: false, error: "SMTP timeout" });
    MembershipApplication.findOne.mockResolvedValue(freshApp());

    const req = makeReq({ memberId: "MEM-0001", email: "member@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("SMTP timeout"),
      })
    );
  });

  test("returns 500 when sendEmail throws unexpectedly", async () => {
    sendEmail.mockRejectedValue(new Error("network error"));
    MembershipApplication.findOne.mockResolvedValue(freshApp());

    const req = makeReq({ memberId: "MEM-0001", email: "member@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // ── 7. Cooldown boundary ──────────────────────────────────────────────────

  test("does NOT 429 when last OTP request was exactly 60 seconds ago", async () => {
    sendEmail.mockResolvedValue({ success: true });
    const exactly60sAgo = new Date(Date.now() - 60 * 1000);
    MembershipApplication.findOne.mockResolvedValue(
      freshApp({ activationOtpRequestedAt: exactly60sAgo })
    );

    const req = makeReq({ memberId: "MEM-0001", email: "member@example.com" });
    const res = makeRes();

    await requestActivationOtp(req, res);

    expect(res.status).not.toHaveBeenCalledWith(429);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
