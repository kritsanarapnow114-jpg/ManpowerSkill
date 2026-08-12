"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { forbidRoles } = require("../auth");
const { HAZARD_KEYS } = require("../labels");

const router = express.Router();

const MAX_IMAGE_LENGTH = 2_000_000; // ~1.5MB decoded, generous for an equipment photo

router.use(async (req, res, next) => {
  try {
    await ready();
    next();
  } catch (err) {
    next(err);
  }
});

function serialize(row) {
  return { id: row.id, code: row.code, name: row.name, image: row.image, sortOrder: row.sort_order, hazards: row.hazards || [] };
}

function validateHazards(hazards) {
  return Array.isArray(hazards) && hazards.every((h) => HAZARD_KEYS.includes(h));
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM stations ORDER BY sort_order, code");
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", forbidRoles("employee"), async (req, res, next) => {
  try {
    const { code, name, image, hazards } = req.body || {};
    if (typeof code !== "string" || !code.trim()) return res.status(400).json({ error: "code is required" });
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name is required" });
    if (image && (typeof image !== "string" || image.length > MAX_IMAGE_LENGTH)) {
      return res.status(400).json({ error: "image is too large" });
    }
    if (hazards !== undefined && !validateHazards(hazards)) return res.status(400).json({ error: "invalid hazards" });

    const { rows: maxRows } = await pool.query("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM stations");
    const id = "STN" + Date.now();
    await pool.query(
      "INSERT INTO stations (id, code, name, image, sort_order, hazards) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, code.trim(), name.trim(), typeof image === "string" ? image : "", maxRows[0].next, JSON.stringify(hazards || [])]
    );
    const { rows } = await pool.query("SELECT * FROM stations WHERE id = $1", [id]);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", forbidRoles("employee"), async (req, res, next) => {
  try {
    const existing = await pool.query("SELECT * FROM stations WHERE id = $1", [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Station not found" });

    const { code, name, image, hazards } = req.body || {};
    if (typeof code !== "string" || !code.trim()) return res.status(400).json({ error: "code is required" });
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name is required" });
    if (image && (typeof image !== "string" || image.length > MAX_IMAGE_LENGTH)) {
      return res.status(400).json({ error: "image is too large" });
    }
    if (hazards !== undefined && !validateHazards(hazards)) return res.status(400).json({ error: "invalid hazards" });

    await pool.query(
      "UPDATE stations SET code=$1, name=$2, image=$3, hazards=$4 WHERE id=$5",
      [
        code.trim(),
        name.trim(),
        typeof image === "string" ? image : existing.rows[0].image,
        JSON.stringify(hazards !== undefined ? hazards : existing.rows[0].hazards || []),
        req.params.id,
      ]
    );
    const { rows } = await pool.query("SELECT * FROM stations WHERE id = $1", [req.params.id]);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", forbidRoles("employee"), async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM stations WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Station not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
