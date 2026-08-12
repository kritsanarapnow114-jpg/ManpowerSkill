"use strict";

const { pool } = require("./db");
const { TASK_LEVEL_WEIGHT } = require("./labels");

// How far back "recent" reaches for every signal below - keeps scores reflecting current
// performance rather than a lifetime average that never moves once an employee is experienced.
const WINDOW_DAYS = 90;

const LATE_TASK_CREDIT = 0.6; // credit multiplier for a relevant task finished after its due date
const ATTENDANCE_LATE_PENALTY = 8; // per "มาสาย" in the window
const ATTENDANCE_ABSENCE_PENALTY = 15; // per unexcused "ขาด" in the window
const ACHIEVEMENT_CREDIT = 20; // per achievement logged in the window, capped at 100
const STATION_TARGET_HOURS = 40; // recent hours at a matched station considered "full" proficiency

function windowStart() {
  return new Date(Date.now() - WINDOW_DAYS * 86400000);
}

// due is free-typed in some legacy/seed tasks (e.g. "20 ส.ค.") rather than the <input type=date>
// format newer tasks use - only a properly formatted date can be compared for overdue/on-time
// purposes. Mirrors the same guard the frontend's isTaskOverdue() uses.
function isIsoDate(due) {
  return typeof due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(due);
}

async function fetchWindowedData(employeeId) {
  const since = windowStart();
  const sinceDate = since.toISOString().slice(0, 10);

  const [taskRows, attendanceRows, achievementRows, workLogRows] = await Promise.all([
    pool.query(
      `SELECT t.axis_group, t.axis_index, t.level, t.due, ta.done, ta.done_at
       FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id
       WHERE ta.employee_id = $1 AND t.axis_group IS NOT NULL`,
      [employeeId]
    ),
    pool.query(
      `SELECT type, COUNT(*)::int AS n FROM attendance
       WHERE employee_id = $1 AND date >= $2 AND type = ANY($3) GROUP BY type`,
      [employeeId, sinceDate, ["มาสาย", "ขาด"]]
    ),
    pool.query(
      "SELECT COUNT(*)::int AS n FROM achievements WHERE employee_id = $1 AND date >= $2",
      [employeeId, sinceDate]
    ),
    pool.query(
      `SELECT s.name, COALESCE(SUM(wl.hours), 0)::float AS hours
       FROM work_logs wl JOIN stations s ON s.id = wl.station_id
       WHERE wl.employee_id = $1 AND wl.date >= $2
       GROUP BY s.name`,
      [employeeId, sinceDate]
    ),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  // Keep only tasks that are either recently completed (within the window) or currently
  // overdue-and-incomplete (with a real, parseable due date) - everything else (still-pending
  // work, or work finished/overdue long ago) shouldn't move a "recent performance" score.
  const relevantTasks = taskRows.rows.filter((t) => {
    if (t.done) return t.done_at && t.done_at.toISOString().slice(0, 10) >= sinceDate;
    return isIsoDate(t.due) && t.due < today;
  });

  const byType = Object.fromEntries(attendanceRows.rows.map((r) => [r.type, r.n]));
  return {
    tasks: relevantTasks,
    lateCount: byType["มาสาย"] || 0,
    absenceCount: byType["ขาด"] || 0,
    achievementCount: achievementRows.rows[0].n,
    stationHours: workLogRows.rows,
  };
}

// Ratio of credit earned to credit possible among tasks linked to this exact axis that either
// finished or fell overdue within the window; harder tasks (TASK_LEVEL_WEIGHT) count for more,
// and finishing late earns partial credit instead of full or none.
function taskComponent(tasks, group, index) {
  const relevant = tasks.filter((t) => t.axis_group === group && t.axis_index === index);
  if (!relevant.length) return null;
  let num = 0;
  let denom = 0;
  for (const t of relevant) {
    const w = TASK_LEVEL_WEIGHT[t.level] || 2;
    denom += w;
    if (t.done) {
      const onTime = !isIsoDate(t.due) || !t.done_at || t.done_at.toISOString().slice(0, 10) <= t.due;
      num += w * (onTime ? 1 : LATE_TASK_CREDIT);
    }
  }
  return denom > 0 ? Math.round((num / denom) * 100) : null;
}

function attendanceComponent(data) {
  const score = 100 - data.lateCount * ATTENDANCE_LATE_PENALTY - data.absenceCount * ATTENDANCE_ABSENCE_PENALTY;
  return Math.max(0, Math.min(100, score));
}

function achievementComponent(data) {
  return Math.max(0, Math.min(100, data.achievementCount * ACHIEVEMENT_CREDIT));
}

function stationComponent(data, keywords) {
  if (!keywords || !keywords.length) return null;
  const matched = data.stationHours.filter((s) =>
    keywords.some((k) => s.name.toLowerCase().includes(k.toLowerCase()))
  );
  if (!matched.length) return null;
  const hours = matched.reduce((sum, s) => sum + s.hours, 0);
  return Math.max(0, Math.min(100, Math.round((hours / STATION_TARGET_HOURS) * 100)));
}

// The domain signal is what backs an axis when there's no task explicitly linked to it (or in
// addition to one) - whichever real records come closest to what the axis actually measures.
function domainComponent(axis, data) {
  if (axis.signal === "attendance") return attendanceComponent(data);
  if (axis.signal === "station") {
    const station = stationComponent(data, axis.stationKeywords);
    return station !== null ? station : achievementComponent(data);
  }
  return achievementComponent(data);
}

function scoreOneAxis(axis, group, index, data) {
  const task = taskComponent(data.tasks, group, index);
  const domain = domainComponent(axis, data);
  if (task === null) return domain;
  return Math.round(task * 0.5 + domain * 0.5);
}

async function computeSkillScores(employeeId, g1Axes, g2Axes) {
  const data = await fetchWindowedData(employeeId);
  return {
    g1: g1Axes.map((axis, i) => scoreOneAxis(axis, "g1", i, data)),
    g2: g2Axes.map((axis, i) => scoreOneAxis(axis, "g2", i, data)),
  };
}

module.exports = { computeSkillScores, WINDOW_DAYS };
