"use strict";

const express = require("express");
const { pool, ready } = require("../db");

const router = express.Router();

const MAX_IMAGE_LENGTH = 2_000_000; // ~1.5MB decoded, generous for a scanned certificate

router.use(async (req, res, next) => {
  try {
    await ready();
    next();
  } catch (err) {
    next(err);
  }
});

function serialize(row) {
  return { id: row.id, employeeId: row.employee_id, name: row.name, expiry: row.expiry, image: row.image };
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM certificates ORDER BY expiry, created_at DESC");
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { employeeId, name, expiry, image } = req.body || {};
    if (!employeeId) return res.status(400).json({ error: "Valid employeeId is required" });
    const emp = await pool.query("SELECT id FROM employees WHERE id = $1", [employeeId]);
    if (!emp.rows[0]) return res.status(400).json({ error: "Valid employeeId is required" });
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name is required" });
    if (expiry && typeof expiry !== "string") return res.status(400).json({ error: "expiry must be a date string" });
    if (image && (typeof image !== "string" || image.length > MAX_IMAGE_LENGTH)) {
      return res.status(400).json({ error: "image is too large" });
    }

    const id = "C" + Date.now();
    await pool.query(
      "INSERT INTO certificates (id, employee_id, name, expiry, image) VALUES ($1,$2,$3,$4,$5)",
      [id, employeeId, name.trim(), typeof expiry === "string" ? expiry.trim() : "", typeof image === "string" ? image : ""]
    );
    const { rows } = await pool.query("SELECT * FROM certificates WHERE id = $1", [id]);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM certificates WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Certificate not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
