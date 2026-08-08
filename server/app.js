"use strict";

const express = require("express");

const app = express();
app.use(express.json({ limit: "8mb" }));

app.use("/api/meta", require("./routes/meta"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/stations", require("./routes/stations"));
app.use("/api/certificates", require("./routes/certificates"));

app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "ข้อมูลที่ส่งใหญ่เกินไป (รูปภาพอาจใหญ่เกินไป)" });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
