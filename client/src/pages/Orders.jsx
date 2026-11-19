import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, amd, fmtDate } from '../api.js';
import { Loading, ErrorBox, StatusBadge } from '../components/ui.jsx';

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/orders').then((d) => setOrders(d.orders)).catch(setError); }, []);
  if (error) return <div className="container"><ErrorBox error={error} /></div>;
  if (!orders) return <Loading />;
  return (
    <div className="container narrow">
      <h1>My orders</h1>
      {!orders.length && <div className="empty card"><p>You have no orders yet.</p><Link className="btn btn-primary" to="/search">Start shopping</Link></div>}
      {orders.map((o) => (
        <Link key={o.id} to={`/orders/${o.id}`} className="card order-row">
          <div className="order-row-head">
            <div><small className="muted">ORDER</small><b>#{o.id}</b></div>
            <div><small className="muted">PLACED</small><span>{fmtDate(o.createdAt)}</span></div>
            <div><small className="muted">TOTAL</small><b>{amd(o.totalAmd)}</b></div>
            <div><small className="muted">ITEMS</small><span>{o.itemCount}</span></div>
          </div>
          <div className="order-row-sellers">
            {o.sellers.map((s) => <span key={s.id}>{s.storeName}: <StatusBadge status={s.status} /></span>)}
          </div>
        </Link>
      ))}
    </div>
  );
}
