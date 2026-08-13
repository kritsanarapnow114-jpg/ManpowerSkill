"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { TASK_LEVELS, g1AxesFor, g2AxesFor } = require("../labels");
const { fetchTeamMemberIds, isTeamLead } = require("../teams");
const { ensureRecurringGenerated } = require("../recurring");

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

// Whether a specific employee is an assignee of a task — used to scope an employee's own
// visibility/actions (self-service check-off) to tasks they're actually part of.
async function taskInvolvesEmployee(taskId, employeeId) {
  const { rows } = await pool.query(
    "SELECT 1 FROM task_assignments WHERE task_id = $1 AND employee_id = $2 LIMIT 1",
    [taskId, employeeId]
  );
  return rows.length > 0;
}

// Whether every assignee of a task is within an allowed set of employee ids - used to let a
// team-lead employee manage (patch/delete) tasks assigned entirely within their own team.
async function taskAssigneesWithinSet(taskId, allowedIds) {
  const { rows } = await pool.query("SELECT employee_id FROM task_assignments WHERE task_id = $1", [taskId]);
  if (!rows.length) return false;
  const allowed = new Set(allowedIds);
  return rows.every((r) => allowed.has(r.employee_id));
}

router.get("/", async (req, res, next) => {
  try {
    let whereClause = "";
    let params = [];
    if (req.user.role === "shift_leader") {
      whereClause = "WHERE t.id IN (SELECT task_id FROM task_assignments ta2 JOIN employees e2 ON e2.id = ta2.employee_id WHERE e2.line_id = $1)";
      params = [req.user.lineId];
    } else if (req.user.role === "employee") {
      const memberIds = await fetchTeamMemberIds(req.user.employeeId);
      whereClause = "WHERE t.id IN (SELECT task_id FROM task_assignments ta2 WHERE ta2.employee_id = ANY($1))";
      params = [[req.user.employeeId, ...memberIds]];
    }
    const { rows } = await pool.query(
      `SELECT t.id, t.title, t.due, t.level, t.axis_group, t.axis_index,
         u.id AS assigner_id, COALESCE(NULLIF(u.display_name, ''), u.username) AS assigner_name,
         COALESCE(bool_and(ta.done), false) AS done,
         COALESCE(json_agg(json_build_object('id', e.id, 'nameEn', e.name_en, 'name', e.name, 'nickname', e.nickname, 'empCode', e.emp_code, 'level', e.level) ORDER BY e.emp_code), '[]') AS assignees
       FROM tasks t
       JOIN task_assignments ta ON ta.task_id = t.id
       JOIN employees e ON e.id = ta.employee_id
       LEFT JOIN users u ON u.id = t.assigned_by
       ${whereClause}
       GROUP BY t.id, u.id, u.display_name, u.username
       ORDER BY t.created_at DESC`,
      params
    );
    res.json(rows.map((r) => ({
      id: r.id, title: r.title, due: r.due, level: r.level,
      axisGroup: r.axis_group, axisIndex: r.axis_index, done: r.done, assignees: r.assignees,
      assignedBy: r.assigner_id ? { id: r.assigner_id, name: r.assigner_name } : null,
    })));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    let teamMemberIds = [];
    if (req.user.role === "employee") {
      if (!(await isTeamLead(req.user.employeeId))) {
        return res.status(403).json({ error: "พนักงานไม่สามารถมอบหมายงานได้" });
      }
      teamMemberIds = await fetchTeamMemberIds(req.user.employeeId);
    }

    const { employeeIds, title, due, level, axisGroup, axisIndex } = req.body || {};
    const ids = Array.isArray(employeeIds) ? [...new Set(employeeIds)] : [];
    if (!ids.length) return res.status(400).json({ error: "employeeIds must be a non-empty array" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });
    if (!TASK_LEVELS.includes(level)) return res.status(400).json({ error: `level must be one of ${TASK_LEVELS.join(", ")}` });

    const empCheck = await pool.query("SELECT id, line_id, position FROM employees WHERE id = ANY($1)", [ids]);
    if (empCheck.rows.length !== ids.length) return res.status(400).json({ error: "Some employeeIds are invalid" });
    if (req.user.role === "shift_leader" && empCheck.rows.some((r) => r.line_id !== req.user.lineId)) {
      return res.status(403).json({ error: "คุณมอบหมายงานได้เฉพาะพนักงานในสายของตัวเองเท่านั้น" });
    }
    if (req.user.role === "employee") {
      const allowed = new Set([req.user.employeeId, ...teamMemberIds]);
      if (ids.some((eid) => !allowed.has(eid))) {
        return res.status(403).json({ error: "คุณมอบหมายงานได้เฉพาะสมาชิกในทีมของคุณเท่านั้น" });
      }
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

    const id = "T" + Date.now();
    await pool.query(
      "INSERT INTO tasks (id, title, due, level, axis_group, axis_index, assigned_by) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [id, title.trim(), typeof due === "string" ? due.trim() : "", level, axGroup, axIndex, req.user.userId]
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
    if (req.user.role === "shift_leader" && !(await taskInvolvesLine(req.params.id, req.user.lineId))) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (req.user.role === "employee" && !(await taskInvolvesEmployee(req.params.id, req.user.employeeId))) {
      const lead = await isTeamLead(req.user.employeeId);
      const memberIds = lead ? await fetchTeamMemberIds(req.user.employeeId) : [];
      const withinTeam = lead && (await taskAssigneesWithinSet(req.params.id, [req.user.employeeId, ...memberIds]));
      if (!withinTeam) return res.status(404).json({ error: "Task not found" });
    }
    if (!req.body || typeof req.body.done !== "boolean") return res.status(400).json({ error: "done must be a boolean" });

    const newDone = req.body.done;
    // done_at feeds the skill-score computation (on-time vs late, and the recent-activity
    // window), so it's set the moment a task is actually marked done, not backdated - and only
    // touched on a genuine state change, so re-confirming an already-done task doesn't refresh it.
    await pool.query(
      "UPDATE task_assignments SET done = $1, done_at = CASE WHEN $1 THEN now() ELSE NULL END WHERE task_id = $2 AND done <> $1",
      [newDone, req.params.id]
    );
    res.json({ id: req.params.id, done: newDone });
  } catch (err) {
    next(err);
  }
});

// Replaces a task's whole assignee list - lets a team lead who received a task pick which of
// their teammates actually does it (can include themselves), without creating a new task.
router.put("/:id/assignees", async (req, res, next) => {
  try {
    const task = await pool.query("SELECT id FROM tasks WHERE id = $1", [req.params.id]);
    if (!task.rows[0]) return res.status(404).json({ error: "Task not found" });

    const { employeeIds } = req.body || {};
    const ids = Array.isArray(employeeIds) ? [...new Set(employeeIds)] : [];
    if (!ids.length) return res.status(400).json({ error: "employeeIds must be a non-empty array" });

    const empCheck = await pool.query("SELECT id, line_id FROM employees WHERE id = ANY($1)", [ids]);
    if (empCheck.rows.length !== ids.length) return res.status(400).json({ error: "Some employeeIds are invalid" });

    if (req.user.role === "shift_leader") {
      if (!(await taskInvolvesLine(req.params.id, req.user.lineId))) return res.status(404).json({ error: "Task not found" });
      if (empCheck.rows.some((r) => r.line_id !== req.user.lineId)) {
        return res.status(403).json({ error: "คุณมอบหมายงานได้เฉพาะพนักงานในสายของตัวเองเท่านั้น" });
      }
    } else if (req.user.role === "employee") {
      if (!(await taskInvolvesEmployee(req.params.id, req.user.employeeId))) return res.status(404).json({ error: "Task not found" });
      const teamMemberIds = await fetchTeamMemberIds(req.user.employeeId);
      const allowed = new Set([req.user.employeeId, ...teamMemberIds]);
      if (ids.some((eid) => !allowed.has(eid))) {
        return res.status(403).json({ error: "คุณมอบหมายงานได้เฉพาะสมาชิกในทีมของคุณเท่านั้น" });
      }
    }

    const { rows: current } = await pool.query("SELECT id, employee_id FROM task_assignments WHERE task_id = $1", [req.params.id]);
    const currentIds = new Set(current.map((r) => r.employee_id));
    const newIds = new Set(ids);

    for (const r of current) {
      if (!newIds.has(r.employee_id)) await pool.query("DELETE FROM task_assignments WHERE id = $1", [r.id]);
    }
    const toAdd = ids.filter((eid) => !currentIds.has(eid));
    for (let i = 0; i < toAdd.length; i++) {
      await pool.query(
        "INSERT INTO task_assignments (id, task_id, employee_id, done) VALUES ($1,$2,$3,false)",
        [req.params.id + "-a" + Date.now() + "-" + i, req.params.id, toAdd[i]]
      );
    }

    res.json({ id: req.params.id, employeeIds: ids });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (req.user.role === "shift_leader" && !(await taskInvolvesLine(req.params.id, req.user.lineId))) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (req.user.role === "employee") {
      const lead = await isTeamLead(req.user.employeeId);
      const memberIds = lead ? await fetchTeamMemberIds(req.user.employeeId) : [];
      const withinTeam = lead && (await taskAssigneesWithinSet(req.params.id, [req.user.employeeId, ...memberIds]));
      if (!withinTeam) return res.status(403).json({ error: "พนักงานไม่สามารถลบงานได้" });
    }
    const result = await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
