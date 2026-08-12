import { api, setUnauthorizedHandler } from "./api.js";
import { icons } from "./icons.js";
import { escapeHtml, normalizeImageLink, stationLevelOf, stationLevelColor } from "./format.js";
import { renderOverview } from "./screens/overview.js";
import { renderList } from "./screens/list.js";
import { renderDetail } from "./screens/detail.js";
import { renderForm } from "./screens/form.js";
import { renderTasks, renderEmpSuggestionItems } from "./screens/tasks.js";
import { renderAttendance } from "./screens/attendance.js";
import { renderStations } from "./screens/stations.js";
import { renderCertificates } from "./screens/certificates.js";
import { renderAchievements } from "./screens/achievements.js";
import { renderWorkLog } from "./screens/worklog.js";
import { renderLogin } from "./screens/login.js";
import { renderUsers } from "./screens/users.js";
import { renderMyTasks, renderMyWorkLog } from "./screens/myportal.js";

const appEl = document.getElementById("app");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const state = {
  currentUser: null,
  loginForm: { username: "", password: "", error: null, loading: false },
  meta: null,
  employees: [],
  tasks: [],
  screen: "list",
  selId: null,
  draft: null,
  taskForm: { employeeIds: [], empSearch: "", title: "", due: "", level: "กลาง", axisGroup: "", axisIndex: null },
  taskDistribute: { openTaskId: null, selection: [] },
  attendanceRecords: [],
  attendanceForm: { employeeId: null, type: "ลาป่วย", date: todayISO(), note: "" },
  stationForm: { editingId: null, code: "", name: "", image: "", hazards: [] },
  certificates: [],
  certificateForm: { employeeId: null, name: "", expiry: "", image: "" },
  achievements: [],
  achievementForm: { employeeId: null, title: "", date: todayISO(), note: "" },
  workLogs: [],
  workLogForm: { employeeId: null, stationId: null, date: todayISO(), hours: "", note: "" },
  users: [],
  userForm: { editingId: null, username: "", displayName: "", password: "", role: "shift_leader", lineId: null, employeeId: null },
  lineForm: { name: "" },
  myWorkLogForm: { stationId: null, date: todayISO(), hours: "", note: "" },
  loading: true,
  error: null,
};

const PAGE_MAP = {
  overview: ["ภาพรวมทีม", "Team capability overview"],
  list: ["พนักงานทั้งหมด", "All employees"],
  detail: ["ข้อมูลความสามารถพนักงาน", "Employee capability profile"],
  form: ["แก้ไขข้อมูลพนักงาน", "Edit employee info"],
  tasks: ["งานที่มอบหมาย", "Assigned tasks & progress"],
  attendance: ["บันทึกขาดลามาสาย", "Attendance & leave records"],
  stations: ["จัดการสถานี / เครื่องจักร", "Manage stations & machine photos"],
  certificates: ["ใบเซอร์พนักงาน", "Employee certificates"],
  achievements: ["ผลงานพนักงาน", "Employee achievements"],
  worklog: ["บันทึกการทำงาน", "Daily work log"],
  users: ["จัดการผู้ใช้งาน", "Manage accounts"],
  "my-tasks": ["งานของฉัน", "My tasks"],
  "my-worklog": ["บันทึกชั่วโมงของฉัน", "My work log"],
  "team-tasks": ["สั่งงานทีม", "Assign & manage team tasks"],
};

function findEmployee(id) {
  return state.employees.find((e) => e.id === id) || state.employees[0] || null;
}

// For an "employee"-role login, state.employees may hold more than just their own record (a
// team lead's teammates are included too), so their own record isn't reliably index 0.
function findSelf() {
  return state.employees.find((e) => e.id === state.currentUser.employeeId) || null;
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
    nickname: emp.nickname || "",
    photo: emp.photo || "",
    gender: emp.gender,
    position: emp.position,
    empCode: emp.empCode,
    join: emp.join,
    level: emp.level,
    lineId: emp.lineId,
    leaveQuota: { vacation: emp.leave.vacation.quota, sick: emp.leave.sick.quota, personal: emp.leave.personal.quota },
    st: Object.fromEntries(emp.st.map((s) => [s.id, { hours: s.v, trained: s.trained }])),
    stats: { ...emp.stats },
    isTeamLead: !!emp.isTeamLead,
    teamMemberIds: emp.teamMemberIds ? [...emp.teamMemberIds] : [],
    teamSearch: "",
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
  const position = state.meta.positions[0] || state.meta.defaultPosition;
  state.draft = {
    id: null,
    isNew: true,
    name: "พนักงานใหม่",
    nameEn: "NEW EMPLOYEE",
    nickname: "",
    photo: "",
    gender: state.meta.genders[0],
    position,
    empCode: "EMP-",
    join: "2026",
    level: "Basic",
    lineId: state.currentUser.role === "admin" ? (state.meta.lines[0] && state.meta.lines[0].id) : state.currentUser.lineId,
    leaveQuota: { ...state.meta.defaultLeaveQuota },
    st: Object.fromEntries(state.meta.stations.map((s) => [s.id, { hours: 0, trained: false }])),
    stats: { today: "0/0", qc: "0/0", rework: "0/0", defect: "0/0" },
    isTeamLead: false,
    teamMemberIds: [],
    teamSearch: "",
  };
  state.screen = "form";
  render();
}

