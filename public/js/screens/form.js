import { lvlColor, escapeHtml, stationLevelOf, stationLevelColor } from "../format.js";
import { radarSVG } from "../radar.js";

export function renderForm({ draft, meta }) {
  const g1Sliders = meta.g1Axes.map((axis, i) => `
    <div class="slider-row">
      <span class="slider-label">${escapeHtml(axis.th.replace(/\n/g, " "))}</span>
      <input type="range" min="0" max="100" value="${draft.g1[i]}" data-slider="g1" data-index="${i}">
      <span class="slider-value" id="slider-val-g1-${i}" style="color:#2f8fd0">${draft.g1[i]}%</span>
    </div>
  `).join("");

  const g2Sliders = meta.g2Axes.map((axis, i) => `
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
        <span class="slider-label">${escapeHtml(station.name)}</span>
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

  const radar1 = radarSVG(meta.g1Axes.map((axis, i) => ({ label: axis.th, v: draft.g1[i] })), "#2f8fd0", "rgba(47,143,208,.18)");
  const radar2 = radarSVG(meta.g2Axes.map((axis, i) => ({ label: axis.th, v: draft.g2[i] })), "#d99a17", "rgba(217,154,23,.26)");

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
