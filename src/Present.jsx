import React, { useState, useEffect, useRef, useMemo } from 'react';
import PptxGenJS from 'pptxgenjs';
import { buildSlides, buildContinuousSlides, CANON_W, CANON_H } from './paginate.js';

function SlideContent({ slide, onPhotoClick, colSplit = 55 }) {
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
  const [colSplit, setColSplit] = useState(55); // text column % (rest goes to photos)
  const touchX = useRef(null);
  const slides = useMemo(() => buildSlides(cases, fontScale, colSplit), [cases, fontScale, colSplit]);
  const continuousSlides = useMemo(() => buildContinuousSlides(cases), [cases]);

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
    setSubView('scroll');
    setTimeout(() => {
      window.scrollTo(0, 0);
      const wrap = document.querySelector('.scroll-pages-wrap');
      if (wrap) wrap.scrollTop = 0;
      window.print();
    }, 150);
  }

  // Printing forces the browser out of fullscreen for the print dialog and doesn't
  // restore it afterward — re-request it once the dialog closes, and return to
  // Slide View since that's where the export controls live.
  useEffect(() => {
    function onAfterPrint() {
      if (mode === 'presenting') {
        document.documentElement.requestFullscreen?.().catch(() => {});
        setSubView('slide');
      }
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
      const DARK='0A0D0F', TEXT='D7E0E0', ACCENT='E0A458', DIM='7D8C8C', ACCENT2='4FB8A8';
      const sorted = [...cases].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

      if (sorted.length > 1) {
        const s = pres.addSlide(); s.background = { color: DARK };
        s.addText('MORNING REPORT SUMMARY', { x:0.4,y:0.3,w:9.2,h:0.5,fontFace:'Courier New',fontSize:20,color:ACCENT,bold:true });
        s.addText(new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'  ·  '+sorted.length+' cases',
          { x:0.4,y:0.78,w:9.2,h:0.3,fontFace:'Courier New',fontSize:11,color:DIM });
        const rows = [[
          {text:'#',options:{color:ACCENT2,bold:true}},
          {text:'HN',options:{color:ACCENT2,bold:true}},
          {text:'Chief Complaint',options:{color:ACCENT2,bold:true}},
          {text:'Diagnosis',options:{color:ACCENT2,bold:true}}
        ]];
        sorted.forEach((c,i)=>rows.push([String(i+1).padStart(2,'0'), c.hn||'', c.cc||'', c.dx||'—']));
        s.addTable(rows, { x:0.4,y:1.25,w:9.2,fontFace:'Courier New',fontSize:11,color:TEXT,border:{type:'solid',color:'232B2F',pts:0.5},autoPage:false });
      }

      sorted.forEach((c,i)=>{
        const s = pres.addSlide(); s.background = { color: DARK };
        s.addText('CASE '+String(i+1).padStart(2,'0')+' / '+String(sorted.length).padStart(2,'0'),
          { x:0.4,y:0.25,w:5,h:0.35,fontFace:'Courier New',fontSize:13,color:ACCENT,bold:true });
        s.addText('HN '+(c.hn||''), { x:6.5,y:0.25,w:3.1,h:0.35,fontFace:'Courier New',fontSize:11,color:DIM,align:'right' });

        const blocks = [['CHIEF COMPLAINT',c.cc],['PRESENT ILLNESS',c.hpi],['PHYSICAL EXAMINATION',c.pe],['INVESTIGATION',c.inv],['DIAGNOSIS',c.dx],['MANAGEMENT',c.mgmt]].filter(b=>b[1]);
        let y = 0.75;
        const colW = (c.photos && c.photos.length) ? 5.6 : 9.2;
        blocks.forEach(([label,val])=>{
          const lines = Math.max(1, Math.ceil(val.length/70));
          const h = Math.min(1.8, 0.32 + lines*0.18);
          s.addText(label, { x:0.4,y:y,w:colW,h:0.22,fontFace:'Courier New',fontSize:9,color:ACCENT2,bold:true });
          s.addText(val, { x:0.4,y:y+0.22,w:colW,h:h,fontFace:'Courier New',fontSize:11,color:label==='DIAGNOSIS'?ACCENT:TEXT,valign:'top' });
          y += h + 0.3;
        });
        if (c.photos && c.photos.length) {
          let py = 0.75;
          c.photos.slice(0,4).forEach(photo=>{
            try { s.addImage({ data: photo, x:6.2, y:py, w:3.2, h:1.65 }); } catch(e){}
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
      <div id="slideshow" style={{ '--ufont': fontScale }}
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
      </div>
    );
  }

  return (
    <div>
      <div className="present-wrap">
        <span className="count-pill">{cases.length === 1 ? '1 case ready' : `${cases.length} cases ready`}</span>
      </div>
      <div className="present-actions">
        <button className="btn primary" onClick={startPresenting}>Start Presentation</button>
      </div>
      <div className="hint">Once started: switch between Slide View and Scroll View, or export PPTX/PDF, from the toolbar at the top.</div>
    </div>
  );
}
