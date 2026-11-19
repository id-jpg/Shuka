import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Loading, ErrorBox } from '../components/ui.jsx';

/** Demo product photos come from Wikimedia Commons; CC BY / CC BY-SA require naming author and licence. */
export default function Credits() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/credits').then((d) => setItems(d.credits)).catch(setError); }, []);
  if (error) return <div className="container"><ErrorBox error={error} /></div>;
  if (!items) return <Loading />;
  return (
    <div className="container narrow">
      <h1>Photo credits</h1>
      <p className="muted">
        The demo product photos are from <a href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">Wikimedia Commons</a>,
        used under their free licences. Photos were resized and cropped.
      </p>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th></th><th>Product</th><th>Photo</th><th>Author</th><th>Licence</th></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.image}>
                <td><img className="thumb" src={c.image} alt="" loading="lazy" /></td>
                <td>{c.product}</td>
                <td><a href={c.source} target="_blank" rel="noreferrer">{c.title}</a></td>
                <td>{c.author}</td>
                <td>{c.licenseUrl ? <a href={c.licenseUrl} target="_blank" rel="noreferrer">{c.license}</a> : c.license}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
