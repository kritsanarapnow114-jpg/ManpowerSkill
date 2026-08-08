import { api } from "./api.js";
import { icons } from "./icons.js";
import { clamp, stColor, taskColor, taskBadge, escapeHtml } from "./format.js";
import { radarSVG } from "./radar.js";
import { renderOverview } from "./screens/overview.js";
import { renderList } from "./screens/list.js";
import { renderDetail } from "./screens/detail.js";
import { renderForm } from "./screens/form.js";
import { renderTasks } from "./screens/tasks.js";
import { renderAttendance } from "./screens/attendance.js";

const appEl = document.getElementById("app");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const state = {
  meta: null,
  employees: [],
  screen: "list",
  selId: null,
  draft: null,
  taskForm: { employeeId: null, title: "", due: "" },
  attendanceRecords: [],
  attendanceForm: { employeeId: null, type: "ลาป่วย", date: todayISO(), note: "" },
  loading: true,
  error: null,
};

const PAGE_MAP = {
  overview: ["ภาพรวมทีม", "Team capability overview"],
  list: ["พนักงานทั้งหมด", "All employees"],
  detail: ["ข้อมูลความสามารถพนักงาน", "Employee capability profile"],
  form: ["แก้ไขคะแนนความสามารถ", "Edit capability scores"],
  tasks: ["งานที่มอบหมาย", "Assigned tasks & progress"],
  attendance: ["บันทึกขาดลามาสาย", "Attendance & leave records"],
};

function findEmployee(id) {
  return state.employees.find((e) => e.id === id) || state.employees[0] || null;
}

function go(screen) {
  state.screen = screen;
  render();
}

function openEmp(id) {
  state.screen = "detail";
  state.selId = id;
  render();
}

function draftFromEmployee(emp) {
  return {
    id: emp.id,
    isNew: false,
    name: emp.name,
    nameEn: emp.nameEn,
    gender: emp.gender,
    position: emp.position,
    empCode: emp.empCode,
    join: emp.join,
    level: emp.level,
    g1: emp.g1.map((a) => a.v),
    g2: emp.g2.map((a) => a.v),
    st: emp.st.map((a) => a.v),
    stats: { ...emp.stats },
  };
}

function editEmp(id) {
  const emp = findEmployee(id);
  if (!emp) return;
  state.draft = draftFromEmployee(emp);
  state.screen = "form";
  state.selId = id;
  render();
}

function addNew() {
  state.draft = {
    id: null,
    isNew: true,
    name: "พนักงานใหม่",
    nameEn: "NEW EMPLOYEE",
    gender: state.meta.genders[0],
    position: "Assembly Operator",
    empCode: "EMP-",
    join: "2026",
    level: "Basic",
    g1: state.meta.g1Axes.map(() => 0),
    g2: state.meta.g2Axes.map(() => 0),
    st: state.meta.stations.map(() => 0),
    stats: { today: "0/0", qc: "0/0", rework: "0/0", defect: "0/0" },
  };
  state.screen = "form";
  render();
}

async function saveForm() {
  const d = state.draft;
  const payload = {
    name: d.name, nameEn: d.nameEn, gender: d.gender, position: d.position, empCode: d.empCode, join: d.join, level: d.level,
    g1: d.g1, g2: d.g2, st: d.st, stats: d.stats,
  };
  try {
    const saved = d.isNew ? await api.createEmployee(payload) : await api.updateEmployee(d.id, payload);
    const idx = state.employees.findIndex((e) => e.id === saved.id);
    if (idx >= 0) state.employees[idx] = saved; else state.employees.push(saved);
    state.employees.sort((a, b) => a.empCode.localeCompare(b.empCode));
    state.draft = null;
    state.selId = saved.id;
    state.screen = "detail";
    state.error = null;
  } catch (err) {
    state.error = "บันทึกไม่สำเร็จ: " + err.message;
  }
  render();
}

function cancelForm() {
  const exists = state.employees.some((e) => e.id === state.selId);
  state.draft = null;
  state.screen = exists ? "detail" : "list";
  render();
}

function setDraftField(field, value) {
  if (!state.draft) return;
  state.draft[field] = value;
}

function setDraftLevel(level) {
  if (!state.draft) return;
  state.draft.level = level;
  render();
}

function setDraftGender(gender) {
  if (!state.draft) return;
  state.draft.gender = gender;
  render();
}

