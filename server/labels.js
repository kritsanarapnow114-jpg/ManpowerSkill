// Fixed label sets shared by every employee (mirrors the design prototype's constants).
"use strict";

// Skill axes differ by position - each does genuinely different work, so "Advance standard"
// and "%Skill judgment" are keyed per position rather than shared. DEFAULT_POSITION's set is
// used as a fallback for any employee whose position doesn't match one of these exactly
// (legacy/free-text positions).
const DEFAULT_POSITION = "Material Handler";

// \n in a label breaks it onto a second line in the radar chart (see radar.js) - used on
// longer labels so they don't overflow into a neighboring axis or the next card.
//
// Every axis also carries a "signal" - which real, recorded data source backs it up when there's
// no task explicitly linked to it (see server/skillscore.js). "station" axes additionally list
// stationKeywords matched (case-insensitively, substring) against station names to find relevant
// work-log hours; if nothing matches (e.g. the stations list hasn't been renamed to cover this
// equipment yet), it falls back to "achievement" automatically.
const G1_AXES_BY_POSITION = {
  "Material Handler": [
    { th: "คุณภาพงาน", en: "Work Quality", signal: "achievement" },
    { th: "การปฏิบัติ\nตามขั้นตอน", en: "Process\nCompliance", signal: "attendance" },
    { th: "ความตรงต่อเวลา", en: "Punctuality &\nCycle Time", signal: "attendance" },
    { th: "ความถูกต้อง\nของเอกสาร", en: "Documentation\nAccuracy", signal: "achievement" },
    { th: "ประสิทธิภาพ\nการทำงาน", en: "Work Efficiency", signal: "achievement" },
    { th: "ความปลอดภัย 5ส", en: "Safety & 5S", signal: "attendance" },
  ],
  "Material Handler (Cert Forklift)": [
    { th: "ความปลอดภัย\nในการขับ", en: "Driving Safety", signal: "attendance" },
    { th: "การตรวจเช็ครถ\nก่อน-หลังใช้งาน", en: "Pre/Post-use\nInspection", signal: "station", stationKeywords: ["forklift", "โฟล์คลิฟท์"] },
    { th: "ความแม่นยำ\nในการยก-วาง", en: "Load Precision", signal: "achievement" },
    { th: "ความตรงต่อเวลา\nในการขนส่ง", en: "Delivery\nTimeliness", signal: "attendance" },
    { th: "การดูแลรักษา\nเครื่องจักร", en: "Equipment Care", signal: "station", stationKeywords: ["forklift", "โฟล์คลิฟท์"] },
    { th: "ความปลอดภัย 5ส", en: "Safety & 5S", signal: "attendance" },
  ],
  "Material Handler Shift Leader": [
    { th: "คุณภาพงานทีม", en: "Team Work\nQuality", signal: "achievement" },
    { th: "การบริหาร\nกำหนดเวลา/เป้าหมาย", en: "Schedule & Target\nManagement", signal: "achievement" },
    { th: "ความถูกต้อง\nในการตัดสินใจ", en: "Decision Accuracy", signal: "achievement" },
    { th: "การสื่อสาร\nและถ่ายทอดงาน", en: "Communication &\nDelegation", signal: "achievement" },
    { th: "ประสิทธิภาพ\nการบริหารทีม", en: "Team Efficiency", signal: "achievement" },
    { th: "ความปลอดภัย 5ส", en: "Safety & 5S", signal: "attendance" },
  ],
};

