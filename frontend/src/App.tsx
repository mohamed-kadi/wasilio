import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, CheckCircle2, CreditCard, Inbox, LayoutDashboard, LogOut, MessageSquare, Package, PackageCheck, PhoneCall, PlusCircle, RefreshCw, ShoppingCart, Store, Truck, Users } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import OrdersList from './pages/OrdersList';
import InboundOrders from './pages/InboundOrders';
import Products from './pages/Products';
import StorefrontSettings from './pages/StorefrontSettings';
import StorefrontPublishing from './pages/StorefrontPublishing';
import CreateOrder from './pages/CreateOrder';
import OrderDetails from './pages/OrderDetails';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LandingPage from './pages/LandingPage';
import LegalPage from './pages/LegalPage';
import Confirmations from './pages/Confirmations';
import Couriers from './pages/Couriers';
import CourierDetails from './pages/CourierDetails';
import AssignmentQueue from './pages/AssignmentQueue';
import PickupQueue from './pages/PickupQueue';
import DeliveryQueue from './pages/DeliveryQueue';
import DeliveryFollowUps from './pages/DeliveryFollowUps';
import CourierPerformance from './pages/CourierPerformance';
import AdminBilling from './pages/AdminBilling';
import { useAuthStore } from './store/authStore';
import BrandLogo from './components/BrandLogo';

const queryClient = new QueryClient();

function Sidebar() {
  const session = useAuthStore((state) => state.session);
  const isSuperAdmin = session?.user.role === 'SUPER_ADMIN';

  return (
    <div className="w-64 bg-white border-r min-h-screen flex flex-col">
      <div className="h-16 flex items-center px-6 border-b">
        <BrandLogo markClassName="h-8 w-8" textClassName="text-xl" />
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1">
        {!isSuperAdmin && (
          <>
            <Link to="/app" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </Link>

            <div className="pt-3">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Catalog</p>
              <Link to="/app/products" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <Package size={20} />
                <span>Products</span>
              </Link>
            </div>

            <div className="pt-3">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Storefront</p>
              <Link to="/app/storefront/settings" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <Store size={20} />
                <span>Settings</span>
              </Link>
              <Link to="/app/storefront/publishing" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <PackageCheck size={20} />
                <span>Product Publishing</span>
              </Link>
            </div>

            <div className="pt-3">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Orders</p>
              <Link to="/app/orders" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <ShoppingCart size={20} />
                <span>Orders</span>
              </Link>
              <Link to="/app/orders/new" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <PlusCircle size={20} />
                <span>Create Order</span>
              </Link>
              <Link to="/app/inbound-orders" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <Inbox size={20} />
                <span>Inbound Orders</span>
              </Link>
            </div>

            <div className="pt-3">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Operations</p>
              <Link to="/app/confirmations" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <PhoneCall size={20} />
                <span>Confirmation</span>
              </Link>
              <Link to="/app/couriers" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <Users size={20} />
                <span>Delivery/Courier</span>
              </Link>
              <Link to="/app/couriers/assignment" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <Truck size={20} />
                <span>Assignment Queue</span>
              </Link>
              <Link to="/app/couriers/pickup" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <PackageCheck size={20} />
                <span>Pickup Queue</span>
              </Link>
              <Link to="/app/couriers/delivery" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <CheckCircle2 size={20} />
                <span>Delivery Queue</span>
              </Link>
              <Link to="/app/delivery-follow-ups" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <MessageSquare size={20} />
                <span>Follow-ups</span>
              </Link>
              <Link to="/app/couriers/performance" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
                <BarChart3 size={20} />
                <span>Performance</span>
              </Link>
            </div>

            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-900">
              <p className="font-semibold uppercase tracking-wide text-blue-700">Workflow guide</p>
              <p className="mt-2"><span className="font-semibold">Product</span> = catalog item.</p>
              <p><span className="font-semibold">Storefront</span> = public store identity.</p>
              <p><span className="font-semibold">Publishing</span> = public landing content.</p>
              <p><span className="font-semibold">Orders</span> = operational workflow.</p>
            </div>
          </>
        )}
        {isSuperAdmin && (
          <Link to="/admin/billing" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
            <CreditCard size={20} />
            <span>Admin Billing</span>
          </Link>
        )}
      </nav>
    </div>
  );
}

