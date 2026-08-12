"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { sign, verify, comparePassword, MAX_AGE_MS } = require("../auth");

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await ready();
    next();
  } catch (err) {
    next(err);
  }
});

function serializeUser(row) {
  return { id: row.id, username: row.username, role: row.role, lineId: row.line_id, displayName: row.display_name };
}

const isSecure = () => process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

function setSessionCookie(res, user) {
  const token = sign({ userId: user.id, username: user.username, role: user.role, lineId: user.line_id, displayName: user.display_name });
  res.cookie("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure(),
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

router.post("/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password) {
      return res.status(400).json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
    }
    const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username.trim()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    const ok = await comparePassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    setSessionCookie(res, user);
    res.json(serializeUser(user));
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("session", { path: "/" });
  res.status(204).end();
});

router.get("/me", async (req, res, next) => {
  try {
    const payload = verify(req.cookies && req.cookies.session);
    if (!payload) return res.status(401).json({ error: "not logged in" });
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [payload.userId]);
    if (!rows[0]) return res.status(401).json({ error: "not logged in" });
    res.json(serializeUser(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
