import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { ProductCard, Loading, ErrorBox } from '../components/ui.jsx';

const ICONS = { electronics: '🎧', books: '📚', 'home-kitchen': '🍳', 'clothing-shoes': '👟', 'beauty-health': '🧴',
  'sports-outdoors': '⛰️', 'toys-kids': '🧸', 'food-drinks': '🍑', 'handmade-crafts': '🏺' };

export default function Home() {
  const { categories, user } = useStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/products?sort=newest').then(setData).catch(setError); }, []);

  return (
    <div className="container">
      <section className="hero">
        <div>
          <h1>Everything Armenia sells, in one cart.</h1>
          <p>Buy from local sellers across Yerevan and all 10 marzer. Pay cash when it arrives.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/search">Browse all products</Link>
            {!user?.isSeller && <Link className="btn btn-light" to={user ? '/sell' : '/register'}>Start selling</Link>}
          </div>
        </div>
      </section>

      <h2 className="section-title">Shop by category</h2>
      <div className="cat-grid">
        {categories.map((c) => (
          <Link key={c.id} to={`/search?category=${c.slug}`} className="card cat-card">
            <span className="cat-icon" aria-hidden="true">{ICONS[c.slug] || '🛍️'}</span>
            <b>{c.name}</b>
            <small className="muted">{c.productCount} products</small>
          </Link>
        ))}
      </div>

      <h2 className="section-title">New arrivals</h2>
      <ErrorBox error={error} />
      {!data && !error ? <Loading /> : (
        <div className="grid">{data?.items.slice(0, 12).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}
      <p className="center"><Link to="/search" className="btn btn-light">See all products</Link></p>
    </div>
  );
}