async function saveForm() {
  const d = state.draft;
  const payload = {
    name: d.name, nameEn: d.nameEn, nickname: d.nickname, photo: d.photo, gender: d.gender, position: d.position, empCode: d.empCode, join: d.join, level: d.level,
    lineId: d.lineId, leaveQuota: d.leaveQuota, st: d.st, stats: d.stats,
    isTeamLead: d.isTeamLead, teamMemberIds: d.teamMemberIds,
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

function setDraftLeaveQuota(key, value) {
  if (!state.draft) return;
  const n = Math.max(0, parseInt(value, 10) || 0);
  state.draft.leaveQuota[key] = n;
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


function refreshStationBadge(stationId) {
  const entry = state.draft.st[stationId] || { hours: 0, trained: false };
  const valEl = document.getElementById(`slider-val-st-${stationId}`);
  if (valEl) {
    const level = stationLevelOf(entry.trained, entry.hours);
    const color = stationLevelColor(level.key);
    valEl.textContent = level.en;
    valEl.style.color = color;
    valEl.style.background = color + "1a";
  }
}

function updateDraftStationTrained(stationId, trained) {
  if (!state.draft) return;
  const entry = state.draft.st[stationId] || { hours: 0, trained: false };
  state.draft.st[stationId] = { ...entry, trained };
  refreshStationBadge(stationId);
}

async function refreshEmployees() {
  state.employees = await api.listEmployees();
}

async function refreshTasks() {
  const [tasks, employees] = await Promise.all([api.listTasks(), api.listEmployees()]);
  state.tasks = tasks;
  state.employees = employees;
}

async function addTask() {
  const employeeIds = state.taskForm.employeeIds;
  const title = (state.taskForm.title || "").trim();
  if (!title || !employeeIds.length) return;
  try {
    const payload = { employeeIds, title, due: (state.taskForm.due || "").trim(), level: state.taskForm.level };
    if (state.taskForm.axisGroup) {
      payload.axisGroup = state.taskForm.axisGroup;
      payload.axisIndex = state.taskForm.axisIndex;
    }
    await api.createTask(payload);
    await refreshTasks();
    state.taskForm.title = "";
    state.taskForm.due = "";
    state.taskForm.employeeIds = [];
    state.taskForm.empSearch = "";
    state.taskForm.axisGroup = "";
    state.taskForm.axisIndex = null;
    state.error = null;
  } catch (err) {
    state.error = "มอบหมายงานไม่สำเร็จ: " + err.message;
  }
  render();
}

async function toggleTaskDone(taskId, done) {
  try {
    await api.setTaskDone(taskId, done);
    await refreshTasks();
    state.error = null;
  } catch (err) {
    state.error = "บันทึกสถานะงานไม่สำเร็จ: " + err.message;
  }
  render();
}

function openDistributeTask(taskId) {
  state.taskDistribute = { openTaskId: taskId, selection: [] };
  render();
}

function cancelDistributeTask() {
  state.taskDistribute = { openTaskId: null, selection: [] };
  render();
}

function toggleDistributeEmp(id) {
  const sel = state.taskDistribute.selection;
  const i = sel.indexOf(id);
  if (i === -1) sel.push(id);
  else sel.splice(i, 1);
  render();
}

async function confirmDistributeTask(taskId) {
  const employeeIds = state.taskDistribute.selection;
  if (!employeeIds.length) return;
  try {
    await api.setTaskAssignees(taskId, employeeIds);
    await refreshTasks();
    state.taskDistribute = { openTaskId: null, selection: [] };
    state.error = null;
  } catch (err) {
    state.error = "มอบหมายงานไม่สำเร็จ: " + err.message;
  }
  render();
}

async function deleteTask(taskId) {
  try {
    await api.deleteTask(taskId);
    await refreshTasks();
    state.error = null;
  } catch (err) {
    state.error = "ลบงานไม่สำเร็จ: " + err.message;
  }
  render();
}

async function refreshEmployee(employeeId) {
  const updated = await api.getEmployee(employeeId);
  const idx = state.employees.findIndex((e) => e.id === employeeId);
  if (idx >= 0) state.employees[idx] = updated;
}

async function addAttendance() {
  const employeeId = state.attendanceForm.employeeId || state.selId || (state.employees[0] && state.employees[0].id);
  const { type, date, note } = state.attendanceForm;
  if (!employeeId || !type || !date) return;
  try {
    const created = await api.createAttendance({ employeeId, type, date, note: (note || "").trim() });
    state.attendanceRecords.unshift(created);
    await refreshEmployee(employeeId);
    state.attendanceForm.note = "";
    state.error = null;
  } catch (err) {
    state.error = "บันทึกไม่สำเร็จ: " + err.message;
  }
  render();
}

async function deleteAttendance(id) {
  const record = state.attendanceRecords.find((r) => r.id === id);
  try {
    await api.deleteAttendance(id);
    state.attendanceRecords = state.attendanceRecords.filter((r) => r.id !== id);
    if (record) await refreshEmployee(record.employeeId);
    state.error = null;
  } catch (err) {
    state.error = "ลบรายการไม่สำเร็จ: " + err.message;
  }
  render();
}

const MAX_SOURCE_IMAGE_BYTES = 15_000_000;

// Downscales + re-encodes client-side so uploads stay tiny in the DB
// (a 3-8MB phone photo becomes ~20-100KB) instead of storing raw base64.
// Source formats that can carry transparency (PNG/WebP/GIF) are re-encoded
// as PNG so a background-removed cutout keeps its transparent background;
// everything else (JPEG, which has no alpha anyway) becomes JPEG for
// better compression.
function readImageFile(file, { maxDim = 500, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      reject(new Error("ไฟล์รูปใหญ่เกินไป (จำกัดไม่เกิน 15MB)"));
      return;
    }
    const keepsAlpha = ["image/png", "image/webp", "image/gif"].includes(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(keepsAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

async function refreshMeta() {
  const [meta, employees] = await Promise.all([api.getMeta(), api.listEmployees()]);
  state.meta = meta;
  state.employees = employees;
}

function editStation(id) {
  const s = state.meta.stations.find((x) => x.id === id);
  if (!s) return;
  state.stationForm = { editingId: s.id, code: s.code, name: s.name, image: s.image || "", hazards: s.hazards ? [...s.hazards] : [] };
  render();
}

function toggleStationHazard(key) {
  const hazards = state.stationForm.hazards;
  const i = hazards.indexOf(key);
  if (i === -1) hazards.push(key);
  else hazards.splice(i, 1);
  render();
}

function cancelStationEdit() {
  state.stationForm = { editingId: null, code: "", name: "", image: "", hazards: [] };
  render();
}

async function saveStation() {
  const { editingId, code, name, image, hazards } = state.stationForm;
  if (!code.trim() || !name.trim()) return;
  try {
    const payload = { code: code.trim(), name: name.trim(), image, hazards };
    if (editingId) await api.updateStation(editingId, payload);
    else await api.createStation(payload);
    await refreshMeta();
    state.stationForm = { editingId: null, code: "", name: "", image: "", hazards: [] };
    state.error = null;
  } catch (err) {
    state.error = "บันทึกสถานีไม่สำเร็จ: " + err.message;
  }
  render();
}

async function deleteStation(id) {
  try {
    await api.deleteStation(id);
    await refreshMeta();
    if (state.stationForm.editingId === id) state.stationForm = { editingId: null, code: "", name: "", image: "", hazards: [] };
    state.error = null;
  } catch (err) {
    state.error = "ลบสถานีไม่สำเร็จ: " + err.message;
  }
  render();
}

async function addCertificate() {
  const employeeId = state.certificateForm.employeeId || state.selId || (state.employees[0] && state.employees[0].id);
  const name = (state.certificateForm.name || "").trim();
  if (!employeeId || !name) return;
  try {
    const created = await api.createCertificate({
      employeeId,
      name,
      expiry: state.certificateForm.expiry || "",
      image: state.certificateForm.image || "",
    });
    state.certificates.unshift(created);
    state.certificateForm.name = "";
    state.certificateForm.expiry = "";
    state.certificateForm.image = "";
    state.error = null;
  } catch (err) {
    state.error = "บันทึกใบเซอร์ไม่สำเร็จ: " + err.message;
  }
  render();
}

async function deleteCertificate(id) {
  try {
    await api.deleteCertificate(id);
    state.certificates = state.certificates.filter((c) => c.id !== id);
    state.error = null;
  } catch (err) {
    state.error = "ลบใบเซอร์ไม่สำเร็จ: " + err.message;
  }
  render();
}

async function addAchievement() {
  const employeeId = state.achievementForm.employeeId || state.selId || (state.employees[0] && state.employees[0].id);
  const title = (state.achievementForm.title || "").trim();
  if (!employeeId || !title) return;
  try {
    const created = await api.createAchievement({
      employeeId,
      title,
      date: state.achievementForm.date || "",
      note: state.achievementForm.note || "",
    });
    state.achievements.unshift(created);
    state.achievementForm.title = "";
    state.achievementForm.note = "";
    state.error = null;
  } catch (err) {
    state.error = "บันทึกผลงานไม่สำเร็จ: " + err.message;
  }
  render();
}

async function deleteAchievement(id) {
  try {
    await api.deleteAchievement(id);
    state.achievements = state.achievements.filter((a) => a.id !== id);
    state.error = null;
  } catch (err) {
    state.error = "ลบรายการไม่สำเร็จ: " + err.message;
  }
  render();
}

async function refreshWorkLogs() {
  const [workLogs, employees] = await Promise.all([api.listWorkLogs(), api.listEmployees()]);
  state.workLogs = workLogs;
  state.employees = employees;
}

async function addWorkLog() {
  const employeeId = state.workLogForm.employeeId || state.selId || (state.employees[0] && state.employees[0].id);
  const stationId = state.workLogForm.stationId || (state.meta.stations[0] && state.meta.stations[0].id);
  const hours = Number(state.workLogForm.hours);
  if (!employeeId || !stationId || !Number.isFinite(hours) || hours <= 0) return;
  try {
    await api.createWorkLog({
      employeeId,
      stationId,
      date: state.workLogForm.date || todayISO(),
      hours,
      note: state.workLogForm.note || "",
    });
    await refreshWorkLogs();
    state.workLogForm.hours = "";
    state.workLogForm.note = "";
    state.error = null;
  } catch (err) {
    state.error = "บันทึกชั่วโมงทำงานไม่สำเร็จ: " + err.message;
  }
  render();
}

async function deleteWorkLog(id) {
  try {
    await api.deleteWorkLog(id);
    await refreshWorkLogs();
    state.error = null;
  } catch (err) {
    state.error = "ลบรายการไม่สำเร็จ: " + err.message;
  }
  render();
}

function emptyUserForm() {
  return {
    editingId: null, username: "", displayName: "", password: "", role: "shift_leader",
    lineId: state.meta.lines[0] ? state.meta.lines[0].id : null,
    employeeId: state.employees[0] ? state.employees[0].id : null,
  };
}

function editUser(id) {
  const u = state.users.find((x) => x.id === id);
  if (!u) return;
  state.userForm = {
    editingId: u.id, username: u.username, displayName: u.displayName, password: "", role: u.role,
    lineId: u.lineId || (state.meta.lines[0] && state.meta.lines[0].id),
    employeeId: u.employeeId || (state.employees[0] && state.employees[0].id),
  };
  render();
}

function cancelUserEdit() {
  state.userForm = emptyUserForm();
  render();
}

function setUserRole(role) {
  state.userForm.role = role;
  render();
}

async function saveUser() {
  const { editingId, username, displayName, password, role, lineId, employeeId } = state.userForm;
  if (!editingId && !username.trim()) return;
  if (!editingId && password.length < 6) { state.error = "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"; render(); return; }
  try {
    const payload = { displayName, role, lineId, employeeId };
    if (password) payload.password = password;
    if (editingId) {
      await api.updateUser(editingId, payload);
    } else {
      await api.createUser({ ...payload, username: username.trim(), password });
    }
    state.users = await api.listUsers();
    state.userForm = emptyUserForm();
    state.error = null;
  } catch (err) {
    state.error = "บันทึกบัญชีไม่สำเร็จ: " + err.message;
  }
  render();
}

async function deleteUser(id) {
  try {
    await api.deleteUser(id);
    state.users = state.users.filter((u) => u.id !== id);
    if (state.userForm.editingId === id) state.userForm = emptyUserForm();
    state.error = null;
  } catch (err) {
    state.error = "ลบบัญชีไม่สำเร็จ: " + err.message;
  }
  render();
}

async function addLine() {
  const name = (state.lineForm.name || "").trim();
  if (!name) return;
  try {
    const line = await api.createLine({ name });
    state.meta.lines.push(line);
    state.lineForm.name = "";
    state.error = null;
  } catch (err) {
    state.error = "เพิ่มสายไม่สำเร็จ: " + err.message;
  }
  render();
}

async function refreshMyData() {
  const [employees, tasks, workLogs] = await Promise.all([api.listEmployees(), api.listTasks(), api.listWorkLogs()]);
  state.employees = employees;
  state.tasks = tasks;
  state.workLogs = workLogs;
  state.selId = state.currentUser.employeeId;
}

async function myCompleteTask(taskId) {
  try {
    await api.setTaskDone(taskId, true);
    await refreshMyData();
    state.error = null;
  } catch (err) {
    state.error = "บันทึกไม่สำเร็จ: " + err.message;
  }
  render();
}

async function myReopenTask(taskId) {
  try {
    await api.setTaskDone(taskId, false);
    await refreshMyData();
    state.error = null;
  } catch (err) {
    state.error = "บันทึกไม่สำเร็จ: " + err.message;
  }
  render();
}

async function myAddWorkLog() {
  const stationId = state.myWorkLogForm.stationId || (state.meta.stations[0] && state.meta.stations[0].id);
  const hours = Number(state.myWorkLogForm.hours);
  if (!stationId || !Number.isFinite(hours) || hours <= 0) return;
  try {
    await api.createWorkLog({
      stationId,
      date: state.myWorkLogForm.date || todayISO(),
      hours,
      note: state.myWorkLogForm.note || "",
    });
    await refreshMyData();
    state.myWorkLogForm.hours = "";
    state.myWorkLogForm.note = "";
    state.error = null;
  } catch (err) {
    state.error = "บันทึกชั่วโมงทำงานไม่สำเร็จ: " + err.message;
  }
  render();
}

async function myDeleteWorkLog(id) {
  try {
    await api.deleteWorkLog(id);
    await refreshMyData();
    state.error = null;
  } catch (err) {
    state.error = "ลบรายการไม่สำเร็จ: " + err.message;
  }
  render();
}

function resetAppState() {
  state.meta = null;
  state.employees = [];
  state.tasks = [];
  state.screen = "list";
  state.selId = null;
  state.draft = null;
  state.taskForm = { employeeIds: [], empSearch: "", title: "", due: "", level: "กลาง", axisGroup: "", axisIndex: null };
  state.taskDistribute = { openTaskId: null, selection: [] };
  state.attendanceRecords = [];
  state.attendanceForm = { employeeId: null, type: "ลาป่วย", date: todayISO(), note: "" };
  state.stationForm = { editingId: null, code: "", name: "", image: "", hazards: [] };
  state.certificates = [];
  state.certificateForm = { employeeId: null, name: "", expiry: "", image: "" };
  state.achievements = [];
  state.achievementForm = { employeeId: null, title: "", date: todayISO(), note: "" };
  state.workLogs = [];
  state.workLogForm = { employeeId: null, stationId: null, date: todayISO(), hours: "", note: "" };
  state.users = [];
  state.userForm = { editingId: null, username: "", displayName: "", password: "", role: "shift_leader", lineId: null };
  state.lineForm = { name: "" };
  state.loading = false;
  state.error = null;
}

async function loadAppData() {
  state.loading = true;
  render();
  try {
    const [meta, employees, tasks, attendanceRecords, certificates, achievements, workLogs] = await Promise.all([
      api.getMeta(), api.listEmployees(), api.listTasks(), api.listAttendance(), api.listCertificates(), api.listAchievements(), api.listWorkLogs(),
    ]);
    state.meta = meta;
    state.employees = employees;
    state.tasks = tasks;
    state.attendanceRecords = attendanceRecords;
    state.certificates = certificates;
    state.achievements = achievements;
    state.workLogs = workLogs;
    state.selId = state.currentUser.role === "employee" ? state.currentUser.employeeId : (employees[0] ? employees[0].id : null);
    state.attendanceForm.employeeId = state.selId;
    state.certificateForm.employeeId = state.selId;
    state.achievementForm.employeeId = state.selId;
    state.workLogForm.employeeId = state.selId;
    state.workLogForm.stationId = meta.stations[0] ? meta.stations[0].id : null;
    state.myWorkLogForm.stationId = meta.stations[0] ? meta.stations[0].id : null;
    if (state.currentUser.role === "admin") {
      state.users = await api.listUsers();
      state.userForm = emptyUserForm();
    }
    if (state.currentUser.role === "employee") {
      state.screen = "detail";
    }
    state.loading = false;
    state.error = null;
  } catch (err) {
    state.loading = false;
    state.error = "โหลดข้อมูลไม่สำเร็จ: " + err.message;
  }
  render();
}

async function login() {
  const username = (state.loginForm.username || "").trim();
  const password = state.loginForm.password || "";
  if (!username || !password) return;
  state.loginForm.loading = true;
  state.loginForm.error = null;
  render();
  try {
    const user = await api.login(username, password);
    state.currentUser = user;
    state.loginForm = { username: "", password: "", error: null, loading: false };
    await loadAppData();
  } catch (err) {
    state.loginForm.loading = false;
    state.loginForm.error = err.message || "เข้าสู่ระบบไม่สำเร็จ";
    render();
  }
}

async function logout() {
  try {
    await api.logout();
  } catch (_) {}
  state.currentUser = null;
  resetAppState();
  render();
}

setUnauthorizedHandler(() => {
  state.currentUser = null;
  resetAppState();
  render();
});

function renderEmployeeShell() {
  const { screen } = state;
  const self = findSelf();
  const isLead = !!(self && self.isTeamLead);
  const validScreens = ["my-tasks", "my-worklog", ...(isLead ? ["team-tasks"] : [])];
  const myScreen = validScreens.includes(screen) ? screen : "detail";
  const pg = PAGE_MAP[myScreen] || PAGE_MAP.detail;

  let content = "";
  if (state.loading) {
    content = `<div class="card">กำลังโหลดข้อมูล...</div>`;
  } else if (myScreen === "team-tasks") {
    content = renderTasks({ employees: state.employees, tasks: state.tasks, taskForm: state.taskForm, meta: state.meta, showEnglish: true, currentUser: state.currentUser, distribute: state.taskDistribute });
  } else if (myScreen === "my-tasks") {
    content = renderMyTasks({ tasks: self ? self.tasks : [] });
  } else if (myScreen === "my-worklog") {
    content = renderMyWorkLog({ stations: state.meta.stations, logs: state.workLogs, form: state.myWorkLogForm, hazardTypes: state.meta.hazardTypes });
  } else {
    const emp = self;
    if (emp) {
      const certs = state.certificates.filter((c) => c.employeeId === emp.id);
      const achievements = state.achievements.filter((a) => a.employeeId === emp.id);
      content = renderDetail({ emp, certificates: certs, achievements, readOnly: true, hazardTypes: state.meta.hazardTypes });
    }
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
        <button class="nav-btn${myScreen === "detail" ? " active" : ""}" data-nav="detail">
          ${icons.employees}<span>ข้อมูลของฉัน<small>My profile</small></span>
        </button>
        <button class="nav-btn${myScreen === "my-tasks" ? " active" : ""}" data-nav="my-tasks">
          ${icons.tasks}<span>งานของฉัน<small>My tasks</small></span>
        </button>
        <button class="nav-btn${myScreen === "my-worklog" ? " active" : ""}" data-nav="my-worklog">
          ${icons.worklog}<span>บันทึกชั่วโมงของฉัน<small>My work log</small></span>
        </button>
        ${isLead ? `
          <button class="nav-btn${myScreen === "team-tasks" ? " active" : ""}" data-nav="team-tasks">
            ${icons.tasks}<span>สั่งงานทีม<small>Team tasks</small></span>
          </button>
        ` : ""}
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${escapeHtml(state.currentUser.displayName || state.currentUser.username)}</div>
              <div class="sidebar-user-role">พนักงาน</div>
            </div>
            <button class="sidebar-logout-btn" title="ออกจากระบบ" data-action="logout">${icons.logout}</button>
          </div>
        </div>
      </aside>
      <main class="main">
        <header class="topbar">
          <div style="min-width:0">
            <div class="page-title">${escapeHtml(myScreen === "detail" ? "ข้อมูลของฉัน" : pg[0])}</div>
            <div class="page-sub">${escapeHtml(myScreen === "detail" ? "My profile" : pg[1])}</div>
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

function renderShell() {
  if (!state.currentUser) {
    appEl.innerHTML = renderLogin({ form: state.loginForm });
    return;
  }
  if (state.currentUser.role === "employee") {
    renderEmployeeShell();
    return;
  }

  const { screen } = state;
  const isAdmin = state.currentUser.role === "admin";
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
    content = renderTasks({ employees: state.employees, tasks: state.tasks, taskForm: state.taskForm, meta: state.meta, showEnglish: true });
  } else if (screen === "attendance") {
    content = renderAttendance({ employees: state.employees, records: state.attendanceRecords, form: state.attendanceForm });
  } else if (screen === "stations") {
    content = renderStations({ stations: state.meta.stations, form: state.stationForm, hazardTypes: state.meta.hazardTypes });
  } else if (screen === "certificates") {
    content = renderCertificates({ employees: state.employees, certificates: state.certificates, form: state.certificateForm });
  } else if (screen === "achievements") {
    content = renderAchievements({ employees: state.employees, achievements: state.achievements, form: state.achievementForm });
  } else if (screen === "worklog") {
    content = renderWorkLog({ employees: state.employees, stations: state.meta.stations, logs: state.workLogs, form: state.workLogForm, hazardTypes: state.meta.hazardTypes });
  } else if (screen === "users" && isAdmin) {
    content = renderUsers({ users: state.users, lines: state.meta.lines, employees: state.employees, userForm: state.userForm, lineForm: state.lineForm });
  } else if (screen === "form" && state.draft) {
    content = renderForm({ draft: state.draft, meta: state.meta, currentUser: state.currentUser, employees: state.employees });
  } else {
    const emp = findEmployee(state.selId);
    if (emp) {
      state.selId = emp.id;
      const certs = state.certificates.filter((c) => c.employeeId === emp.id);
      const achievements = state.achievements.filter((a) => a.employeeId === emp.id);
      content = renderDetail({ emp, certificates: certs, achievements, hazardTypes: state.meta.hazardTypes });
    }
  }

  const lineById = state.meta ? Object.fromEntries(state.meta.lines.map((l) => [l.id, l])) : {};
  const roleLabel = isAdmin ? "ผู้ดูแลระบบ" : "หัวหน้ากะ";
  const lineLabel = isAdmin ? "ทุกสาย" : ((lineById[state.currentUser.lineId] && lineById[state.currentUser.lineId].name) || "");

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
        <button class="nav-btn${screen === "stations" ? " active" : ""}" data-nav="stations">
          ${icons.machine}<span>จัดการสถานี<small>Stations</small></span>
        </button>
        <button class="nav-btn${screen === "certificates" ? " active" : ""}" data-nav="certificates">
          ${icons.certificate}<span>ใบเซอร์พนักงาน<small>Certificates</small></span>
        </button>
        <button class="nav-btn${screen === "achievements" ? " active" : ""}" data-nav="achievements">
          ${icons.achievement}<span>ผลงานพนักงาน<small>Achievements</small></span>
        </button>
        <button class="nav-btn${screen === "worklog" ? " active" : ""}" data-nav="worklog">
          ${icons.worklog}<span>บันทึกการทำงาน<small>Work log</small></span>
        </button>
        ${isAdmin ? `
          <button class="nav-btn${screen === "users" ? " active" : ""}" data-nav="users">
            ${icons.admin}<span>จัดการผู้ใช้งาน<small>Manage accounts</small></span>
          </button>
        ` : ""}
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${escapeHtml(state.currentUser.displayName || state.currentUser.username)}</div>
              <div class="sidebar-user-role">${escapeHtml(roleLabel)}${lineLabel ? " · " + escapeHtml(lineLabel) : ""}</div>
            </div>
            <button class="sidebar-logout-btn" title="ออกจากระบบ" data-action="logout">${icons.logout}</button>
          </div>
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
  else if (action === "go-certificates") go("certificates");
  else if (action === "go-achievements") go("achievements");
  else if (action === "save-form") saveForm();
  else if (action === "cancel-form") cancelForm();
  else if (action === "set-level") setDraftLevel(actionEl.dataset.level);
  else if (action === "set-gender") setDraftGender(actionEl.dataset.gender);
  else if (action === "set-task-level") { state.taskForm.level = actionEl.dataset.level; render(); }
  else if (action === "pick-task-emp") {
    if (!state.taskForm.employeeIds.includes(actionEl.dataset.id)) state.taskForm.employeeIds.push(actionEl.dataset.id);
    state.taskForm.empSearch = "";
    render();
  }
  else if (action === "unpick-task-emp") {
    state.taskForm.employeeIds = state.taskForm.employeeIds.filter((id) => id !== actionEl.dataset.id);
    render();
  }
  else if (action === "pick-team-member") {
    if (state.draft && !state.draft.teamMemberIds.includes(actionEl.dataset.id)) state.draft.teamMemberIds.push(actionEl.dataset.id);
    if (state.draft) state.draft.teamSearch = "";
    render();
  }
  else if (action === "unpick-team-member") {
    if (state.draft) state.draft.teamMemberIds = state.draft.teamMemberIds.filter((id) => id !== actionEl.dataset.id);
    render();
  }
  else if (action === "add-task") addTask();
  else if (action === "complete-task") toggleTaskDone(actionEl.dataset.taskId, true);
  else if (action === "reopen-task") toggleTaskDone(actionEl.dataset.taskId, false);
  else if (action === "delete-task") deleteTask(actionEl.dataset.taskId);
  else if (action === "open-distribute-task") openDistributeTask(actionEl.dataset.taskId);
  else if (action === "cancel-distribute-task") cancelDistributeTask();
  else if (action === "confirm-distribute-task") confirmDistributeTask(actionEl.dataset.taskId);
  else if (action === "add-attendance") addAttendance();
  else if (action === "delete-attendance") deleteAttendance(actionEl.dataset.id);
  else if (action === "edit-station") editStation(actionEl.dataset.id);
  else if (action === "cancel-station-edit") cancelStationEdit();
  else if (action === "save-station") saveStation();
  else if (action === "delete-station") deleteStation(actionEl.dataset.id);
  else if (action === "toggle-station-hazard") toggleStationHazard(actionEl.dataset.key);
  else if (action === "add-certificate") addCertificate();
  else if (action === "delete-certificate") deleteCertificate(actionEl.dataset.id);
  else if (action === "add-achievement") addAchievement();
  else if (action === "delete-achievement") deleteAchievement(actionEl.dataset.id);
  else if (action === "add-worklog") addWorkLog();
  else if (action === "delete-worklog") deleteWorkLog(actionEl.dataset.id);
  else if (action === "add-new") addNew();
  else if (action === "login") login();
  else if (action === "logout") logout();
  else if (action === "edit-user") editUser(actionEl.dataset.id);
  else if (action === "cancel-user-edit") cancelUserEdit();
  else if (action === "set-user-role") setUserRole(actionEl.dataset.role);
  else if (action === "save-user") saveUser();
  else if (action === "delete-user") deleteUser(actionEl.dataset.id);
  else if (action === "add-line") addLine();
  else if (action === "go-my-tasks") go("my-tasks");
  else if (action === "my-complete-task") myCompleteTask(actionEl.dataset.taskId);
  else if (action === "my-reopen-task") myReopenTask(actionEl.dataset.taskId);
  else if (action === "my-add-worklog") myAddWorkLog();
  else if (action === "my-delete-worklog") myDeleteWorkLog(actionEl.dataset.id);
});

appEl.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.field) {
    setDraftField(t.dataset.field, t.value);
  } else if (t.dataset && t.dataset.leaveField) {
    setDraftLeaveQuota(t.dataset.leaveField, t.value);
  } else if (t.id === "task-title-input") {
    state.taskForm.title = t.value;
  } else if (t.id === "task-due-input") {
    state.taskForm.due = t.value;
  } else if (t.id === "task-emp-search") {
    state.taskForm.empSearch = t.value;
    const box = document.getElementById("task-emp-suggestions");
    if (box) box.innerHTML = renderEmpSuggestionItems(state.employees, t.value, state.taskForm.employeeIds);
  } else if (t.id === "team-member-search") {
    if (state.draft) state.draft.teamSearch = t.value;
    const box = document.getElementById("team-member-suggestions");
    if (box && state.draft) {
      const excludeIds = [...state.draft.teamMemberIds, state.draft.id].filter(Boolean);
      box.innerHTML = renderEmpSuggestionItems(state.employees, t.value, excludeIds, "pick-team-member");
    }
  } else if (t.id === "att-note-input") {
    state.attendanceForm.note = t.value;
  } else if (t.id === "stn-code-input") {
    state.stationForm.code = t.value;
  } else if (t.id === "stn-name-input") {
    state.stationForm.name = t.value;
  } else if (t.id === "cert-name-input") {
    state.certificateForm.name = t.value;
  } else if (t.id === "cert-link-input") {
    state.certificateForm.image = normalizeImageLink(t.value.trim());
  } else if (t.id === "photo-link-input") {
    setDraftField("photo", normalizeImageLink(t.value.trim()));
  } else if (t.id === "ach-title-input") {
    state.achievementForm.title = t.value;
  } else if (t.id === "ach-note-input") {
    state.achievementForm.note = t.value;
  } else if (t.id === "wl-hours-input") {
    state.workLogForm.hours = t.value;
  } else if (t.id === "wl-note-input") {
    state.workLogForm.note = t.value;
  } else if (t.id === "login-username") {
    state.loginForm.username = t.value;
  } else if (t.id === "login-password") {
    state.loginForm.password = t.value;
  } else if (t.id === "user-username-input") {
    state.userForm.username = t.value;
  } else if (t.id === "user-displayname-input") {
    state.userForm.displayName = t.value;
  } else if (t.id === "user-password-input") {
    state.userForm.password = t.value;
  } else if (t.id === "line-name-input") {
    state.lineForm.name = t.value;
  } else if (t.id === "my-wl-hours-input") {
    state.myWorkLogForm.hours = t.value;
  } else if (t.id === "my-wl-note-input") {
    state.myWorkLogForm.note = t.value;
  }
});

appEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.dataset && e.target.dataset.loginField !== undefined) {
    e.preventDefault();
    login();
  }
});

