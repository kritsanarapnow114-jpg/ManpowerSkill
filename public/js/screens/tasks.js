import { avatarBg, initials, taskColor, taskLevelColor, taskPct, isTaskOverdue, escapeHtml } from "../format.js";
import { icons } from "../icons.js";

export function renderEmpSuggestionItems(employees, query, excludeIds) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return "";
  const excluded = new Set(excludeIds);
  const matches = employees.filter((e) => !excluded.has(e.id) && (
    e.nameEn.toLowerCase().includes(q) ||
    e.name.toLowerCase().includes(q) ||
    (e.nickname || "").toLowerCase().includes(q) ||
    e.empCode.toLowerCase().includes(q)
  )).slice(0, 8);
  if (!matches.length) return `<div class="task-emp-suggest-empty">ไม่พบพนักงาน</div>`;
  return matches.map((e) => `
    <div class="task-emp-suggest-item" data-action="pick-task-emp" data-id="${escapeHtml(e.id)}">
      <div class="avatar-sm" style="background:${avatarBg(e.level)}">${escapeHtml(initials(e.nameEn))}</div>
      <div style="min-width:0">
        <div class="list-name-en">${escapeHtml(e.empCode)} · ${escapeHtml(e.nameEn)}${e.nickname ? ` (${escapeHtml(e.nickname)})` : ""}</div>
        <div class="list-name-th">${escapeHtml(e.name)}</div>
      </div>
    </div>
  `).join("");
}

