import { avatarBg, initials, escapeHtml } from "../format.js";
import { icons } from "../icons.js";

export function renderAchievements({ employees, achievements, form }) {
  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));

  const empOptions = employees
    .map((e) => `<option value="${escapeHtml(e.id)}" ${form.employeeId === e.id ? "selected" : ""}>${escapeHtml(e.empCode + " · " + e.nameEn)}</option>`)
    .join("");

  const rows = achievements.map((a) => {
    const emp = empById[a.employeeId];
    return `
      <div class="achievement-row">
        <div class="achievement-date">${escapeHtml(a.date || "—")}</div>
        <div class="achievement-emp">
          <div class="avatar-sm" style="background:${emp ? avatarBg(emp.level) : "#8494a1"}">${escapeHtml(emp ? initials(emp.nameEn) : "?")}</div>
          <div style="min-width:0">
            <div class="list-name-en">${escapeHtml(emp ? emp.nameEn : a.employeeId)}</div>
            <div class="list-name-th">${escapeHtml(emp ? emp.name : "")}</div>
          </div>
        </div>
        <div class="achievement-body">
          <div class="achievement-title">${escapeHtml(a.title)}</div>
          ${a.note ? `<div class="achievement-note">${escapeHtml(a.note)}</div>` : ""}
        </div>
        <button class="btn-icon" title="ลบรายการ" data-action="delete-achievement" data-id="${escapeHtml(a.id)}">${icons.trash}</button>
      </div>
    `;
  }).join("");

  return `
    <div>
      <div class="task-kpi-row" style="grid-template-columns:1fr">
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#c78912"></div>
          <div class="kpi-label">ผลงาน/ความสำเร็จทั้งหมด · Total achievements</div>
          <div class="kpi-value">${achievements.length}</div>
        </div>
      </div>

      <div class="card" style="padding:18px 22px">
        <div class="section-title" style="margin-bottom:12px">บันทึกผลงานใหม่ <small>· New achievement</small></div>
        <div class="assign-row">
          <label class="assign-field employee">พนักงาน
            <select class="field-input" id="ach-emp-select">${empOptions}</select>
          </label>
          <label class="assign-field title">ผลงาน / ความสำเร็จ
            <input class="field-input" id="ach-title-input" value="${escapeHtml(form.title)}" placeholder="เช่น ได้รับคำชมเชยจากหัวหน้างาน, ลดของเสียได้ 5%">
          </label>
          <label class="assign-field due">วันที่
            <input type="date" class="field-input" id="ach-date-input" value="${escapeHtml(form.date)}">
          </label>
          <button class="btn-gradient" data-action="add-achievement">${icons.plus} บันทึก</button>
        </div>
        <label class="field-label" style="display:block;margin-top:14px">รายละเอียดเพิ่มเติม (ถ้ามี)
          <input class="field-input" id="ach-note-input" value="${escapeHtml(form.note)}" placeholder="รายละเอียดเพิ่มเติม" style="margin-top:6px">
        </label>
      </div>

      <div class="card" style="padding:0;overflow:hidden;margin-top:18px">
        <div class="achievement-row achievement-head">
          <div>วันที่</div><div>พนักงาน</div><div>ผลงาน</div><div></div>
        </div>
        ${rows || `<div class="task-empty" style="margin:16px">ยังไม่มีบันทึกผลงาน</div>`}
      </div>
    </div>
  `;
}
