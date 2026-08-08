"use strict";

const path = require("path");
const express = require("express");
const app = require("./app");

app.use(express.static(path.join(__dirname, "..", "public")));
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Employee Skills app listening on http://localhost:${PORT}`);
});