function updateDraftSlider(group, index, value) {
  if (!state.draft) return;
  const v = clamp(value);
  state.draft[group][index] = v;

  const valEl = document.getElementById(`slider-val-${group}-${index}`);
  if (valEl) {
    if (group === "st") {
      valEl.textContent = v + "%";
      valEl.style.color = stColor(v);
    } else {
      valEl.textContent = v + "%";
    }
  }

  if (group === "g1" || group === "g2") {
    const radarEl = document.getElementById(`radar-${group}`);
    const axes = state.meta[group === "g1" ? "g1Axes" : "g2Axes"];
    const color = group === "g1" ? "#2f8fd0" : "#d99a17";
    const fill = group === "g1" ? "rgba(47,143,208,.18)" : "rgba(217,154,23,.26)";
    if (radarEl) {
      radarEl.innerHTML = radarSVG(axes.map((axis, i) => ({ label: axis.th, v: state.draft[group][i] })), color, fill);
    }
  }
}

async function addTask() {
  const employeeId = state.taskForm.employeeId || state.selId || (state.employees[0] && state.employees[0].id);
  const title = (state.taskForm.title || "").trim();
  if (!title || !employeeId) return;
  try {
    await api.createTask({ employeeId, title, due: (state.taskForm.due || "").trim() });
    const updated = await api.getEmployee(employeeId);
    const idx = state.employees.findIndex((e) => e.id === employeeId);
    if (idx >= 0) state.employees[idx] = updated;
    state.taskForm.title = "";
    state.taskForm.due = "";
    state.error = null;
  } catch (err) {
    state.error = "มอบหมายงานไม่สำเร็จ: " + err.message;
  }
  render();
}

function liveUpdateTaskRow(taskId, value) {
  const v = clamp(value);
  const color = taskColor(v);
  const valEl = document.getElementById(`task-val-${taskId}`);
  if (valEl) { valEl.textContent = v + "%"; valEl.style.color = color; }
  const badgeEl = document.getElementById(`task-badge-${taskId}`);
  if (badgeEl) {
    badgeEl.textContent = taskBadge(v);
    badgeEl.style.color = v >= 100 ? "#0f7a34" : color;
    badgeEl.style.background = v >= 100 ? "#dcfce7" : "#f1f5f8";
  }
}

async function commitTaskProgress(taskId, empId, value) {
  const v = clamp(value);
  const emp = state.employees.find((e) => e.id === empId);
  if (emp) {
    const t = emp.tasks.find((x) => x.id === taskId);
    if (t) t.progress = v;
  }
  try {
    await api.updateTaskProgress(taskId, v);
    state.error = null;
  } catch (err) {
    state.error = "บันทึกความคืบหน้าไม่สำเร็จ: " + err.message;
  }
  render();
}

async function deleteTask(taskId, empId) {
  try {
    await api.deleteTask(taskId);
    const emp = state.employees.find((e) => e.id === empId);
    if (emp) emp.tasks = emp.tasks.filter((t) => t.id !== taskId);
    state.error = null;
  } catch (err) {
    state.error = "ลบงานไม่สำเร็จ: " + err.message;
  }
  render();
}

async function addAttendance() {
  const employeeId = state.attendanceForm.employeeId || state.selId || (state.employees[0] && state.employees[0].id);
  const { type, date, note } = state.attendanceForm;
  if (!employeeId || !type || !date) return;
  try {
    const created = await api.createAttendance({ employeeId, type, date, note: (note || "").trim() });
    state.attendanceRecords.unshift(created);
    state.attendanceForm.note = "";
    state.error = null;
  } catch (err) {
    state.error = "บันทึกไม่สำเร็จ: " + err.message;
  }
  render();
}

async function deleteAttendance(id) {
  try {
    await api.deleteAttendance(id);
    state.attendanceRecords = state.attendanceRecords.filter((r) => r.id !== id);
    state.error = null;
  } catch (err) {
    state.error = "ลบรายการไม่สำเร็จ: " + err.message;
  }
  render();
}

