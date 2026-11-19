import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../../store.jsx';

export default function SellerLayout() {
  const { user } = useStore();
  return (
    <div className="container seller-layout">
      <aside className="seller-nav">
        <div className="seller-store">{user.storeName}<small>Seller dashboard</small></div>
        <NavLink to="/seller" end>Overview</NavLink>
        <NavLink to="/seller/products">Products</NavLink>
        <NavLink to="/seller/orders">Orders</NavLink>
        <NavLink to="/seller/products/new" className="btn btn-primary">+ Add product</NavLink>
      </aside>
      <section className="seller-main"><Outlet /></section>
    </div>
  );
}