const G2_AXES_BY_POSITION = {
  "Material Handler": [
    { th: "Checker /\nตรวจนับสินค้า", en: "Checker", signal: "achievement" },
    { th: "Truck Scale\nOperation", en: "Truck Scale\nOperation", signal: "station", stationKeywords: ["truck scale", "ชั่งน้ำหนัก"] },
    { th: "System &\nDocumentation", en: "System &\nDocumentation", signal: "achievement" },
    { th: "Inventory\nAccuracy", en: "Inventory Accuracy", signal: "achievement" },
    { th: "Quality Control", en: "Quality Control", signal: "achievement" },
    { th: "Safety & Problem\nSolving", en: "Safety & Problem\nSolving", signal: "attendance" },
  ],
  "Material Handler (Cert Forklift)": [
    { th: "Forklift\nOperation", en: "Forklift Operation", signal: "station", stationKeywords: ["forklift", "โฟล์คลิฟท์"] },
    { th: "Load Handling", en: "Load Handling", signal: "achievement" },
    { th: "Packing &\nBundling", en: "Packing & Bundling", signal: "station", stationKeywords: ["packing", "แพ็ค", "บรรจุ"] },
    { th: "Racking &\nStorage", en: "Racking & Storage", signal: "station", stationKeywords: ["racking", "storage", "จัดเก็บ"] },
    { th: "Hazard\nAwareness", en: "Hazard Awareness", signal: "attendance" },
    { th: "Equipment\nMaintenance\nAwareness", en: "Equipment\nMaintenance\nAwareness", signal: "station", stationKeywords: ["forklift", "โฟล์คลิฟท์"] },
  ],
  "Material Handler Shift Leader": [
    { th: "Team\nCoordination", en: "Team Coordination", signal: "achievement" },
    { th: "Problem Solving\n& Escalation", en: "Problem Solving\n& Escalation", signal: "achievement" },
    { th: "Training &\nMentoring", en: "Training &\nMentoring", signal: "achievement" },
    { th: "Workload\nPlanning", en: "Workload Planning", signal: "achievement" },
    { th: "Reporting &\nDocumentation", en: "Reporting &\nDocumentation", signal: "achievement" },
    { th: "Safety Compliance\nOversight", en: "Safety Compliance\nOversight", signal: "attendance" },
  ],
};

function g1AxesFor(position) {
  return G1_AXES_BY_POSITION[position] || G1_AXES_BY_POSITION[DEFAULT_POSITION];
}

function g2AxesFor(position) {
  return G2_AXES_BY_POSITION[position] || G2_AXES_BY_POSITION[DEFAULT_POSITION];
}

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

// Hazard categories shown on stations/machines as an icon badge (safety awareness at a glance).
const HAZARD_TYPES = [
  { key: "mechanical", emoji: "⚙️", th: "เครื่องกล", en: "Mechanical" },
  { key: "noise", emoji: "🔊", th: "เสียง", en: "Noise" },
  { key: "movement", emoji: "🚜", th: "การเคลื่อนไหว/ยานพาหนะ", en: "Movement" },
  { key: "gravity", emoji: "📦", th: "แรงโน้มถ่วง/ของตก", en: "Gravity" },
  { key: "pressure", emoji: "💨", th: "แรงดัน", en: "Pressure" },
  { key: "chemical", emoji: "🧪", th: "สารเคมี", en: "Chemical" },
  { key: "radiation", emoji: "☢️", th: "รังสี", en: "Radiation" },
  { key: "biological", emoji: "🦠", th: "ชีวภาพ", en: "Biological" },
  { key: "electrical", emoji: "⚡", th: "ไฟฟ้า", en: "Electrical" },
  { key: "temperature", emoji: "🌡️", th: "อุณหภูมิ", en: "Temperature" },
];
const HAZARD_KEYS = HAZARD_TYPES.map((h) => h.key);

const POSITIONS = ["Material Handler", "Material Handler (Cert Forklift)", "Material Handler Shift Leader"];

const LEVELS = ["Basic", "Advance", "Expert"];

const GENDERS = ["ชาย", "หญิง"];

const ATTENDANCE_TYPES = ["ขาด", "ลาป่วย", "ลากิจ", "ลาพักร้อน", "มาสาย"];

// Leave-type attendance entries that count against a quota (ขาด/มาสาย do not).
const LEAVE_TYPE_KEYS = { "ลาพักร้อน": "vacation", "ลาป่วย": "sick", "ลากิจ": "personal" };

const DEFAULT_LEAVE_QUOTA = { vacation: 10, sick: 30, personal: 6 };

const TASK_LEVELS = ["ง่าย", "กลาง", "ยาก"];
const TASK_LEVEL_WEIGHT = { "ง่าย": 1, "กลาง": 2, "ยาก": 3 };

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
  G1_AXES_BY_POSITION, G2_AXES_BY_POSITION, DEFAULT_POSITION, g1AxesFor, g2AxesFor,
  STATIONS, POSITIONS, LEVELS, GENDERS, ATTENDANCE_TYPES, LEAVE_TYPE_KEYS, DEFAULT_LEAVE_QUOTA,
  TASK_LEVELS, TASK_LEVEL_WEIGHT, STATION_LEVELS, HAZARD_TYPES, HAZARD_KEYS,
};