function renderShell() {
  const { screen } = state;
  const isEmpScreen = screen === "list" || screen === "detail" || screen === "form";
  const pg = PAGE_MAP[screen] || PAGE_MAP.detail;

  let content = "";
  if (state.loading) {
    content = `<div class="card">กำลังโหลดข้อมูล...</div>`;
  } else if (screen === "overview") {
    content = renderOverview({ employees: state.employees });
  } else if (screen === "list") {
    content = renderList({ employees: state.employees });
  } else if (screen === "tasks") {
    content = renderTasks({ employees: state.employees, taskForm: state.taskForm, showEnglish: true });
  } else if (screen === "attendance") {
    content = renderAttendance({ employees: state.employees, records: state.attendanceRecords, form: state.attendanceForm });
  } else if (screen === "form" && state.draft) {
    content = renderForm({ draft: state.draft, meta: state.meta });
  } else {
    const emp = findEmployee(state.selId);
    if (emp) { state.selId = emp.id; content = renderDetail({ emp }); }
  }

  appEl.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">NB</div>
          <div>
            <div class="brand-name">NBC Skills</div>
            <div class="brand-sub">ระบบข้อมูลความสามารถ</div>
          </div>
        </div>
        <button class="nav-btn${screen === "overview" ? " active" : ""}" data-nav="overview">
          ${icons.overview}<span>ภาพรวมทีม<small>Team overview</small></span>
        </button>
        <button class="nav-btn${isEmpScreen ? " active" : ""}" data-nav="list">
          ${icons.employees}<span>พนักงาน<small>Employees</small></span>
        </button>
        <button class="nav-btn${screen === "tasks" ? " active" : ""}" data-nav="tasks">
          ${icons.tasks}<span>งานที่มอบหมาย<small>Assigned tasks</small></span>
        </button>
        <button class="nav-btn${screen === "attendance" ? " active" : ""}" data-nav="attendance">
          ${icons.attendance}<span>ขาดลามาสาย<small>Attendance</small></span>
        </button>
        <div class="sidebar-footer">
          <div class="line1">สายการประกอบ · Line A</div>
          <div class="line2">อัปเดตล่าสุด · 5 ส.ค. 2026</div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div style="min-width:0">
            <div class="page-title">${escapeHtml(pg[0])}</div>
            <div class="page-sub">${escapeHtml(pg[1])}</div>
          </div>
          <div class="topbar-actions">
            <div class="search-box">${icons.search}<span>ค้นหาพนักงาน / รหัส</span></div>
            <button class="btn-gradient" data-action="add-new">${icons.plus} เพิ่มพนักงาน</button>
          </div>
        </header>
        <div class="content">
          ${state.error ? `<div class="card" style="border-color:#f2b8b8;color:#b42318;margin-bottom:16px">${escapeHtml(state.error)}</div>` : ""}
          ${content}
        </div>
      </main>
    </div>
  `;
}

function render() {
  renderShell();
}

appEl.addEventListener("click", (e) => {
  const navEl = e.target.closest("[data-nav]");
  if (navEl) { go(navEl.dataset.nav); return; }

  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === "open-emp") openEmp(actionEl.dataset.id);
  else if (action === "edit-emp") editEmp(actionEl.dataset.id);
  else if (action === "edit-this") editEmp(state.selId);
  else if (action === "back-to-list") go("list");
  else if (action === "go-tasks") go("tasks");
  else if (action === "save-form") saveForm();
  else if (action === "cancel-form") cancelForm();
  else if (action === "set-level") setDraftLevel(actionEl.dataset.level);
  else if (action === "set-gender") setDraftGender(actionEl.dataset.gender);
  else if (action === "add-task") addTask();
  else if (action === "delete-task") deleteTask(actionEl.dataset.taskId, actionEl.dataset.empId);
  else if (action === "add-attendance") addAttendance();
  else if (action === "delete-attendance") deleteAttendance(actionEl.dataset.id);
  else if (action === "add-new") addNew();
});

appEl.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.field) {
    setDraftField(t.dataset.field, t.value);
  } else if (t.dataset && t.dataset.slider) {
    updateDraftSlider(t.dataset.slider, parseInt(t.dataset.index, 10), t.value);
  } else if (t.hasAttribute("data-task-slider")) {
    liveUpdateTaskRow(t.dataset.taskId, t.value);
  } else if (t.id === "task-title-input") {
    state.taskForm.title = t.value;
  } else if (t.id === "task-due-input") {
    state.taskForm.due = t.value;
  } else if (t.id === "att-note-input") {
    state.attendanceForm.note = t.value;
  }
});

appEl.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "task-emp-select") {
    state.taskForm.employeeId = t.value;
  } else if (t.hasAttribute("data-task-slider")) {
    commitTaskProgress(t.dataset.taskId, t.dataset.empId, t.value);
  } else if (t.id === "att-emp-select") {
    state.attendanceForm.employeeId = t.value;
  } else if (t.id === "att-type-select") {
    state.attendanceForm.type = t.value;
  } else if (t.id === "att-date-input") {
    state.attendanceForm.date = t.value;
  }
});

async function init() {
  try {
    const [meta, employees, attendanceRecords] = await Promise.all([api.getMeta(), api.listEmployees(), api.listAttendance()]);
    state.meta = meta;
    state.employees = employees;
    state.attendanceRecords = attendanceRecords;
    state.selId = employees[0] ? employees[0].id : null;
    state.taskForm.employeeId = state.selId;
    state.attendanceForm.employeeId = state.selId;
    state.loading = false;
  } catch (err) {
    state.loading = false;
    state.error = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
  }
  render();
}

init();
