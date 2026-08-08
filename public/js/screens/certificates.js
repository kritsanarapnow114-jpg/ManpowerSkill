import { avatarBg, initials, certStatus, escapeHtml, looksLikeImage, isSafeLink } from "../format.js";
import { icons } from "../icons.js";

export function renderCertificates({ employees, certificates, form }) {
  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));

  const total = certificates.length;
  const expiredCount = certificates.filter((c) => certStatus(c.expiry).kind === "expired").length;
  const soonCount = certificates.filter((c) => certStatus(c.expiry).kind === "soon").length;

  const empOptions = employees
    .map((e) => `<option value="${escapeHtml(e.id)}" ${form.employeeId === e.id ? "selected" : ""}>${escapeHtml(e.empCode + " · " + e.nameEn)}</option>`)
    .join("");

  const cards = certificates.map((c) => {
    const emp = empById[c.employeeId];
    const status = certStatus(c.expiry);
    const thumb = looksLikeImage(c.image)
      ? `<img class="cert-card-img" src="${escapeHtml(c.image)}" alt="">`
      : `<div class="cert-card-img cert-card-img-empty">${icons.certificate}</div>`;
    const linkBtn = c.image && !looksLikeImage(c.image) && isSafeLink(c.image)
      ? `<a class="cert-card-link" href="${escapeHtml(c.image)}" target="_blank" rel="noopener noreferrer">${icons.image} ดูใบเซอร์ →</a>`
      : "";
    return `
      <div class="cert-card">
        ${thumb}
        <div class="cert-card-body">
          <div class="cert-card-name">${escapeHtml(c.name)}</div>
          <div class="cert-card-emp">
            <div class="avatar-sm" style="background:${emp ? avatarBg(emp.level) : "#8494a1"}">${escapeHtml(emp ? initials(emp.nameEn) : "?")}</div>
            <span>${escapeHtml(emp ? emp.nameEn : c.employeeId)}</span>
          </div>
          <div class="cert-card-expiry" style="color:${status.color}">${escapeHtml(status.label)}${c.expiry ? ` · ${escapeHtml(c.expiry)}` : ""}</div>
          ${linkBtn}
        </div>
        <button class="btn-icon" title="ลบใบเซอร์" data-action="delete-certificate" data-id="${escapeHtml(c.id)}">${icons.trash}</button>
      </div>
    `;
  }).join("");

  return `
    <div>
      <div class="task-kpi-row" style="grid-template-columns:repeat(3,1fr)">
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#5a6a78"></div>
          <div class="kpi-label">ใบเซอร์ทั้งหมด · Total</div>
          <div class="kpi-value">${total}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#e0902e"></div>
          <div class="kpi-label">ใกล้หมดอายุ · Expiring soon</div>
          <div class="kpi-value" style="color:#e0902e">${soonCount}</div>
        </div>
        <div class="card card-sm">
          <div class="kpi-stripe" style="background:#dc2626"></div>
          <div class="kpi-label">หมดอายุแล้ว · Expired</div>
          <div class="kpi-value" style="color:#dc2626">${expiredCount}</div>
        </div>
      </div>

      <div class="card" style="padding:18px 22px">
        <div class="section-title" style="margin-bottom:12px">เพิ่มใบเซอร์ใหม่ <small>· New certificate</small></div>
        <div class="assign-row">
          <label class="assign-field employee">พนักงาน
            <select class="field-input" id="cert-emp-select">${empOptions}</select>
          </label>
          <label class="assign-field title">ชื่อ/ประเภทใบเซอร์
            <input class="field-input" id="cert-name-input" value="${escapeHtml(form.name)}" placeholder="เช่น Forklift Operator">
          </label>
          <label class="assign-field due">วันหมดอายุ
            <input type="date" class="field-input" id="cert-expiry-input" value="${escapeHtml(form.expiry)}">
          </label>
          <label class="assign-field due">รูป/ไฟล์ใบเซอร์
            <input type="file" accept="image/*" class="field-input" id="cert-image-input">
          </label>
          <label class="assign-field title">หรือวางลิงก์เอกสาร (URL)
            <input class="field-input" id="cert-link-input" value="${escapeHtml(isSafeLink(form.image) ? form.image : "")}" placeholder="เช่น https://drive.google.com/...">
          </label>
          <button class="btn-gradient" data-action="add-certificate">${icons.plus} เพิ่มใบเซอร์</button>
        </div>
        ${form.image && looksLikeImage(form.image)
          ? `<div class="station-manage-preview"><img src="${escapeHtml(form.image)}" alt=""><span>ตัวอย่างรูปที่เลือก</span></div>`
          : form.image
          ? `<div class="station-manage-preview"><span>ลิงก์ที่ใส่: ${escapeHtml(form.image)}</span></div>`
          : ""}
      </div>

      <div class="cert-grid">${cards || `<div class="task-empty">ยังไม่มีใบเซอร์</div>`}</div>
    </div>
  `;
}
