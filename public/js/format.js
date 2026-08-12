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

// Station proficiency tiers, mirrors server/labels.js STATION_LEVELS. An employee must pass
// basic training for a station before they can work it at all; from there, hours worked push
// them from Basic up to Skilled/Expert.
export const STATION_LEVELS = [
  { key: "none", en: "None" },
  { key: "basic", en: "Basic" },
  { key: "skilled", en: "Skilled", min: 120 },
  { key: "expert", en: "Expert", min: 300 },
];

export function stationLevelOf(trained, hours) {
  if (!trained) return STATION_LEVELS[0];
  let level = STATION_LEVELS[1];
  for (const l of STATION_LEVELS) if (l.min !== undefined && hours >= l.min) level = l;
  return level;
}

export function stationLevelColor(key) {
  return key === "expert" ? "#16a34a" : key === "skilled" ? "#0c7f93" : key === "basic" ? "#e0902e" : "#94a3b8";
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
  const done = tasks.filter((t) => t.done).length;
  return Math.round((done / tasks.length) * 100);
}

export function taskLevelColor(level) {
  return level === "ยาก" ? "#dc2626" : level === "กลาง" ? "#e0902e" : "#16a34a";
}

export function isTaskOverdue(due, done) {
  if (done || !due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  return due < new Date().toISOString().slice(0, 10);
}

function driveFileId(url) {
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const openMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) return openMatch[1];
  const ucMatch = url.match(/drive\.google\.com\/uc\?.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (ucMatch) return ucMatch[1];
  const thumbMatch = url.match(/drive\.google\.com\/thumbnail\?.*[?&]id=([a-zA-Z0-9_-]+)/);
  if (thumbMatch) return thumbMatch[1];
  return null;
}

export function normalizeImageLink(url) {
  if (!url) return url;
  const id = driveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : url;
}

export function looksLikeImage(url) {
  if (!url) return false;
  if (url.startsWith("data:image")) return true;
  if (/drive\.google\.com\/(uc|thumbnail)\?/.test(url)) return true;
  return /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(url);
}

export function isSafeLink(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

// Renders a station's hazard keys as small emoji badges with a Thai/English tooltip.
export function hazardBadges(hazardKeys, hazardTypes) {
  if (!hazardKeys || !hazardKeys.length) return "";
  const byKey = Object.fromEntries((hazardTypes || []).map((h) => [h.key, h]));
  return hazardKeys
    .map((k) => byKey[k])
    .filter(Boolean)
    .map((h) => `<span class="hazard-badge" title="${escapeHtml(h.th)} · ${escapeHtml(h.en)}">${h.emoji}</span>`)
    .join("");
}

export function certStatus(expiry) {
  if (!expiry) return { kind: "none", label: "ไม่มีวันหมดอายุ", color: "#8494a1" };
  const days = Math.floor((new Date(expiry + "T00:00:00") - new Date(new Date().toDateString())) / 86400000);
  if (days < 0) return { kind: "expired", label: "หมดอายุแล้ว", color: "#dc2626" };
  if (days <= 30) return { kind: "soon", label: `ใกล้หมดอายุ (${days} วัน)`, color: "#e0902e" };
  return { kind: "ok", label: "ยังไม่หมดอายุ", color: "#16a34a" };
}
