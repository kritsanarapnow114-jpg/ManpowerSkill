"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { forbidRoles } = require("../auth");
const { g1AxesFor, g2AxesFor } = require("../labels");
const { FREQUENCIES, ensureRecurringGenerated, generateAchievementIfDue } = require("../recurring");

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await ready();
    await ensureRecurringGenerated();
    next();
  } catch (err) {
    next(err);
  }
});

router.use(forbidRoles("employee"));

function serialize(row) {
  return {
    id: row.id, employeeId: row.employee_id, title: row.title, note: row.note,
    axisGroup: row.axis_group, axisIndex: row.axis_index, frequency: row.frequency,
  };
}

router.get("/", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM recurring_achievements WHERE active = true ORDER BY created_at DESC";
    let params = [];
    if (req.user.role === "shift_leader") {
      sql = `SELECT ra.* FROM recurring_achievements ra JOIN employees e ON e.id = ra.employee_id
             WHERE ra.active = true AND e.line_id = $1 ORDER BY ra.created_at DESC`;
      params = [req.user.lineId];
    }
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { employeeId, title, note, frequency, axisGroup, axisIndex } = req.body || {};
    if (!employeeId) return res.status(400).json({ error: "Valid employeeId is required" });
    const emp = await pool.query("SELECT id, line_id, position FROM employees WHERE id = $1", [employeeId]);
    if (!emp.rows[0]) return res.status(400).json({ error: "Valid employeeId is required" });
    if (req.user.role === "shift_leader" && emp.rows[0].line_id !== req.user.lineId) {
      return res.status(403).json({ error: "คุณตั้งผลงานประจำได้เฉพาะพนักงานในสายของตัวเองเท่านั้น" });
    }
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });
    if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: `frequency must be one of ${FREQUENCIES.join(", ")}` });

    let axGroup = null;
    let axIndex = null;
    if (axisGroup === "g1" || axisGroup === "g2") {
      const axes = axisGroup === "g1" ? g1AxesFor(emp.rows[0].position) : g2AxesFor(emp.rows[0].position);
      const idx = Number(axisIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= axes.length) return res.status(400).json({ error: "invalid axisIndex" });
      axGroup = axisGroup;
      axIndex = idx;
    }

    const id = "RA" + Date.now();
    await pool.query(
      "INSERT INTO recurring_achievements (id, employee_id, title, note, axis_group, axis_index, frequency) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [id, employeeId, title.trim(), typeof note === "string" ? note.trim() : "", axGroup, axIndex, frequency]
    );

    const { rows } = await pool.query("SELECT * FROM recurring_achievements WHERE id = $1", [id]);
    await generateAchievementIfDue(rows[0], new Date().toISOString().slice(0, 10));
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    let sql = "DELETE FROM recurring_achievements WHERE id = $1";
    let params = [req.params.id];
    if (req.user.role === "shift_leader") {
      sql = `DELETE FROM recurring_achievements WHERE id = $1
             AND employee_id IN (SELECT id FROM employees WHERE line_id = $2)`;
      params = [req.params.id, req.user.lineId];
    }
    const result = await pool.query(sql, params);
    if (result.rowCount === 0) return res.status(404).json({ error: "Recurring achievement not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
