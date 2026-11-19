import { useState } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

function useNext() {
  const [p] = useSearchParams();
  const next = p.get('next') || '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

export function Login() {
  const { user, setUser } = useStore();
  const nav = useNavigate(); const next = useNext();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={next} replace />;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { setUser((await api.post('/auth/login', form)).user); nav(next, { replace: true }); }
    catch (err) { setError(err); setBusy(false); }
  };
  return (
    <div className="container auth-page">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Sign in</h1>
        <ErrorBox error={error && !Object.keys(error.fields).length ? error : null} />
        <Field label="Email" error={error?.fields.email}><input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Password" error={error?.fields.password}><input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <button className="btn btn-primary block" disabled={busy}>Sign in</button>
        <p className="small muted">Demo: buyer1@shuka.am / shuka1234</p>
      </form>
      <p className="center">New to Shuka? <Link to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}>Create your account</Link></p>
    </div>
  );
}

export function Register() {
  const { user, setUser } = useStore();
  const nav = useNavigate(); const next = useNext();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={next} replace />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { setUser((await api.post('/auth/register', form)).user); nav(next, { replace: true }); }
    catch (err) { setError(err); setBusy(false); }
  };
  const fe = error?.fields || {};
  return (
    <div className="container auth-page">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Create account</h1>
        <ErrorBox error={error && !Object.keys(fe).length ? error : null} />
        <Field label="Your name" error={fe.name}><input autoComplete="name" value={form.name} onChange={set('name')} /></Field>
        <Field label="Email" error={fe.email}><input type="email" autoComplete="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Phone" error={fe.phone}><input type="tel" autoComplete="tel" placeholder="+374 91 123456" value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Password" error={fe.password} hint="At least 8 characters"><input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} /></Field>
        <button className="btn btn-primary block" disabled={busy}>Create your Shuka account</button>
      </form>
      <p className="center">Already have an account? <Link to="/login">Sign in</Link></p>
    </div>
  );
}
