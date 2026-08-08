"use strict";

function clamp(v) {
  v = parseInt(v, 10);
  if (Number.isNaN(v)) v = 0;
  return Math.max(0, Math.min(100, v));
}

function avgOf(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((s, x) => s + x, 0) / values.length);
}

function passOf(g1, g2) {
  return avgOf([...g1, ...g2]);
}

module.exports = { clamp, avgOf, passOf };
