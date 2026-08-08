import { lvlColor, initials, passColor, avgOf, escapeHtml } from "../format.js";

function statAbbr(en) {
  return (en || "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
}

export function renderList({ employees }) {
  const cards = employees.map((e) => {
    const avgG1 = avgOf(e.g1.map((a) => a.v));
    const avgG2 = avgOf(e.g2.map((a) => a.v));
    const stnQualified = e.st.filter((s) => s.v >= 80).length;
    const tasksDone = e.tasks.filter((t) => t.progress >= 100).length;
    const gradId = "shieldGrad-" + e.id;
    const patId = "shieldPat-" + e.id;

    const photo = e.photo
      ? `<img class="player-card-photo" src="${escapeHtml(e.photo)}" alt="">`
      : `<div class="player-card-photo player-card-photo-empty">${escapeHtml(initials(e.nameEn))}</div>`;

    const statCells = e.g1.map((a) => `
      <div class="player-card-stat-cell">
        <b>${a.v}</b>
        <span>${escapeHtml(statAbbr(a.en))}</span>
      </div>
    `).join("");

    return `
      <div class="player-card-wrap" data-action="open-emp" data-id="${escapeHtml(e.id)}">
        <div class="player-card-inner">
          <div class="player-card-face player-card-front">
            <svg class="player-card-shield" viewBox="0 0 240 336" preserveAspectRatio="none">
              <defs>
                <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#f8e2a0"/>
                  <stop offset="35%" stop-color="#e0b358"/>
                  <stop offset="70%" stop-color="#c6963f"/>
                  <stop offset="100%" stop-color="#9c7328"/>
                </linearGradient>
                <pattern id="${patId}" width="16" height="16" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(255,255,255,.10)" stroke-width="2"/>
                </pattern>
              </defs>
              <path class="player-card-shield-path" d="M20,34 C20,14 36,4 62,4 L178,4 C204,4 220,14 220,34 L220,248 C220,259 218,268 210,278 C193,299 158,317 120,332 C82,317 47,299 30,278 C22,268 20,259 20,248 Z" fill="url(#${gradId})"/>
              <path d="M20,34 C20,14 36,4 62,4 L178,4 C204,4 220,14 220,34 L220,248 C220,259 218,268 210,278 C193,299 158,317 120,332 C82,317 47,299 30,278 C22,268 20,259 20,248 Z" fill="url(#${patId})"/>
            </svg>
            <div class="player-card-content">
              <div class="player-card-rating">
                <div class="player-card-rating-num">${e.pass}</div>
                <div class="player-card-rating-lvl">${escapeHtml(e.level)}</div>
              </div>
              <div class="player-card-crest">NBC</div>
              <div class="player-card-photo-wrap">${photo}</div>
              <div class="player-card-name">${escapeHtml(e.nameEn)}</div>
              <div class="player-card-name-th">${escapeHtml(e.name)}</div>
              <div class="player-card-divider"></div>
              <div class="player-card-stats-grid">${statCells}</div>
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

  return `<div class="player-card-grid">${cards}</div>`;
}
