import { useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

export default function Account() {
  const { user, setUser, notify } = useStore();
  const [form, setForm] = useState({ name: user.name, phone: user.phone });
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try { setUser((await api.patch('/me', form)).user); notify('Saved'); } catch (err) { setError(err); }
  };
  return (
    <div className="container auth-page">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Account settings</h1>
        <p className="muted">{user.email}{user.isSeller && ` · Seller: ${user.storeName}`}</p>
        <ErrorBox error={error && !Object.keys(error.fields).length ? error : null} />
        <Field label="Name" error={error?.fields.name}><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Phone" error={error?.fields.phone}><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <button className="btn btn-primary">Save</button>
      </form>
    </div>
  );
}
