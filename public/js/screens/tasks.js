import { avatarBg, initials, taskColor, taskLevelColor, taskPct, escapeHtml } from "../format.js";
import { icons } from "../icons.js";

export function renderTasks({ employees, taskForm, meta, showEnglish }) {
  let tkAll = 0, tkDone = 0;
  employees.forEach((e) => e.tasks.forEach((t) => {
    tkAll++;
    if (t.done) tkDone++;
  }));
  const totalWorkload = employees.reduce((s, e) => s + e.workload, 0);

  const empCheckboxes = employees.map((e) => `
    <label class="task-emp-check">
      <input type="checkbox" data-task-emp-check value="${escapeHtml(e.id)}" ${taskForm.employeeIds.includes(e.id) ? "checked" : ""}>
      <span>${escapeHtml(e.empCode + " · " + (showEnglish ? e.nameEn : e.name))}</span>
    </label>
  `).join("");

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

  const groups = employees.map((e) => {
    const pct = taskPct(e.tasks);
    const pctColor = taskColor(pct);
    const rows = e.tasks.map((t) => {
      const withOthers = t.otherAssignees.length ? ` <span class="task-row-shared">(ร่วมกับ ${escapeHtml(t.otherAssignees.join(", "))})</span>` : "";
      return `
        <div class="task-row">
          <label class="task-row-check">
            <input type="checkbox" ${t.done ? "checked" : ""} data-toggle-done data-assignment-id="${escapeHtml(t.assignmentId)}">
          </label>
          <div class="task-row-info">
            <div class="task-row-title">${escapeHtml(t.title)}${withOthers}</div>
            <div class="task-row-due">${t.due ? "กำหนดส่ง " + escapeHtml(t.due) : "ไม่มีกำหนด"}</div>
          </div>
          <span class="task-level-badge" style="background:${taskLevelColor(t.level)}1a;color:${taskLevelColor(t.level)}">${escapeHtml(t.level)}</span>
          <span class="task-badge" style="color:${t.done ? "#0f7a34" : "#5a6a78"};background:${t.done ? "#dcfce7" : "#f1f5f8"}">${t.done ? "เสร็จ" : "ยังไม่เสร็จ"}</span>
          <button class="btn-icon" title="ลบงาน" data-action="delete-task" data-assignment-id="${escapeHtml(t.assignmentId)}">${icons.trash}</button>
        </div>
      `;
    }).join("");

    return `
      <div class="card" style="padding:18px 22px">
        <div class="task-group-head">
          <div class="avatar-md" style="background:${avatarBg(e.level)}">${escapeHtml(initials(e.nameEn))}</div>
          <div class="task-group-info">
            <div class="task-group-name">${escapeHtml(e.nameEn)}</div>
            <div class="task-group-sub">${escapeHtml(e.name)} · ${escapeHtml(e.position)}</div>
          </div>
          <div class="task-group-pct-label">
            <div class="lbl">Workload</div>
            <div class="val" style="color:${e.workload >= 6 ? "#dc2626" : e.workload >= 3 ? "#e0902e" : "#16a34a"}">${e.workload}</div>
          </div>
          <div class="task-group-pct-label">
            <div class="lbl">เสร็จแล้ว</div>
            <div class="val" style="color:${pctColor}">${pct}%</div>
          </div>
        </div>
        ${e.tasks.length
          ? `<div class="task-list">${rows}</div>`
          : `<div class="task-empty">ยังไม่มีงานที่มอบหมาย</div>`}
      </div>
    `;
  }).join("");

  return `
    <div>
      <div class="task-kpi-row">
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#0c7f93"></div>
          <div class="kpi-label">งานทั้งหมด · Total assignments</div>
          <div class="kpi-value">${tkAll}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#16a34a"></div>
          <div class="kpi-label">เสร็จแล้ว · Completed</div>
          <div class="kpi-value" style="color:#16a34a">${tkDone}</div>
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
            <input class="field-input" id="task-due-input" value="${escapeHtml(taskForm.due)}" placeholder="15 ส.ค.">
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
          <div>
            <div class="field-label" style="margin-bottom:8px">มอบหมายให้ (เลือกได้หลายคน)</div>
            <div class="task-emp-check-list">${empCheckboxes}</div>
          </div>
        </div>
      </div>

      <div class="task-groups">${groups}</div>
    </div>
  `;
}
