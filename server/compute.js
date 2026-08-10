"use strict";

const { STATION_LEVELS } = require("./labels");

function clamp(v) {
  v = parseInt(v, 10);
  if (Number.isNaN(v)) v = 0;
  return Math.max(0, Math.min(100, v));
}

function clampHours(v) {
  v = parseInt(v, 10);
  if (Number.isNaN(v) || v < 0) v = 0;
  return v;
}

function avgOf(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((s, x) => s + x, 0) / values.length);
}

function passOf(g1, g2) {
  return avgOf([...g1, ...g2]);
}

function stationLevelOf(trained, hours) {
  if (!trained) return STATION_LEVELS[0]; // none
  let level = STATION_LEVELS[1]; // basic
  for (const l of STATION_LEVELS) if (l.min !== undefined && hours >= l.min) level = l;
  return level;
}

module.exports = { clamp, clampHours, avgOf, passOf, stationLevelOf };
