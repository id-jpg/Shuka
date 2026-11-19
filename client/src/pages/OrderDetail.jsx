import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, amd, fmtDateTime } from '../api.js';
import { useStore } from '../store.jsx';
import { Loading, ErrorBox, StatusBadge, History, Field } from '../components/ui.jsx';

function ReviewForm({ item, onDone }) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try { await api.post(`/products/${item.productId}/reviews`, { rating, body }); onDone(); }
    catch (err) { setError(err); setBusy(false); }
  };
  return (
    <form className="review-form" onSubmit={submit}>
      <div className="star-input" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)} aria-label={`${n} stars`}>★</button>
        ))}
      </div>
      <Field label="Your review" error={error?.fields?.body}>
        <textarea rows="3" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you like or dislike?" />
      </Field>
      <ErrorBox error={error && !error.fields?.body ? error : null} />
      <button className="btn btn-primary" disabled={busy}>Submit review</button>
    </form>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { notify } = useStore();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [reviewing, setReviewing] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => api.get(`/orders/${id}`).then((d) => setOrder(d.order)).catch(setError);
  useEffect(() => { load(); }, [id]);

  if (error && !order) return <div className="container"><ErrorBox error={error} /><Link to="/orders">Back to my orders</Link></div>;
  if (!order) return <Loading />;

  const cancel = async (so) => {
    if (!confirm(`Cancel the part of this order from ${so.storeName}?`)) return;
    setBusy(so.id); setError(null);
    try { setOrder((await api.post(`/orders/${order.id}/sellers/${so.id}/cancel`)).order); notify('Order part cancelled'); }
    catch (e) { setError(e); load(); } finally { setBusy(null); }
  };
  const a = order.address;

  return (
    <div className="container narrow">
      {params.get('placed') && (
        <div className="alert alert-ok big">
          <b>Thank you! Your order #{order.id} has been placed.</b><br />
          Pay {amd(order.totalAmd)} in cash on delivery. Each seller will confirm and ship their part.
        </div>
      )}
      <nav className="crumbs"><Link to="/orders">My orders</Link> › Order #{order.id}</nav>
      <h1>Order #{order.id}</h1>
      <div className="muted">Placed {fmtDateTime(order.createdAt)} · Total <b>{amd(order.totalAmd)}</b> · Cash on delivery</div>
      <ErrorBox error={error} />
      <section className="card form-card">
        <h2>Delivery address</h2>
        <p>{a.recipient}, {a.phone}<br />{a.street}{a.apartment && `, apt. ${a.apartment}`}<br />{a.city}, {a.region}</p>
        {a.note && <p className="muted">Note: {a.note}</p>}
      </section>
      {order.sellers.map((so) => (
        <section key={so.id} className="card form-card">
          <div className="so-head">
            <h2>From {so.storeName}</h2>
            <StatusBadge status={so.status} />
          </div>
          {so.items.map((i) => (
            <div key={i.id} className="order-item">
              <Link to={`/p/${i.productId}`} className="cart-img">{i.image && <img src={i.image.thumb} alt="" />}</Link>
              <div className="grow">
                <Link to={`/p/${i.productId}`}>{i.title}</Link>
                <div className="muted small">{i.quantity} × {amd(i.unitPriceAmd)}</div>
                {i.canReview && reviewing !== i.id && <button className="btn btn-light" onClick={() => setReviewing(i.id)}>Write a review</button>}
                {i.reviewed && <div className="small ok">✓ You reviewed this product</div>}
                {reviewing === i.id && <ReviewForm item={i} onDone={() => { setReviewing(null); notify('Thanks for your review!'); load(); }} />}
              </div>
              <b>{amd(i.unitPriceAmd * i.quantity)}</b>
            </div>
          ))}
          <div className="cart-subtotal">Cash to pay this seller: <b>{amd(so.subtotalAmd)}</b></div>
          {so.canCancel && <button className="btn btn-danger" disabled={busy === so.id} onClick={() => cancel(so)}>Cancel this part</button>}
          <details className="history-box" open>
            <summary>Status history</summary>
            <History history={so.history} />
          </details>
        </section>
      ))}
    </div>
  );
}
