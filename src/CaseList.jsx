import React, { useState } from 'react';
import { esc } from './utils.js';

function Block({ label, val }) {
  if (!val) return null;
  return (<>
    <span className="lbl">{label}</span>
    <div>{val}</div>
  </>);
}

export default function CaseList({ cases, onEdit, onDelete }) {
  const [openId, setOpenId] = useState(null);

  if (!cases.length) {
    return <div className="empty">No cases yet. Add one from the "Add Case" tab.</div>;
  }

  const sorted = [...cases].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div>
      {sorted.map(c => {
        const dt = new Date(c.created_at);
        const open = openId === c.id;
        return (
          <div className="case-item" key={c.id}>
            <div className="case-top" onClick={() => setOpenId(open ? null : c.id)}>
              <div>
                <div className="case-hn">HN {c.hn}</div>
                <div className="case-cc">{c.cc}</div>
                <div className="case-dx">{c.dx || '—'}</div>
              </div>
              <div className="case-meta">
                {dt.toLocaleDateString()}<br/>
                {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {open && (
              <div className="expand">
                <Block label="Present Illness" val={c.hpi} />
                <Block label="Physical Examination" val={c.pe} />
                <Block label="Investigation" val={c.inv} />
                <Block label="Management" val={c.mgmt} />
                {c.photos && c.photos.length > 0 && (
                  <>
                    <span className="lbl">Photos</span>
                    <div className="thumbs">
                      {c.photos.map((p, i) => (
                        <div className="thumb" key={i}><img src={p} alt="" /></div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="case-actions">
              <button className="btn" onClick={() => setOpenId(open ? null : c.id)}>Details</button>
              <button className="btn" onClick={() => onEdit(c)}>Edit</button>
              <button className="btn danger" onClick={() => {
                if (confirm('Delete this case? This cannot be undone.')) onDelete(c.id);
              }}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
