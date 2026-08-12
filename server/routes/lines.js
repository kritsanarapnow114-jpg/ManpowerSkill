"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { requireAdmin } = require("../auth");

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await ready();
    next();
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM lines ORDER BY sort_order, name");
    res.json(rows.map((r) => ({ id: r.id, name: r.name })));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name is required" });

    const { rows: countRows } = await pool.query("SELECT COUNT(*)::int AS count FROM lines");
    const id = "LINE-" + Date.now();
    await pool.query("INSERT INTO lines (id, name, sort_order) VALUES ($1,$2,$3)", [id, name.trim(), countRows[0].count]);
    res.status(201).json({ id, name: name.trim() });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
