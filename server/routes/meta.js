"use strict";

const express = require("express");
const { G1_AXES, G2_AXES, STATIONS, LEVELS, GENDERS, ATTENDANCE_TYPES } = require("../labels");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    g1Axes: G1_AXES,
    g2Axes: G2_AXES,
    stations: STATIONS,
    levels: LEVELS,
    genders: GENDERS,
    attendanceTypes: ATTENDANCE_TYPES,
  });
});

module.exports = router;
