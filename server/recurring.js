"use strict";

const { pool } = require("./db");

const FREQUENCIES = ["daily", "weekly", "monthly"];

// A "period key" identifies which day/week/month a generated instance belongs to, so a template
// only ever produces one instance per period no matter how many times the check runs that period.
function periodKey(frequency, todayStr) {
  const today = new Date(todayStr + "T00:00:00Z");
  if (frequency === "daily") return todayStr;
  if (frequency === "monthly") return todayStr.slice(0, 7); // YYYY-MM
  // weekly: Monday of the current ISO week, as YYYY-MM-DD.
  const day = today.getUTCDay() || 7; // Mon=1 .. Sun=7
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - day + 1);
  return monday.toISOString().slice(0, 10);
}

// The due date given to a generated task - the end of whichever period it belongs to.
function periodDue(frequency, todayStr) {
  const today = new Date(todayStr + "T00:00:00Z");
  if (frequency === "daily") return todayStr;
  if (frequency === "monthly") {
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  }
  const day = today.getUTCDay() || 7;
  const sunday = new Date(today);
  sunday.setUTCDate(today.getUTCDate() - day + 7);
  return sunday.toISOString().slice(0, 10);
}

// Generates this template's instance for "today"'s period if one hasn't been made yet. Safe to
// call repeatedly (including right after creating the template, for an immediate first instance).
async function generateTaskIfDue(tpl, todayStr) {
  const key = periodKey(tpl.frequency, todayStr);
  if (tpl.last_generated_period === key) return;
  const { rows: assignees } = await pool.query(
    "SELECT employee_id FROM recurring_task_assignees WHERE recurring_task_id = $1",
    [tpl.id]
  );
  if (assignees.length) {
    const taskId = "T" + Date.now() + "-" + tpl.id;
    await pool.query(
      "INSERT INTO tasks (id, title, description, due, level, axis_group, axis_index, assigned_by, station_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [taskId, tpl.title, tpl.description || "", periodDue(tpl.frequency, todayStr), tpl.level, tpl.axis_group, tpl.axis_index, tpl.assigned_by, tpl.station_id]
    );
    for (let i = 0; i < assignees.length; i++) {
      await pool.query(
        "INSERT INTO task_assignments (id, task_id, employee_id, done) VALUES ($1,$2,$3,false)",
        [taskId + "-a" + i, taskId, assignees[i].employee_id]
      );
    }
  }
  await pool.query("UPDATE recurring_tasks SET last_generated_period = $1 WHERE id = $2", [key, tpl.id]);
}

async function generateAchievementIfDue(tpl, todayStr) {
  const key = periodKey(tpl.frequency, todayStr);
  if (tpl.last_generated_period === key) return;
  const id = "AC" + Date.now() + "-" + tpl.id;
  await pool.query(
    "INSERT INTO achievements (id, employee_id, title, date, note, axis_group, axis_index) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id, tpl.employee_id, tpl.title, todayStr, tpl.note, tpl.axis_group, tpl.axis_index]
  );
  await pool.query("UPDATE recurring_achievements SET last_generated_period = $1 WHERE id = $2", [key, tpl.id]);
}

// Only actually checks the DB once per calendar day per warm server instance - every other
// request that day is a no-op. A cold start just re-checks, which is cheap and idempotent.
let lastCheckedDate = null;
async function ensureRecurringGenerated() {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (lastCheckedDate === todayStr) return;
  const [{ rows: taskTpls }, { rows: achTpls }] = await Promise.all([
    pool.query("SELECT * FROM recurring_tasks WHERE active = true"),
    pool.query("SELECT * FROM recurring_achievements WHERE active = true"),
  ]);
  for (const tpl of taskTpls) await generateTaskIfDue(tpl, todayStr);
  for (const tpl of achTpls) await generateAchievementIfDue(tpl, todayStr);
  lastCheckedDate = todayStr;
}

module.exports = { FREQUENCIES, ensureRecurringGenerated, generateTaskIfDue, generateAchievementIfDue };
