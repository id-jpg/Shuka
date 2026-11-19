import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, amd, fmtDateTime } from '../../api.js';
import { useStore } from '../../store.jsx';
import { Loading, ErrorBox, StatusBadge, History } from '../../components/ui.jsx';

const ACTION = {
  confirmed: ['Confirm order', 'btn-primary'],
  shipped: ['Mark as shipped', 'btn-primary'],
  delivered: ['Mark as delivered (cash received)', 'btn-primary'],
  cancelled: ['Cancel order', 'btn-danger'],
};

export default function OrderDetail() {
  const { id } = useParams();
  const { notify } = useStore();
  const [o, setO] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/seller/orders/${id}`).then((d) => setO(d.order)).catch(setError); }, [id]);

  if (!o) return error ? <><ErrorBox error={error} /><Link to="/seller/orders">Back to orders</Link></> : <Loading />;

  const move = async (to) => {
    if (to === 'cancelled' && !confirm('Cancel this order? Stock will be returned.')) return;
    setBusy(true); setError(null);
    try { setO((await api.post(`/seller/orders/${o.id}/status`, { to })).order); notify(`Order moved to ${to}`); }
    catch (e) { setError(e); } finally { setBusy(false); }
  };
  const d = o.delivery;

  return (
    <>
      <nav className="crumbs"><Link to="/seller/orders">Orders</Link> › #{o.orderId}-{o.id}</nav>
      <div className="page-head"><h1>Order #{o.orderId}-{o.id}</h1><StatusBadge status={o.status} /></div>
      <div className="muted">Placed {fmtDateTime(o.createdAt)} by {o.buyerName}</div>
      <ErrorBox error={error} />
      <div className="two-col">
        <section className="card form-card">
          <h2>Deliver to</h2>
          <p className="address">
            <b>{d.recipient}</b><br />
            <a href={`tel:${d.phone.replace(/\s/g, '')}`}>{d.phone}</a><br />
            {d.street}{d.apartment && `, apt. ${d.apartment}`}<br />
            {d.city}, {d.region}
          </p>
          {d.note && <div className="alert alert-warn">Note: {d.note}</div>}
        </section>
        <section className="card form-card">
          <h2>Cash to collect</h2>
          <div className="price price-lg">{amd(o.cashToCollect)}</div>
          <div className="actions-col">
            {o.allowedMoves.map((to) => (
              <button key={to} className={`btn ${ACTION[to][1]}`} disabled={busy} onClick={() => move(to)}>{ACTION[to][0]}</button>
            ))}
            {!o.allowedMoves.length && <span className="muted">No further actions.</span>}
          </div>
        </section>
      </div>
      <section className="card form-card">
        <h2>Items</h2>
        {o.items.map((i) => (
          <div key={i.id} className="order-item">
            <span className="cart-img">{i.image && <img src={i.image.thumb} alt="" />}</span>
            <div className="grow">{i.title}<div className="muted small">{i.quantity} × {amd(i.unitPriceAmd)} (price at purchase)</div></div>
            <b>{amd(i.quantity * i.unitPriceAmd)}</b>
          </div>
        ))}
      </section>
      <section className="card form-card">
        <h2>Status history</h2>
        <History history={o.history} />
      </section>
    </>
  );
}
