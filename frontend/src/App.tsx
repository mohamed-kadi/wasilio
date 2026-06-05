import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LayoutDashboard, ShoppingCart, PlusCircle } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import OrdersList from './pages/OrdersList';
import CreateOrder from './pages/CreateOrder';
import OrderDetails from './pages/OrderDetails';

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="flex min-h-screen bg-gray-50">
          <Sidebar />
          <main className="flex-1 flex flex-col">
            <header className="h-16 bg-white border-b flex items-center px-8">
              <div className="flex-1"></div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Admin</span>
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  A
                </div>
              </div>
            </header>
            <div className="p-8 flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/orders" element={<OrdersList />} />
                <Route path="/orders/new" element={<CreateOrder />} />
                <Route path="/orders/:id" element={<OrderDetails />} />
              </Routes>
            </div>
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
