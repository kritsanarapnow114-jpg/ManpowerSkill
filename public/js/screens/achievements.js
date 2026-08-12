import { avatarBg, initials, escapeHtml, FREQUENCY_LABELS } from "../format.js";
import { icons } from "../icons.js";

// Resolves an achievement's linked axis to its display label, if any - needs the owning
// employee's position since axis meaning (and even which axes exist) differs by position.
function axisLabel(meta, position, axisGroup, axisIndex) {
  if (!axisGroup || axisIndex === null || axisIndex === undefined) return null;
  const byPosition = axisGroup === "g1" ? meta.g1AxesByPosition : meta.g2AxesByPosition;
  const axes = byPosition[position] || byPosition[meta.defaultPosition];
  const axis = axes[axisIndex];
  if (!axis) return null;
  return `${axisGroup === "g1" ? "Advance" : "Skill"} · ${axis.en}`;
}

export function renderAchievements({ employees, achievements, form, meta, recurringAchievements = [] }) {
  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));

  const empOptions = employees
    .map((e) => `<option value="${escapeHtml(e.id)}" ${form.employeeId === e.id ? "selected" : ""}>${escapeHtml(e.empCode + " · " + e.nameEn)}</option>`)
    .join("");

  const selectedEmp = empById[form.employeeId];
  const axisG1 = selectedEmp ? (meta.g1AxesByPosition[selectedEmp.position] || meta.g1AxesByPosition[meta.defaultPosition]) : null;
  const axisG2 = selectedEmp ? (meta.g2AxesByPosition[selectedEmp.position] || meta.g2AxesByPosition[meta.defaultPosition]) : null;
  const axisOptions = [`<option value="">ไม่เกี่ยวข้องกับทักษะ (ทั่วไป)</option>`]
    .concat(axisG1 ? axisG1.map((a, i) => `<option value="g1:${i}" ${form.axisGroup === "g1" && form.axisIndex === i ? "selected" : ""}>Advance · ${escapeHtml(a.en)}</option>`) : [])
    .concat(axisG2 ? axisG2.map((a, i) => `<option value="g2:${i}" ${form.axisGroup === "g2" && form.axisIndex === i ? "selected" : ""}>Skill · ${escapeHtml(a.en)}</option>`) : [])
    .join("");

  const rows = achievements.map((a) => {
    const emp = empById[a.employeeId];
    const tag = emp ? axisLabel(meta, emp.position, a.axisGroup, a.axisIndex) : null;
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
          ${tag ? `<div class="achievement-axis-tag">${escapeHtml(tag)}</div>` : ""}
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
        <div class="assign-row" style="margin-top:14px">
          <label class="assign-field due" style="flex:1">ทักษะที่เกี่ยวข้อง (ถ้ามี)
            <select class="field-input" id="ach-axis-select">${axisOptions}</select>
          </label>
          <label class="assign-field due" style="flex:1">ทำซ้ำ
            <select class="field-input" id="ach-frequency-select">
              <option value="" ${!form.frequency ? "selected" : ""}>ครั้งเดียว</option>
              <option value="daily" ${form.frequency === "daily" ? "selected" : ""}>รายวัน</option>
              <option value="weekly" ${form.frequency === "weekly" ? "selected" : ""}>รายสัปดาห์</option>
              <option value="monthly" ${form.frequency === "monthly" ? "selected" : ""}>รายเดือน</option>
            </select>
          </label>
          <label class="field-label" style="flex:2">รายละเอียดเพิ่มเติม (ถ้ามี)
            <input class="field-input" id="ach-note-input" value="${escapeHtml(form.note)}" placeholder="รายละเอียดเพิ่มเติม" style="margin-top:6px">
          </label>
        </div>
      </div>

      ${recurringAchievements.length ? `
        <div class="card" style="padding:16px 20px">
          <div class="section-title" style="margin-bottom:12px">ผลงานประจำที่ตั้งไว้ <small>· Recurring achievements</small></div>
          <div class="recurring-list">
            ${recurringAchievements.map((r) => {
              const emp = empById[r.employeeId];
              const tag = emp ? axisLabel(meta, emp.position, r.axisGroup, r.axisIndex) : null;
              return `
                <div class="recurring-row">
                  <span class="recurring-freq-badge">${escapeHtml(FREQUENCY_LABELS[r.frequency] || r.frequency)}</span>
                  <div class="recurring-row-body">
                    <div class="recurring-row-title">${escapeHtml(r.title)}</div>
                    <div class="recurring-row-meta">${escapeHtml(emp ? (emp.nickname || emp.nameEn) : r.employeeId)}${tag ? " · " + escapeHtml(tag) : ""}</div>
                  </div>
                  <button class="btn-icon" title="ยกเลิกผลงานประจำ" data-action="delete-recurring-achievement" data-id="${escapeHtml(r.id)}">${icons.trash}</button>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      ` : ""}

      <div class="card" style="padding:0;overflow:hidden;margin-top:18px">
        <div class="achievement-row achievement-head">
          <div>วันที่</div><div>พนักงาน</div><div>ผลงาน</div><div></div>
        </div>
        ${rows || `<div class="task-empty" style="margin:16px">ยังไม่มีบันทึกผลงาน</div>`}
      </div>
    </div>
  `;
}