function Header() {
  const queryClientInstance = useQueryClient();
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);

  function handleLogout() {
    clearSession();
    queryClientInstance.clear();
    navigate('/login', { replace: true });
  }

  return (
    <header className="h-16 bg-white border-b flex items-center px-8">
      <div className="flex-1" />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">{session?.user.email}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">{session?.user.role}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function AccountPaused() {
  const queryClientInstance = useQueryClient();
  const navigate = useNavigate();
  const session = useAuthStore((state) => state.session);
  const blockedTenantStatus = useAuthStore((state) => state.blockedTenantStatus);
  const clearTenantBlocked = useAuthStore((state) => state.clearTenantBlocked);
  const clearSession = useAuthStore((state) => state.clearSession);

  function handleCheckAgain() {
    clearTenantBlocked();
    queryClientInstance.clear();
    navigate('/app', { replace: true });
  }

  function handleLogout() {
    clearSession();
    queryClientInstance.clear();
    navigate('/login', { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-xl rounded-lg border border-amber-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase text-amber-700">Account paused</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">Merchant workspace is temporarily unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              This tenant is currently marked as <span className="font-semibold text-gray-900">{blockedTenantStatus}</span>. Merchant workflows are paused until Wasilio operations updates the account status.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">{session?.user.email}</p>
          <p className="mt-1">Contact Wasilio support or settle the outstanding payment, then check again.</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCheckAgain}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <RefreshCw size={16} />
            Check again
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}

function ProtectedApp() {
  const session = useAuthStore((state) => state.session);
  const blockedTenantStatus = useAuthStore((state) => state.blockedTenantStatus);
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (session.user.role !== 'SUPER_ADMIN' && blockedTenantStatus) {
    return <AccountPaused />;
  }

  if (session.user.role === 'SUPER_ADMIN' && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin/billing" replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <Header />
        <div className="p-8 flex-1 overflow-auto">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<OrdersList />} />
            <Route path="products" element={<Products />} />
            <Route path="storefront/settings" element={<StorefrontSettings />} />
            <Route path="storefront/publishing" element={<StorefrontPublishing />} />
            <Route path="storefront-settings" element={<Navigate to="/app/storefront/settings" replace />} />
            <Route path="inbound-orders" element={<InboundOrders />} />
            <Route path="confirmations" element={<Confirmations />} />
            <Route path="couriers" element={<Couriers />} />
            <Route path="couriers/assignment" element={<AssignmentQueue />} />
            <Route path="couriers/pickup" element={<PickupQueue />} />
            <Route path="couriers/delivery" element={<DeliveryQueue />} />
            <Route path="delivery-follow-ups" element={<DeliveryFollowUps />} />
            <Route path="couriers/performance" element={<CourierPerformance />} />
            <Route path="billing" element={session.user.role === 'SUPER_ADMIN' ? <AdminBilling /> : <Navigate to="/app" replace />} />
            <Route path="couriers/:id" element={<CourierDetails />} />
            <Route path="orders/new" element={<CreateOrder />} />
            <Route path="orders/:id" element={<OrderDetails />} />
            <Route path="*" element={<Navigate to={session.user.role === 'SUPER_ADMIN' ? '/admin/billing' : '/app'} replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<LegalPage kind="terms" />} />
          <Route path="/privacy" element={<LegalPage kind="privacy" />} />
          <Route path="/payment-refund-policy" element={<LegalPage kind="payment" />} />
          <Route path="/app/*" element={<ProtectedApp />} />
          <Route path="/admin/*" element={<ProtectedApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
