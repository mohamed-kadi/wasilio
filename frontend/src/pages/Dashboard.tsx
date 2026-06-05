import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Package, TrendingUp } from 'lucide-react';
import { fetchOrders, getErrorMessage } from '../api/client';

export default function Dashboard() {
  const totalOrdersQuery = useQuery({
    queryKey: ['orders-summary', 'all'],
    queryFn: () => fetchOrders({ page: 0, size: 1 }),
  });

  const deliveredQuery = useQuery({
    queryKey: ['orders-summary', 'delivered'],
    queryFn: () => fetchOrders({ page: 0, size: 1, status: 'DELIVERED' }),
  });

  const failedQuery = useQuery({
    queryKey: ['orders-summary', 'failed'],
    queryFn: () => fetchOrders({ page: 0, size: 1, status: 'FAILED' }),
  });

  const isLoading = totalOrdersQuery.isLoading || deliveredQuery.isLoading || failedQuery.isLoading;
  const error = totalOrdersQuery.error ?? deliveredQuery.error ?? failedQuery.error;

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const totalOrders = totalOrdersQuery.data?.totalElements ?? 0;
  const delivered = deliveredQuery.data?.totalElements ?? 0;
  const failed = failedQuery.data?.totalElements ?? 0;
  const active = totalOrders - delivered - failed;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Orders</p>
            <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Delivered</p>
            <p className="text-2xl font-bold text-gray-900">{delivered}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active</p>
            <p className="text-2xl font-bold text-gray-900">{active}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-lg">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Failed</p>
            <p className="text-2xl font-bold text-gray-900">{failed}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
