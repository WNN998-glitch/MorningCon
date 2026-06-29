import React, { useState, useEffect, useCallback } from 'react';
import { supabase, configMissing } from './supabaseClient.js';
import Auth from './Auth.jsx';
import AddCase from './AddCase.jsx';
import CaseList from './CaseList.jsx';
import Present from './Present.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [tab, setTab] = useState('add');
  const [cases, setCases] = useState([]);
  const [editingCase, setEditingCase] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const toast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2200);
  }, []);

  useEffect(() => {
    if (configMissing) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadCases = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: true });
    if (error) { toast('Load failed: ' + error.message); return; }
    setCases(data || []);
  }, [session, toast]);

  useEffect(() => { loadCases(); }, [loadCases]);

  async function saveCase(form) {
    if (form.id) {
      const { error } = await supabase.from('cases').update({
        hn: form.hn, cc: form.cc, hpi: form.hpi, pe: form.pe, inv: form.inv, dx: form.dx, mgmt: form.mgmt, photos: form.photos
      }).eq('id', form.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('cases').insert({
        hn: form.hn, cc: form.cc, hpi: form.hpi, pe: form.pe, inv: form.inv, dx: form.dx, mgmt: form.mgmt, photos: form.photos,
        user_id: session.user.id
      });
      if (error) throw error;
    }
    await loadCases();
  }

  async function deleteCase(id) {
    const { error } = await supabase.from('cases').delete().eq('id', id);
    if (error) { toast('Delete failed: ' + error.message); return; }
    await loadCases();
    toast('Case deleted');
  }

  function startEdit(c) { setEditingCase(c); setTab('add'); window.scrollTo(0,0); }
  function doneEditing() { setEditingCase(null); }

  if (configMissing) {
    return (
      <div className="auth-wrap">
        <h1>Morning <span>Report</span></h1>
        <div className="card">
          <p style={{fontSize:13, lineHeight:1.6}}>
            This app isn't connected to a database yet. Open <code>config.js</code> in this site's files and
            replace the placeholder values with your Supabase Project URL and anon key
            (Supabase dashboard → Project Settings → API), then reload this page.
          </p>
        </div>
      </div>
    );
  }

  if (session === undefined) {
    return <div className="center-spin">Loading…</div>;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div>
      <div className="topbar no-print">
        <div className="brand">
          <h1>Morning <span>Report</span></h1>
          <div className="who">
            {session.user.email}
            <button onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
        <div className="tabs">
          <button className={`tab ${tab==='add'?'active':''}`} onClick={()=>setTab('add')}>+ Add Case</button>
          <button className={`tab ${tab==='list'?'active':''}`} onClick={()=>setTab('list')}>Cases {cases.length ? `(${cases.length})` : ''}</button>
          <button className={`tab ${tab==='present'?'active':''}`} onClick={()=>setTab('present')}>Present</button>
        </div>
      </div>
      <div className="app">
        <div className="view">
          {tab === 'add' && <AddCase editingCase={editingCase} onSave={saveCase} onDoneEditing={doneEditing} toast={toast} />}
          {tab === 'list' && <CaseList cases={cases} onEdit={startEdit} onDelete={deleteCase} />}
          {tab === 'present' && <Present cases={cases} />}
        </div>
        <div className="footer-note no-print">Stored in your own Supabase database · review your institution's policy on patient identifiers before use</div>
      </div>
      <div className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </div>
  );
}
