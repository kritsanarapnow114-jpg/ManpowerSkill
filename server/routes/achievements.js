"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { forbidRoles } = require("../auth");

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await ready();
    next();
  } catch (err) {
    next(err);
  }
});

function serialize(row) {
  return { id: row.id, employeeId: row.employee_id, title: row.title, date: row.date, note: row.note };
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM achievements ORDER BY date DESC, created_at DESC");
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", forbidRoles("employee"), async (req, res, next) => {
  try {
    const { employeeId, title, date, note } = req.body || {};
    if (!employeeId) return res.status(400).json({ error: "Valid employeeId is required" });
    const emp = await pool.query("SELECT id FROM employees WHERE id = $1", [employeeId]);
    if (!emp.rows[0]) return res.status(400).json({ error: "Valid employeeId is required" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });

    const id = "AC" + Date.now();
    await pool.query(
      "INSERT INTO achievements (id, employee_id, title, date, note) VALUES ($1,$2,$3,$4,$5)",
      [id, employeeId, title.trim(), typeof date === "string" ? date.trim() : "", typeof note === "string" ? note.trim() : ""]
    );
    const { rows } = await pool.query("SELECT * FROM achievements WHERE id = $1", [id]);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", forbidRoles("employee"), async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM achievements WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Achievement not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
