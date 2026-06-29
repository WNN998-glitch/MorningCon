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

// Finds the longest prefix of `text`, preferring whole-word boundaries, such that
// `precedingBlocks` plus a block of {label, val: prefix+'…'} still fits the budget.
// Falls back to character-level splitting only when a single token is itself too
// long to fit (e.g. one giant unbroken run with no spaces).
function splitToFit(headerHtml, precedingBlocks, label, text, showPhotos, photoCount, fontScale, colSplit) {
  const fits = (val) => fitsBudget(headerHtml, [...precedingBlocks, { label, val: val || '…' }], showPhotos, photoCount, fontScale, colSplit);

  // Word-boundary search first — keeps separators so rejoining is exact.
  const tokens = text.split(/(\s+)/);
  let lo = 0, hi = tokens.length, bestWords = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const joined = tokens.slice(0, mid).join('');
    const candidate = mid < tokens.length ? joined.trimEnd() + '…' : joined;
    if (fits(candidate)) { bestWords = mid; lo = mid + 1; } else { hi = mid - 1; }
  }

  if (bestWords > 0) {
    return {
      fitText: tokens.slice(0, bestWords).join('').trimEnd(),
      leftover: tokens.slice(bestWords).join('').trimStart(),
    };
  }

  // Not even one whole word/token fits — the very first token is itself too long
  // (e.g. one giant run with no spaces). Binary search characters within it.
  const firstToken = tokens[0] || '';
  let clo = 0, chi = firstToken.length, bestChars = 0;
  while (clo <= chi) {
    const cmid = (clo + chi) >> 1;
    const candidate = cmid < firstToken.length ? firstToken.slice(0, cmid).trimEnd() + '…' : firstToken.slice(0, cmid);
    if (fits(candidate)) { bestChars = cmid; clo = cmid + 1; } else { chi = cmid - 1; }
  }
  if (bestChars > 0) {
    return {
      fitText: firstToken.slice(0, bestChars).trimEnd(),
      leftover: firstToken.slice(bestChars).trimStart() + tokens.slice(1).join(''),
    };
  }

  // Genuinely nothing fits (pathological — e.g. font scale set absurdly high on an
  // already-tiny budget). Force exactly one character through so we still make progress.
  return {
    fitText: (firstToken.slice(0, 1) || text.slice(0, 1)) + '…',
    leftover: (firstToken.slice(1) || text.slice(1)) + tokens.slice(1).join(''),
  };
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
      // If something's already chosen and not even a sliver of this block fits
      // alongside it, defer the whole block to the next page instead of cramming
      // in an awkward one-character fragment.
      if (chosen.length > 0 && !fitsBudget(headerHtml, [...chosen, { label: block.label, val: '…' }], showPhotos, photoCount, fontScale, colSplit)) {
        break;
      }

      // Whole block doesn't fit — fit as much of its text as possible on this page,
      // preferring whole-word breaks.
      const { fitText, leftover } = splitToFit(headerHtml, chosen, block.label, block.val, showPhotos, photoCount, fontScale, colSplit);
      chosen.push({ label: block.label, val: fitText });
      splitOverflow = { index: i, leftoverVal: leftover };
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
