const express = require("express");
const bcrypt = require("bcryptjs");
const { User } = require("../models");
const { signToken, requireAuth } = require("../middleware/auth");
const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (res, status, code, message) => res.status(status).json({ success: false, error: { code, message } });
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }
const attempts = new Map(), WINDOW_MS = 15 * 60 * 1000, MAX_ATTEMPTS = 10;
function attemptKey(req, email) { return `${req.ip}|${email}`; }
function isLimited(key) { const entry = attempts.get(key); if (!entry) return false; if (Date.now() - entry.first > WINDOW_MS) { attempts.delete(key); return false; } return entry.count >= MAX_ATTEMPTS; }
function recordFailure(key) { const entry = attempts.get(key); if (!entry || Date.now() - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() }); else entry.count += 1; }
router.post("/register", async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim(), email = String(req.body?.email || "").trim().toLowerCase(), password = String(req.body?.password || "");
    if (name.length < 2 || name.length > 120) return fail(res, 400, "VALIDATION_ERROR", "Please enter your name (2-120 characters).");
    if (!EMAIL_PATTERN.test(email) || email.length > 190) return fail(res, 400, "VALIDATION_ERROR", "Please enter a valid email address.");
    if (password.length < 8 || password.length > 72) return fail(res, 400, "VALIDATION_ERROR", "Password must be 8-72 characters.");
    const existing = await User.findOne({ where: { email } });
    if (existing) return fail(res, 409, "EMAIL_EXISTS", "An account with this email already exists.");
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role: "customer" });
    return res.status(201).json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) { if (error.name === "SequelizeUniqueConstraintError") return fail(res, 409, "EMAIL_EXISTS", "An account with this email already exists."); next(error); }
});
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase(), password = String(req.body?.password || "");
    if (!email || !password) return fail(res, 400, "VALIDATION_ERROR", "Please enter your email and password.");
    const key = attemptKey(req, email);
    if (isLimited(key)) return fail(res, 429, "LOGIN_RATE_LIMITED", "Too many failed attempts. Please try again in 15 minutes.");
    const user = await User.findOne({ where: { email } });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!valid) { recordFailure(key); return fail(res, 401, "INVALID_CREDENTIALS", "Invalid email or password."); }
    attempts.delete(key);
    return res.json({ success: true, token: signToken(user), user: publicUser(user) });
  } catch (error) { next(error); }
});
router.get("/me", requireAuth, (req, res) => res.json({ success: true, user: publicUser(req.user) }));
module.exports = router;
