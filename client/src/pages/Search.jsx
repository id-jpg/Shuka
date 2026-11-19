import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { ProductCard, Loading, ErrorBox, Pagination } from '../components/ui.jsx';

const SORTS = [['newest', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['rating', 'Avg. customer rating']];

/** All filters live in the URL so a search can be shared. */
export default function Search() {
  const { categories } = useStore();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [min, setMin] = useState(params.get('minPrice') || '');
  const [max, setMax] = useState(params.get('maxPrice') || '');

  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    setMin(params.get('minPrice') || ''); setMax(params.get('maxPrice') || '');
    setData(null); setError(null);
    api.get(`/products?${params}`).then(setData).catch(setError);
    window.scrollTo(0, 0);
  }, [params]);

  const update = (changes) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) { if (v === '' || v == null) p.delete(k); else p.set(k, v); }
    if (!('page' in changes)) p.delete('page');
    setParams(p);
  };

  const catName = categories.find((c) => c.slug === category)?.name;
  const heading = q ? `"${q}"` : catName || 'All products';

  return (
    <div className="container search-page">
      <aside className={`filters card ${showFilters ? 'open' : ''}`}>
        <h3>Category</h3>
        <ul className="filter-list">
          <li><button className={!category ? 'active' : ''} onClick={() => update({ category: '' })}>All categories</button></li>
          {categories.map((c) => (
            <li key={c.id}><button className={category === c.slug ? 'active' : ''} onClick={() => update({ category: c.slug })}>{c.name}</button></li>
          ))}
        </ul>
        <h3>Price (AMD)</h3>
        <form className="price-range" onSubmit={(e) => { e.preventDefault(); update({ minPrice: min, maxPrice: max }); setShowFilters(false); }}>
          <input inputMode="numeric" placeholder="From" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} aria-label="Min price" />
          <span>–</span>
          <input inputMode="numeric" placeholder="To" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} aria-label="Max price" />
          <button className="btn btn-light">Go</button>
        </form>
        {(params.get('minPrice') || params.get('maxPrice')) && (
          <button className="link" onClick={() => update({ minPrice: '', maxPrice: '' })}>Clear price</button>
        )}
      </aside>

      <section className="results">
        <div className="results-bar">
          <div>
            <h1 className="results-title">{heading}</h1>
            {data && <span className="muted">{data.total} result{data.total === 1 ? '' : 's'}</span>}
          </div>
          <div className="results-controls">
            <button className="btn btn-light show-sm" onClick={() => setShowFilters(!showFilters)}>Filters</button>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort by">
              {SORTS.map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}
            </select>
          </div>
        </div>
        <ErrorBox error={error} />
        {!data && !error && <Loading />}
        {data && data.total === 0 && (
          <div className="empty card">
            <h2>No results{q ? ` for "${q}"` : ''}</h2>
            <p>Try different words or fewer filters.</p>
            <Link to="/search" className="btn btn-primary">See all products</Link>
          </div>
        )}
        {data && data.total > 0 && (
          <>
            <div className="grid">{data.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            <Pagination page={data.page} pages={data.pages} onPage={(n) => update({ page: n })} />
          </>
        )}
      </section>
    </div>
  );
}
