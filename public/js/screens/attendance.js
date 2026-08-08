import { avatarBg, initials, attendanceColor, escapeHtml } from "../format.js";
import { icons } from "../icons.js";

const LEAVE_TYPES = ["ลาป่วย", "ลากิจ", "ลาพักร้อน"];
const LEAVE_LABELS = { vacation: "ลาพักร้อน", sick: "ลาป่วย", personal: "ลากิจ" };

export function renderAttendance({ employees, records, form }) {
  const total = records.length;
  const absentCount = records.filter((r) => r.type === "ขาด").length;
  const lateCount = records.filter((r) => r.type === "มาสาย").length;
  const leaveCount = records.filter((r) => LEAVE_TYPES.includes(r.type)).length;

  const empOptions = employees
    .map((e) => `<option value="${escapeHtml(e.id)}" ${form.employeeId === e.id ? "selected" : ""}>${escapeHtml(e.empCode + " · " + e.nameEn)}</option>`)
    .join("");

  const typeOptions = LEAVE_TYPES.concat(["ขาด", "มาสาย"])
    .map((t) => `<option value="${escapeHtml(t)}" ${form.type === t ? "selected" : ""}>${escapeHtml(t)}</option>`)
    .join("");

  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));

  const selectedEmp = empById[form.employeeId] || employees[0] || null;
  const balanceHtml = selectedEmp
    ? Object.entries(LEAVE_LABELS).map(([key, label]) => {
        const { quota, used } = selectedEmp.leave[key];
        const remain = quota - used;
        const color = remain <= 0 ? "#dc2626" : remain <= Math.max(1, Math.round(quota * 0.2)) ? "#e0902e" : "#16a34a";
        return `<span class="attendance-balance-chip">${escapeHtml(label)} <b style="color:${color}">${remain <= 0 ? 0 : remain}</b>/${quota}</span>`;
      }).join("")
    : "";

  const rows = records.map((r) => {
    const emp = empById[r.employeeId];
    const color = attendanceColor(r.type);
    return `
      <div class="attendance-row">
        <div class="attendance-date">${escapeHtml(r.date)}</div>
        <div class="attendance-emp">
          <div class="avatar-sm" style="background:${emp ? avatarBg(emp.level) : "#8494a1"}">${escapeHtml(emp ? initials(emp.nameEn) : "?")}</div>
          <div style="min-width:0">
            <div class="list-name-en">${escapeHtml(emp ? emp.nameEn : r.employeeId)}</div>
            <div class="list-name-th">${escapeHtml(emp ? emp.name : "")}</div>
          </div>
        </div>
        <div><span class="attendance-badge" style="background:${color}1a;color:${color}">${escapeHtml(r.type)}</span></div>
        <div class="attendance-note">${escapeHtml(r.note || "—")}</div>
        <button class="btn-icon" title="ลบรายการ" data-action="delete-attendance" data-id="${escapeHtml(r.id)}">${icons.trash}</button>
      </div>
    `;
  }).join("");

  return `
    <div>
      <div class="task-kpi-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#5a6a78"></div>
          <div class="kpi-label">รายการทั้งหมด · Total</div>
          <div class="kpi-value">${total}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#dc2626"></div>
          <div class="kpi-label">ขาดงาน · Absent</div>
          <div class="kpi-value" style="color:#dc2626">${absentCount}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#d99a17"></div>
          <div class="kpi-label">มาสาย · Late</div>
          <div class="kpi-value" style="color:#d99a17">${lateCount}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#7c4dbc"></div>
          <div class="kpi-label">ลา (รวม) · Leave</div>
          <div class="kpi-value" style="color:#7c4dbc">${leaveCount}</div>
        </div>
      </div>

      <div class="card" style="padding:18px 22px">
        <div class="section-title" style="margin-bottom:12px">บันทึกรายการใหม่ <small>· New record</small></div>
        <div class="assign-row">
          <label class="assign-field employee">พนักงาน
            <select class="field-input" id="att-emp-select">${empOptions}</select>
          </label>
          <label class="assign-field due">ประเภท
            <select class="field-input" id="att-type-select">${typeOptions}</select>
          </label>
          <label class="assign-field due">วันที่
            <input type="date" class="field-input" id="att-date-input" value="${escapeHtml(form.date)}">
          </label>
          <label class="assign-field title">หมายเหตุ
            <input class="field-input" id="att-note-input" value="${escapeHtml(form.note)}" placeholder="เช่น ใบรับรองแพทย์แนบแล้ว">
          </label>
          <button class="btn-gradient" data-action="add-attendance">${icons.plus} บันทึก</button>
        </div>
        ${selectedEmp ? `<div class="attendance-balance-row">คงเหลือของ ${escapeHtml(selectedEmp.nameEn)}: ${balanceHtml}</div>` : ""}
      </div>

      <div class="card" style="padding:0;overflow:hidden;margin-top:18px">
        <div class="attendance-row attendance-head">
          <div>วันที่</div><div>พนักงาน</div><div>ประเภท</div><div>หมายเหตุ</div><div></div>
        </div>
        ${rows || `<div class="task-empty" style="margin:16px">ยังไม่มีรายการ</div>`}
      </div>
    </div>
  `;
}
