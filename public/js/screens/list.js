import { lvlColor, avatarBg, initials, passColor, escapeHtml } from "../format.js";

export function renderList({ employees }) {
  const cards = employees.map((e) => `
    <div class="employee-card" data-action="open-emp" data-id="${escapeHtml(e.id)}">
      <div class="employee-card-top">
        <div class="avatar-sm" style="background:${avatarBg(e.level)}">${escapeHtml(initials(e.nameEn))}</div>
        <div style="min-width:0;flex:1">
          <div class="list-name-en">${escapeHtml(e.nameEn)}</div>
          <div class="list-name-th">${escapeHtml(e.name)}</div>
        </div>
        <span class="level-badge" style="background:${lvlColor(e.level)}">${escapeHtml(e.level)}</span>
      </div>

      <div class="employee-card-meta">
        <span class="list-code">${escapeHtml(e.empCode)}</span>
        <span class="employee-card-dot">·</span>
        <span class="list-position">${escapeHtml(e.position)}</span>
        ${e.gender ? `<span class="employee-card-dot">·</span><span class="list-position">${escapeHtml(e.gender)}</span>` : ""}
      </div>

      <div class="employee-card-stats">
        <div class="employee-card-stat">
          <div class="employee-card-stat-label">คะแนนเฉลี่ย</div>
          <div class="list-avg-cell">
            <div class="list-avg-track"><div class="bar-fill" style="width:${e.avg}%;background:${lvlColor(e.level)};height:100%"></div></div>
            <span class="list-avg-num">${e.avg}%</span>
          </div>
        </div>
        <div class="employee-card-stat employee-card-stat-pass">
          <div class="employee-card-stat-label">Pass</div>
          <div class="list-pass-cell" style="color:${passColor(e.pass)}">${e.pass}%</div>
        </div>
      </div>

      <button class="btn-edit-row employee-card-edit" data-action="edit-emp" data-id="${escapeHtml(e.id)}">แก้ไข</button>
    </div>
  `).join("");

  return `<div class="employee-card-grid">${cards}</div>`;
}
