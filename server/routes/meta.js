"use strict";

const express = require("express");
const { pool, ready } = require("../db");
const { G1_AXES, G2_AXES, LEVELS, GENDERS, ATTENDANCE_TYPES, DEFAULT_LEAVE_QUOTA } = require("../labels");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    await ready();
    const { rows } = await pool.query("SELECT * FROM stations ORDER BY sort_order, code");
    const stations = rows.map((r) => ({ id: r.id, code: r.code, name: r.name, image: r.image }));

    res.json({
      g1Axes: G1_AXES,
      g2Axes: G2_AXES,
      stations,
      levels: LEVELS,
      genders: GENDERS,
      attendanceTypes: ATTENDANCE_TYPES,
      defaultLeaveQuota: DEFAULT_LEAVE_QUOTA,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
