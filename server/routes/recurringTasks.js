"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { forbidRoles } = require("../auth");
const { TASK_LEVELS, g1AxesFor, g2AxesFor } = require("../labels");
const { FREQUENCIES, ensureRecurringGenerated, generateTaskIfDue } = require("../recurring");

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

async function serialize(row) {
  const { rows } = await pool.query(
    "SELECT employee_id FROM recurring_task_assignees WHERE recurring_task_id = $1",
    [row.id]
  );
  let assignedBy = null;
  if (row.assigned_by) {
    const { rows: userRows } = await pool.query(
      "SELECT id, COALESCE(NULLIF(display_name, ''), username) AS name FROM users WHERE id = $1",
      [row.assigned_by]
    );
    if (userRows[0]) assignedBy = userRows[0];
  }
  return {
    id: row.id, title: row.title, level: row.level,
    axisGroup: row.axis_group, axisIndex: row.axis_index,
    frequency: row.frequency, employeeIds: rows.map((r) => r.employee_id), assignedBy,
  };
}

router.get("/", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM recurring_tasks WHERE active = true ORDER BY created_at DESC";
    let params = [];
    if (req.user.role === "shift_leader") {
      sql = `SELECT rt.* FROM recurring_tasks rt
             WHERE rt.active = true AND NOT EXISTS (
               SELECT 1 FROM recurring_task_assignees rta JOIN employees e ON e.id = rta.employee_id
               WHERE rta.recurring_task_id = rt.id AND e.line_id <> $1
             )
             ORDER BY rt.created_at DESC`;
      params = [req.user.lineId];
    }
    const { rows } = await pool.query(sql, params);
    res.json(await Promise.all(rows.map(serialize)));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { employeeIds, title, level, frequency, axisGroup, axisIndex } = req.body || {};
    const ids = Array.isArray(employeeIds) ? [...new Set(employeeIds)] : [];
    if (!ids.length) return res.status(400).json({ error: "employeeIds must be a non-empty array" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });
    if (!TASK_LEVELS.includes(level)) return res.status(400).json({ error: `level must be one of ${TASK_LEVELS.join(", ")}` });
    if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: `frequency must be one of ${FREQUENCIES.join(", ")}` });

    const empCheck = await pool.query("SELECT id, line_id, position FROM employees WHERE id = ANY($1)", [ids]);
    if (empCheck.rows.length !== ids.length) return res.status(400).json({ error: "Some employeeIds are invalid" });
    if (req.user.role === "shift_leader" && empCheck.rows.some((r) => r.line_id !== req.user.lineId)) {
      return res.status(403).json({ error: "คุณตั้งงานประจำได้เฉพาะพนักงานในสายของตัวเองเท่านั้น" });
    }

    let axGroup = null;
    let axIndex = null;
    if (axisGroup === "g1" || axisGroup === "g2") {
      const refPosition = empCheck.rows[0] && empCheck.rows[0].position;
      const axes = axisGroup === "g1" ? g1AxesFor(refPosition) : g2AxesFor(refPosition);
      const idx = Number(axisIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= axes.length) return res.status(400).json({ error: "invalid axisIndex" });
      axGroup = axisGroup;
      axIndex = idx;
    }

    const id = "RT" + Date.now();
    await pool.query(
      "INSERT INTO recurring_tasks (id, title, level, axis_group, axis_index, frequency, assigned_by) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [id, title.trim(), level, axGroup, axIndex, frequency, req.user.userId]
    );
    for (const empId of ids) {
      await pool.query(
        "INSERT INTO recurring_task_assignees (recurring_task_id, employee_id) VALUES ($1,$2)",
        [id, empId]
      );
    }

    const { rows } = await pool.query("SELECT * FROM recurring_tasks WHERE id = $1", [id]);
    await generateTaskIfDue(rows[0], new Date().toISOString().slice(0, 10));
    res.status(201).json(await serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (req.user.role === "shift_leader") {
      const { rows } = await pool.query(
        `SELECT 1 FROM recurring_task_assignees rta JOIN employees e ON e.id = rta.employee_id
         WHERE rta.recurring_task_id = $1 AND e.line_id <> $2 LIMIT 1`,
        [req.params.id, req.user.lineId]
      );
      if (rows.length) return res.status(404).json({ error: "Recurring task not found" });
    }
    const result = await pool.query("DELETE FROM recurring_tasks WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Recurring task not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
