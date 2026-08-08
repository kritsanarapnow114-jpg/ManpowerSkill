"use strict";

const express = require("express");

const app = express();
app.use(express.json());

app.use("/api/meta", require("./routes/meta"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/tasks", require("./routes/tasks"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
