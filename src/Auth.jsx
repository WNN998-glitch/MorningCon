import React, { useState } from 'react';
import { supabase } from './supabaseClient.js';

export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfo('Account created. If email confirmation is enabled on your Supabase project, check your inbox; otherwise you can sign in now.');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
    setBusy(false);
  }

  return (
    <div className="auth-wrap">
      <h1>Morning <span>Report</span></h1>
      <div className="card">
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="hint">{info}</div>}
          <button className="btn primary block" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : (mode === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'signin' ? (
            <>No account yet? <button onClick={()=>setMode('signup')}>Create one</button></>
          ) : (
            <>Already have an account? <button onClick={()=>setMode('signin')}>Sign in</button></>
          )}
        </div>
      </div>
      <div className="hint">First time setup: create your one account here. Consider disabling public sign-ups in your Supabase project afterward (Authentication → Providers).</div>
    </div>
  );
}
