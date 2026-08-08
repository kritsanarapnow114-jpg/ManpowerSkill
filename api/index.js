"use strict";

// Vercel serverless entry point. The frontend in /public is served by
// Vercel's static hosting directly (no function involved); this function
// only handles requests rewritten from /api/* (see vercel.json).
module.exports = require("../server/app");
