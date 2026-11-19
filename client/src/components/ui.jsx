import { Link } from 'react-router-dom';
import { amd, STATUS_LABEL } from '../api.js';

export const Loading = () => <div className="container loading"><div className="spinner" aria-label="Loading" /></div>;

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="alert alert-error" role="alert">{error.message || String(error)}</div>;
}

export function Field({ label, error, children, hint }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Stars({ value = 0, count, size = 'sm' }) {
  const full = Math.round(value);
  return (
    <span className={`stars stars-${size}`} title={`${value} out of 5`}>
      <span aria-hidden="true">{'★'.repeat(full)}<span className="stars-off">{'★'.repeat(5 - full)}</span></span>
      {count !== undefined && <span className="stars-count">{count ? `${value.toFixed(1)} (${count})` : 'No reviews yet'}</span>}
    </span>
  );
}

export function StockLabel({ stock }) {
  if (stock <= 0) return <span className="stock out">Out of stock</span>;
  if (stock <= 5) return <span className="stock low">Only {stock} left</span>;
  return <span className="stock in">In stock</span>;
}

export function ProductCard({ p }) {
  return (
    <Link to={`/p/${p.id}`} className="card product-card">
      <div className="product-card-img">
        {p.image ? <img src={p.image.thumb} alt="" loading="lazy" /> : <div className="noimg">No image</div>}
      </div>
      <div className="product-card-body">
        <div className="product-card-title">{p.title}</div>
        <Stars value={p.ratingAvg} count={p.ratingCount} />
        <div className="price">{amd(p.priceAmd)}</div>
        {p.stock === 0 && <div className="stock out">Out of stock</div>}
      </div>
    </Link>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <nav className="pagination" aria-label="Pages">
      <button className="btn btn-light" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Prev</button>
      {nums.map((n) => (
        <button key={n} className={`btn ${n === page ? 'btn-dark' : 'btn-light'}`} onClick={() => onPage(n)} aria-current={n === page}>{n}</button>
      ))}
      <button className="btn btn-light" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
    </nav>
  );
}

export function History({ history }) {
  return (
    <ol className="history">
      {history.map((h, i) => (
        <li key={i}>
          <StatusBadge status={h.to} />
          <span className="muted"> {new Date(h.at).toLocaleString('en-GB')} · by {h.role}</span>
        </li>
      ))}
    </ol>
  );
}

/** Random key per checkout attempt, so a double click cannot create two orders. */
export const newRequestKey = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
