import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useStore } from '../store.jsx';

export default function Header() {
  const { user, cart, categories, logout } = useStore();
  const [params] = useSearchParams();
  const loc = useLocation();
  const nav = useNavigate();
  const [q, setQ] = useState(params.get('q') || '');
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => { if (loc.pathname === '/search') setQ(params.get('q') || ''); }, [loc.pathname, params]);
  useEffect(() => { setMenu(false); }, [loc.pathname]);
  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    nav(`/search?${p}`);
  };

  return (
    <header className="header">
      <div className="header-top container">
        <Link to="/" className="logo">shuka<span>.am</span></Link>
        <form className="search" onSubmit={submit} role="search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Shuka" aria-label="Search" />
          <button aria-label="Search">⌕</button>
        </form>
        <div className="header-actions">
          <div className="account" ref={menuRef}>
            {user ? (
              <button className="header-link" onClick={(e) => { e.stopPropagation(); setMenu(!menu); }} aria-expanded={menu}>
                <small>Hello, {user.name.split(' ')[0]}</small><b>Account ▾</b>
              </button>
            ) : (
              <Link className="header-link" to="/login"><small>Hello, sign in</small><b>Account</b></Link>
            )}
            {menu && user && (
              <div className="menu">
                <Link to="/orders">My orders</Link>
                <Link to="/account">Account settings</Link>
                {user.isSeller ? <Link to="/seller">Seller dashboard</Link> : <Link to="/sell">Sell on Shuka</Link>}
                <button onClick={async () => { await logout(); nav('/'); }}>Log out</button>
              </div>
            )}
          </div>
          <Link to="/cart" className="header-link cart-link" aria-label={`Cart, ${cart?.count || 0} items`}>
            <span className="cart-icon">🛒<span className="cart-count">{cart?.count || 0}</span></span>
            <b className="hide-sm">Cart</b>
          </Link>
        </div>
      </div>
      <nav className="header-cats">
        <div className="container cats-scroll">
          <NavLink to="/search" end>All</NavLink>
          {categories.map((c) => (
            <Link key={c.id} to={`/search?category=${c.slug}`}
              className={params.get('category') === c.slug && loc.pathname === '/search' ? 'active' : ''}>{c.name}</Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
