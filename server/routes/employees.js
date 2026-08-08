"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { G1_AXES, G2_AXES, STATIONS, LEVELS } = require("../labels");
const { clamp, avgOf, passOf } = require("../compute");

const router = express.Router();

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

async function serialize(row) {
  const g1Values = row.g1;
  const g2Values = row.g2;
  const stValues = row.st;
  const tasks = await fetchTasks(row.id);

  return {
    id: row.id,
    name: row.name,
    nameEn: row.name_en,
    position: row.position,
    level: row.level,
    empCode: row.emp_code,
    join: row.join_year,
    g1: G1_AXES.map((axis, i) => ({ th: axis.th, en: axis.en, v: g1Values[i] })),
    g2: G2_AXES.map((axis, i) => ({ th: axis.th, en: axis.en, v: g2Values[i] })),
    st: STATIONS.map((s, i) => ({ code: s.code, name: s.name, v: stValues[i] })),
    stats: { today: row.stat_today, qc: row.stat_qc, rework: row.stat_rework, defect: row.stat_defect },
    pass: passOf(g1Values, g2Values),
    avg: avgOf([...g1Values, ...g2Values]),
    tasks,
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
    if (!Array.isArray(body.st) || body.st.length !== STATIONS.length) errors.push(`st must have ${STATIONS.length} values`);
    else out.st = body.st.map(clamp);
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
      `INSERT INTO employees (id, name, name_en, position, level, emp_code, join_year, g1, g2, st, stat_today, stat_qc, stat_rework, stat_defect)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, out.name, out.nameEn, out.position, out.level, out.empCode, out.join,
        JSON.stringify(out.g1), JSON.stringify(out.g2), JSON.stringify(out.st),
        out.stats.today, out.stats.qc, out.stats.rework, out.stats.defect]
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
      `UPDATE employees SET name=$1, name_en=$2, position=$3, level=$4, emp_code=$5,
         join_year=$6, g1=$7, g2=$8, st=$9, stat_today=$10, stat_qc=$11, stat_rework=$12, stat_defect=$13
       WHERE id=$14`,
      [out.name, out.nameEn, out.position, out.level, out.empCode, out.join,
        JSON.stringify(out.g1), JSON.stringify(out.g2), JSON.stringify(out.st),
        out.stats.today, out.stats.qc, out.stats.rework, out.stats.defect, req.params.id]
    );

    const { rows } = await pool.query("SELECT * FROM employees WHERE id = $1", [req.params.id]);
    res.json(await serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