appEl.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.stationTrained) {
    updateDraftStationTrained(t.dataset.stationTrained, t.checked);
  } else if (t.dataset && t.dataset.distributeEmp) {
    toggleDistributeEmp(t.dataset.distributeEmp);
  } else if (t.id === "task-axis-select") {
    if (!t.value) {
      state.taskForm.axisGroup = "";
      state.taskForm.axisIndex = null;
    } else {
      const [group, idx] = t.value.split(":");
      state.taskForm.axisGroup = group;
      state.taskForm.axisIndex = parseInt(idx, 10);
    }
  } else if (t.id === "att-emp-select") {
    state.attendanceForm.employeeId = t.value;
    render();
  } else if (t.id === "att-type-select") {
    state.attendanceForm.type = t.value;
  } else if (t.id === "att-date-input") {
    state.attendanceForm.date = t.value;
  } else if (t.id === "wl-emp-select") {
    state.workLogForm.employeeId = t.value;
  } else if (t.id === "wl-station-select") {
    state.workLogForm.stationId = t.value;
  } else if (t.id === "wl-date-input") {
    state.workLogForm.date = t.value;
  } else if (t.id === "stn-image-input") {
    const file = t.files && t.files[0];
    if (!file) return;
    readImageFile(file, { maxDim: 500, quality: 0.82 })
      .then((dataUrl) => { state.stationForm.image = dataUrl; state.error = null; render(); })
      .catch((err) => { state.error = err.message; render(); });
  } else if (t.id === "position-select") {
    setDraftField("position", t.value === "__other__" ? "" : t.value);
    render();
  } else if (t.id === "cert-emp-select") {
    state.certificateForm.employeeId = t.value;
  } else if (t.id === "cert-expiry-input") {
    state.certificateForm.expiry = t.value;
  } else if (t.id === "cert-link-input") {
    render();
  } else if (t.id === "cert-image-input") {
    const file = t.files && t.files[0];
    if (!file) return;
    readImageFile(file, { maxDim: 1000, quality: 0.85 })
      .then((dataUrl) => { state.certificateForm.image = dataUrl; state.error = null; render(); })
      .catch((err) => { state.error = err.message; render(); });
  } else if (t.id === "photo-link-input") {
    render();
  } else if (t.id === "photo-file-input") {
    const file = t.files && t.files[0];
    if (!file) return;
    readImageFile(file, { maxDim: 400, quality: 0.82 })
      .then((dataUrl) => { setDraftField("photo", dataUrl); state.error = null; render(); })
      .catch((err) => { state.error = err.message; render(); });
  } else if (t.id === "ach-emp-select") {
    state.achievementForm.employeeId = t.value;
  } else if (t.id === "ach-date-input") {
    state.achievementForm.date = t.value;
  } else if (t.id === "user-line-select") {
    state.userForm.lineId = t.value;
  } else if (t.id === "user-employee-select") {
    state.userForm.employeeId = t.value;
  } else if (t.id === "team-lead-checkbox") {
    if (state.draft) state.draft.isTeamLead = t.checked;
    render();
  } else if (t.id === "employee-line-select") {
    setDraftField("lineId", t.value);
  } else if (t.id === "my-wl-station-select") {
    state.myWorkLogForm.stationId = t.value;
  } else if (t.id === "my-wl-date-input") {
    state.myWorkLogForm.date = t.value;
  }
});

async function init() {
  try {
    const user = await api.getMe();
    state.currentUser = user;
    await loadAppData();
  } catch (err) {
    state.loading = false;
    render();
  }
}

init();
