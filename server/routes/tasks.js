"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { TASK_LEVELS, TASK_SKILL_BUMP, G1_AXES, G2_AXES } = require("../labels");

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await ready();
    next();
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { employeeIds, title, due, level, axisGroup, axisIndex } = req.body || {};
    const ids = Array.isArray(employeeIds) ? [...new Set(employeeIds)] : [];
    if (!ids.length) return res.status(400).json({ error: "employeeIds must be a non-empty array" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });
    if (!TASK_LEVELS.includes(level)) return res.status(400).json({ error: `level must be one of ${TASK_LEVELS.join(", ")}` });

    const empCheck = await pool.query("SELECT id FROM employees WHERE id = ANY($1)", [ids]);
    if (empCheck.rows.length !== ids.length) return res.status(400).json({ error: "Some employeeIds are invalid" });

    let axGroup = null;
    let axIndex = null;
    if (axisGroup === "g1" || axisGroup === "g2") {
      const axes = axisGroup === "g1" ? G1_AXES : G2_AXES;
      const idx = Number(axisIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= axes.length) return res.status(400).json({ error: "invalid axisIndex" });
      axGroup = axisGroup;
      axIndex = idx;
    }

    const id = "T" + Date.now();
    await pool.query(
      "INSERT INTO tasks (id, title, due, level, axis_group, axis_index) VALUES ($1,$2,$3,$4,$5,$6)",
      [id, title.trim(), typeof due === "string" ? due.trim() : "", level, axGroup, axIndex]
    );
    for (let i = 0; i < ids.length; i++) {
      await pool.query(
        "INSERT INTO task_assignments (id, task_id, employee_id, done) VALUES ($1,$2,$3,false)",
        [id + "-a" + i, id, ids[i]]
      );
    }
    res.status(201).json({ id, employeeIds: ids });
  } catch (err) {
    next(err);
  }
});

router.patch("/assignments/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ta.id, ta.employee_id, ta.done, t.axis_group, t.axis_index
       FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id
       WHERE ta.id = $1`,
      [req.params.id]
    );
    const assignment = rows[0];
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (!req.body || typeof req.body.done !== "boolean") return res.status(400).json({ error: "done must be a boolean" });

    const newDone = req.body.done;
    if (newDone !== assignment.done) {
      await pool.query("UPDATE task_assignments SET done = $1 WHERE id = $2", [newDone, req.params.id]);

      if (assignment.axis_group === "g1" || assignment.axis_group === "g2") {
        const col = assignment.axis_group;
        const delta = newDone ? TASK_SKILL_BUMP : -TASK_SKILL_BUMP;
        const empRes = await pool.query(`SELECT ${col} FROM employees WHERE id = $1`, [assignment.employee_id]);
        const arr = empRes.rows[0] && empRes.rows[0][col];
        if (Array.isArray(arr) && assignment.axis_index >= 0 && assignment.axis_index < arr.length) {
          const next = arr.slice();
          next[assignment.axis_index] = Math.max(0, Math.min(100, (next[assignment.axis_index] || 0) + delta));
          await pool.query(`UPDATE employees SET ${col} = $1 WHERE id = $2`, [JSON.stringify(next), assignment.employee_id]);
        }
      }
    }
    res.json({ id: assignment.id, done: newDone });
  } catch (err) {
    next(err);
  }
});

router.delete("/assignments/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT task_id FROM task_assignments WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Assignment not found" });
    const taskId = rows[0].task_id;

    await pool.query("DELETE FROM task_assignments WHERE id = $1", [req.params.id]);
    const remaining = await pool.query("SELECT COUNT(*)::int AS n FROM task_assignments WHERE task_id = $1", [taskId]);
    if (remaining.rows[0].n === 0) await pool.query("DELETE FROM tasks WHERE id = $1", [taskId]);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
