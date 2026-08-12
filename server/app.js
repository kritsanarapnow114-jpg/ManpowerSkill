"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const { requireAuth } = require("./auth");

const app = express();
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

app.use("/api/auth", require("./routes/auth"));
app.use("/api", requireAuth);

app.use("/api/meta", require("./routes/meta"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/recurring-tasks", require("./routes/recurringTasks"));
app.use("/api/recurring-achievements", require("./routes/recurringAchievements"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/stations", require("./routes/stations"));
app.use("/api/certificates", require("./routes/certificates"));
app.use("/api/achievements", require("./routes/achievements"));
app.use("/api/worklogs", require("./routes/worklogs"));
app.use("/api/users", require("./routes/users"));
app.use("/api/lines", require("./routes/lines"));

app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "ข้อมูลที่ส่งใหญ่เกินไป (รูปภาพอาจใหญ่เกินไป)" });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
