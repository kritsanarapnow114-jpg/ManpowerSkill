"use strict";

const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const connectionString =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";

// Falls back to a secret derived from the DB connection string (unique per deployment) so
// sessions work out of the box without requiring a separate env var to be configured.
const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.createHash("sha256").update("nbc-skills-session:" + connectionString).digest("hex");

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function sign(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + MAX_AGE_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function requireAuth(req, res, next) {
  const payload = verify(req.cookies && req.cookies.session);
  if (!payload) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
  req.user = payload;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "เฉพาะผู้ดูแลระบบเท่านั้น" });
  next();
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = { sign, verify, requireAuth, requireAdmin, hashPassword, comparePassword, MAX_AGE_MS };
