import { avatarBg, initials, escapeHtml } from "../format.js";
import { icons } from "../icons.js";

export function renderWorkLog({ employees, stations, logs, form, hazardTypes = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayLogs = logs.filter((l) => l.date === today);
  const todayEmpIds = new Set(todayLogs.map((l) => l.employeeId));
  const todayHours = todayLogs.reduce((s, l) => s + l.hours, 0);
  const totalHours = logs.reduce((s, l) => s + l.hours, 0);

  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const stnById = Object.fromEntries(stations.map((s) => [s.id, s]));

  const empOptions = employees
    .map((e) => `<option value="${escapeHtml(e.id)}" ${form.employeeId === e.id ? "selected" : ""}>${escapeHtml(e.empCode + " · " + e.nameEn)}</option>`)
    .join("");
  const hazardEmojiByKey = Object.fromEntries(hazardTypes.map((h) => [h.key, h.emoji]));
  const stnOptions = stations
    .map((s) => {
      const emojis = (s.hazards || []).map((k) => hazardEmojiByKey[k]).filter(Boolean).join("");
      return `<option value="${escapeHtml(s.id)}" ${form.stationId === s.id ? "selected" : ""}>${emojis ? emojis + " " : ""}${escapeHtml(s.name)}</option>`;
    })
    .join("");

  const todayCards = todayLogs.map((l) => {
    const emp = empById[l.employeeId];
    const stn = stnById[l.stationId];
    return `
      <div class="workload-chip">
        <div class="avatar-sm" style="background:${emp ? avatarBg(emp.level) : "#8494a1"}">${escapeHtml(emp ? initials(emp.nameEn) : "?")}</div>
        <div class="workload-chip-info">
          <div class="workload-chip-name">${escapeHtml(emp ? (emp.nickname || emp.nameEn) : l.employeeId)}</div>
          <div class="workload-chip-meta">${escapeHtml(stn ? stn.name : l.stationId)} · ${l.hours} ชม.</div>
        </div>
        <button class="btn-icon" title="ลบรายการ" data-action="delete-worklog" data-id="${escapeHtml(l.id)}">${icons.trash}</button>
      </div>
    `;
  }).join("");

  const rows = logs.map((l) => {
    const emp = empById[l.employeeId];
    const stn = stnById[l.stationId];
    return `
      <div class="worklog-row">
        <div class="attendance-date">${escapeHtml(l.date)}</div>
        <div class="attendance-emp">
          <div class="avatar-sm" style="background:${emp ? avatarBg(emp.level) : "#8494a1"}">${escapeHtml(emp ? initials(emp.nameEn) : "?")}</div>
          <div style="min-width:0">
            <div class="list-name-en">${escapeHtml(emp ? emp.nameEn : l.employeeId)}</div>
            <div class="list-name-th">${escapeHtml(emp ? emp.name : "")}</div>
          </div>
        </div>
        <div>${escapeHtml(stn ? stn.name : l.stationId)}</div>
        <div><b>${l.hours}</b> ชม.</div>
        <div class="attendance-note">${escapeHtml(l.note || "—")}</div>
        <button class="btn-icon" title="ลบรายการ" data-action="delete-worklog" data-id="${escapeHtml(l.id)}">${icons.trash}</button>
      </div>
    `;
  }).join("");

  return `
    <div>
      <div class="task-kpi-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#0c7f93"></div>
          <div class="kpi-label">มาทำงานวันนี้ · Working today</div>
          <div class="kpi-value">${todayEmpIds.size}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#16a34a"></div>
          <div class="kpi-label">ชั่วโมงวันนี้ · Hours today</div>
          <div class="kpi-value" style="color:#16a34a">${todayHours}</div>
        </div>
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
        <div class="section-title" style="margin-bottom:12px">บันทึกการทำงาน <small>· Log work hours</small></div>
        <div class="assign-row">
          <label class="assign-field employee">พนักงาน
            <select class="field-input" id="wl-emp-select">${empOptions}</select>
          </label>
          <label class="assign-field due">สถานี / เครื่องจักร
            <select class="field-input" id="wl-station-select">${stnOptions}</select>
          </label>
          <label class="assign-field due">วันที่
            <input type="date" class="field-input" id="wl-date-input" value="${escapeHtml(form.date)}">
          </label>
          <label class="assign-field due">ชั่วโมง
            <input type="number" min="0" max="24" step="0.5" class="field-input" id="wl-hours-input" value="${escapeHtml(form.hours)}">
          </label>
          <label class="assign-field title">หมายเหตุ
            <input class="field-input" id="wl-note-input" value="${escapeHtml(form.note)}" placeholder="เช่น กะเช้า, ฝึกเพิ่มเติม">
          </label>
          <button class="btn-gradient" data-action="add-worklog">${icons.plus} บันทึก</button>
        </div>
      </div>

      ${todayLogs.length ? `
        <div class="card" style="padding:16px 20px">
          <div class="section-title" style="margin-bottom:12px">วันนี้ใครทำงานที่ไหนบ้าง <small>· Today</small></div>
          <div class="workload-chip-grid">${todayCards}</div>
        </div>
      ` : ""}

      <div class="card" style="padding:0;overflow:hidden;margin-top:18px">
        <div class="worklog-row worklog-head">
          <div>วันที่</div><div>พนักงาน</div><div>สถานี</div><div>ชั่วโมง</div><div>หมายเหตุ</div><div></div>
        </div>
        ${rows || `<div class="task-empty" style="margin:16px">ยังไม่มีรายการ</div>`}
      </div>
    </div>
  `;
}
