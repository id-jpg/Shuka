import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, amd, fmtDateTime, STATUS_LABEL } from '../../api.js';
import { Loading, ErrorBox, StatusBadge } from '../../components/ui.jsx';

const TABS = ['placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { setD(null); api.get(`/seller/orders${status ? `?status=${status}` : ''}`).then(setD).catch(setError); }, [status]);

  return (
    <>
      <h1>Orders</h1>
      <div className="tabs" role="tablist">
        <button className={!status ? 'active' : ''} onClick={() => setParams({})}>All</button>
        {TABS.map((t) => (
          <button key={t} className={status === t ? 'active' : ''} onClick={() => setParams({ status: t })}>
            {STATUS_LABEL[t]} {d && <span className="tab-count">{d.counts[t]}</span>}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      {!d ? <Loading /> : !d.orders.length ? <div className="empty card"><p>No orders here.</p></div> : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Order</th><th>Date</th><th>Deliver to</th><th className="num">Items</th><th className="num">Cash</th><th>Status</th></tr></thead>
            <tbody>
              {d.orders.map((o) => (
                <tr key={o.id} className="clickable">
                  <td><Link to={`/seller/orders/${o.id}`}>#{o.orderId}-{o.id}</Link></td>
                  <td>{fmtDateTime(o.createdAt)}</td>
                  <td>{o.recipient}<div className="muted small">{o.city}, {o.region}</div></td>
                  <td className="num">{o.itemCount}</td>
                  <td className="num">{amd(o.subtotalAmd)}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
