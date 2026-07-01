import React, { useState, useEffect, useRef, useMemo } from 'react';
import PptxGenJS from 'pptxgenjs';
import { buildSlides, buildContinuousSlides, CANON_W, CANON_H } from './paginate.js';

function SlideContent({ slide, onPhotoClick, colSplit = 55 }) {
  if (slide.type === 'cover') {
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return (
      <div className="slide-cover">
        <div className="cover-eyebrow">Morning Report</div>
        <div className="cover-title">{slide.title}</div>
        <div className="cover-date">{dateStr}</div>
        <div className="cover-count">{slide.caseCount} {slide.caseCount === 1 ? 'case' : 'cases'}</div>
      </div>
    );
  }
  if (slide.type === 'summary') {
    return (
      <div className="slide-summary">
        <h2>Morning Report Summary</h2>
        <div className="sub">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {slide.cases.length} cases</div>
        <table className="sum">
          <tr><th>#</th><th>HN</th><th>Chief Complaint</th><th>Diagnosis</th></tr>
          {slide.cases.map((c, i) => (
            <tr key={c.id}>
              <td className="sum-idx">{String(i + 1).padStart(2, '0')}</td>
              <td>{c.hn}</td><td>{c.cc}</td><td>{c.dx || '—'}</td>
            </tr>
          ))}
        </table>
      </div>
    );
  }
  const c = slide.case;
  return (
    <>
      <div className="case-slide-head">
        <span className="tag">
          CASE {String(slide.index).padStart(2, '0')} / {String(slide.total).padStart(2, '0')}
          {slide.partTotal > 1 ? `  ·  PART ${slide.part}/${slide.partTotal}` : ''}
        </span>
        <span className="hn">HN {c.hn}</span>
      </div>
      <div className="case-grid" style={{ gridTemplateColumns: slide.showPhotos ? `${colSplit}% ${100 - colSplit}%` : '1fr' }}>
        <div>
          {slide.blocks.map((b, i) => (
            <div className="block" key={i}>
              <span className="lbl">{b.label}</span>
              <div className={`val ${b.label === 'Diagnosis' ? 'dx' : ''}`}>{b.val}</div>
            </div>
          ))}
        </div>
        {slide.showPhotos && (
          <div>
            <div className="photo-gallery">
              {c.photos.map((p, i) => <img key={i} src={p} onClick={() => onPhotoClick(p)} />)}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Fits a fixed-size canonical box into whatever container it's placed in (uniform zoom,
// like a slide on a projector) — never reflows or shrinks the content itself.
function useFitBox(targetW, targetH) {
  const boxRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    function measure() {
      const s = Math.min(box.clientWidth / targetW, box.clientHeight / targetH);
      setScale(Number.isFinite(s) && s > 0 ? s : 1);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [targetW, targetH]);
  return { boxRef, scale };
}

function SlidePage({ slide, onPhotoClick, colSplit }) {
  const { boxRef, scale } = useFitBox(CANON_W, CANON_H);
  return (
    <div className="slide-box" ref={boxRef}>
      <div className="slide-canvas" style={{ width: CANON_W, height: CANON_H, transform: `scale(${scale})` }}>
        <div className="slide-box-inner">
          <SlideContent slide={slide} onPhotoClick={onPhotoClick} colSplit={colSplit} />
        </div>
      </div>
    </div>
  );
}

function ContinuousPage({ slide, onPhotoClick, colSplit }) {
  return (
    <div className="cv-page">
      <SlideContent slide={slide} onPhotoClick={onPhotoClick} colSplit={colSplit} />
    </div>
  );
}

export default function Present({ cases }) {
  const [mode, setMode] = useState('idle'); // 'idle' | 'presenting'
  const [subView, setSubView] = useState('slide'); // 'slide' | 'scroll'
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [colSplit, setColSplit] = useState(55);
  const [theme, setTheme] = useState('dark');
  const [coverTitle, setCoverTitle] = useState('');
  const touchX = useRef(null);

  function makeCoverSlide(title, caseCount) {
    return { type: 'cover', title: title.trim() || 'Morning Report', caseCount };
  }

  const slides = useMemo(() => {
    const base = buildSlides(cases, fontScale, colSplit);
    if (coverTitle !== null) return [makeCoverSlide(coverTitle, cases.length), ...base];
    return base;
  }, [cases, fontScale, colSplit, coverTitle]);

  const continuousSlides = useMemo(() => {
    const base = buildContinuousSlides(cases);
    if (coverTitle !== null) return [makeCoverSlide(coverTitle, cases.length), ...base];
    return base;
  }, [cases, coverTitle]);

  // Mirror the theme onto <body> too (not just #slideshow) — printing renders the
  // body background directly, so this keeps the printed PDF matching what's on screen.
  useEffect(() => {
    if (mode === 'presenting') {
      document.body.classList.toggle('theme-light', theme === 'light');
    } else {
      document.body.classList.remove('theme-light');
    }
    return () => document.body.classList.remove('theme-light');
  }, [theme, mode]);

  function adjustFont(delta) {
    setFontScale(s => Math.min(1.6, Math.max(0.6, +(s + delta).toFixed(2))));
  }
  function adjustCols(delta) {
    setColSplit(v => Math.min(75, Math.max(30, v + delta)));
  }

  function startPresenting() {
    if (!cases.length) return;
    setIdx(0);
    setSubView('slide');
    setMode('presenting');
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function exitPresenting() {
    setMode('idle');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }
  function switchSubView(v) {
    setSubView(v);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function printToPdf() {
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => window.print(), 80);
  }

  // Nudge the slide-fit measurement right as print media activates, since the
  // print-only slide canvases are hidden (and unmeasured) until that moment.
  useEffect(() => {
    function onBeforePrint() { window.dispatchEvent(new Event('resize')); }
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, []);

  // Printing forces the browser out of fullscreen for the print dialog and doesn't
  // restore it afterward — re-request it once the dialog closes.
  useEffect(() => {
    function onAfterPrint() {
      if (mode === 'presenting') document.documentElement.requestFullscreen?.().catch(() => {});
    }
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [mode]);

  function next() { setIdx(i => Math.min(i + 1, slides.length - 1)); }
  function prev() { setIdx(i => Math.max(i - 1, 0)); }

  useEffect(() => {
    if (mode !== 'presenting' || subView !== 'slide') return;
    function onKey(e) {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') exitPresenting();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, subView, slides.length]);

  async function exportPptx() {
    if (!cases.length) return;
    setExporting(true);
    try {
      const pres = new PptxGenJS();
      pres.layout = 'LAYOUT_16x9';
      const PALETTE = {
        dark:  { DARK:'0A0D0F', TEXT:'D7E0E0', ACCENT:'E0A458', DIM:'7D8C8C', ACCENT2:'4FB8A8' },
        light: { DARK:'F5F3EF', TEXT:'1B2220', ACCENT:'B5742A', DIM:'5B6663', ACCENT2:'2F8A7A' },
      };
      const { DARK, TEXT, ACCENT, DIM, ACCENT2 } = PALETTE[theme];
      const FULL_W = 9.2; // usable slide width in inches at LAYOUT_16x9, minus margins

      slides.forEach(slide => {
        const s = pres.addSlide(); s.background = { color: DARK };

        if (slide.type === 'cover') {
          const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          s.addText('MORNING REPORT', { x:0.4, y:2.2, w:FULL_W, h:0.4, fontFace:'Courier New', fontSize:14*fontScale, color:DIM, bold:false, align:'center', charSpacing:6 });
          s.addText(slide.title, { x:0.4, y:2.7, w:FULL_W, h:1.4, fontFace:'Courier New', fontSize:38*fontScale, color:ACCENT, bold:true, align:'center' });
          s.addText(dateStr, { x:0.4, y:4.3, w:FULL_W, h:0.35, fontFace:'Courier New', fontSize:13*fontScale, color:DIM, align:'center' });
          s.addText(String(slide.caseCount) + (slide.caseCount === 1 ? ' case' : ' cases'), { x:0.4, y:4.75, w:FULL_W, h:0.3, fontFace:'Courier New', fontSize:11*fontScale, color:ACCENT2, align:'center' });
          return;
        }

        if (slide.type === 'summary') {
          s.addText('MORNING REPORT SUMMARY', { x:0.4,y:0.3,w:FULL_W,h:0.5,fontFace:'Courier New',fontSize:20*fontScale,color:ACCENT,bold:true });
          s.addText(new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'  ·  '+slide.cases.length+' cases',
            { x:0.4,y:0.78,w:FULL_W,h:0.3,fontFace:'Courier New',fontSize:11*fontScale,color:DIM });
          const rows = [[
            {text:'#',options:{color:ACCENT2,bold:true}},
            {text:'HN',options:{color:ACCENT2,bold:true}},
            {text:'Chief Complaint',options:{color:ACCENT2,bold:true}},
            {text:'Diagnosis',options:{color:ACCENT2,bold:true}}
          ]];
          slide.cases.forEach((c,i)=>rows.push([String(i+1).padStart(2,'0'), c.hn||'', c.cc||'', c.dx||'—']));
          s.addTable(rows, { x:0.4,y:1.25,w:FULL_W,fontFace:'Courier New',fontSize:11*fontScale,color:TEXT,border:{type:'solid',color:'232B2F',pts:0.5},autoPage:false });
          return;
        }

        const c = slide.case;
        const partLabel = slide.partTotal > 1 ? `  ·  PART ${slide.part}/${slide.partTotal}` : '';
        s.addText(`CASE ${String(slide.index).padStart(2,'0')} / ${String(slide.total).padStart(2,'0')}${partLabel}`,
          { x:0.4,y:0.25,w:6.5,h:0.35,fontFace:'Courier New',fontSize:13*fontScale,color:ACCENT,bold:true });
        s.addText('HN '+(c.hn||''), { x:7,y:0.25,w:2.2,h:0.35,fontFace:'Courier New',fontSize:11*fontScale,color:DIM,align:'right' });

        const textW = slide.showPhotos ? (FULL_W * colSplit / 100) - 0.15 : FULL_W;
        let y = 0.75;
        slide.blocks.forEach(b => {
          const charsPerLine = Math.max(20, textW * 9);
          const lines = Math.max(1, Math.ceil(b.val.length / charsPerLine));
          const h = Math.min(2.2, (0.32 + lines * 0.18) * fontScale);
          s.addText(b.label.toUpperCase(), { x:0.4,y,w:textW,h:0.22,fontFace:'Courier New',fontSize:9*fontScale,color:ACCENT2,bold:true });
          s.addText(b.val, { x:0.4,y:y+0.22,w:textW,h,fontFace:'Courier New',fontSize:11*fontScale,color:b.label==='Diagnosis'?ACCENT:TEXT,valign:'top' });
          y += h + 0.3;
        });

        if (slide.showPhotos && c.photos && c.photos.length) {
          const photoX = 0.4 + textW + 0.2;
          const photoW = FULL_W - textW - 0.2;
          let py = 0.75;
          c.photos.slice(0, 4).forEach(photo => {
            try { s.addImage({ data: photo, x: photoX, y: py, w: photoW, h: 1.65 }); } catch (e) {}
            py += 1.8;
          });
        }
      });

      await pres.writeFile({ fileName: 'morning-report-'+new Date().toISOString().slice(0,10)+'.pptx' });
    } catch (err) {
      console.error(err);
      alert('PPTX export failed: ' + err.message);
    }
    setExporting(false);
  }

  if (mode === 'presenting') {
    return (
      <div id="slideshow" className={theme === 'light' ? 'theme-light' : ''} style={{ '--ufont': fontScale }}
        onTouchStart={e => touchX.current = e.touches[0].clientX}
        onTouchEnd={e => {
          if (touchX.current == null || subView !== 'slide') return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (dx < -50) next();
          if (dx > 50) prev();
          touchX.current = null;
        }}>
        <div className="present-toolbar no-print">
          <div className="toolbar-left">
            <button className={`pill ${subView==='slide'?'active':''}`} onClick={()=>switchSubView('slide')}>Slide View</button>
            <button className={`pill ${subView==='scroll'?'active':''}`} onClick={()=>switchSubView('scroll')}>Scroll View</button>
            <div className="font-adjust">
              <button onClick={()=>adjustFont(-0.1)} disabled={fontScale<=0.6} title="Smaller text">A−</button>
              <span>{Math.round(fontScale*100)}%</span>
              <button onClick={()=>adjustFont(0.1)} disabled={fontScale>=1.6} title="Larger text">A+</button>
            </div>
            <div className="font-adjust">
              <button onClick={()=>adjustCols(-5)} disabled={colSplit<=30} title="More room for photos">◀</button>
              <span>{colSplit}/{100-colSplit}</span>
              <button onClick={()=>adjustCols(5)} disabled={colSplit>=75} title="More room for text">▶</button>
            </div>
            <button className="pill" onClick={()=>setTheme(t => t==='dark' ? 'light' : 'dark')} title="Toggle theme">
              {theme === 'dark' ? '☾ Dark' : '☀ Light'}
            </button>
          </div>
          <div className="toolbar-right">
            {subView === 'slide' && (
              <>
                <button className="pill" onClick={exportPptx} disabled={exporting}>{exporting ? 'Building…' : 'Export PPTX'}</button>
                <button className="pill" onClick={printToPdf}>Print / PDF</button>
              </>
            )}
            <button className="exitbtn" onClick={exitPresenting}>Exit ⎋</button>
          </div>
        </div>

        {subView === 'slide' ? (
          <>
            <div className="slide-stage">
              <SlidePage slide={slides[idx]} onPhotoClick={setLightbox} colSplit={colSplit} />
            </div>
            <div className="slidebar">
              <button className="navbtn" onClick={prev} disabled={idx===0}>‹</button>
              <span className="ctr">{idx+1} / {slides.length}</span>
              <span style={{width:38}}></span>
              <button className="navbtn" onClick={next} disabled={idx===slides.length-1}>›</button>
            </div>
          </>
        ) : (
          <div className="scroll-pages-wrap">
            <div className="scroll-pages">
              {continuousSlides.map((s, i) => (
                <ContinuousPage key={i} slide={s} onPhotoClick={setLightbox} colSplit={colSplit} />
              ))}
            </div>
          </div>
        )}

        {lightbox && (
          <div className="lightbox no-print" onClick={()=>setLightbox(null)}>
            <img src={lightbox} />
          </div>
        )}

        {/* Hidden except when printing — mirrors Slide View exactly: same pagination
            (parts), same font scale, same column split. This is what Export PPTX and
            Print/PDF both draw from, so the export always matches what's on screen. */}
        <div className="print-pages">
          {slides.map((s, i) => (
            <div className="print-page" key={i}>
              <SlidePage slide={s} onPhotoClick={() => {}} colSplit={colSplit} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="present-wrap">
        <span className="count-pill">{cases.length === 1 ? '1 case ready' : `${cases.length} cases ready`}</span>
      </div>
      <div className="cover-form">
        <label className="cover-form-label">Cover Title</label>
        <input
          type="text"
          className="cover-form-input"
          value={coverTitle}
          onChange={e => setCoverTitle(e.target.value)}
          placeholder="e.g. Surgery Morning Report — Ward 4"
          maxLength={80}
        />
        <div className="cover-form-hint">Appears as the first slide. Leave blank to show "Morning Report".</div>
      </div>
      <div className="present-actions">
        <button className="btn primary" onClick={startPresenting}>Start Presentation</button>
      </div>
      <div className="hint">Once started: switch between Slide View and Scroll View, or export PPTX/PDF, from the toolbar at the top.</div>
    </div>
  );
}
