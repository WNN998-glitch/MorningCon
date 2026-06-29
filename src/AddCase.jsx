import React, { useState, useEffect } from 'react';
import { resizeImage } from './utils.js';

const blank = { id: null, hn: '', cc: '', hpi: '', pe: '', inv: '', dx: '', mgmt: '', photos: [] };

export default function AddCase({ editingCase, onSave, onDoneEditing, toast }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(editingCase ? { ...editingCase } : blank);
  }, [editingCase]);

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  async function handlePhotos(e) {
    const files = Array.from(e.target.files);
    e.target.value = '';
    for (const f of files) {
      try {
        const b64 = await resizeImage(f);
        setForm(f0 => ({ ...f0, photos: [...f0.photos, b64] }));
      } catch (err) { console.error(err); }
    }
  }

  function removePhoto(i) {
    setForm(f => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }));
  }

  async function submit() {
    if (!form.hn.trim() || !form.cc.trim()) {
      toast('Hospital number and chief complaint are required');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      setForm(blank);
      toast(editingCase ? 'Case updated' : 'Case saved');
      if (editingCase) onDoneEditing();
    } catch (err) {
      toast('Save failed: ' + (err.message || 'unknown error'));
    }
    setSaving(false);
  }

  return (
    <div className="card">
      <div className="row2">
        <div className="field">
          <label>Hospital Number</label>
          <input type="text" value={form.hn} onChange={e=>set('hn', e.target.value)} placeholder="e.g. HN 1234567" />
        </div>
        <div className="field">
          <label>Diagnosis</label>
          <input type="text" value={form.dx} onChange={e=>set('dx', e.target.value)} placeholder="Working / final diagnosis" />
        </div>
      </div>
      <div className="field">
        <label>Chief Complaint</label>
        <input type="text" value={form.cc} onChange={e=>set('cc', e.target.value)} placeholder="e.g. RLQ pain 12 hours" />
      </div>
      <div className="field">
        <label>Present Illness</label>
        <textarea value={form.hpi} onChange={e=>set('hpi', e.target.value)} placeholder="History of present illness" />
      </div>
      <div className="field">
        <label>Physical Examination</label>
        <textarea value={form.pe} onChange={e=>set('pe', e.target.value)} placeholder="Vitals, pertinent findings" />
      </div>
      <div className="field">
        <label>Investigation</label>
        <textarea value={form.inv} onChange={e=>set('inv', e.target.value)} placeholder="Labs, imaging results" />
      </div>
      <div className="field">
        <label>Management</label>
        <textarea value={form.mgmt} onChange={e=>set('mgmt', e.target.value)} placeholder="ED management / OR plan / disposition" />
      </div>
      <div className="field">
        <label>Photos</label>
        <div className="photo-input-wrap">
          <label className="photo-btn" htmlFor="photoInput">Add Photos</label>
          <input id="photoInput" type="file" accept="image/*" multiple onChange={handlePhotos} />
          <div className="thumbs">
            {form.photos.map((p, i) => (
              <div className="thumb" key={i}>
                <img src={p} alt="" />
                <button className="rm" onClick={()=>removePhoto(i)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="btnrow">
        {editingCase && <button className="btn ghost" onClick={onDoneEditing}>Cancel</button>}
        <button className="btn primary" onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : (editingCase ? 'Update Case' : 'Save Case')}
        </button>
      </div>
    </div>
  );
}
