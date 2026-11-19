import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

export default function BecomeSeller() {
  const { user, setUser, notify } = useStore();
  const nav = useNavigate();
  const [form, setForm] = useState({ storeName: '', phone: user.phone });
  const [error, setError] = useState(null);
  if (user.isSeller) return <Navigate to="/seller" replace />;
  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try {
      setUser((await api.post('/seller/activate', form)).user);
      notify('Your store is active!');
      nav('/seller/products/new');
    } catch (err) { setError(err); }
  };
  return (
    <div className="container auth-page">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Sell on Shuka</h1>
        <p>Reach buyers across Armenia. No fees, buyers pay you in cash on delivery. Your store is active at once.</p>
        <ErrorBox error={error && !Object.keys(error.fields).length ? error : null} />
        <Field label="Store name" error={error?.fields.storeName}><input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} placeholder="e.g. Yerevan Gadgets" /></Field>
        <Field label="Store phone" error={error?.fields.phone}><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <button className="btn btn-primary block">Activate my store</button>
      </form>
    </div>
  );
}
