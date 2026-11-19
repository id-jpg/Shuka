import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, amd } from '../../api.js';
import { useStore } from '../../store.jsx';
import { Loading, ErrorBox } from '../../components/ui.jsx';

export default function Products() {
  const { notify } = useStore();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const load = () => api.get('/seller/products').then((d) => setItems(d.products)).catch(setError);
  useEffect(() => { load(); }, []);

  const toggle = async (p) => {
    setError(null);
    try { await api.patch(`/seller/products/${p.id}`, { isPublished: !p.isPublished }); notify(p.isPublished ? 'Unpublished' : 'Published'); load(); }
    catch (e) { setError(e); }
  };

  if (!items) return error ? <ErrorBox error={error} /> : <Loading />;
  return (
    <>
      <div className="page-head"><h1>Products</h1><Link className="btn btn-primary" to="/seller/products/new">+ Add product</Link></div>
      <ErrorBox error={error} />
      {!items.length && <div className="empty card"><p>You have no products yet.</p><Link className="btn btn-primary" to="/seller/products/new">Add your first product</Link></div>}
      {items.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th></th><th>Title</th><th className="num">Price</th><th className="num">Stock</th><th>Status</th><th className="num">Sold</th><th></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.image ? <img className="thumb" src={p.image.thumb} alt="" /> : <div className="thumb noimg" />}</td>
                  <td><Link to={`/p/${p.id}`}>{p.title}</Link></td>
                  <td className="num">{amd(p.priceAmd)}</td>
                  <td className={`num ${p.stock === 0 ? 'stock out' : ''}`}>{p.stock}</td>
                  <td>{p.isPublished ? <span className="badge badge-delivered">Published</span> : <span className="badge badge-cancelled">Unpublished</span>}</td>
                  <td className="num">{p.unitsSold}</td>
                  <td className="actions">
                    <Link className="btn btn-light" to={`/seller/products/${p.id}`}>Edit</Link>
                    <button className="btn btn-light" onClick={() => toggle(p)}>{p.isPublished ? 'Unpublish' : 'Publish'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
