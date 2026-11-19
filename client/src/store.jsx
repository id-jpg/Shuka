import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = guest
  const [cart, setCart] = useState(null);
  const [categories, setCategories] = useState([]);
  const [toast, setToast] = useState(null);

  const refreshCart = useCallback(async () => {
    try { setCart((await api.get('/cart')).cart); } catch { setCart(null); }
  }, []);

  useEffect(() => {
    api.get('/me').then((d) => setUser(d.user)).catch(() => setUser(null));
    api.get('/categories').then((d) => setCategories(d.categories)).catch(() => {});
  }, []);
  useEffect(() => { if (user) refreshCart(); else setCart(null); }, [user, refreshCart]);

  const notify = useCallback((message, kind = 'ok') => {
    setToast({ message, kind, id: Math.random() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const logout = async () => { await api.post('/auth/logout'); setUser(null); };

  const value = { user, setUser, cart, setCart, refreshCart, categories, notify, logout };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && <div className={`toast toast-${toast.kind}`} role="status">{toast.message}</div>}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);
