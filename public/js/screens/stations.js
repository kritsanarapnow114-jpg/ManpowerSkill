import { escapeHtml, hazardBadges } from "../format.js";
import { icons } from "../icons.js";

export function renderStations({ stations, form, hazardTypes }) {
  const isEditing = !!form.editingId;

  const cards = stations.map((s) => `
    <div class="station-manage-card">
      ${s.image ? `<img class="station-manage-img" src="${escapeHtml(s.image)}" alt="">` : `<div class="station-manage-img station-manage-img-empty">${icons.image}</div>`}
      <div class="station-manage-body">
        <div class="station-manage-code">${escapeHtml(s.code)}</div>
        <div class="station-manage-name">${escapeHtml(s.name)}</div>
        ${s.hazards && s.hazards.length ? `<div class="hazard-badge-row">${hazardBadges(s.hazards, hazardTypes)}</div>` : ""}
      </div>
      <div class="station-manage-actions">
        <button class="btn-edit-row" data-action="edit-station" data-id="${escapeHtml(s.id)}">แก้ไข</button>
        <button class="btn-icon" title="ลบสถานี" data-action="delete-station" data-id="${escapeHtml(s.id)}">${icons.trash}</button>
      </div>
    </div>
  `).join("");

  const hazardChips = (hazardTypes || []).map((h) => {
    const active = form.hazards.includes(h.key);
    const style = active
      ? `border-color:#dc2626;background:#dc2626;color:#fff`
      : `border-color:#dbe3e9;background:#f5f8fa;color:#5a6a78`;
    return `<button type="button" class="hazard-chip-btn${active ? " active" : ""}" style="${style}" data-action="toggle-station-hazard" data-key="${escapeHtml(h.key)}" title="${escapeHtml(h.en)}">${h.emoji} ${escapeHtml(h.th)}</button>`;
  }).join("");

  return `
    <div>
      <div class="card" style="padding:18px 22px">
        <div class="section-title" style="margin-bottom:12px">${isEditing ? "แก้ไขสถานี" : "เพิ่มสถานีใหม่"} <small>· ${isEditing ? "Edit station" : "New station"}</small></div>
        <div class="assign-row">
          <label class="assign-field due">รหัสสถานี
            <input class="field-input" id="stn-code-input" value="${escapeHtml(form.code)}" placeholder="เช่น ST-11">
          </label>
          <label class="assign-field title">ชื่อสถานี / เครื่องจักร
            <input class="field-input" id="stn-name-input" value="${escapeHtml(form.name)}" placeholder="เช่น Laser Cutting · ตัดเลเซอร์">
          </label>
          <label class="assign-field due">รูปเครื่องจักร
            <input type="file" accept="image/*" class="field-input" id="stn-image-input">
          </label>
          <button class="btn-gradient" data-action="save-station">${icons.plus} ${isEditing ? "บันทึก" : "เพิ่มสถานี"}</button>
          ${isEditing ? `<button class="btn-outline" data-action="cancel-station-edit">ยกเลิก</button>` : ""}
        </div>
        <div style="margin-top:14px">
          <div class="field-label" style="margin-bottom:8px">อันตรายของเครื่องจักร <small>· Hazards</small></div>
          <div class="hazard-chip-row">${hazardChips}</div>
        </div>
        ${form.image ? `<div class="station-manage-preview"><img src="${escapeHtml(form.image)}" alt=""><span>ตัวอย่างรูปที่เลือก</span></div>` : ""}
      </div>

      <div class="station-manage-grid">${cards || `<div class="task-empty">ยังไม่มีสถานี</div>`}</div>
    </div>
  `;
}
