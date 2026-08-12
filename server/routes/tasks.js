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

async function applySkillBump(employeeId, axisGroup, axisIndex, delta) {
  if (axisGroup !== "g1" && axisGroup !== "g2") return;
  const empRes = await pool.query(`SELECT ${axisGroup} FROM employees WHERE id = $1`, [employeeId]);
  const arr = empRes.rows[0] && empRes.rows[0][axisGroup];
  if (!Array.isArray(arr) || axisIndex < 0 || axisIndex >= arr.length) return;
  const next = arr.slice();
  next[axisIndex] = Math.max(0, Math.min(100, (next[axisIndex] || 0) + delta));
  await pool.query(`UPDATE employees SET ${axisGroup} = $1 WHERE id = $2`, [JSON.stringify(next), employeeId]);
}

// Whether any assignee of a task belongs to the given line — used to scope a shift leader's
// visibility/actions to tasks relevant to their own team.
async function taskInvolvesLine(taskId, lineId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM task_assignments ta JOIN employees e ON e.id = ta.employee_id
     WHERE ta.task_id = $1 AND e.line_id = $2 LIMIT 1`,
    [taskId, lineId]
  );
  return rows.length > 0;
}

router.get("/", async (req, res, next) => {
  try {
    const scoped = req.user.role !== "admin";
    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.due, t.level, t.axis_group, t.axis_index,
         COALESCE(bool_and(ta.done), false) AS done,
         COALESCE(json_agg(json_build_object('id', e.id, 'nameEn', e.name_en, 'name', e.name, 'nickname', e.nickname, 'empCode', e.emp_code, 'level', e.level) ORDER BY e.emp_code), '[]') AS assignees
       FROM tasks t
       JOIN task_assignments ta ON ta.task_id = t.id
       JOIN employees e ON e.id = ta.employee_id
       ${scoped ? "WHERE t.id IN (SELECT task_id FROM task_assignments ta2 JOIN employees e2 ON e2.id = ta2.employee_id WHERE e2.line_id = $1)" : ""}
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      scoped ? [req.user.lineId] : []
    );
    res.json(rows.map((r) => ({
      id: r.id, title: r.title, due: r.due, level: r.level,
      axisGroup: r.axis_group, axisIndex: r.axis_index, done: r.done, assignees: r.assignees,
    })));
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

    const empCheck = await pool.query("SELECT id, line_id FROM employees WHERE id = ANY($1)", [ids]);
    if (empCheck.rows.length !== ids.length) return res.status(400).json({ error: "Some employeeIds are invalid" });
    if (req.user.role !== "admin" && empCheck.rows.some((r) => r.line_id !== req.user.lineId)) {
      return res.status(403).json({ error: "คุณมอบหมายงานได้เฉพาะพนักงานในสายของตัวเองเท่านั้น" });
    }

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

// Marks the whole task done/not-done for every assignee at once.
router.patch("/:id", async (req, res, next) => {
  try {
    const task = await pool.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    if (!task.rows[0]) return res.status(404).json({ error: "Task not found" });
    if (req.user.role !== "admin" && !(await taskInvolvesLine(req.params.id, req.user.lineId))) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (!req.body || typeof req.body.done !== "boolean") return res.status(400).json({ error: "done must be a boolean" });

    const newDone = req.body.done;
    const { axis_group: axisGroup, axis_index: axisIndex } = task.rows[0];
    const { rows: assignments } = await pool.query("SELECT id, employee_id, done FROM task_assignments WHERE task_id = $1", [req.params.id]);

    const delta = newDone ? TASK_SKILL_BUMP : -TASK_SKILL_BUMP;
    for (const a of assignments) {
      if (a.done === newDone) continue;
      await pool.query("UPDATE task_assignments SET done = $1 WHERE id = $2", [newDone, a.id]);
      await applySkillBump(a.employee_id, axisGroup, axisIndex, delta);
    }
    res.json({ id: req.params.id, done: newDone });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (req.user.role !== "admin" && !(await taskInvolvesLine(req.params.id, req.user.lineId))) {
      return res.status(404).json({ error: "Task not found" });
    }
    const result = await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
