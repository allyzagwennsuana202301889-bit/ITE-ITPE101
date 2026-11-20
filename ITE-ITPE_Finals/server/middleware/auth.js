const jwt = require("jsonwebtoken");
const { User } = require("../models");

const JWT_SECRET = process.env.JWT_SECRET;
function getSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  return JWT_SECRET;
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// Requires a valid "Authorization: Bearer <token>" header.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Please log in to continue." });
    }

    const payload = jwt.verify(token, getSecret());
    const user = await User.findByPk(payload.id);

    if (!user) {
      return res.status(401).json({ message: "Account no longer exists." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Your session has expired. Please log in again." });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

module.exports = { signToken, requireAuth, requireAdmin };
