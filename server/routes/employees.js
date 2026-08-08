"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { G1_AXES, G2_AXES, LEVELS, GENDERS, LEAVE_TYPE_KEYS } = require("../labels");
const { clamp, avgOf, passOf } = require("../compute");

const router = express.Router();

function clamp0(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

router.use(async (req, res, next) => {
  try {
    await ready();
    next();
  } catch (err) {
    next(err);
  }
});

async function fetchTasks(employeeId) {
  const { rows } = await pool.query(
    "SELECT id, title, due, progress FROM tasks WHERE employee_id = $1 ORDER BY created_at",
    [employeeId]
  );
  return rows.map((t) => ({ id: t.id, title: t.title, due: t.due, progress: t.progress }));
}

async function fetchStations() {
  const { rows } = await pool.query("SELECT * FROM stations ORDER BY sort_order, code");
  return rows;
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
  const g1Values = row.g1;
  const g2Values = row.g2;
  const stValues = row.st || {};
  const tasks = await fetchTasks(row.id);
  const used = await fetchLeaveUsed(row.id);
  const stations = await fetchStations();

  return {
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    gender: row.gender,
    position: row.position,
    level: row.level,
    empCode: row.emp_code,
    join: row.join_year,
    g1: G1_AXES.map((axis, i) => ({ th: axis.th, en: axis.en, v: g1Values[i] })),
    g2: G2_AXES.map((axis, i) => ({ th: axis.th, en: axis.en, v: g2Values[i] })),
    st: stations.map((s) => ({ id: s.id, code: s.code, name: s.name, image: s.image, v: stValues[s.id] ?? 0 })),
    stats: { today: row.stat_today, qc: row.stat_qc, rework: row.stat_rework, defect: row.stat_defect },
    pass: passOf(g1Values, g2Values),
    avg: avgOf([...g1Values, ...g2Values]),
    tasks,
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
  if (need("g1")) {
    if (!Array.isArray(body.g1) || body.g1.length !== G1_AXES.length) errors.push(`g1 must have ${G1_AXES.length} values`);
    else out.g1 = body.g1.map(clamp);
  }
  if (need("g2")) {
    if (!Array.isArray(body.g2) || body.g2.length !== G2_AXES.length) errors.push(`g2 must have ${G2_AXES.length} values`);
    else out.g2 = body.g2.map(clamp);
  }
  if (need("st")) {
    if (typeof body.st !== "object" || body.st === null || Array.isArray(body.st)) {
      errors.push("st must be an object of station scores keyed by station id");
    } else {
      out.st = {};
      for (const [stationId, v] of Object.entries(body.st)) out.st[stationId] = clamp(v);
    }
  }
  if (need("leaveQuota")) {
    const lq = body.leaveQuota || {};
    const keys = ["vacation", "sick", "personal"];
    const bad = keys.some((k) => !Number.isFinite(Number(lq[k])) || Number(lq[k]) < 0);
    if (bad) errors.push("leaveQuota.vacation/sick/personal must be non-negative numbers");
    else out.leaveQuota = { vacation: clamp0(lq.vacation), sick: clamp0(lq.sick), personal: clamp0(lq.personal) };
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

router.get("/", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM employees ORDER BY emp_code");
    res.json(await Promise.all(rows.map(serialize)));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await pool.query("SELECT * FROM employees WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Employee not found" });
    res.json(await serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { errors, out } = validateBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });

    const id = "E" + Date.now();
    await pool.query(
      `INSERT INTO employees (id, name, name_en, gender, position, level, emp_code, join_year, g1, g2, st, stat_today, stat_qc, stat_rework, stat_defect, leave_quota_vacation, leave_quota_sick, leave_quota_personal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [id, out.name, out.nameEn, out.gender, out.position, out.level, out.empCode, out.join,
        JSON.stringify(out.g1), JSON.stringify(out.g2), JSON.stringify(out.st),
        out.stats.today, out.stats.qc, out.stats.rework, out.stats.defect,
        out.leaveQuota.vacation, out.leaveQuota.sick, out.leaveQuota.personal]
    );

    const { rows } = await pool.query("SELECT * FROM employees WHERE id = $1", [id]);
    res.status(201).json(await serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const existing = await pool.query("SELECT id FROM employees WHERE id = $1", [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Employee not found" });

    const { errors, out } = validateBody(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });

    await pool.query(
      `UPDATE employees SET name=$1, name_en=$2, gender=$3, position=$4, level=$5, emp_code=$6,
         join_year=$7, g1=$8, g2=$9, st=$10, stat_today=$11, stat_qc=$12, stat_rework=$13, stat_defect=$14,
         leave_quota_vacation=$15, leave_quota_sick=$16, leave_quota_personal=$17
       WHERE id=$18`,
      [out.name, out.nameEn, out.gender, out.position, out.level, out.empCode, out.join,
        JSON.stringify(out.g1), JSON.stringify(out.g2), JSON.stringify(out.st),
        out.stats.today, out.stats.qc, out.stats.rework, out.stats.defect,
        out.leaveQuota.vacation, out.leaveQuota.sick, out.leaveQuota.personal, req.params.id]
    );

    const { rows } = await pool.query("SELECT * FROM employees WHERE id = $1", [req.params.id]);
    res.json(await serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
