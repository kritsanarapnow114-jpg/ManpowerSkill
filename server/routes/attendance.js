"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { ATTENDANCE_TYPES } = require("../labels");

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
  return {
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    date: row.date,
    note: row.note,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM attendance ORDER BY date DESC, created_at DESC");
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { employeeId, type, date, note } = req.body || {};
    if (!employeeId) return res.status(400).json({ error: "Valid employeeId is required" });
    const emp = await pool.query("SELECT id FROM employees WHERE id = $1", [employeeId]);
    if (!emp.rows[0]) return res.status(400).json({ error: "Valid employeeId is required" });
    if (!ATTENDANCE_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${ATTENDANCE_TYPES.join(", ")}` });
    }
    if (typeof date !== "string" || !date.trim()) return res.status(400).json({ error: "date is required" });

    const id = "A" + Date.now();
    await pool.query(
      "INSERT INTO attendance (id, employee_id, type, date, note) VALUES ($1,$2,$3,$4,$5)",
      [id, employeeId, type, date.trim(), typeof note === "string" ? note.trim() : ""]
    );
    const { rows } = await pool.query("SELECT * FROM attendance WHERE id = $1", [id]);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM attendance WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Attendance record not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
