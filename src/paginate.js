import { esc } from './utils.js';

// Canonical slide design size — kept in sync with .slide-box-inner / .slide-canvas in styles.css.
// Pagination decisions are made against this fixed size; the actual on-screen box is just
// zoomed to fit its container afterward, so text never reflows differently per device.
export const CANON_W = 1100;
export const CANON_H = Math.round(CANON_W * 9 / 16); // 619
const FIT_BUDGET = CANON_H - 12; // small safety margin so nothing sits flush against the edge

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
    ? `<div class="photo-gallery">${Array.from({ length: photoCount }).map(() => '<div style="width:100%;height:160px;"></div>').join('')}</div>`
    : '';
  el.innerHTML =
    `<div class="case-slide-head">${headerHtml}</div>` +
    `<div class="case-grid" style="grid-template-columns:${showPhotos ? `${colSplit}% ${100 - colSplit}%` : '1fr'}">` +
    `<div>${blocksHtml}</div>${showPhotos ? `<div>${photosHtml}</div>` : ''}` +
    `</div>`;
  return el.scrollHeight;
}

function fitsBudget(headerHtml, blocks, showPhotos, photoCount, fontScale, colSplit) {
  const blocksHtml = blocks.map(b =>
    `<div class="block"><span class="lbl">${esc(b.label)}</span><div class="val">${esc(b.val)}</div></div>`
  ).join('');
  return measureHeight(headerHtml, blocksHtml, showPhotos, photoCount, fontScale, colSplit) <= FIT_BUDGET;
}

// Finds the longest prefix of `text` such that `precedingBlocks` plus a block of
// {label, val: prefix+'…'} still fits the budget. Returns 0 if not even one character fits.
function maxFittingPrefix(headerHtml, precedingBlocks, label, text, showPhotos, photoCount, fontScale, colSplit) {
  let lo = 0, hi = text.length, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const candidate = mid < text.length ? text.slice(0, mid).trimEnd() + '…' : text.slice(0, mid);
    const ok = fitsBudget(headerHtml, [...precedingBlocks, { label, val: candidate || '…' }], showPhotos, photoCount, fontScale, colSplit);
    if (ok) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return best;
}

// Splits one case's fields across as many pages as needed so each page's rendered
// height fits within the canonical slide height. Photos (if any) are shown only
// on the first page so continuation pages get full width for text. If a single
// field is long enough to overflow a page by itself, its own text is split across
// as many continuation pages as it needs — nothing is ever left to overflow unbounded.
export function paginateCase(c, fontScale = 1, colSplit = 55) {
  const blocks = buildBlockList(c);
  const hasPhotos = !!(c.photos && c.photos.length);
  const headerHtml = `<span class="tag">CASE</span><span class="hn">HN ${esc(c.hn)}</span>`;

  const pages = [];
  let remaining = [...blocks];
  let pageNum = 1;
  const SAFETY_MAX_PAGES = 60;

  while (remaining.length > 0 && pages.length < SAFETY_MAX_PAGES) {
    const showPhotos = pageNum === 1 && hasPhotos;
    const photoCount = c.photos ? c.photos.length : 0;
    let chosen = [];
    let consumedWhole = 0;
    let splitOverflow = null; // { index, leftoverVal } when a block had to be split mid-page

    for (let i = 0; i < remaining.length; i++) {
      const block = remaining[i];
      const tentative = [...chosen, block];
      if (fitsBudget(headerHtml, tentative, showPhotos, photoCount, fontScale, colSplit)) {
        chosen = tentative;
        consumedWhole = i + 1;
        continue;
      }
      // Whole block doesn't fit — try fitting as much of its text as possible on this page.
      const fitLen = maxFittingPrefix(headerHtml, chosen, block.label, block.val, showPhotos, photoCount, fontScale, colSplit);
      if (fitLen > 0) {
        chosen.push({ label: block.label, val: block.val.slice(0, fitLen).trimEnd() + '…' });
        splitOverflow = { index: i, leftoverVal: block.val.slice(fitLen).trimStart() };
      } else if (chosen.length === 0) {
        // Nothing fits at all on an empty page (pathological case) — force at least
        // half the text through so we always make forward progress.
        const fallbackLen = Math.max(1, Math.floor(block.val.length / 2));
        chosen.push({ label: block.label, val: block.val.slice(0, fallbackLen).trimEnd() + '…' });
        splitOverflow = { index: i, leftoverVal: block.val.slice(fallbackLen).trimStart() };
      }
      // else: this block doesn't fit even partially alongside what's chosen — leave it
      // entirely for the next page.
      break;
    }

    if (chosen.length === 0) {
      // Absolute fallback: shouldn't normally happen, but guarantees progress.
      chosen = [remaining[0]];
      consumedWhole = 1;
    }

    pages.push({ blocks: chosen, showPhotos });

    if (splitOverflow) {
      const rest = [...remaining];
      if (splitOverflow.leftoverVal) {
        rest[splitOverflow.index] = { label: remaining[splitOverflow.index].label, val: splitOverflow.leftoverVal };
        remaining = rest.slice(splitOverflow.index);
      } else {
        remaining = rest.slice(splitOverflow.index + 1);
      }
    } else {
      remaining = remaining.slice(consumedWhole);
    }
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
