import { lvlColor, escapeHtml, stationLevelOf, stationLevelColor, hazardBadges } from "../format.js";
import { radarSVG } from "../radar.js";
import { renderEmpSuggestionItems } from "./tasks.js";

export function renderForm({ draft, meta, currentUser, employees = [] }) {
  const isAdmin = currentUser && currentUser.role === "admin";
  const g1Axes = meta.g1AxesByPosition[draft.position] || meta.g1AxesByPosition[meta.defaultPosition];
  const g2Axes = meta.g2AxesByPosition[draft.position] || meta.g2AxesByPosition[meta.defaultPosition];
  const g1Sliders = g1Axes.map((axis, i) => `
    <div class="slider-row">
      <span class="slider-label">${escapeHtml(axis.th.replace(/\n/g, " "))}</span>
      <input type="range" min="0" max="100" value="${draft.g1[i]}" data-slider="g1" data-index="${i}">
      <span class="slider-value" id="slider-val-g1-${i}" style="color:#2f8fd0">${draft.g1[i]}%</span>
    </div>
  `).join("");

  const g2Sliders = g2Axes.map((axis, i) => `
    <div class="slider-row">
      <span class="slider-label">${escapeHtml(axis.th.replace(/\n/g, " "))}</span>
      <input type="range" min="0" max="100" value="${draft.g2[i]}" data-slider="g2" data-index="${i}">
      <span class="slider-value" id="slider-val-g2-${i}" style="color:#c78912">${draft.g2[i]}%</span>
    </div>
  `).join("");

  const stSliders = meta.stations.map((station) => {
    const entry = draft.st[station.id] || { hours: 0, trained: false };
    const level = stationLevelOf(entry.trained, entry.hours);
    const color = stationLevelColor(level.key);
    const thumb = station.image
      ? `<img class="station-form-thumb" src="${escapeHtml(station.image)}" alt="">`
      : `<span class="station-form-thumb station-form-thumb-empty"></span>`;
    return `
      <div class="station-form-row">
        ${thumb}
        <span class="slider-label">${escapeHtml(station.name)}${station.hazards && station.hazards.length ? `<span class="hazard-badge-row">${hazardBadges(station.hazards, meta.hazardTypes)}</span>` : ""}</span>
        <label class="station-trained-check" title="ผ่านการอบรมพื้นฐาน">
          <input type="checkbox" ${entry.trained ? "checked" : ""} data-station-trained="${escapeHtml(station.id)}">
          <span>อบรมแล้ว</span>
        </label>
        <span class="station-hours-display">${entry.hours} ชม.</span>
        <span class="station-level-badge" id="slider-val-st-${escapeHtml(station.id)}" style="color:${color};background:${color}1a">${escapeHtml(level.en)}</span>
      </div>
    `;
  }).join("");

  const levelButtons = meta.levels.map((l) => {
    const active = draft.level === l;
    const style = active
      ? `border-color:${lvlColor(l)};background:${lvlColor(l)};color:#fff`
      : `border-color:#dbe3e9;background:#f5f8fa;color:#5a6a78`;
    return `<button class="level-btn${active ? " active" : ""}" style="${style}" data-action="set-level" data-level="${l}">${l}</button>`;
  }).join("");

  const genderButtons = meta.genders.map((g) => {
    const active = draft.gender === g;
    const style = active
      ? `border-color:#0c7f93;background:#0c7f93;color:#fff`
      : `border-color:#dbe3e9;background:#f5f8fa;color:#5a6a78`;
    return `<button class="level-btn${active ? " active" : ""}" style="${style}" data-action="set-gender" data-gender="${escapeHtml(g)}">${escapeHtml(g)}</button>`;
  }).join("");

  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const teamTags = (draft.teamMemberIds || []).map((id) => {
    const e = empById[id];
    if (!e) return "";
    return `<span class="task-emp-tag">${escapeHtml(e.nickname || e.nameEn)}<button type="button" data-action="unpick-team-member" data-id="${escapeHtml(id)}">&times;</button></span>`;
  }).join("");
  const teamExcludeIds = [...(draft.teamMemberIds || []), draft.id].filter(Boolean);

  const radar1 = radarSVG(g1Axes.map((axis, i) => ({ label: axis.th, v: draft.g1[i] })), "#2f8fd0", "rgba(47,143,208,.18)");
  const radar2 = radarSVG(g2Axes.map((axis, i) => ({ label: axis.th, v: draft.g2[i] })), "#d99a17", "rgba(217,154,23,.26)");

  return `
    <div class="form-wrap">
      <div class="form-head">
        <div>
          <div class="form-head-title">แก้ไขคะแนนความสามารถ</div>
          <div class="form-head-sub">ปรับคะแนนแล้วกราฟจะอัปเดตทันที · กดบันทึกเพื่อจัดเก็บ</div>
        </div>
        <div class="form-head-actions">
          <button class="btn-outline" data-action="cancel-form">ยกเลิก</button>
          <button class="btn-gradient" data-action="save-form">บันทึกข้อมูล</button>
        </div>
      </div>

      <div class="card" style="padding:20px 22px">
        <div class="photo-field-row">
          ${draft.photo
            ? `<img class="photo-field-preview" src="${escapeHtml(draft.photo)}" alt="">`
            : `<div class="photo-field-preview photo-field-preview-empty">${escapeHtml((draft.nameEn || "?").trim()[0] || "?")}</div>`}
          <div class="photo-field-inputs">
            <label class="field-label">รูปพนักงาน (ไฟล์)<input type="file" accept="image/*" class="field-input" id="photo-file-input"></label>
            <label class="field-label">หรือวางลิงก์รูป (URL)<input class="field-input" id="photo-link-input" value="${escapeHtml(draft.photo && draft.photo.startsWith("http") ? draft.photo : "")}" placeholder="https://..."></label>
          </div>
        </div>
        <div class="field-grid" style="margin-top:16px">
          <label class="field-label">ชื่อ (EN)<input class="field-input" value="${escapeHtml(draft.nameEn)}" data-field="nameEn"></label>
          <label class="field-label">ชื่อ (ไทย)<input class="field-input" value="${escapeHtml(draft.name)}" data-field="name"></label>
          <label class="field-label">ชื่อเล่น<input class="field-input" value="${escapeHtml(draft.nickname)}" data-field="nickname" placeholder="เช่น ก้อง, มิว"></label>
          <label class="field-label">ตำแหน่ง
            <select class="field-input" id="position-select">
              ${meta.positions.map((p) => `<option value="${escapeHtml(p)}" ${draft.position === p ? "selected" : ""}>${escapeHtml(p)}</option>`).join("")}
              <option value="__other__" ${!meta.positions.includes(draft.position) ? "selected" : ""}>อื่นๆ (พิมพ์เอง)</option>
            </select>
          </label>
          <label class="field-label">รหัสพนักงาน<input class="field-input" value="${escapeHtml(draft.empCode)}" data-field="empCode"></label>
          ${isAdmin ? `
            <label class="field-label">สาย
              <select class="field-input" id="employee-line-select">
                ${meta.lines.map((l) => `<option value="${escapeHtml(l.id)}" ${draft.lineId === l.id ? "selected" : ""}>${escapeHtml(l.name)}</option>`).join("")}
              </select>
            </label>
          ` : ""}
        </div>
        ${!meta.positions.includes(draft.position) ? `
          <label class="field-label" style="margin-top:16px">ระบุตำแหน่ง
            <input class="field-input" value="${escapeHtml(draft.position)}" data-field="position" placeholder="พิมพ์ชื่อตำแหน่ง">
          </label>
        ` : ""}
        <div class="field-grid" style="margin-top:16px;grid-template-columns:repeat(3,1fr)">
          <label class="field-label">โควตาลาพักร้อน (วัน/ปี)<input type="number" min="0" class="field-input" value="${draft.leaveQuota.vacation}" data-leave-field="vacation"></label>
          <label class="field-label">โควตาลาป่วย (วัน/ปี)<input type="number" min="0" class="field-input" value="${draft.leaveQuota.sick}" data-leave-field="sick"></label>
          <label class="field-label">โควตาลากิจ (วัน/ปี)<input type="number" min="0" class="field-input" value="${draft.leaveQuota.personal}" data-leave-field="personal"></label>
        </div>
        <div class="form-select-row">
          <div>
            <div class="field-label" style="margin-bottom:8px">ระดับความสามารถ</div>
            <div class="level-select-row">${levelButtons}</div>
          </div>
          <div>
            <div class="field-label" style="margin-bottom:8px">เพศ</div>
            <div class="level-select-row">${genderButtons}</div>
          </div>
        </div>
        <div style="margin-top:16px">
          <label class="station-trained-check" style="cursor:pointer">
            <input type="checkbox" ${draft.isTeamLead ? "checked" : ""} id="team-lead-checkbox">
            <span style="font-weight:700;font-size:13px">เป็นหัวหน้าทีม (มอบหมายงานให้สมาชิกทีมได้) <small style="font-weight:400;color:#8494a1">· Team lead</small></span>
          </label>
          ${draft.isTeamLead ? `
            <div style="margin-top:10px">
              <div class="field-label" style="margin-bottom:8px">สมาชิกในทีม (พิมพ์ชื่อ/ชื่อเล่น/รหัสเพื่อค้นหา)</div>
              <div class="task-emp-picker">
                <input type="text" class="field-input" id="team-member-search" autocomplete="off" placeholder="พิมพ์เพื่อค้นหาพนักงาน..." value="${escapeHtml(draft.teamSearch || "")}">
                <div class="task-emp-suggest-list" id="team-member-suggestions">${renderEmpSuggestionItems(employees, draft.teamSearch, teamExcludeIds, "pick-team-member")}</div>
              </div>
              ${teamTags ? `<div class="task-emp-tags">${teamTags}</div>` : `<div style="font-size:12px;color:#8494a1;margin-top:8px">ยังไม่ได้เลือกสมาชิกทีม</div>`}
            </div>
          ` : ""}
        </div>
      </div>

      <div class="skill-grid">
        <div class="card" style="padding:18px 20px">
          <div style="font-weight:800;color:#2f8fd0;font-size:14px;text-align:center">Advance standard</div>
          <div id="radar-g1" style="padding:6px 0 4px">${radar1}</div>
          <div class="slider-list">${g1Sliders}</div>
        </div>
        <div class="card" style="padding:18px 20px">
          <div style="font-weight:800;color:#c78912;font-size:14px;text-align:center">%Skill judgment</div>
          <div id="radar-g2" style="padding:6px 0 4px">${radar2}</div>
          <div class="slider-list">${g2Sliders}</div>
        </div>
      </div>

      <div class="card" style="padding:18px 22px;margin-top:18px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-weight:800;font-size:14px;color:#132530">ความชำนาญสถานี / เครื่องจักร</div>
          <div style="display:flex;gap:14px">
            <button class="btn-link" data-nav="worklog">บันทึกชั่วโมงทำงาน →</button>
            <button class="btn-link" data-nav="stations">จัดการสถานี / อัปโหลดรูป →</button>
          </div>
        </div>
        <div style="font-size:12px;color:#8494a1;margin-bottom:14px">ติ๊ก "อบรมแล้ว" เพื่อปลดล็อกสถานี ส่วนชั่วโมงคำนวณจากการบันทึกการทำงานรายวันอัตโนมัติ</div>
        <div class="station-form-grid">${stSliders}</div>
      </div>
    </div>
  `;
}
