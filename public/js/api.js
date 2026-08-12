let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(url, options) {
  const res = await fetch(url, { credentials: "same-origin", ...options });
  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    if (onUnauthorized) onUnauthorized();
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch (_) {}
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  login: (username, password) => request("/api/auth/login", json("POST", { username, password })),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  getMe: () => request("/api/auth/me"),
  listUsers: () => request("/api/users"),
  createUser: (data) => request("/api/users", json("POST", data)),
  updateUser: (id, data) => request(`/api/users/${id}`, json("PUT", data)),
  deleteUser: (id) => request(`/api/users/${id}`, { method: "DELETE" }),
  listLines: () => request("/api/lines"),
  createLine: (data) => request("/api/lines", json("POST", data)),
  getMeta: () => request("/api/meta"),
  listEmployees: () => request("/api/employees"),
  getEmployee: (id) => request(`/api/employees/${id}`),
  createEmployee: (data) => request("/api/employees", json("POST", data)),
  updateEmployee: (id, data) => request(`/api/employees/${id}`, json("PUT", data)),
  listTasks: () => request("/api/tasks"),
  createTask: (data) => request("/api/tasks", json("POST", data)),
  setTaskDone: (taskId, done) => request(`/api/tasks/${taskId}`, json("PATCH", { done })),
  setTaskAssignees: (taskId, employeeIds) => request(`/api/tasks/${taskId}/assignees`, json("PUT", { employeeIds })),
  deleteTask: (taskId) => request(`/api/tasks/${taskId}`, { method: "DELETE" }),
  listRecurringTasks: () => request("/api/recurring-tasks"),
  createRecurringTask: (data) => request("/api/recurring-tasks", json("POST", data)),
  deleteRecurringTask: (id) => request(`/api/recurring-tasks/${id}`, { method: "DELETE" }),
  listAttendance: () => request("/api/attendance"),
  createAttendance: (data) => request("/api/attendance", json("POST", data)),
  deleteAttendance: (id) => request(`/api/attendance/${id}`, { method: "DELETE" }),
  listStations: () => request("/api/stations"),
  createStation: (data) => request("/api/stations", json("POST", data)),
  updateStation: (id, data) => request(`/api/stations/${id}`, json("PUT", data)),
  deleteStation: (id) => request(`/api/stations/${id}`, { method: "DELETE" }),
  listCertificates: () => request("/api/certificates"),
  createCertificate: (data) => request("/api/certificates", json("POST", data)),
  deleteCertificate: (id) => request(`/api/certificates/${id}`, { method: "DELETE" }),
  listAchievements: () => request("/api/achievements"),
  createAchievement: (data) => request("/api/achievements", json("POST", data)),
  deleteAchievement: (id) => request(`/api/achievements/${id}`, { method: "DELETE" }),
  listRecurringAchievements: () => request("/api/recurring-achievements"),
  createRecurringAchievement: (data) => request("/api/recurring-achievements", json("POST", data)),
  deleteRecurringAchievement: (id) => request(`/api/recurring-achievements/${id}`, { method: "DELETE" }),
  listWorkLogs: () => request("/api/worklogs"),
  createWorkLog: (data) => request("/api/worklogs", json("POST", data)),
  deleteWorkLog: (id) => request(`/api/worklogs/${id}`, { method: "DELETE" }),
};
