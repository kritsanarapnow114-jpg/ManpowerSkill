export function clamp(v) {
  v = parseInt(v, 10);
  if (Number.isNaN(v)) v = 0;
  return Math.max(0, Math.min(100, v));
}

export function avgOf(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((s, x) => s + x, 0) / values.length);
}

export function passOf(g1, g2) {
  return avgOf([...g1.map((a) => a.v), ...g2.map((a) => a.v)]);
}

export function lvlColor(level) {
  return level === "Expert" ? "#7c4dbc" : level === "Advance" ? "#0c7f93" : "#64748b";
}

export function stColor(pct) {
  return pct >= 90 ? "#16a34a" : pct >= 75 ? "#0c7f93" : pct >= 60 ? "#e0902e" : "#dc2626";
}

export function avatarBg(level) {
  return level === "Expert"
    ? "linear-gradient(135deg,#8b5bd0,#5a2f95)"
    : level === "Advance"
    ? "linear-gradient(135deg,#12a0b8,#0c6070)"
    : "linear-gradient(135deg,#8494a1,#5a6a78)";
}

export function taskColor(pct) {
  return pct >= 100 ? "#16a34a" : pct >= 50 ? "#0c7f93" : pct >= 1 ? "#e0902e" : "#94a3b8";
}

export function taskBadge(pct) {
  return pct >= 100 ? "เสร็จ" : pct >= 1 ? "กำลังทำ" : "ยังไม่เริ่ม";
}

export function initials(nameEn) {
  return String(nameEn || "")
    .replace(/^(MR\.|MS\.)\s*/i, "")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const ATTENDANCE_COLORS = {
  "ขาด": "#dc2626",
  "ลาป่วย": "#e0902e",
  "ลากิจ": "#7c4dbc",
  "ลาพักร้อน": "#16a34a",
  "มาสาย": "#d99a17",
};

export function attendanceColor(type) {
  return ATTENDANCE_COLORS[type] || "#64748b";
}

export function passColor(pass) {
  return pass >= 95 ? "#16a34a" : pass >= 85 ? "#0c7f93" : "#e0902e";
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function taskPct(tasks) {
  if (!tasks || !tasks.length) return 0;
  return avgOf(tasks.map((t) => clamp(t.progress)));
}

export function certStatus(expiry) {
  if (!expiry) return { kind: "none", label: "ไม่มีวันหมดอายุ", color: "#8494a1" };
  const days = Math.floor((new Date(expiry + "T00:00:00") - new Date(new Date().toDateString())) / 86400000);
  if (days < 0) return { kind: "expired", label: "หมดอายุแล้ว", color: "#dc2626" };
  if (days <= 30) return { kind: "soon", label: `ใกล้หมดอายุ (${days} วัน)`, color: "#e0902e" };
  return { kind: "ok", label: "ยังไม่หมดอายุ", color: "#16a34a" };
}
