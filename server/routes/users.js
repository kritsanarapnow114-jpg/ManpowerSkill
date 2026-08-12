"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { requireAdmin, hashPassword } = require("../auth");

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await ready();
    next();
  } catch (err) {
    next(err);
  }
});

router.use(requireAdmin);

function serialize(row) {
  return { id: row.id, username: row.username, role: row.role, lineId: row.line_id, displayName: row.display_name };
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY role, username");
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { username, password, role, lineId, displayName } = req.body || {};
    if (typeof username !== "string" || !username.trim()) return res.status(400).json({ error: "username is required" });
    if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "password ต้องมีอย่างน้อย 6 ตัวอักษร" });
    if (role !== "admin" && role !== "shift_leader") return res.status(400).json({ error: "role must be admin or shift_leader" });

    let lid = null;
    if (role === "shift_leader") {
      if (typeof lineId !== "string" || !lineId.trim()) return res.status(400).json({ error: "lineId is required for shift_leader" });
      const lineCheck = await pool.query("SELECT id FROM lines WHERE id = $1", [lineId]);
      if (!lineCheck.rows[0]) return res.status(400).json({ error: "Invalid lineId" });
      lid = lineId;
    }

    const existing = await pool.query("SELECT id FROM users WHERE username = $1", [username.trim()]);
    if (existing.rows[0]) return res.status(400).json({ error: "username นี้มีอยู่แล้ว" });

    const id = "U" + Date.now();
    const hash = await hashPassword(password);
    await pool.query(
      "INSERT INTO users (id, username, password_hash, role, line_id, display_name) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, username.trim(), hash, role, lid, typeof displayName === "string" ? displayName.trim() : ""]
    );
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "User not found" });

    const { password, role, lineId, displayName } = req.body || {};
    const finalRole = role === "admin" || role === "shift_leader" ? role : existing.rows[0].role;

    let lid = null;
    if (finalRole === "shift_leader") {
      const nextLineId = typeof lineId === "string" && lineId.trim() ? lineId.trim() : existing.rows[0].line_id;
      if (!nextLineId) return res.status(400).json({ error: "lineId is required for shift_leader" });
      const lineCheck = await pool.query("SELECT id FROM lines WHERE id = $1", [nextLineId]);
      if (!lineCheck.rows[0]) return res.status(400).json({ error: "Invalid lineId" });
      lid = nextLineId;
    }

    const finalDisplayName = typeof displayName === "string" ? displayName.trim() : existing.rows[0].display_name;

    if (typeof password === "string" && password.trim()) {
      if (password.length < 6) return res.status(400).json({ error: "password ต้องมีอย่างน้อย 6 ตัวอักษร" });
      const hash = await hashPassword(password);
      await pool.query(
        "UPDATE users SET role=$1, line_id=$2, display_name=$3, password_hash=$4 WHERE id=$5",
        [finalRole, lid, finalDisplayName, hash, req.params.id]
      );
    } else {
      await pool.query(
        "UPDATE users SET role=$1, line_id=$2, display_name=$3 WHERE id=$4",
        [finalRole, lid, finalDisplayName, req.params.id]
      );
    }

    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [req.params.id]);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (req.params.id === req.user.userId) return res.status(400).json({ error: "ลบบัญชีของตัวเองไม่ได้" });

    const target = await pool.query("SELECT role FROM users WHERE id = $1", [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ error: "User not found" });

    if (target.rows[0].role === "admin") {
      const adminCount = await pool.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
      if (adminCount.rows[0].count <= 1) return res.status(400).json({ error: "ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน" });
    }

    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
