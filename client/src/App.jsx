import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { useStore } from './store.jsx';
import Header from './components/Header.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import { Login, Register } from './pages/Auth.jsx';
import Account from './pages/Account.jsx';
import Credits from './pages/Credits.jsx';
import BecomeSeller from './pages/BecomeSeller.jsx';
import SellerLayout from './pages/seller/SellerLayout.jsx';
import Overview from './pages/seller/Overview.jsx';
import SellerProducts from './pages/seller/Products.jsx';
import ProductEditor from './pages/seller/ProductEditor.jsx';
import SellerOrders from './pages/seller/Orders.jsx';
import SellerOrderDetail from './pages/seller/OrderDetail.jsx';
import { Loading } from './components/ui.jsx';

function RequireAuth({ children, seller = false }) {
  const { user } = useStore();
  const loc = useLocation();
  if (user === undefined) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (seller && !user.isSeller) return <Navigate to="/sell" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/p/:id" element={<Product />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/cart" element={<RequireAuth><Cart /></RequireAuth>} />
          <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
          <Route path="/sell" element={<RequireAuth><BecomeSeller /></RequireAuth>} />
          <Route path="/seller" element={<RequireAuth seller><SellerLayout /></RequireAuth>}>
            <Route index element={<Overview />} />
            <Route path="products" element={<SellerProducts />} />
            <Route path="products/new" element={<ProductEditor />} />
            <Route path="products/:id" element={<ProductEditor />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="orders/:id" element={<SellerOrderDetail />} />
          </Route>
          <Route path="*" element={<div className="container empty"><h1>Page not found</h1><a href="/">Back to Shuka</a></div>} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container">Shuka · Made in Armenia · Prices in AMD · Cash on delivery only · <Link to="/credits" className="footer-link">Photo credits</Link></div>
      </footer>
    </>
  );
}
