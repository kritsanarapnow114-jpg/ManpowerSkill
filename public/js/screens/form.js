import { lvlColor, stColor, escapeHtml } from "../format.js";
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
    const v = draft.st[station.id] ?? 0;
    const thumb = station.image
      ? `<img class="station-form-thumb" src="${escapeHtml(station.image)}" alt="">`
      : `<span class="station-form-thumb station-form-thumb-empty"></span>`;
    return `
      <div class="station-form-row">
        ${thumb}
        <span class="slider-label">${escapeHtml(station.name)}</span>
        <input type="range" min="0" max="100" value="${v}" data-slider="st" data-station-id="${escapeHtml(station.id)}">
        <span class="slider-value" id="slider-val-st-${escapeHtml(station.id)}" style="color:${stColor(v)}">${v}%</span>
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
        <div class="field-grid">
          <label class="field-label">ชื่อ (EN)<input class="field-input" value="${escapeHtml(draft.nameEn)}" data-field="nameEn"></label>
          <label class="field-label">ชื่อ (ไทย)<input class="field-input" value="${escapeHtml(draft.name)}" data-field="name"></label>
          <label class="field-label">ตำแหน่ง<input class="field-input" value="${escapeHtml(draft.position)}" data-field="position"></label>
          <label class="field-label">รหัสพนักงาน<input class="field-input" value="${escapeHtml(draft.empCode)}" data-field="empCode"></label>
        </div>
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
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div style="font-weight:800;font-size:14px;color:#132530">ความชำนาญสถานี / เครื่องจักร</div>
          <button class="btn-link" data-nav="stations">จัดการสถานี / อัปโหลดรูป →</button>
        </div>
        <div class="station-form-grid">${stSliders}</div>
      </div>
    </div>
  `;
}
