import { escapeHtml } from "../format.js";
import { icons } from "../icons.js";

const ROLE_LABELS = { admin: "ผู้ดูแลระบบ", shift_leader: "หัวหน้ากะ (Shift leader)", employee: "พนักงาน" };
const ROLE_COLORS = {
  shift_leader: "border-color:#0c7f93;background:#0c7f93;color:#fff",
  admin: "border-color:#7c4dbc;background:#7c4dbc;color:#fff",
  employee: "border-color:#16a34a;background:#16a34a;color:#fff",
};
const ROLE_IDLE = "border-color:#dbe3e9;background:#f5f8fa;color:#5a6a78";

export function renderUsers({ users, lines, employees, userForm, lineForm }) {
  const lineById = Object.fromEntries(lines.map((l) => [l.id, l]));
  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const isEditing = !!userForm.editingId;

  const lineOptions = lines
    .map((l) => `<option value="${escapeHtml(l.id)}" ${userForm.lineId === l.id ? "selected" : ""}>${escapeHtml(l.name)}</option>`)
    .join("");
  const empOptions = employees
    .map((e) => `<option value="${escapeHtml(e.id)}" ${userForm.employeeId === e.id ? "selected" : ""}>${escapeHtml(e.empCode + " · " + e.nameEn)}</option>`)
    .join("");

  const rows = users.map((u) => {
    const scopeLabel = u.role === "employee"
      ? (empById[u.employeeId] ? empById[u.employeeId].nameEn : u.employeeId || "—")
      : u.lineId ? escapeHtml((lineById[u.lineId] && lineById[u.lineId].name) || u.lineId) : "—";
    return `
    <div class="user-manage-row">
      <div>
        <div class="user-manage-name">${escapeHtml(u.displayName || u.username)}</div>
        <div class="user-manage-username">@${escapeHtml(u.username)}</div>
      </div>
      <div><span class="user-role-badge user-role-${escapeHtml(u.role)}">${escapeHtml(ROLE_LABELS[u.role] || u.role)}</span></div>
      <div>${scopeLabel}</div>
      <div class="user-manage-actions">
        <button class="btn-edit-row" data-action="edit-user" data-id="${escapeHtml(u.id)}">แก้ไข</button>
        <button class="btn-icon" title="ลบบัญชี" data-action="delete-user" data-id="${escapeHtml(u.id)}">${icons.trash}</button>
      </div>
    </div>
  `;
  }).join("");

  const roleButtons = ["shift_leader", "employee", "admin"].map((r) => `
    <button class="level-btn${userForm.role === r ? " active" : ""}" style="${userForm.role === r ? ROLE_COLORS[r] : ROLE_IDLE}" data-action="set-user-role" data-role="${r}">${escapeHtml(ROLE_LABELS[r])}</button>
  `).join("");

  return `
    <div>
      <div class="card" style="padding:18px 22px">
        <div class="section-title" style="margin-bottom:12px">${isEditing ? "แก้ไขบัญชี" : "เพิ่มบัญชีใหม่"} <small>· ${isEditing ? "Edit account" : "New account"}</small></div>
        <div class="assign-row">
          <label class="assign-field due">ชื่อผู้ใช้ (username)
            <input class="field-input" id="user-username-input" value="${escapeHtml(userForm.username)}" placeholder="เช่น leaderB" ${isEditing ? "disabled" : ""}>
          </label>
          <label class="assign-field title">ชื่อที่แสดง
            <input class="field-input" id="user-displayname-input" value="${escapeHtml(userForm.displayName)}" placeholder="เช่น หัวหน้า Line B">
          </label>
          <label class="assign-field due">รหัสผ่าน${isEditing ? " (เว้นว่างถ้าไม่เปลี่ยน)" : ""}
            <input type="password" class="field-input" id="user-password-input" value="${escapeHtml(userForm.password)}" placeholder="อย่างน้อย 6 ตัวอักษร">
          </label>
        </div>
        <div class="task-assign-second-row">
          <div>
            <div class="field-label" style="margin-bottom:8px">บทบาท</div>
            <div class="level-select-row">${roleButtons}</div>
          </div>
          ${userForm.role === "shift_leader" ? `
            <div style="flex:1;min-width:200px">
              <div class="field-label" style="margin-bottom:8px">สายที่รับผิดชอบ</div>
              <select class="field-input" id="user-line-select">${lineOptions}</select>
            </div>
          ` : ""}
          ${userForm.role === "employee" ? `
            <div style="flex:1;min-width:220px">
              <div class="field-label" style="margin-bottom:8px">ผูกกับพนักงาน</div>
              <select class="field-input" id="user-employee-select">${empOptions}</select>
            </div>
          ` : ""}
          <button class="btn-gradient" data-action="save-user">${icons.plus} ${isEditing ? "บันทึก" : "เพิ่มบัญชี"}</button>
          ${isEditing ? `<button class="btn-outline" data-action="cancel-user-edit">ยกเลิก</button>` : ""}
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden;margin-top:18px">
        <div class="user-manage-row user-manage-head">
          <div>บัญชี</div><div>บทบาท</div><div>สาย / พนักงาน</div><div></div>
        </div>
        ${rows || `<div class="task-empty" style="margin:16px">ยังไม่มีบัญชี</div>`}
      </div>

      <div class="card" style="padding:18px 22px;margin-top:18px">
        <div class="section-title" style="margin-bottom:12px">เพิ่มสายการผลิต <small>· Add line</small></div>
        <div class="assign-row">
          <label class="assign-field title">ชื่อสาย
            <input class="field-input" id="line-name-input" value="${escapeHtml(lineForm.name)}" placeholder="เช่น Line B">
          </label>
          <button class="btn-gradient" data-action="add-line">${icons.plus} เพิ่มสาย</button>
        </div>
        <div class="line-chip-row">${lines.map((l) => `<span class="line-chip">${escapeHtml(l.name)}</span>`).join("")}</div>
      </div>
    </div>
  `;
}
