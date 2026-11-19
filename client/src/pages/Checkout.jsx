import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, amd, REGIONS } from '../api.js';
import { useStore } from '../store.jsx';
import { Loading, ErrorBox, Field, newRequestKey } from '../components/ui.jsx';

const EMPTY = { recipient: '', phone: '', region: 'Yerevan', city: 'Yerevan', street: '', apartment: '', note: '' };

export default function Checkout() {
  const { user, cart, setCart, refreshCart } = useStore();
  const nav = useNavigate();
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);
  const [placing, setPlacing] = useState(false);
  const requestKey = useRef(newRequestKey());

  useEffect(() => {
    api.get('/orders/last-address').then((d) => {
      setForm(d.address ? { ...EMPTY, ...d.address } : { ...EMPTY, recipient: user.name, phone: user.phone });
    }).catch(() => setForm({ ...EMPTY, recipient: user.name, phone: user.phone }));
  }, [user]);

  if (!cart || !form) return <Loading />;
  if (!cart.groups.length) return <div className="container empty card"><h1>Your cart is empty</h1><Link to="/search">Continue shopping</Link></div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fe = error?.fields || {};

  const place = async (e) => {
    e.preventDefault();
    if (placing) return;
    setPlacing(true); setError(null);
    try {
      const d = await api.post('/orders', { ...form, requestKey: requestKey.current });
      await refreshCart();
      nav(`/orders/${d.orderId}?placed=1`, { replace: true });
    } catch (err) {
      setError(err);
      setPlacing(false);
      if (['PRICE_CHANGED', 'OUT_OF_STOCK', 'UNAVAILABLE'].includes(err.code)) refreshCart();
    }
  };

  const acceptPrices = async () => {
    setCart((await api.post('/cart/accept-prices')).cart);
    setError(null);
  };

  return (
    <form className="container checkout-page" onSubmit={place} noValidate>
      <div>
        <h1>Checkout</h1>
        <section className="card form-card">
          <h2>Delivery address</h2>
          <div className="form-grid">
            <Field label="Recipient name" error={fe.recipient}><input value={form.recipient} onChange={set('recipient')} autoComplete="name" /></Field>
            <Field label="Phone" error={fe.phone}><input value={form.phone} onChange={set('phone')} type="tel" autoComplete="tel" placeholder="+374 91 123456" /></Field>
            <Field label="Region" error={fe.region}>
              <select value={form.region} onChange={set('region')}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
            </Field>
            <Field label="City or village" error={fe.city}><input value={form.city} onChange={set('city')} /></Field>
            <Field label="Street and building" error={fe.street}><input value={form.street} onChange={set('street')} placeholder="Abovyan St 10" autoComplete="street-address" /></Field>
            <Field label="Apartment (optional)" error={fe.apartment}><input value={form.apartment} onChange={set('apartment')} /></Field>
          </div>
          <Field label="Note for delivery (optional)" error={fe.note}><textarea rows="2" value={form.note} onChange={set('note')} placeholder="e.g. call before arriving" /></Field>
        </section>
        <section className="card form-card">
          <h2>Payment</h2>
          <p><b>Cash on delivery.</b> Pay each seller in AMD when your items arrive.</p>
        </section>
      </div>

      <aside className="card summary">
        <h2>Order summary</h2>
        {cart.groups.map((g) => (
          <div key={g.sellerId} className="summary-group">
            <div className="muted small">From {g.storeName}</div>
            {g.items.map((i) => (
              <div key={i.productId} className="summary-line">
                <span>{i.quantity} × {i.title}</span><span>{amd(i.lineTotal)}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="summary-line summary-total"><span>Total</span><b className="price">{amd(cart.total)}</b></div>
        <div className="small">Payment: cash on delivery</div>
        {error?.code === 'PRICE_CHANGED' ? (
          <div className="alert alert-warn">
            <b>Prices changed:</b>
            <ul>{error.data.items.map((i) => <li key={i.productId}>{i.title}: {amd(i.oldPrice)} → <b>{amd(i.newPrice)}</b></li>)}</ul>
            <button type="button" className="btn btn-light" onClick={acceptPrices}>Accept new prices</button>
          </div>
        ) : <ErrorBox error={error && !Object.keys(fe).length ? error : null} />}
        {error && ['OUT_OF_STOCK', 'UNAVAILABLE'].includes(error.code) && <Link to="/cart">Go back to the cart</Link>}
        <button className="btn btn-primary block" disabled={placing || !cart.canCheckout}>{placing ? 'Placing order…' : 'Place order'}</button>
      </aside>
    </form>
  );
}
