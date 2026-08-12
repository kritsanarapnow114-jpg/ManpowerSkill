"use strict";

const express = require("express");
const { pool, ready } = require("../db");

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
    stationId: row.station_id,
    date: row.date,
    hours: Number(row.hours),
    note: row.note,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM work_logs ORDER BY date DESC, created_at DESC");
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { employeeId, stationId, date, hours, note } = req.body || {};
    if (!employeeId) return res.status(400).json({ error: "Valid employeeId is required" });
    const emp = await pool.query("SELECT id FROM employees WHERE id = $1", [employeeId]);
    if (!emp.rows[0]) return res.status(400).json({ error: "Valid employeeId is required" });

    if (!stationId) return res.status(400).json({ error: "Valid stationId is required" });
    const stn = await pool.query("SELECT id FROM stations WHERE id = $1", [stationId]);
    if (!stn.rows[0]) return res.status(400).json({ error: "Valid stationId is required" });

    if (typeof date !== "string" || !date.trim()) return res.status(400).json({ error: "date is required" });

    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > 24) return res.status(400).json({ error: "hours must be a number between 0 and 24" });

    const id = "WL" + Date.now();
    await pool.query(
      "INSERT INTO work_logs (id, employee_id, station_id, date, hours, note) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, employeeId, stationId, date.trim(), h, typeof note === "string" ? note.trim() : ""]
    );
    const { rows } = await pool.query("SELECT * FROM work_logs WHERE id = $1", [id]);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM work_logs WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Work log not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
