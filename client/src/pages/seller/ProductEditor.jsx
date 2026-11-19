import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useStore } from '../../store.jsx';
import { Loading, ErrorBox, Field } from '../../components/ui.jsx';

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = !id;
  const { categories, notify } = useStore();
  const nav = useNavigate();
  const [form, setForm] = useState(null);
  const [images, setImages] = useState([]);        // saved images (edit mode)
  const [pending, setPending] = useState([]);      // chosen files not uploaded yet (new mode)
  const [error, setError] = useState(null);
  const [imgError, setImgError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) { setForm({ title: '', categoryId: '', description: '', priceAmd: '', stock: '1', isPublished: true }); setImages([]); setPending([]); return; }
    api.get(`/seller/products/${id}`).then(({ product: p }) => {
      setForm({ title: p.title, categoryId: String(p.categoryId), description: p.description, priceAmd: String(p.priceAmd), stock: String(p.stock), isPublished: p.isPublished });
      setImages(p.images);
    }).catch(setError);
  }, [id, isNew]);

  useEffect(() => () => pending.forEach((f) => URL.revokeObjectURL(f.preview)), [pending]);

  if (!form) return error ? <ErrorBox error={error} /> : <Loading />;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const fe = error?.fields || {};
  const total = images.length + pending.length;

  const checkFiles = (files) => {
    for (const f of files) {
      if (!TYPES.includes(f.type)) return `"${f.name}" is not a JPEG, PNG or WebP image`;
      if (f.size > MAX_BYTES) return `"${f.name}" is larger than 5 MB`;
    }
    if (total + files.length > MAX_IMAGES) return `You can have at most ${MAX_IMAGES} images`;
    return null;
  };

  const upload = async (productId, files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    return (await api.post(`/seller/products/${productId}/images`, fd)).product;
  };

  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    setImgError(null);
    const problem = checkFiles(files);
    if (problem) return setImgError(problem);
    if (isNew) {
      setPending([...pending, ...files.map((f) => Object.assign(f, { preview: URL.createObjectURL(f) }))]);
      return;
    }
    setBusy(true);
    try { setImages((await upload(id, files)).images); } catch (err) { setImgError(err.message); } finally { setBusy(false); }
  };

  const makeMain = async (imgId) => {
    try { setImages((await api.patch(`/seller/products/${id}`, { mainImageId: imgId })).product.images); } catch (err) { setImgError(err.message); }
  };
  const removeImage = async (imgId) => {
    try {
      const p = (await api.del(`/seller/products/${id}/images/${imgId}`)).product;
      setImages(p.images); setForm((f) => ({ ...f, isPublished: p.isPublished }));
    } catch (err) { setImgError(err.message); }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setImgError(null);
    const body = {
      title: form.title, description: form.description, categoryId: form.categoryId,
      priceAmd: form.priceAmd, stock: form.stock,
    };
    try {
      if (isNew) {
        if (form.isPublished && pending.length === 0) {
          setImgError('Add at least one image to publish'); setBusy(false); return;
        }
        const created = (await api.post('/seller/products', body)).product;
        if (pending.length) await upload(created.id, pending);
        if (form.isPublished) await api.patch(`/seller/products/${created.id}`, { isPublished: true });
        notify('Product created');
        nav(`/seller/products/${created.id}`, { replace: true });
      } else {
        await api.patch(`/seller/products/${id}`, { ...body, isPublished: form.isPublished });
        notify('Saved');
        nav('/seller/products');
      }
    } catch (err) {
      setError(err);
      if (err.fields?.images) setImgError(err.fields.images);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate>
      <div className="page-head">
        <h1>{isNew ? 'Add a product' : 'Edit product'}</h1>
        {!isNew && <Link to={`/p/${id}`}>View in store ›</Link>}
      </div>
      <ErrorBox error={error && !Object.keys(fe).length ? error : null} />
      <div className="card form-card">
        <Field label="Title" error={fe.title}><input value={form.title} onChange={set('title')} maxLength={120} /></Field>
        <Field label="Category" error={fe.categoryId}>
          <select value={form.categoryId} onChange={set('categoryId')}>
            <option value="">Choose a category…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Description" error={fe.description}><textarea rows="6" value={form.description} onChange={set('description')} /></Field>
        <div className="form-grid">
          <Field label="Price (AMD)" error={fe.priceAmd}><input inputMode="numeric" value={form.priceAmd} onChange={(e) => setForm({ ...form, priceAmd: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 12500" /></Field>
          <Field label="Stock" error={fe.stock}><input inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value.replace(/\D/g, '') })} /></Field>
        </div>
      </div>

      <div className="card form-card">
        <h2>Images <small className="muted">({total}/{MAX_IMAGES}, first is the main image)</small></h2>
        <div className="image-grid">
          {images.map((im) => (
            <div key={im.id} className={`image-tile ${im.isMain ? 'main' : ''}`}>
              <img src={im.thumb} alt="" />
              {im.isMain ? <span className="badge badge-confirmed">Main</span> : <button type="button" className="btn btn-light" onClick={() => makeMain(im.id)}>Make main</button>}
              <button type="button" className="btn btn-danger" onClick={() => removeImage(im.id)} aria-label="Delete image">✕</button>
            </div>
          ))}
          {pending.map((f, i) => (
            <div key={f.preview} className={`image-tile ${i === 0 && !images.length ? 'main' : ''}`}>
              <img src={f.preview} alt="" />
              {i > 0 && <button type="button" className="btn btn-light" onClick={() => setPending([f, ...pending.filter((x) => x !== f)])}>Make main</button>}
              {i === 0 && <span className="badge badge-confirmed">Main</span>}
              <button type="button" className="btn btn-danger" onClick={() => setPending(pending.filter((x) => x !== f))} aria-label="Remove image">✕</button>
            </div>
          ))}
          {total < MAX_IMAGES && (
            <label className="image-tile add">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} hidden disabled={busy} />
              <span>＋<br />Add images</span>
            </label>
          )}
        </div>
        <div className="field-hint">JPEG, PNG or WebP, up to 5 MB each.</div>
        {imgError && <div className="field-error">{imgError}</div>}
      </div>

      <div className="card form-card">
        <label className="check"><input type="checkbox" checked={form.isPublished} onChange={set('isPublished')} /> Published (visible in the store)</label>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <Link to="/seller/products" className="btn btn-light">Cancel</Link>
      </div>
    </form>
  );
}
