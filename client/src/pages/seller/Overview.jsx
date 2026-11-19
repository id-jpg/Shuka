import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, amd, STATUS_LABEL } from '../../api.js';
import { Loading, ErrorBox } from '../../components/ui.jsx';

export default function Overview() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/seller/overview').then(setD).catch(setError); }, []);
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Loading />;
  return (
    <>
      <h1>Overview</h1>
      <div className="stat-grid">
        <Link to="/seller/orders?status=placed" className="card stat"><small>Orders to confirm</small><b>{d.toConfirm}</b></Link>
        <Link to="/seller/orders?status=confirmed" className="card stat"><small>Orders to ship</small><b>{d.toShip}</b></Link>
        <div className="card stat"><small>Revenue, last 30 days</small><b>{amd(d.revenue30d)}</b><span className="muted small">{d.delivered30d} delivered orders</span></div>
        <div className="card stat"><small>Revenue, all time</small><b>{amd(d.revenueAllTime)}</b></div>
      </div>
      <h2>Orders by status</h2>
      <div className="card">
        <table className="table">
          <tbody>
            {Object.entries(d.counts).map(([s, n]) => (
              <tr key={s}><td><Link to={`/seller/orders?status=${s}`}>{STATUS_LABEL[s]}</Link></td><td className="num">{n}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Products</h2>
      <p>{d.products.total} products · {d.products.published} published · {d.products.soldOut} sold out · <Link to="/seller/products">Manage products</Link></p>
    </>
  );
}
