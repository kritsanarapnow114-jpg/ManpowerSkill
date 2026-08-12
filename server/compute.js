"use strict";

const { STATION_LEVELS } = require("./labels");

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

module.exports = { avgOf, passOf, stationLevelOf };
