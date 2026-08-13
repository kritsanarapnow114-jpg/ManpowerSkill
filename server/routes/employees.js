"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { g1AxesFor, g2AxesFor, LEVELS, GENDERS, LEAVE_TYPE_KEYS } = require("../labels");
const { avgOf, passOf, stationLevelOf } = require("../compute");
const { fetchTeamMemberIds, syncTeamMembers } = require("../teams");
const { computeSkillScores } = require("../skillscore");
const { ensureRecurringGenerated } = require("../recurring");

const router = express.Router();

const MAX_IMAGE_LENGTH = 2_000_000; // ~1.5MB decoded, generous for a headshot

function clamp0(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

router.use(async (req, res, next) => {
  try {
    await ready();
    await ensureRecurringGenerated();
    next();
  } catch (err) {
    next(err);
  }
});

async function fetchTasks(employeeId) {
  const { rows } = await pool.query(
    `SELECT ta.id AS assignment_id, ta.done, t.id AS task_id, t.title, t.due, t.level, t.axis_group, t.axis_index,
       u.id AS assigner_id, COALESCE(NULLIF(u.display_name, ''), u.username) AS assigner_name,
       (SELECT COALESCE(array_agg(e2.name_en ORDER BY e2.name_en), ARRAY[]::text[])
        FROM task_assignments ta2 JOIN employees e2 ON e2.id = ta2.employee_id
        WHERE ta2.task_id = t.id AND ta2.employee_id <> $1) AS other_assignees
     FROM task_assignments ta
     JOIN tasks t ON t.id = ta.task_id
     LEFT JOIN users u ON u.id = t.assigned_by
     WHERE ta.employee_id = $1
     ORDER BY t.created_at`,
    [employeeId]
  );
  return rows.map((t) => ({
    id: t.task_id,
    assignmentId: t.assignment_id,
    title: t.title,
    due: t.due,
    level: t.level,
    done: t.done,
    axisGroup: t.axis_group,
    axisIndex: t.axis_index,
    otherAssignees: t.other_assignees || [],
    assignedBy: t.assigner_id ? { id: t.assigner_id, name: t.assigner_name } : null,
  }));
}

async function fetchWorkload(employeeId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(CASE t.level WHEN 'ง่าย' THEN 1 WHEN 'กลาง' THEN 2 WHEN 'ยาก' THEN 3 ELSE 2 END), 0)::int AS workload
     FROM task_assignments ta JOIN tasks t ON t.id = ta.task_id
     WHERE ta.employee_id = $1 AND ta.done = false`,
    [employeeId]
  );
  return rows[0].workload;
}

async function fetchStations() {
  const { rows } = await pool.query("SELECT * FROM stations ORDER BY sort_order, code");
  return rows;
}

async function fetchStationHours(employeeId) {
  const { rows } = await pool.query(
    "SELECT station_id, COALESCE(SUM(hours), 0)::float AS hours FROM work_logs WHERE employee_id = $1 GROUP BY station_id",
    [employeeId]
  );
  return Object.fromEntries(rows.map((r) => [r.station_id, r.hours]));
}

async function fetchLeaveUsed(employeeId) {
  const { rows } = await pool.query(
    "SELECT type, COUNT(*)::int AS n FROM attendance WHERE employee_id = $1 AND type = ANY($2) GROUP BY type",
    [employeeId, Object.keys(LEAVE_TYPE_KEYS)]
  );
  const used = { vacation: 0, sick: 0, personal: 0 };
  for (const row of rows) used[LEAVE_TYPE_KEYS[row.type]] = row.n;
  return used;
}

async function serialize(row) {
  const stValues = row.st || {};
  const tasks = await fetchTasks(row.id);
  const workload = await fetchWorkload(row.id);
  const used = await fetchLeaveUsed(row.id);
  const stations = await fetchStations();
  const stationHours = await fetchStationHours(row.id);
  const teamMemberIds = await fetchTeamMemberIds(row.id);

  const g1Axes = g1AxesFor(row.position);
  const g2Axes = g2AxesFor(row.position);
  const { g1: g1Values, g2: g2Values } = await computeSkillScores(row.id, g1Axes, g2Axes);

  return {
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    nickname: row.nickname,
    photo: row.photo,
    gender: row.gender,
    position: row.position,
    level: row.level,
    empCode: row.emp_code,
    join: row.join_year,
    lineId: row.line_id,
    isTeamLead: !!row.is_team_lead,
    teamMemberIds,
    g1: g1Axes.map((axis, i) => ({ th: axis.th, en: axis.en, v: g1Values[i] })),
    g2: g2Axes.map((axis, i) => ({ th: axis.th, en: axis.en, v: g2Values[i] })),
    st: stations.map((s) => {
      const entry = stValues[s.id];
      const hours = stationHours[s.id] || 0;
      const trained = !!(entry && typeof entry === "object" && entry.trained);
      const level = stationLevelOf(trained, hours);
      return { id: s.id, code: s.code, name: s.name, image: s.image, hazards: s.hazards || [], v: hours, trained, level: level.key, levelEn: level.en };
    }),
    stats: { today: row.stat_today, qc: row.stat_qc, rework: row.stat_rework, defect: row.stat_defect },
    pass: passOf(g1Values, g2Values),
    avg: avgOf([...g1Values, ...g2Values]),
    tasks,
    workload,
    leave: {
      vacation: { quota: row.leave_quota_vacation, used: used.vacation },
      sick: { quota: row.leave_quota_sick, used: used.sick },
      personal: { quota: row.leave_quota_personal, used: used.personal },
    },
  };
}

function validateBody(body, { partial } = {}) {
  const errors = [];
  const out = {};

  const need = (key) => !partial || Object.prototype.hasOwnProperty.call(body, key);

  if (need("name")) {
    if (typeof body.name !== "string" || !body.name.trim()) errors.push("name is required");
    else out.name = body.name.trim();
  }
  if (need("nameEn")) {
    if (typeof body.nameEn !== "string" || !body.nameEn.trim()) errors.push("nameEn is required");
    else out.nameEn = body.nameEn.trim();
  }
  if (need("nickname")) {
    out.nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  }
  if (need("photo")) {
    if (body.photo && (typeof body.photo !== "string" || body.photo.length > MAX_IMAGE_LENGTH)) {
      errors.push("photo is too large");
    } else {
      out.photo = typeof body.photo === "string" ? body.photo : "";
    }
  }
  if (need("gender")) {
    if (body.gender !== "" && !GENDERS.includes(body.gender)) errors.push(`gender must be one of ${GENDERS.join(", ")}`);
    else out.gender = body.gender || "";
  }
  if (need("position")) {
    if (typeof body.position !== "string" || !body.position.trim()) errors.push("position is required");
    else out.position = body.position.trim();
  }
  if (need("empCode")) {
    if (typeof body.empCode !== "string" || !body.empCode.trim()) errors.push("empCode is required");
    else out.empCode = body.empCode.trim();
  }
  if (need("join")) {
    out.join = typeof body.join === "string" ? body.join.trim() : "";
  }
  if (need("level")) {
    if (!LEVELS.includes(body.level)) errors.push(`level must be one of ${LEVELS.join(", ")}`);
    else out.level = body.level;
  }
  if (need("st")) {
    if (typeof body.st !== "object" || body.st === null || Array.isArray(body.st)) {
      errors.push("st must be an object keyed by station id");
    } else {
      out.st = {};
      for (const [stationId, entry] of Object.entries(body.st)) {
        const e = entry && typeof entry === "object" ? entry : {};
        out.st[stationId] = { trained: !!e.trained };
      }
    }
  }
  if (need("leaveQuota")) {
    const lq = body.leaveQuota || {};
    const keys = ["vacation", "sick", "personal"];
    const bad = keys.some((k) => !Number.isFinite(Number(lq[k])) || Number(lq[k]) < 0);
    if (bad) errors.push("leaveQuota.vacation/sick/personal must be non-negative numbers");
    else out.leaveQuota = { vacation: clamp0(lq.vacation), sick: clamp0(lq.sick), personal: clamp0(lq.personal) };
  }
  if (need("isTeamLead")) {
    out.isTeamLead = !!body.isTeamLead;
  }
  if (need("stats")) {
    const stats = body.stats || {};
    out.stats = {
      today: String(stats.today ?? ""),
      qc: String(stats.qc ?? ""),
      rework: String(stats.rework ?? ""),
      defect: String(stats.defect ?? ""),
    };
  }

  return { errors, out };
}

// Validates a raw teamMemberIds array against real employee ids. Returns ids:undefined when the
// field was omitted (leave membership untouched), so callers can distinguish "not provided" from
// "explicitly cleared" ([]).
async function validTeamMemberIds(rawIds, excludeId) {
  if (rawIds === undefined) return { ids: undefined, error: null };
  if (!Array.isArray(rawIds) || !rawIds.every((x) => typeof x === "string")) {
    return { ids: null, error: "teamMemberIds must be an array of employee ids" };
  }
  const ids = [...new Set(rawIds)].filter((x) => x !== excludeId);
  if (!ids.length) return { ids: [], error: null };
  const { rows } = await pool.query("SELECT id FROM employees WHERE id = ANY($1)", [ids]);
  if (rows.length !== ids.length) return { ids: null, error: "Some teamMemberIds are invalid" };
  return { ids, error: null };
}

router.get("/", async (req, res, next) => {
  try {
    let sql = "SELECT * FROM employees ORDER BY emp_code";
    let params = [];
    if (req.user.role === "shift_leader") {
      sql = "SELECT * FROM employees WHERE line_id = $1 ORDER BY emp_code";
      params = [req.user.lineId];
    } else if (req.user.role === "employee") {
      const memberIds = await fetchTeamMemberIds(req.user.employeeId);
      sql = "SELECT * FROM employees WHERE id = ANY($1) ORDER BY emp_code";
      params = [[req.user.employeeId, ...memberIds]];
    }
    const { rows } = await pool.query(sql, params);
    res.json(await Promise.all(rows.map(serialize)));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM employees WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Employee not found" });
    if (req.user.role === "shift_leader" && rows[0].line_id !== req.user.lineId) {
      return res.status(404).json({ error: "Employee not found" });
    }
    if (req.user.role === "employee" && req.params.id !== req.user.employeeId) {
      const memberIds = await fetchTeamMemberIds(req.user.employeeId);
      if (!memberIds.includes(req.params.id)) return res.status(404).json({ error: "Employee not found" });
    }
    res.json(await serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (req.user.role === "employee") return res.status(403).json({ error: "พนักงานไม่สามารถเพิ่มพนักงานได้" });
    const { errors, out } = validateBody(req.body || {});

    const bodyLineId = typeof req.body.lineId === "string" ? req.body.lineId.trim() : "";
    const lineId = req.user.role === "admin" ? bodyLineId : req.user.lineId;
    if (!lineId) errors.push("lineId is required");
    else {
      const lineCheck = await pool.query("SELECT id FROM lines WHERE id = $1", [lineId]);
      if (!lineCheck.rows[0]) errors.push("Invalid lineId");
    }

    const id = "E" + Date.now();
    const { ids: teamMemberIds, error: teamErr } = await validTeamMemberIds(req.body && req.body.teamMemberIds, id);
    if (teamErr) errors.push(teamErr);
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });

    // g1/g2 are computed live from real activity (see server/skillscore.js) and no longer
    // editable - the columns just need any array of the right length to satisfy NOT NULL.
    const zerosG1 = g1AxesFor(out.position).map(() => 0);
    const zerosG2 = g2AxesFor(out.position).map(() => 0);
    await pool.query(
      `INSERT INTO employees (id, name, name_en, nickname, photo, gender, position, level, emp_code, join_year, g1, g2, st, stat_today, stat_qc, stat_rework, stat_defect, leave_quota_vacation, leave_quota_sick, leave_quota_personal, line_id, is_team_lead)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [id, out.name, out.nameEn, out.nickname, out.photo, out.gender, out.position, out.level, out.empCode, out.join,
        JSON.stringify(zerosG1), JSON.stringify(zerosG2), JSON.stringify(out.st),
        out.stats.today, out.stats.qc, out.stats.rework, out.stats.defect,
        out.leaveQuota.vacation, out.leaveQuota.sick, out.leaveQuota.personal, lineId, out.isTeamLead]
    );
    if (teamMemberIds !== undefined) await syncTeamMembers(id, teamMemberIds);

    const { rows } = await pool.query("SELECT * FROM employees WHERE id = $1", [id]);
    res.status(201).json(await serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (req.user.role === "employee") return res.status(403).json({ error: "พนักงานไม่สามารถแก้ไขข้อมูลนี้ได้" });
    const existing = await pool.query("SELECT id, line_id FROM employees WHERE id = $1", [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Employee not found" });
    if (req.user.role !== "admin" && existing.rows[0].line_id !== req.user.lineId) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const { errors, out } = validateBody(req.body || {});

    const bodyLineId = typeof req.body.lineId === "string" ? req.body.lineId.trim() : "";
    const lineId = req.user.role === "admin" ? bodyLineId || existing.rows[0].line_id : req.user.lineId;
    if (!lineId) errors.push("lineId is required");
    else {
      const lineCheck = await pool.query("SELECT id FROM lines WHERE id = $1", [lineId]);
      if (!lineCheck.rows[0]) errors.push("Invalid lineId");
    }

    const { ids: teamMemberIds, error: teamErr } = await validTeamMemberIds(req.body && req.body.teamMemberIds, req.params.id);
    if (teamErr) errors.push(teamErr);
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });

    await pool.query(
      `UPDATE employees SET name=$1, name_en=$2, nickname=$3, photo=$4, gender=$5, position=$6, level=$7, emp_code=$8,
         join_year=$9, st=$10, stat_today=$11, stat_qc=$12, stat_rework=$13, stat_defect=$14,
         leave_quota_vacation=$15, leave_quota_sick=$16, leave_quota_personal=$17, line_id=$18, is_team_lead=$19
       WHERE id=$20`,
      [out.name, out.nameEn, out.nickname, out.photo, out.gender, out.position, out.level, out.empCode, out.join,
        JSON.stringify(out.st),
        out.stats.today, out.stats.qc, out.stats.rework, out.stats.defect,
        out.leaveQuota.vacation, out.leaveQuota.sick, out.leaveQuota.personal, lineId, out.isTeamLead, req.params.id]
    );
    if (teamMemberIds !== undefined) await syncTeamMembers(req.params.id, teamMemberIds);

    const { rows } = await pool.query("SELECT * FROM employees WHERE id = $1", [req.params.id]);
    res.json(await serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
