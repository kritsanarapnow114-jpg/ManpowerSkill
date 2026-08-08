import { avatarBg, initials, taskColor, taskBadge, taskPct, escapeHtml } from "../format.js";
import { icons } from "../icons.js";

export function renderTasks({ employees, taskForm, showEnglish }) {
  let tkAll = 0, tkDone = 0, tkSum = 0, tkN = 0;
  employees.forEach((e) => e.tasks.forEach((t) => {
    tkAll++; tkSum += t.progress; tkN++;
    if (t.progress >= 100) tkDone++;
  }));
  const tkAvg = tkN ? Math.round(tkSum / tkN) : 0;

  const empOptions = employees.map((e) => `<option value="${escapeHtml(e.id)}" ${taskForm.employeeId === e.id ? "selected" : ""}>${escapeHtml(e.empCode + " · " + (showEnglish ? e.nameEn : e.name))}</option>`).join("");

  const groups = employees.map((e) => {
    const pct = taskPct(e.tasks);
    const pctColor = taskColor(pct);
    const rows = e.tasks.map((t) => {
      const color = taskColor(t.progress);
      const badge = taskBadge(t.progress);
      const badgeBg = t.progress >= 100 ? "#dcfce7" : "#f1f5f8";
      const badgeColor = t.progress >= 100 ? "#0f7a34" : color;
      return `
        <div class="task-row">
          <div class="task-row-info">
            <div class="task-row-title">${escapeHtml(t.title)}</div>
            <div class="task-row-due">${t.due ? "กำหนดส่ง " + escapeHtml(t.due) : "ไม่มีกำหนด"}</div>
          </div>
          <input type="range" min="0" max="100" value="${t.progress}" data-task-slider data-task-id="${escapeHtml(t.id)}" data-emp-id="${escapeHtml(e.id)}">
          <span class="task-row-value" id="task-val-${escapeHtml(t.id)}" style="color:${color}">${t.progress}%</span>
          <span class="task-badge" id="task-badge-${escapeHtml(t.id)}" style="color:${badgeColor};background:${badgeBg}">${badge}</span>
          <button class="btn-icon" title="ลบงาน" data-action="delete-task" data-task-id="${escapeHtml(t.id)}" data-emp-id="${escapeHtml(e.id)}">${icons.trash}</button>
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
            <div class="lbl">ผลงานเฉลี่ย</div>
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
          <div class="kpi-label">งานทั้งหมด · Total tasks</div>
          <div class="kpi-value">${tkAll}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#16a34a"></div>
          <div class="kpi-label">เสร็จแล้ว · Completed</div>
          <div class="kpi-value" style="color:#16a34a">${tkDone}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#7c4dbc"></div>
          <div class="kpi-label">ความคืบหน้ารวม · Avg progress</div>
          <div class="kpi-value" style="color:#7c4dbc">${tkAvg}%</div>
        </div>
      </div>

      <div class="card" style="padding:18px 22px">
        <div class="section-title" style="margin-bottom:12px">มอบหมายงานใหม่ <small>· Assign a task</small></div>
        <div class="assign-row">
          <label class="assign-field employee">พนักงาน
            <select class="field-input" id="task-emp-select">${empOptions}</select>
          </label>
          <label class="assign-field title">ชื่องาน / เป้าหมาย
            <input class="field-input" id="task-title-input" value="${escapeHtml(taskForm.title)}" placeholder="เช่น อบรมสถานี Torque, ประกอบ 50 ชิ้น/วัน">
          </label>
          <label class="assign-field due">กำหนดส่ง
            <input class="field-input" id="task-due-input" value="${escapeHtml(taskForm.due)}" placeholder="15 ส.ค.">
          </label>
          <button class="btn-gradient" data-action="add-task">${icons.plus} มอบหมาย</button>
        </div>
      </div>

      <div class="task-groups">${groups}</div>
    </div>
  `;
}
