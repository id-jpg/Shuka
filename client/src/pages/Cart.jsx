import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api, amd } from '../api.js';
import { useStore } from '../store.jsx';
import { Loading, ErrorBox } from '../components/ui.jsx';

export default function Cart() {
  const { cart, setCart, notify } = useStore();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const nav = useNavigate();
  if (!cart) return <Loading />;

  const act = async (key, fn) => {
    setBusy(key); setError(null);
    try { setCart((await fn()).cart); } catch (e) { setError(e); } finally { setBusy(null); }
  };
  const setQty = (id, q) => act(id, () => api.put(`/cart/items/${id}`, { quantity: q }));
  const remove = (id) => act(id, () => api.del(`/cart/items/${id}`)).then(() => notify('Removed from cart'));
  const items = cart.groups.flatMap((g) => g.items);
  const anyPriceChange = items.some((i) => i.priceChanged);

  if (!items.length) {
    return (
      <div className="container"><div className="empty card">
        <h1>Your cart is empty</h1><Link className="btn btn-primary" to="/search">Start shopping</Link>
      </div></div>
    );
  }

  return (
    <div className="container cart-page">
      <div>
        <h1>Shopping cart</h1>
        <ErrorBox error={error} />
        {anyPriceChange && (
          <div className="alert alert-warn">
            Some prices changed since you added them.{' '}
            <button className="link" onClick={() => act('accept', () => api.post('/cart/accept-prices'))}>Accept new prices</button>
          </div>
        )}
        {cart.groups.map((g) => (
          <section key={g.sellerId} className="card cart-group">
            <h2 className="cart-seller">Sold by {g.storeName}</h2>
            {g.items.map((i) => (
              <div key={i.productId} className={`cart-item ${i.soldOut ? 'is-out' : ''}`}>
                <Link to={`/p/${i.productId}`} className="cart-img">{i.image && <img src={i.image.thumb} alt="" />}</Link>
                <div className="cart-item-body">
                  <Link to={`/p/${i.productId}`} className="cart-title">{i.title}</Link>
                  {i.soldOut && <div className="stock out">Sold out — remove it to continue</div>}
                  {i.priceChanged && <div className="alert alert-warn small">Price changed from {amd(i.priceWhenAdded)} to {amd(i.priceAmd)}</div>}
                  {i.exceedsStock && <div className="stock low">Only {i.stock} left — lower the quantity</div>}
                  <div className="cart-controls">
                    {!i.soldOut && (
                      <select value={i.quantity} disabled={busy === i.productId} onChange={(e) => setQty(i.productId, Number(e.target.value))} aria-label="Quantity">
                        {Array.from({ length: Math.max(i.quantity, Math.min(i.stock, 30)) }, (_, n) => n + 1).map((n) => (
                          <option key={n} value={n} disabled={n > i.stock}>{n}</option>
                        ))}
                      </select>
                    )}
                    <button className="link" disabled={busy === i.productId} onClick={() => remove(i.productId)}>Remove</button>
                  </div>
                </div>
                <div className="cart-price">{amd(i.priceAmd)}{i.quantity > 1 && <div className="muted small">× {i.quantity}</div>}</div>
              </div>
            ))}
            <div className="cart-subtotal">Subtotal from {g.storeName}: <b>{amd(g.subtotal)}</b></div>
          </section>
        ))}
      </div>
      <aside className="card summary">
        <div className="summary-total">Total ({cart.count} item{cart.count === 1 ? '' : 's'}): <b className="price">{amd(cart.total)}</b></div>
        <div className="muted small">Payment: cash on delivery</div>
        <button className="btn btn-primary block" disabled={!cart.canCheckout} onClick={() => nav('/checkout')}>Proceed to checkout</button>
        {!cart.canCheckout && <div className="small muted">Fix the warnings in your cart first.</div>}
      </aside>
    </div>
  );
}
