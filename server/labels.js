// Fixed label sets shared by every employee (mirrors the design prototype's constants).
"use strict";

const G1_AXES = [
  { th: "คุณภาพงาน", en: "Defect detection" },
  { th: "การปฏิบัติตาม process", en: "Process compliance" },
  { th: "การทำงานตามเวลาที่กำหนด", en: "Cycle time" },
  { th: "ความถูกต้องของงาน", en: "Feeling judgment" },
  { th: "ประสิทธิภาพ", en: "Basic standard" },
  { th: "ความปลอดภัย 5ส", en: "Safety 5S" },
];

const G2_AXES = [
  { th: "Warehouse Operation", en: "Warehouse Operation" },
  { th: "Forklift Operation", en: "Forklift Operation" },
  { th: "Packing Line Operation", en: "Packing Line Operation" },
  { th: "Quality Control", en: "Quality Control" },
  { th: "System & Documentation", en: "System & Documentation" },
  { th: "Safety & Problem Solving", en: "Safety & Problem Solving" },
];

const STATIONS = [
  { code: "ST-01", name: "Press · ปั๊มขึ้นรูป" },
  { code: "ST-02", name: "Welding · เชื่อม" },
  { code: "ST-03", name: "Assembly A · ประกอบ A" },
  { code: "ST-04", name: "Assembly B · ประกอบ B" },
  { code: "ST-05", name: "Painting · พ่นสี" },
  { code: "ST-06", name: "QC Visual · ตรวจสายตา" },
  { code: "ST-07", name: "Packing · แพ็ค" },
  { code: "ST-08", name: "Torque · ขันแรง" },
  { code: "ST-09", name: "Testing · ทดสอบ" },
  { code: "ST-10", name: "Final · ตรวจปลายสาย" },
];

const POSITIONS = ["Material Handler", "Material Handler Shift lead"];

const LEVELS = ["Basic", "Advance", "Expert"];

const GENDERS = ["ชาย", "หญิง"];

const ATTENDANCE_TYPES = ["ขาด", "ลาป่วย", "ลากิจ", "ลาพักร้อน", "มาสาย"];

// Leave-type attendance entries that count against a quota (ขาด/มาสาย do not).
const LEAVE_TYPE_KEYS = { "ลาพักร้อน": "vacation", "ลาป่วย": "sick", "ลากิจ": "personal" };

const DEFAULT_LEAVE_QUOTA = { vacation: 10, sick: 30, personal: 6 };

const TASK_LEVELS = ["ง่าย", "กลาง", "ยาก"];
const TASK_LEVEL_WEIGHT = { "ง่าย": 1, "กลาง": 2, "ยาก": 3 };
// Points a linked skill axis moves by when a task assignment is marked done/undone.
const TASK_SKILL_BUMP = 5;

// Station proficiency: an employee must first pass basic training for a station before they're
// allowed to work it at all ("none" -> "basic"); from there, proficiency rises with accumulated
// work hours ("basic" -> "skilled" -> "expert"). Hour thresholds are the same for every station.
const STATION_LEVELS = [
  { key: "none", en: "None" },
  { key: "basic", en: "Basic" },
  { key: "skilled", en: "Skilled", min: 120 },
  { key: "expert", en: "Expert", min: 300 },
];

module.exports = {
  G1_AXES, G2_AXES, STATIONS, POSITIONS, LEVELS, GENDERS, ATTENDANCE_TYPES, LEAVE_TYPE_KEYS, DEFAULT_LEAVE_QUOTA,
  TASK_LEVELS, TASK_LEVEL_WEIGHT, TASK_SKILL_BUMP, STATION_LEVELS,
};
