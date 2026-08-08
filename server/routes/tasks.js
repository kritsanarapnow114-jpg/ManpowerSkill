"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { clamp } = require("../compute");

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await ready();
    next();
  } catch (err) {
    next(err);
  }
});

function serialize(row) {
  return { id: row.id, employeeId: row.employee_id, title: row.title, due: row.due, progress: row.progress };
}

router.post("/", async (req, res, next) => {
  try {
    const { employeeId, title, due } = req.body || {};
    if (!employeeId) return res.status(400).json({ error: "Valid employeeId is required" });
    const emp = await pool.query("SELECT id FROM employees WHERE id = $1", [employeeId]);
    if (!emp.rows[0]) return res.status(400).json({ error: "Valid employeeId is required" });
    if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "title is required" });

    const id = "T" + Date.now();
    await pool.query(
      "INSERT INTO tasks (id, employee_id, title, due, progress) VALUES ($1,$2,$3,$4,0)",
      [id, employeeId, title.trim(), typeof due === "string" ? due.trim() : ""]
    );
    const { rows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [id]);
    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const existing = await pool.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: "Task not found" });

    if (req.body && req.body.progress !== undefined) {
      await pool.query("UPDATE tasks SET progress = $1 WHERE id = $2", [clamp(req.body.progress), req.params.id]);
    }
    const { rows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    res.json(serialize(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Task not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
