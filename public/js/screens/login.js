import { escapeHtml } from "../format.js";

export function renderLogin({ form }) {
  return `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-logo">NB</div>
        <div class="login-title">NBC Skills</div>
        <div class="login-sub">เข้าสู่ระบบเพื่อใช้งาน</div>
        ${form.error ? `<div class="login-error">${escapeHtml(form.error)}</div>` : ""}
        <label class="field-label">ชื่อผู้ใช้
          <input class="field-input" id="login-username" value="${escapeHtml(form.username)}" autocomplete="username" data-login-field autofocus>
        </label>
        <label class="field-label">รหัสผ่าน
          <input class="field-input" id="login-password" type="password" value="${escapeHtml(form.password)}" autocomplete="current-password" placeholder="••••••••" data-login-field>
        </label>
        <button class="btn-gradient login-submit" data-action="login" ${form.loading ? "disabled" : ""}>${form.loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
      </div>
    </div>
  `;
}
