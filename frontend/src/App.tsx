import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, LogOut, PlusCircle, ShoppingCart } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import OrdersList from './pages/OrdersList';
import CreateOrder from './pages/CreateOrder';
import OrderDetails from './pages/OrderDetails';
import Login from './pages/Login';
import { useAuthStore } from './store/authStore';

const queryClient = new QueryClient();

function Sidebar() {
  return (
    <div className="w-64 bg-white border-r min-h-screen flex flex-col">
      <div className="h-16 flex items-center px-6 border-b">
        <h1 className="text-xl font-bold text-blue-600 tracking-tight">nexora</h1>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1">
        <Link to="/" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link to="/orders" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
          <ShoppingCart size={20} />
          <span>Orders</span>
        </Link>
        <Link to="/orders/new" className="flex items-center gap-3 px-3 py-2 text-gray-700 rounded-md hover:bg-gray-100">
          <PlusCircle size={20} />
          <span>Create Order</span>
        </Link>
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

function ProtectedApp() {
  const session = useAuthStore((state) => state.session);
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <Header />
        <div className="p-8 flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<OrdersList />} />
            <Route path="/orders/new" element={<CreateOrder />} />
            <Route path="/orders/:id" element={<OrderDetails />} />
            <Route path="*" element={<Navigate to="/" replace />} />
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
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
