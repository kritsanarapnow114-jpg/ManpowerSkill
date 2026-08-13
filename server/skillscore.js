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
const REVISION_PENALTY = 10; // per "sent back for revision" event on work this employee assigned, in the window

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

  const [taskRows, attendanceRows, achievementRows, workLogRows, revisionRows] = await Promise.all([
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
      "SELECT axis_group, axis_index FROM achievements WHERE employee_id = $1 AND date >= $2",
      [employeeId, sinceDate]
    ),
    pool.query(
      `SELECT s.name, COALESCE(SUM(wl.hours), 0)::float AS hours
       FROM work_logs wl JOIN stations s ON s.id = wl.station_id
       WHERE wl.employee_id = $1 AND wl.date >= $2
       GROUP BY s.name`,
      [employeeId, sinceDate]
    ),
    // Revisions on work THIS employee assigned to others (not work assigned to them) - a
    // delegation/QC-quality signal, only meaningful if they have a login (e.g. a team lead).
    pool.query(
      `SELECT COUNT(*)::int AS n FROM task_revisions tr
       JOIN tasks t ON t.id = tr.task_id
       JOIN users u ON u.id = t.assigned_by
       WHERE u.employee_id = $1 AND tr.created_at >= $2`,
      [employeeId, since.toISOString()]
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
    achievements: achievementRows.rows,
    stationHours: workLogRows.rows,
    revisionCount: revisionRows.rows[0].n,
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

// Counts achievements explicitly tagged to this exact axis when logged - an achievement left
// untagged (general recognition) or tagged to a different axis doesn't count here.
function achievementCountFor(data, group, index) {
  return data.achievements.filter((a) => a.axis_group === group && a.axis_index === index).length;
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
// addition to one). An axis's "base" signal (attendance/station) is whatever real records come
// closest to what it measures; a tagged achievement always counts too - blended in alongside the
// base when both exist, so tagging an achievement to *any* axis (even an attendance/station one)
// always has an effect, not just axes whose base signal happens to be "achievement".
function domainComponent(axis, data, group, index) {
  const achievementCount = achievementCountFor(data, group, index);
  const achievementScore = Math.max(0, Math.min(100, achievementCount * ACHIEVEMENT_CREDIT));

  let base = null;
  if (axis.signal === "attendance") base = attendanceComponent(data);
  else if (axis.signal === "station") base = stationComponent(data, axis.stationKeywords);

  if (base === null) return achievementScore;
  if (achievementCount === 0) return base;
  return Math.round(base * 0.5 + achievementScore * 0.5);
}

function scoreOneAxis(axis, group, index, data) {
  const task = taskComponent(data.tasks, group, index);
  const domain = domainComponent(axis, data, group, index);
  if (task === null) return domain;
  return Math.round(task * 0.5 + domain * 0.5);
}

async function computeSkillScores(employeeId, g1Axes, g2Axes) {
  const data = await fetchWindowedData(employeeId);
  // A flat penalty across every axis, not a per-axis signal - sending work you assigned back for
  // revision reflects on your overall delegation/QC quality rather than one specific skill.
  const revisionPenalty = data.revisionCount * REVISION_PENALTY;
  const applyPenalty = (score) => Math.max(0, score - revisionPenalty);
  return {
    g1: g1Axes.map((axis, i) => applyPenalty(scoreOneAxis(axis, "g1", i, data))),
    g2: g2Axes.map((axis, i) => applyPenalty(scoreOneAxis(axis, "g2", i, data))),
  };
}

module.exports = { computeSkillScores, WINDOW_DAYS };
