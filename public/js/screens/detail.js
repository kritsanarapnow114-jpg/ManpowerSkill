import { lvlColor, initials, escapeHtml, taskPct, certStatus, stationLevelColor, hazardBadges } from "../format.js";
import { radarSVG } from "../radar.js";
import { icons } from "../icons.js";

const LEAVE_LABELS = { vacation: "ลาพักร้อน", sick: "ลาป่วย", personal: "ลากิจ" };
const STATUS_RANK = { expired: 0, soon: 1, ok: 2, none: 3 };

export function renderDetail({ emp, certificates = [], achievements = [], readOnly = false, hazardTypes = [] }) {
  const leaveRows = Object.entries(LEAVE_LABELS).map(([key, label]) => {
    const { quota, used } = emp.leave[key];
    const remain = quota - used;
    const color = remain <= 0 ? "#dc2626" : remain <= Math.max(1, Math.round(quota * 0.2)) ? "#e0902e" : "#16a34a";
    const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 100;
    return `
      <div class="leave-balance-row">
        <div class="leave-balance-label">${escapeHtml(label)}</div>
        <div class="leave-balance-track"><div class="leave-balance-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="leave-balance-num" style="color:${color}">${used}/${quota}</div>
      </div>
    `;
  }).join("");

  const stationsHtml = emp.st.map((s) => {
    const color = stationLevelColor(s.level);
    const barPct = Math.min(100, Math.round((s.v / 300) * 100));
    return `
    <div class="station-chip">
      ${s.image ? `<img class="station-chip-img" src="${escapeHtml(s.image)}" alt="">` : ""}
      <div class="station-chip-top">
        <div class="station-tag" style="background:${color}">${escapeHtml(s.code.replace("ST-", ""))}</div>
        <span class="station-level-badge" style="color:${color};background:${color}1a">${escapeHtml(s.levelEn)}</span>
      </div>
      <div class="station-name">${escapeHtml(s.name)}</div>
      ${s.hazards && s.hazards.length ? `<div class="hazard-badge-row">${hazardBadges(s.hazards, hazardTypes)}</div>` : ""}
      <div class="station-hours">${s.trained ? `${s.v} ชม.` : "ยังไม่ผ่านอบรม"}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${barPct}%;background:${color}"></div></div>
    </div>
  `;
  }).join("");

  const stats = [
    { label: "ประกอบวันนี้", val: emp.stats.today, color: "#0c7f93" },
    { label: "ตรวจ QC", val: emp.stats.qc, color: "#7c4dbc" },
    { label: "แก้ไขงาน", val: emp.stats.rework, color: "#e0902e" },
    { label: "ของเสีย", val: emp.stats.defect, color: "#dc2626" },
  ];
  const statsHtml = stats.map((st) => `
    <div class="stat-item">
      <div class="stat-ring" style="border-color:${st.color}">${escapeHtml(st.val)}</div>
      <div class="stat-label">${escapeHtml(st.label)}</div>
    </div>
  `).join("");

  const radar1 = radarSVG(emp.g1.map((a) => ({ label: a.th, v: a.v })), "#2f8fd0", "rgba(47,143,208,.18)");
  const radar2 = radarSVG(emp.g2.map((a) => ({ label: a.th, v: a.v })), "#d99a17", "rgba(217,154,23,.26)");

  const empTaskTotal = emp.tasks.length;
  const empTaskDone = emp.tasks.filter((t) => t.done).length;
  const empTaskPctVal = taskPct(emp.tasks);

  const certStatuses = certificates.map((c) => certStatus(c.expiry));
  const worstCert = certStatuses.slice().sort((a, b) => STATUS_RANK[a.kind] - STATUS_RANK[b.kind])[0];

  return `
    <div>
      ${readOnly ? "" : `<button class="btn-link" data-action="back-to-list">${icons.back} กลับไปรายชื่อ</button>`}
      <div class="detail-grid">
        <div class="card">
          <div class="detail-head">
            <div>
              <div class="detail-name">${escapeHtml(emp.nameEn)}</div>
              <div class="detail-sub">${escapeHtml(emp.name)} · ${escapeHtml(emp.position)}${emp.gender ? ` · ${escapeHtml(emp.gender)}` : ""}</div>
            </div>
            <span class="level-pill" style="background:${lvlColor(emp.level)}">${icons.star} ${escapeHtml(emp.level)}</span>
            ${readOnly ? "" : `<button class="btn-outline-accent" style="margin-left:auto" data-action="edit-this">${icons.edit} แก้ไขคะแนน</button>`}
          </div>

          <div class="radar-grid">
            <div class="radar-card">
              <div class="radar-title" style="color:#2f8fd0">Advance standard</div>
              ${radar1}
            </div>
            <div class="radar-card">
              <div class="radar-title" style="color:#c78912">%Skill judgment</div>
              ${radar2}
            </div>
          </div>

          <div style="margin-top:22px">
            <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px">
              <span style="font-weight:800;font-size:15px;color:#132530">สถานี / เครื่องจักรที่ชำนาญ</span>
              <span style="font-size:12.5px;color:#8494a1">Skilled stations</span>
            </div>
            <div class="stations-row">${stationsHtml}</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px">
          <div class="card" style="padding:0;overflow:hidden">
            <div class="avatar-hero">${emp.photo
              ? `<img class="avatar-circle-lg avatar-circle-photo" src="${escapeHtml(emp.photo)}" alt="">`
              : `<div class="avatar-circle-lg">${escapeHtml(initials(emp.nameEn))}</div>`}</div>
            <div class="hero-card-body">
              <div class="muted-label">รหัสพนักงาน · เข้าร่วม</div>
              <div class="hero-meta">${escapeHtml(emp.empCode)} · ${escapeHtml(emp.join)}</div>
            </div>
          </div>

          <div class="card" style="padding:16px 18px">
            <div class="pass-label">Total straight pass rate</div>
            <div class="pass-value"><span class="num">${emp.pass}</span><span class="pct">%</span></div>
            <div class="pass-track"><div class="pass-fill" style="width:${emp.pass}%"></div></div>
            <div class="stat-grid">${statsHtml}</div>
          </div>

          <div class="card" style="padding:16px 18px">
            <div class="pass-label">วันลาคงเหลือ · Leave balance</div>
            <div class="leave-balance-list">${leaveRows}</div>
          </div>

          <div class="card" style="padding:16px 18px">
            <div class="task-summary-head">
              <div class="pass-label">งานที่มอบหมาย · Assigned tasks</div>
              <button class="task-summary-link" data-action="${readOnly ? "go-my-tasks" : "go-tasks"}">${readOnly ? "ดูงานของฉัน" : "จัดการ"} →</button>
            </div>
            <div class="task-summary-value">
              <span class="num">${empTaskPctVal}<span>%</span></span>
              <span class="count">${empTaskDone}/${empTaskTotal} งานเสร็จ · Workload ${emp.workload}</span>
            </div>
            <div class="task-summary-track"><div class="task-summary-fill" style="width:${empTaskPctVal}%"></div></div>
          </div>

          <div class="card" style="padding:16px 18px">
            <div class="task-summary-head">
              <div class="pass-label">ใบเซอร์ · Certificates</div>
              ${readOnly ? "" : `<button class="task-summary-link" data-action="go-certificates">จัดการ →</button>`}
            </div>
            <div class="task-summary-value">
              <span class="num">${certificates.length}</span>
              ${certificates.length ? `<span class="count" style="color:${worstCert.color}">${escapeHtml(worstCert.label)}</span>` : `<span class="count">ยังไม่มีใบเซอร์</span>`}
            </div>
          </div>

          <div class="card" style="padding:16px 18px">
            <div class="task-summary-head">
              <div class="pass-label">ผลงาน · Achievements</div>
              ${readOnly ? "" : `<button class="task-summary-link" data-action="go-achievements">จัดการ →</button>`}
            </div>
            <div class="task-summary-value">
              <span class="num">${achievements.length}</span>
              <span class="count">${achievements.length ? escapeHtml(achievements[0].title) : "ยังไม่มีบันทึกผลงาน"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
