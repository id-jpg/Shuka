import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, amd, fmtDate } from '../api.js';
import { useStore } from '../store.jsx';
import { Loading, ErrorBox, Stars, StockLabel } from '../components/ui.jsx';

export default function Product() {
  const { id } = useParams();
  const { user, cart, setCart, notify } = useStore();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState(null);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);

  useEffect(() => {
    setP(null); setError(null); setImg(0); setQty(1);
    api.get(`/products/${id}`).then((d) => setP(d.product)).catch(setError);
    api.get(`/products/${id}/reviews`).then((d) => setReviews(d.reviews)).catch(() => {});
  }, [id]);

  if (error) return <div className="container"><ErrorBox error={error} /><Link to="/search">Back to all products</Link></div>;
  if (!p) return <Loading />;

  const inCart = cart?.groups.flatMap((g) => g.items).find((i) => i.productId === p.id)?.quantity || 0;
  const maxQty = Math.max(0, p.stock - inCart);

  const add = async () => {
    if (!user) return nav(`/login?next=/p/${p.id}`);
    setAdding(true); setAddError(null);
    try {
      const d = await api.put(`/cart/items/${p.id}`, { quantity: inCart + qty });
      setCart(d.cart);
      notify(`Added ${qty} × ${p.title} to your cart`);
      setQty(1);
    } catch (e) { setAddError(e); } finally { setAdding(false); }
  };

  return (
    <div className="container">
      <nav className="crumbs"><Link to="/">Home</Link> › <Link to={`/search?category=${p.category.slug}`}>{p.category.name}</Link></nav>
      <div className="product-page">
        <div className="gallery">
          <div className="gallery-main card">
            {p.images[img] ? <img src={p.images[img].large} alt={p.title} /> : <div className="noimg">No image</div>}
          </div>
          {p.images.length > 1 && (
            <div className="thumbs">
              {p.images.map((im, i) => (
                <button key={im.id} className={i === img ? 'active' : ''} onClick={() => setImg(i)} aria-label={`Image ${i + 1}`}>
                  <img src={im.thumb} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-info">
          <h1>{p.title}</h1>
          <div className="muted">Sold by <b>{p.seller.storeName}</b></div>
          <Stars value={p.ratingAvg} count={p.ratingCount} size="md" />
          <hr />
          <div className="price price-lg">{amd(p.priceAmd)}</div>
          <p className="description">{p.description}</p>
        </div>
        <div className="buybox card">
          <div className="price">{amd(p.priceAmd)}</div>
          <StockLabel stock={p.stock} />
          <div className="muted small">Delivery anywhere in Armenia · Cash on delivery</div>
          {!p.isPublished && <div className="alert alert-warn">This product is unpublished. Only you can see it.</div>}
          {p.isOwner ? (
            <Link className="btn btn-light block" to={`/seller/products/${p.id}`}>Edit your product</Link>
          ) : p.stock > 0 && (
            <>
              {inCart > 0 && <div className="small">You have {inCart} in your cart.</div>}
              {maxQty > 0 ? (
                <label className="qty-row">Quantity:
                  <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                    {Array.from({ length: Math.min(maxQty, 30) }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}
                  </select>
                </label>
              ) : <div className="small">You already have all available units in your cart.</div>}
              <button className="btn btn-primary block" disabled={adding || maxQty === 0} onClick={add}>
                {adding ? 'Adding…' : 'Add to cart'}
              </button>
              <ErrorBox error={addError} />
            </>
          )}
        </div>
      </div>

      <section className="reviews">
        <h2>Customer reviews</h2>
        <Stars value={p.ratingAvg} count={p.ratingCount} size="md" />
        {reviews.length === 0 && <p className="muted">No reviews yet. Reviews can be written by buyers after delivery.</p>}
        {reviews.map((r) => (
          <article key={r.id} className="review">
            <div><b>{r.buyerName}</b> <span className="muted small">· {fmtDate(r.createdAt)}</span></div>
            <Stars value={r.rating} />
            <p>{r.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
