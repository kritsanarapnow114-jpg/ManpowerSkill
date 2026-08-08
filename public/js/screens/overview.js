import { stColor, avatarBg, initials, escapeHtml } from "../format.js";

export function renderOverview({ employees }) {
  const counts = { Basic: 0, Advance: 0, Expert: 0 };
  employees.forEach((e) => counts[e.level]++);
  const teamAvgPass = employees.length ? Math.round(employees.reduce((s, e) => s + e.pass, 0) / employees.length) : 0;

  const kpis = [
    { label: "พนักงานทั้งหมด", value: employees.length, sub: "คนในสาย Line A", color: "#0c7f93", icon: "#" },
    { label: "Expert", value: counts.Expert, sub: "ระดับผู้เชี่ยวชาญ", color: "#7c4dbc", icon: "E" },
    { label: "Advance", value: counts.Advance, sub: "ระดับก้าวหน้า", color: "#12a0b8", icon: "A" },
    { label: "Basic", value: counts.Basic, sub: "ระดับพื้นฐาน", color: "#e0902e", icon: "B" },
    { label: "Avg pass rate", value: teamAvgPass + "%", sub: "ค่าเฉลี่ยทั้งทีม", color: "#16a34a", icon: "%" },
  ];

  const kpiHtml = kpis.map((k) => `
    <div class="card card-sm kpi-card">
      <div class="kpi-stripe" style="background:${k.color}"></div>
      <div class="kpi-head">
        <div class="kpi-icon" style="background:${k.color}">${escapeHtml(k.icon)}</div>
        <div class="kpi-label">${escapeHtml(k.label)}</div>
      </div>
      <div class="kpi-value">${escapeHtml(String(k.value))}</div>
      <div class="kpi-sub">${escapeHtml(k.sub)}</div>
    </div>
  `).join("");

  const stationCount = employees[0] ? employees[0].st.length : 0;
  const coverage = Array.from({ length: stationCount }, (_, i) => {
    const station = employees[0].st[i];
    const qualified = employees.filter((e) => e.st[i].v >= 80).length;
    const pct = employees.length ? Math.round((qualified / employees.length) * 100) : 0;
    return { name: station.name, qualified, total: employees.length, pct, color: stColor(pct) };
  });

  const coverageHtml = coverage.map((c) => `
    <div>
      <div class="coverage-row-head">
        <span class="coverage-name">${escapeHtml(c.name)}</span>
        <span class="coverage-count">${c.qualified}/${c.total} คน</span>
      </div>
      <div class="coverage-track"><div class="bar-fill" style="width:${c.pct}%;background:${c.color};height:100%"></div></div>
    </div>
  `).join("");

  const top = [...employees].sort((a, b) => b.avg - a.avg).slice(0, 5);
  const topHtml = top.map((e, i) => `
    <div class="top-row" data-action="open-emp" data-id="${escapeHtml(e.id)}">
      <div class="top-rank">${i + 1}</div>
      <div class="avatar-sm" style="background:${avatarBg(e.level)}">${escapeHtml(initials(e.nameEn))}</div>
      <div class="top-name">
        <div class="top-name-en">${escapeHtml(e.nameEn)}</div>
        <div class="top-level">${escapeHtml(e.level)}</div>
      </div>
      <div class="top-avg">${e.avg}%</div>
    </div>
  `).join("");

  return `
    <div class="kpi-row">${kpiHtml}</div>
    <div class="overview-grid">
      <div class="card">
        <div class="section-title">ความครอบคลุมสถานี <small>· คนที่ผ่านเกณฑ์ ≥80%</small></div>
        <div class="coverage-list">${coverageHtml}</div>
      </div>
      <div class="card">
        <div class="section-title">Top performers <small>· คะแนนเฉลี่ยสูงสุด</small></div>
        <div class="top-list">${topHtml}</div>
      </div>
    </div>
  `;
}
