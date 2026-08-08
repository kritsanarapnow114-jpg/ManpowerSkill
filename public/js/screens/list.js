import { lvlColor, avatarBg, initials, passColor, avgOf, escapeHtml } from "../format.js";

export function renderList({ employees }) {
  const cards = employees.map((e) => {
    const avgG1 = avgOf(e.g1.map((a) => a.v));
    const avgG2 = avgOf(e.g2.map((a) => a.v));
    const stnQualified = e.st.filter((s) => s.v >= 80).length;
    const tasksDone = e.tasks.filter((t) => t.progress >= 100).length;

    const photo = e.photo
      ? `<img class="player-card-photo" src="${escapeHtml(e.photo)}" alt="">`
      : `<div class="player-card-photo player-card-photo-empty">${escapeHtml(initials(e.nameEn))}</div>`;

    return `
      <div class="player-card-wrap" data-action="open-emp" data-id="${escapeHtml(e.id)}">
        <div class="player-card-inner">
          <div class="player-card-face player-card-front" style="background:${avatarBg(e.level)}">
            <div class="player-card-rating">
              <div class="player-card-rating-num">${e.pass}</div>
              <div class="player-card-rating-lvl">${escapeHtml(e.level)}</div>
            </div>
            <div class="player-card-photo-wrap">${photo}</div>
            <div class="player-card-name">${escapeHtml(e.nameEn)}</div>
            <div class="player-card-name-th">${escapeHtml(e.name)}</div>
            <div class="player-card-pos">${escapeHtml(e.position)} · ${escapeHtml(e.empCode)}</div>
            <div class="player-card-mini-stats">
              <div><span>${avgG1}</span><label>ADV</label></div>
              <div><span>${avgG2}</span><label>SKL</label></div>
              <div><span>${stnQualified}/${e.st.length}</span><label>STN</label></div>
            </div>
          </div>

          <div class="player-card-face player-card-back">
            <div class="player-card-back-head">
              <div style="min-width:0">
                <div class="list-name-en">${escapeHtml(e.nameEn)}</div>
                <div class="list-name-th">${escapeHtml(e.name)}</div>
              </div>
              <span class="level-badge" style="background:${lvlColor(e.level)}">${escapeHtml(e.level)}</span>
            </div>
            <div class="employee-card-meta" style="margin-top:6px">
              <span class="list-code">${escapeHtml(e.empCode)}</span>
              <span class="employee-card-dot">·</span>
              <span class="list-position">${escapeHtml(e.position)}</span>
            </div>
            <div class="player-card-back-stats">
              <div class="player-card-back-stat-row"><span>Advance standard</span><b style="color:#2f8fd0">${avgG1}%</b></div>
              <div class="player-card-back-stat-row"><span>Skill judgment</span><b style="color:#c78912">${avgG2}%</b></div>
              <div class="player-card-back-stat-row"><span>Pass rate</span><b style="color:${passColor(e.pass)}">${e.pass}%</b></div>
              <div class="player-card-back-stat-row"><span>สถานีที่ผ่าน (≥80%)</span><b>${stnQualified}/${e.st.length}</b></div>
              <div class="player-card-back-stat-row"><span>งานที่เสร็จ</span><b>${tasksDone}/${e.tasks.length}</b></div>
            </div>
            <button class="btn-edit-row player-card-back-edit" data-action="edit-emp" data-id="${escapeHtml(e.id)}">แก้ไขคะแนน →</button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <img class="fls-banner" src="/img/fls-bg.png" alt="FLS Group">
    <div class="player-card-grid">${cards}</div>
  `;
}
