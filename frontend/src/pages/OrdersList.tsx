import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PlusCircle } from 'lucide-react';
import { fetchOrders, getErrorMessage } from '../api/client';
import type { OrderStatus } from '../api/client';

const statusColors: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-800',
  CONFIRMATION_REQUESTED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-indigo-100 text-indigo-800',
  REJECTED: 'bg-red-100 text-red-800',
  ASSIGNED_TO_COURIER: 'bg-yellow-100 text-yellow-800',
  PICKED_UP: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

const statuses: OrderStatus[] = [
  'CREATED',
  'CONFIRMATION_REQUESTED',
  'CONFIRMED',
  'REJECTED',
  'ASSIGNED_TO_COURIER',
  'PICKED_UP',
  'DELIVERED',
  'FAILED',
];

export default function OrdersList() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [status, setStatus] = useState<OrderStatus | ''>('');

  const {
    data: ordersPage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['orders', { page, size, status }],
    queryFn: () => fetchOrders({ page, size, status }),
  });

  const orders = ordersPage?.content ?? [];
  const totalPages = ordersPage?.totalPages ?? 0;
  const totalElements = ordersPage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-500">{totalElements} total orders</p>
        </div>
        <Link
          to="/orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          <PlusCircle size={18} />
          New Order
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3">
        <label className="text-sm font-medium text-gray-700" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as OrderStatus | '');
            setPage(0);
          }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          {statuses.map((statusOption) => (
            <option key={statusOption} value={statusOption}>
              {statusOption.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <label className="text-sm font-medium text-gray-700" htmlFor="page-size">
          Page size
        </label>
        <select
          id="page-size"
          value={size}
          onChange={(event) => {
            setSize(Number(event.target.value));
            setPage(0);
          }}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          {[10, 20, 50, 100].map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
              <th className="p-4 font-medium">ID</th>
              <th className="p-4 font-medium">Customer</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="p-4 font-mono text-gray-500">
                  <Link to={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                    {order.id.slice(0, 8)}...
                  </Link>
                </td>
                <td className="p-4">
                  <p className="font-medium text-gray-900">
                    {order.customer.firstName} {order.customer.lastName}
                  </p>
                  <p className="text-gray-500">{order.customer.phone}</p>
                </td>
                <td className="p-4 font-medium">{order.amount.toFixed(2)} MAD</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-4 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No orders found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Loading orders...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
          {isFetching && !isLoading ? ' • Refreshing' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((currentPage) => currentPage - 1)}
            disabled={!canGoBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setPage((currentPage) => currentPage + 1)}
            disabled={!canGoForward}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
