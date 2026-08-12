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
    let sql = "SELECT wl.* FROM work_logs wl";
    let params = [];
    if (req.user.role === "shift_leader") {
      sql += " JOIN employees e ON e.id = wl.employee_id WHERE e.line_id = $1";
      params = [req.user.lineId];
    } else if (req.user.role === "employee") {
      sql += " WHERE wl.employee_id = $1";
      params = [req.user.employeeId];
    }
    sql += " ORDER BY wl.date DESC, wl.created_at DESC";
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = req.body || {};
    const employeeId = req.user.role === "employee" ? req.user.employeeId : body.employeeId;
    const { stationId, date, hours, note } = body;

    if (!employeeId) return res.status(400).json({ error: "Valid employeeId is required" });
    const emp = await pool.query("SELECT id, line_id FROM employees WHERE id = $1", [employeeId]);
    if (!emp.rows[0]) return res.status(400).json({ error: "Valid employeeId is required" });
    if (req.user.role === "shift_leader" && emp.rows[0].line_id !== req.user.lineId) {
      return res.status(403).json({ error: "คุณบันทึกได้เฉพาะพนักงานในสายของตัวเองเท่านั้น" });
    }

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
    const existing = await pool.query(
      "SELECT wl.id, wl.employee_id, e.line_id FROM work_logs wl JOIN employees e ON e.id = wl.employee_id WHERE wl.id = $1",
      [req.params.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: "Work log not found" });
    if (req.user.role === "shift_leader" && existing.rows[0].line_id !== req.user.lineId) {
      return res.status(404).json({ error: "Work log not found" });
    }
    if (req.user.role === "employee" && existing.rows[0].employee_id !== req.user.employeeId) {
      return res.status(404).json({ error: "Work log not found" });
    }

    const result = await pool.query("DELETE FROM work_logs WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Work log not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
