// Fixed label sets shared by every employee (mirrors the design prototype's constants).
"use strict";

const G1_AXES = [
  { th: "การตรวจจับของเสีย", en: "Defect detection" },
  { th: "การปฏิบัติตาม process", en: "Process compliance" },
  { th: "การทำงานตามเวลาที่กำหนด", en: "Cycle time" },
  { th: "Feeling judgment", en: "Feeling judgment" },
  { th: "Basic standard", en: "Basic standard" },
  { th: "ความปลอดภัย 5ส", en: "Safety 5S" },
];

const G2_AXES = [
  { th: "Visual inspection", en: "Visual inspection" },
  { th: "Torque check", en: "Torque check" },
  { th: "Assembly fit", en: "Assembly fit" },
  { th: "Function test", en: "Function test" },
  { th: "Final check", en: "Final check" },
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

const LEVELS = ["Basic", "Advance", "Expert"];

const GENDERS = ["ชาย", "หญิง"];

const ATTENDANCE_TYPES = ["ขาด", "ลาป่วย", "ลากิจ", "ลาพักร้อน", "มาสาย"];

module.exports = { G1_AXES, G2_AXES, STATIONS, LEVELS, GENDERS, ATTENDANCE_TYPES };
