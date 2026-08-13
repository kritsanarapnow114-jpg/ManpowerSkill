import { taskLevelColor, isTaskOverdue, escapeHtml } from "../format.js";
import { icons } from "../icons.js";

export function renderMyTasks({ tasks }) {
  const cards = tasks.map((t) => {
    const overdue = isTaskOverdue(t.due, t.done);
    return `
      <div class="task-card${t.done ? " task-card-done" : ""}">
        <div class="task-card-body">
          <div class="task-card-title">${escapeHtml(t.title)}</div>
          ${t.description ? `<div class="task-card-description">${escapeHtml(t.description)}</div>` : ""}
          <div class="task-card-due" style="${overdue ? "color:#dc2626;font-weight:700" : ""}">${t.due ? "กำหนดส่ง " + escapeHtml(t.due) : "ไม่มีกำหนด"}</div>
          ${t.otherAssignees && t.otherAssignees.length ? `<div class="task-card-assignees"><span>ร่วมกับ ${escapeHtml(t.otherAssignees.join(", "))}</span></div>` : ""}
          ${t.assignedBy ? `<div class="task-card-assigner">มอบหมายโดย ${escapeHtml(t.assignedBy.name)}</div>` : ""}
        </div>
        <span class="task-level-badge" style="background:${taskLevelColor(t.level)}1a;color:${taskLevelColor(t.level)}">${escapeHtml(t.level)}</span>
        ${overdue ? `<span class="task-badge" style="color:#b42318;background:#fde8e8">เลยกำหนด</span>` : ""}
        ${t.done
          ? `<span class="task-badge" style="color:#0f7a34;background:#dcfce7">เสร็จแล้ว</span><button class="btn-ghost-sm" data-action="my-reopen-task" data-task-id="${escapeHtml(t.id)}">ย้อนกลับ</button>`
          : `<button class="btn-complete" data-action="my-complete-task" data-task-id="${escapeHtml(t.id)}">${icons.check} เสร็จสิ้น</button>`}
      </div>
    `;
  }).join("");

  return `<div><div class="task-card-list">${cards || `<div class="task-empty" style="margin-top:16px">ยังไม่มีงานที่ได้รับมอบหมาย</div>`}</div></div>`;
}

export function renderMyWorkLog({ stations, logs, form, hazardTypes = [] }) {
  const hazardEmojiByKey = Object.fromEntries(hazardTypes.map((h) => [h.key, h.emoji]));
  const stnOptions = stations.map((s) => {
    const emojis = (s.hazards || []).map((k) => hazardEmojiByKey[k]).filter(Boolean).join("");
    return `<option value="${escapeHtml(s.id)}" ${form.stationId === s.id ? "selected" : ""}>${emojis ? emojis + " " : ""}${escapeHtml(s.name)}</option>`;
  }).join("");
  const totalHours = logs.reduce((s, l) => s + l.hours, 0);
  const stnById = Object.fromEntries(stations.map((s) => [s.id, s]));

  const rows = logs.map((l) => {
    const stn = stnById[l.stationId];
    return `
      <div class="worklog-row" style="grid-template-columns:110px 1fr 70px 1fr 44px">
        <div class="attendance-date">${escapeHtml(l.date)}</div>
        <div>${escapeHtml(stn ? stn.name : l.stationId)}</div>
        <div><b>${l.hours}</b> ชม.</div>
        <div class="attendance-note">${escapeHtml(l.note || "—")}</div>
        <button class="btn-icon" title="ลบรายการ" data-action="my-delete-worklog" data-id="${escapeHtml(l.id)}">${icons.trash}</button>
      </div>
    `;
  }).join("");

  return `
    <div>
      <div class="task-kpi-row" style="grid-template-columns:repeat(2,1fr)">
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#7c4dbc"></div>
          <div class="kpi-label">รายการทั้งหมด · Total logs</div>
          <div class="kpi-value" style="color:#7c4dbc">${logs.length}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#e0902e"></div>
          <div class="kpi-label">ชั่วโมงสะสมทั้งหมด · Total hours</div>
          <div class="kpi-value" style="color:#e0902e">${totalHours}</div>
        </div>
      </div>

      <div class="card" style="padding:18px 22px">
        <div class="section-title" style="margin-bottom:12px">บันทึกการทำงานของฉัน <small>· Log my work hours</small></div>
        <div class="assign-row">
          <label class="assign-field due">สถานี / เครื่องจักร
            <select class="field-input" id="my-wl-station-select">${stnOptions}</select>
          </label>
          <label class="assign-field due">วันที่
            <input type="date" class="field-input" id="my-wl-date-input" value="${escapeHtml(form.date)}">
          </label>
          <label class="assign-field due">ชั่วโมง
            <input type="number" min="0" max="24" step="0.5" class="field-input" id="my-wl-hours-input" value="${escapeHtml(form.hours)}">
          </label>
          <label class="assign-field title">หมายเหตุ
            <input class="field-input" id="my-wl-note-input" value="${escapeHtml(form.note)}" placeholder="เช่น กะเช้า">
          </label>
          <button class="btn-gradient" data-action="my-add-worklog">${icons.plus} บันทึก</button>
        </div>
      </div>

      <div class="card" style="padding:0;overflow:hidden;margin-top:18px">
        ${rows || `<div class="task-empty" style="margin:16px">ยังไม่มีรายการ</div>`}
      </div>
    </div>
  `;
}
