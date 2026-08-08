import { lvlColor, avatarBg, initials, passColor, escapeHtml } from "../format.js";

export function renderList({ employees }) {
  const rows = employees.map((e) => `
    <div class="list-row-grid list-row" data-action="open-emp" data-id="${escapeHtml(e.id)}">
      <div class="list-code">${escapeHtml(e.empCode)}</div>
      <div class="list-name-cell">
        <div class="avatar-sm" style="background:${avatarBg(e.level)}">${escapeHtml(initials(e.nameEn))}</div>
        <div style="min-width:0">
          <div class="list-name-en">${escapeHtml(e.nameEn)}</div>
          <div class="list-name-th">${escapeHtml(e.name)}</div>
        </div>
      </div>
      <div class="list-position">${escapeHtml(e.position)}</div>
      <div><span class="level-badge" style="background:${lvlColor(e.level)}">${escapeHtml(e.level)}</span></div>
      <div class="list-avg-cell">
        <div class="list-avg-track"><div class="bar-fill" style="width:${e.avg}%;background:${lvlColor(e.level)};height:100%"></div></div>
        <span class="list-avg-num">${e.avg}%</span>
      </div>
      <div class="list-pass-cell" style="color:${passColor(e.pass)}">${e.pass}%</div>
      <div class="list-actions-cell">
        <button class="btn-edit-row" data-action="edit-emp" data-id="${escapeHtml(e.id)}">แก้ไข</button>
      </div>
    </div>
  `).join("");

  return `
    <div class="list-card">
      <div class="list-inner">
        <div class="list-row-grid list-head">
          <div>รหัส</div><div>ชื่อ - สกุล</div><div>ตำแหน่ง</div><div>ระดับ</div><div>คะแนนเฉลี่ย</div><div style="text-align:center">Pass</div><div></div>
        </div>
        ${rows}
      </div>
    </div>
  `;
}
