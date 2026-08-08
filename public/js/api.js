async function request(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch (_) {}
    throw new Error(message);
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
  getMeta: () => request("/api/meta"),
  listEmployees: () => request("/api/employees"),
  getEmployee: (id) => request(`/api/employees/${id}`),
  createEmployee: (data) => request("/api/employees", json("POST", data)),
  updateEmployee: (id, data) => request(`/api/employees/${id}`, json("PUT", data)),
  createTask: (data) => request("/api/tasks", json("POST", data)),
  updateTaskProgress: (id, progress) => request(`/api/tasks/${id}`, json("PATCH", { progress })),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: "DELETE" }),
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
};
