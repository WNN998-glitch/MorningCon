import { esc } from './utils.js';

// Canonical slide design size — kept in sync with .slide-box-inner / .slide-canvas in styles.css.
// Pagination decisions are made against this fixed size; the actual on-screen box is just
// zoomed to fit its container afterward, so text never reflows differently per device.
export const CANON_W = 1100;
export const CANON_H = Math.round(CANON_W * 9 / 16); // 619

function buildBlockList(c) {
  const blockDefs = [
    ['Chief Complaint', c.cc, true],
    ['Present Illness', c.hpi, false],
    ['Physical Examination', c.pe, false],
    ['Investigation', c.inv, false],
    ['Diagnosis', c.dx, true],
    ['Management', c.mgmt, false],
  ];
  return blockDefs
    .filter(([, val, required]) => required || (val && val.trim()))
    .map(([label, val]) => ({ label, val: val && val.trim() ? val : '—' }));
}

let measureEl = null;
function getMeasureEl() {
  if (measureEl) return measureEl;
  measureEl = document.createElement('div');
  measureEl.className = 'slide-box-inner';
  measureEl.style.position = 'fixed';
  measureEl.style.left = '-9999px';
  measureEl.style.top = '0';
  measureEl.style.width = CANON_W + 'px';
  measureEl.style.height = 'auto';
  measureEl.style.visibility = 'hidden';
  measureEl.style.pointerEvents = 'none';
  document.body.appendChild(measureEl);
  return measureEl;
}

function measureHeight(headerHtml, blocksHtml, showPhotos, photoCount, fontScale, colSplit) {
  const el = getMeasureEl();
  el.style.setProperty('--ufont', fontScale);
  const photosHtml = showPhotos
    ? `<div class="photo-gallery">${Array.from({ length: photoCount }).map(() => '<div style="width:100%;height:180px;"></div>').join('')}</div>`
    : '';
  el.innerHTML =
    `<div class="case-slide-head">${headerHtml}</div>` +
    `<div class="case-grid" style="grid-template-columns:${showPhotos ? `${colSplit}% ${100 - colSplit}%` : '1fr'}">` +
    `<div>${blocksHtml}</div>${showPhotos ? `<div>${photosHtml}</div>` : ''}` +
    `</div>`;
  return el.scrollHeight;
}

// Splits one case's fields across as many pages as needed so each page's rendered
// height fits within the canonical slide height. Photos (if any) are shown only
// on the first page so continuation pages get full width for text.
export function paginateCase(c, fontScale = 1, colSplit = 55) {
  const blocks = buildBlockList(c);
  const hasPhotos = !!(c.photos && c.photos.length);
  const headerHtml = `<span class="tag">CASE</span><span class="hn">HN ${esc(c.hn)}</span>`;

  const pages = [];
  let remaining = [...blocks];
  let pageNum = 1;

  while (remaining.length > 0) {
    const showPhotos = pageNum === 1 && hasPhotos;
    let chosen = [];
    for (let i = 0; i < remaining.length; i++) {
      const tentative = [...chosen, remaining[i]];
      const blocksHtml = tentative.map(b =>
        `<div class="block"><span class="lbl">${esc(b.label)}</span><div class="val">${esc(b.val)}</div></div>`
      ).join('');
      const h = measureHeight(headerHtml, blocksHtml, showPhotos, c.photos ? c.photos.length : 0, fontScale, colSplit);
      if (h <= CANON_H || tentative.length === 1) {
        chosen = tentative;
      } else {
        break;
      }
    }
    if (chosen.length === 0) chosen = [remaining[0]]; // safety: always make progress
    pages.push({ blocks: chosen, showPhotos });
    remaining = remaining.slice(chosen.length);
    pageNum++;
  }
  if (pages.length === 0) pages.push({ blocks: [], showPhotos: hasPhotos });
  return pages;
}

// For Slide View: paginated into as many fixed-size slides as each case needs.
export function buildSlides(cases, fontScale = 1, colSplit = 55) {
  const sorted = [...cases].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const s = [];
  if (sorted.length > 1) s.push({ type: 'summary', cases: sorted });
  sorted.forEach((c, i) => {
    const pages = paginateCase(c, fontScale, colSplit);
    pages.forEach((p, pIdx) => {
      s.push({
        type: 'case',
        case: c,
        index: i + 1,
        total: sorted.length,
        blocks: p.blocks,
        showPhotos: p.showPhotos,
        part: pIdx + 1,
        partTotal: pages.length,
      });
    });
  });
  return s;
}

// For Scroll View: one continuous entry per case, full content, never split.
export function buildContinuousSlides(cases) {
  const sorted = [...cases].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const s = [];
  if (sorted.length > 1) s.push({ type: 'summary', cases: sorted });
  sorted.forEach((c, i) => {
    s.push({
      type: 'case',
      case: c,
      index: i + 1,
      total: sorted.length,
      blocks: buildBlockList(c),
      showPhotos: !!(c.photos && c.photos.length),
      part: 1,
      partTotal: 1,
    });
  });
  return s;
}