export function renderTasks({ employees, tasks, taskForm, meta, showEnglish }) {
  const tkAll = tasks.length;
  const tkDone = tasks.filter((t) => t.done).length;
  const tkOverdue = tasks.filter((t) => isTaskOverdue(t.due, t.done)).length;
  const totalWorkload = employees.reduce((s, e) => s + e.workload, 0);

  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const tags = taskForm.employeeIds.map((id) => {
    const e = empById[id];
    if (!e) return "";
    return `<span class="task-emp-tag">${escapeHtml(e.nickname || (showEnglish ? e.nameEn : e.name))}<button type="button" data-action="unpick-task-emp" data-id="${escapeHtml(id)}">&times;</button></span>`;
  }).join("");

  const levelButtons = meta.taskLevels.map((l) => {
    const active = taskForm.level === l;
    const color = taskLevelColor(l);
    const style = active ? `border-color:${color};background:${color};color:#fff` : `border-color:#dbe3e9;background:#f5f8fa;color:#5a6a78`;
    return `<button class="level-btn${active ? " active" : ""}" style="${style}" data-action="set-task-level" data-level="${escapeHtml(l)}">${escapeHtml(l)}</button>`;
  }).join("");

  const axisOptions = [`<option value="">ไม่เกี่ยวข้องกับทักษะ</option>`]
    .concat(meta.g1Axes.map((a, i) => `<option value="g1:${i}" ${taskForm.axisGroup === "g1" && taskForm.axisIndex === i ? "selected" : ""}>Advance · ${escapeHtml(a.en)}</option>`))
    .concat(meta.g2Axes.map((a, i) => `<option value="g2:${i}" ${taskForm.axisGroup === "g2" && taskForm.axisIndex === i ? "selected" : ""}>Skill · ${escapeHtml(a.en)}</option>`))
    .join("");

  const workloadSummary = employees.map((e) => {
    const pct = taskPct(e.tasks);
    return `
      <div class="workload-chip">
        <div class="avatar-sm" style="background:${avatarBg(e.level)}">${escapeHtml(initials(e.nameEn))}</div>
        <div class="workload-chip-info">
          <div class="workload-chip-name">${escapeHtml(e.nickname || e.nameEn)}</div>
          <div class="workload-chip-meta">
            Workload <b style="color:${e.workload >= 6 ? "#dc2626" : e.workload >= 3 ? "#e0902e" : "#16a34a"}">${e.workload}</b>
            · เสร็จ <b style="color:${taskColor(pct)}">${pct}%</b>
          </div>
        </div>
      </div>
    `;
  }).join("");

  const activeTasks = tasks.filter((t) => !t.done);
  const historyTasks = tasks.filter((t) => t.done);

  const taskCards = activeTasks.map((t) => {
    const overdue = isTaskOverdue(t.due, t.done);
    const names = t.assignees.map((a) => a.nickname || a.nameEn).join(", ");
    const avatars = t.assignees.map((a) => `<div class="avatar-sm" title="${escapeHtml(a.nameEn)}" style="background:${avatarBg(a.level)}">${escapeHtml(initials(a.nameEn))}</div>`).join("");
    return `
      <div class="task-card">
        <div class="task-card-body">
          <div class="task-card-title">${escapeHtml(t.title)}</div>
          <div class="task-card-due" style="${overdue ? "color:#dc2626;font-weight:700" : ""}">${t.due ? "กำหนดส่ง " + escapeHtml(t.due) : "ไม่มีกำหนด"}</div>
          <div class="task-card-assignees">
            <div class="avatar-stack">${avatars}</div>
            <span>${t.assignees.length} คน · ${escapeHtml(names)}</span>
          </div>
        </div>
        <span class="task-level-badge" style="background:${taskLevelColor(t.level)}1a;color:${taskLevelColor(t.level)}">${escapeHtml(t.level)}</span>
        ${overdue ? `<span class="task-badge" style="color:#b42318;background:#fde8e8">เลยกำหนด</span>` : ""}
        <button class="btn-complete" data-action="complete-task" data-task-id="${escapeHtml(t.id)}">${icons.check || ""} เสร็จสิ้น</button>
        <button class="btn-icon" title="ลบงาน" data-action="delete-task" data-task-id="${escapeHtml(t.id)}">${icons.trash}</button>
      </div>
    `;
  }).join("");

  const historyCards = historyTasks.map((t) => {
    const names = t.assignees.map((a) => a.nickname || a.nameEn).join(", ");
    const avatars = t.assignees.map((a) => `<div class="avatar-sm" title="${escapeHtml(a.nameEn)}" style="background:${avatarBg(a.level)}">${escapeHtml(initials(a.nameEn))}</div>`).join("");
    return `
      <div class="task-card task-card-done">
        <div class="task-card-body">
          <div class="task-card-title">${escapeHtml(t.title)}</div>
          <div class="task-card-due">${t.due ? "กำหนดส่ง " + escapeHtml(t.due) : "ไม่มีกำหนด"}</div>
          <div class="task-card-assignees">
            <div class="avatar-stack">${avatars}</div>
            <span>${t.assignees.length} คน · ${escapeHtml(names)}</span>
          </div>
        </div>
        <span class="task-level-badge" style="background:${taskLevelColor(t.level)}1a;color:${taskLevelColor(t.level)}">${escapeHtml(t.level)}</span>
        <span class="task-badge" style="color:#0f7a34;background:#dcfce7">เสร็จแล้ว</span>
        <button class="btn-ghost-sm" data-action="reopen-task" data-task-id="${escapeHtml(t.id)}">ย้อนกลับ</button>
        <button class="btn-icon" title="ลบงาน" data-action="delete-task" data-task-id="${escapeHtml(t.id)}">${icons.trash}</button>
      </div>
    `;
  }).join("");

  return `
    <div>
      <div class="task-kpi-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#0c7f93"></div>
          <div class="kpi-label">งานทั้งหมด · Total tasks</div>
          <div class="kpi-value">${tkAll}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#16a34a"></div>
          <div class="kpi-label">เสร็จแล้ว · Completed</div>
          <div class="kpi-value" style="color:#16a34a">${tkDone}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#dc2626"></div>
          <div class="kpi-label">เลยกำหนด · Overdue</div>
          <div class="kpi-value" style="color:#dc2626">${tkOverdue}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#7c4dbc"></div>
          <div class="kpi-label">Workload รวมทีม · Team workload</div>
          <div class="kpi-value" style="color:#7c4dbc">${totalWorkload}</div>
        </div>
      </div>

      <div class="card" style="padding:18px 22px">
        <div class="section-title" style="margin-bottom:12px">มอบหมายงานใหม่ <small>· Assign a task</small></div>
        <div class="assign-row">
          <label class="assign-field title">ชื่องาน / เป้าหมาย
            <input class="field-input" id="task-title-input" value="${escapeHtml(taskForm.title)}" placeholder="เช่น อบรมสถานี Torque, ประกอบ 50 ชิ้น/วัน">
          </label>
          <label class="assign-field due">กำหนดส่ง
            <input type="date" class="field-input" id="task-due-input" value="${escapeHtml(taskForm.due)}">
          </label>
          <label class="assign-field due">ทักษะที่เกี่ยวข้อง (ถ้ามี)
            <select class="field-input" id="task-axis-select">${axisOptions}</select>
          </label>
          <button class="btn-gradient" data-action="add-task">${icons.plus} มอบหมาย</button>
        </div>
        <div class="task-assign-second-row">
          <div>
            <div class="field-label" style="margin-bottom:8px">ระดับความยาก</div>
            <div class="level-select-row">${levelButtons}</div>
          </div>
          <div style="flex:1;min-width:260px">
            <div class="field-label" style="margin-bottom:8px">มอบหมายให้ (พิมพ์ชื่อ/ชื่อเล่น/รหัสเพื่อค้นหา)</div>
            <div class="task-emp-picker">
              <input type="text" class="field-input" id="task-emp-search" autocomplete="off" placeholder="พิมพ์เพื่อค้นหาพนักงาน..." value="${escapeHtml(taskForm.empSearch || "")}">
              <div class="task-emp-suggest-list" id="task-emp-suggestions">${renderEmpSuggestionItems(employees, taskForm.empSearch, taskForm.employeeIds)}</div>
            </div>
            ${tags ? `<div class="task-emp-tags">${tags}</div>` : ""}
          </div>
        </div>
      </div>

      <div class="card" style="padding:16px 20px">
        <div class="section-title" style="margin-bottom:12px">Workload รายคน <small>· Per-employee workload</small></div>
        <div class="workload-chip-grid">${workloadSummary}</div>
      </div>

      <div class="task-card-list">${taskCards || `<div class="task-empty" style="margin-top:16px">ยังไม่มีงานที่ต้องทำ</div>`}</div>

      ${historyTasks.length ? `
        <div class="section-title" style="margin:22px 0 10px">ประวัติงานที่เสร็จแล้ว <small>· History</small></div>
        <div class="task-card-list task-history-list">${historyCards}</div>
      ` : ""}
    </div>
  `;
}
