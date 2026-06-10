import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bookmark, ChevronLeft, ChevronRight, PlusCircle, Save, Trash2, X } from 'lucide-react';
import {
  createOrderSearchSavedView,
  deleteOrderSearchSavedView,
  fetchCouriers,
  fetchOrders,
  fetchOrderSearchSavedViews,
  getErrorMessage,
  updateOrderSearchSavedView,
} from '../api/client';
import type { OrderSearchSavedView, OrderStatus } from '../api/client';

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

interface OrderFilters {
  statuses: OrderStatus[];
  phone: string;
  customerName: string;
  orderId: string;
  courierId: string;
  createdFrom: string;
  createdTo: string;
}

const emptyFilters: OrderFilters = {
  statuses: [],
  phone: '',
  customerName: '',
  orderId: '',
  courierId: '',
  createdFrom: '',
  createdTo: '',
};

function filtersToSavedPayload(filters: OrderFilters): Record<string, string> {
  const payload: Record<string, string> = {};
  if (filters.statuses.length > 0) {
    payload.status = filters.statuses.join(',');
  }
  if (filters.phone) payload.phone = filters.phone;
  if (filters.customerName) payload.customerName = filters.customerName;
  if (filters.orderId) payload.orderId = filters.orderId;
  if (filters.courierId) payload.courierId = filters.courierId;
  if (filters.createdFrom) payload.createdFrom = filters.createdFrom;
  if (filters.createdTo) payload.createdTo = filters.createdTo;
  return payload;
}

function savedPayloadToFilters(payload: Record<string, string>): OrderFilters {
  const parsedStatuses = (payload.status ?? '')
    .split(',')
    .filter((status): status is OrderStatus => statuses.includes(status as OrderStatus));
  return {
    statuses: parsedStatuses,
    phone: payload.phone ?? '',
    customerName: payload.customerName ?? '',
    orderId: payload.orderId ?? '',
    courierId: payload.courierId ?? '',
    createdFrom: payload.createdFrom ?? '',
    createdTo: payload.createdTo ?? '',
  };
}

function toInstantFromDate(date: string, endOfDay = false) {
  if (!date) return undefined;
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`;
}

export default function OrdersList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState<OrderFilters>(emptyFilters);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewName, setSavedViewName] = useState('');

  const {
    data: ordersPage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['orders', { page, size, filters }],
    queryFn: () =>
      fetchOrders({
        page,
        size,
        status: filters.statuses,
        phone: filters.phone,
        customerName: filters.customerName,
        orderId: filters.orderId,
        courierId: filters.courierId,
        createdFrom: toInstantFromDate(filters.createdFrom),
        createdTo: toInstantFromDate(filters.createdTo, true),
      }),
  });

  const { data: couriersPage } = useQuery({
    queryKey: ['couriers', { page: 0, size: 100 }],
    queryFn: () => fetchCouriers({ page: 0, size: 100 }),
  });

  const { data: savedViews = [] } = useQuery({
    queryKey: ['order-search-saved-views'],
    queryFn: fetchOrderSearchSavedViews,
  });

  const createSavedViewMutation = useMutation({
    mutationFn: () =>
      createOrderSearchSavedView({
        name: savedViewName.trim(),
        filters: filtersToSavedPayload(filters),
      }),
    onSuccess: async (savedView) => {
      setSelectedSavedViewId(savedView.viewId);
      setSavedViewName(savedView.name);
      await queryClient.invalidateQueries({ queryKey: ['order-search-saved-views'] });
    },
  });

  const updateSavedViewMutation = useMutation({
    mutationFn: (savedView: OrderSearchSavedView) =>
      updateOrderSearchSavedView(savedView.viewId, {
        name: savedViewName.trim() || savedView.name,
        filters: filtersToSavedPayload(filters),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['order-search-saved-views'] });
    },
  });

  const deleteSavedViewMutation = useMutation({
    mutationFn: deleteOrderSearchSavedView,
    onSuccess: async () => {
      setSelectedSavedViewId('');
      setSavedViewName('');
      await queryClient.invalidateQueries({ queryKey: ['order-search-saved-views'] });
    },
  });

  const orders = ordersPage?.content ?? [];
  const couriers = couriersPage?.content ?? [];
  const totalPages = ordersPage?.totalPages ?? 0;
  const totalElements = ordersPage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const selectedSavedView = savedViews.find((view) => view.viewId === selectedSavedViewId);

  function updateFilter<K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
    setPage(0);
  }

  function toggleStatus(status: OrderStatus) {
    const nextStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((currentStatus) => currentStatus !== status)
      : [...filters.statuses, status];
    updateFilter('statuses', nextStatuses);
  }

  function applySavedView(viewId: string) {
    setSelectedSavedViewId(viewId);
    const savedView = savedViews.find((view) => view.viewId === viewId);
    if (!savedView) {
      setSavedViewName('');
      return;
    }
    setFilters(savedPayloadToFilters(savedView.filters));
    setSavedViewName(savedView.name);
    setPage(0);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setSelectedSavedViewId('');
    setSavedViewName('');
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-500">{totalElements} total orders</p>
        </div>
        <Link
          to="/app/orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          <PlusCircle size={18} />
          New Order
        </Link>
      </div>

      <div className="space-y-4 bg-white border border-gray-200 rounded-lg px-4 py-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="customer-name">
              Customer
            </label>
            <input
              id="customer-name"
              value={filters.customerName}
              onChange={(event) => updateFilter('customerName', event.target.value)}
              placeholder="Name"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              value={filters.phone}
              onChange={(event) => updateFilter('phone', event.target.value)}
              placeholder="0600000000"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="order-id">
              Order ID
            </label>
            <input
              id="order-id"
              value={filters.orderId}
              onChange={(event) => updateFilter('orderId', event.target.value)}
              placeholder="Full or partial ID"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="courier">
              Courier
            </label>
            <select
              id="courier"
              value={filters.courierId}
              onChange={(event) => updateFilter('courierId', event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">All couriers</option>
              {couriers.map((courier) => (
                <option key={courier.courierId} value={courier.courierId}>
                  {courier.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="created-from">
              From
            </label>
            <input
              id="created-from"
              type="date"
              value={filters.createdFrom}
              onChange={(event) => updateFilter('createdFrom', event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="created-to">
              To
            </label>
            <input
              id="created-to"
              type="date"
              value={filters.createdTo}
              onChange={(event) => updateFilter('createdTo', event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="page-size">
              Page size
            </label>
            <select
              id="page-size"
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(0);
              }}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {[10, 20, 50, 100].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <X size={16} />
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {statuses.map((statusOption) => (
            <label
              key={statusOption}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={filters.statuses.includes(statusOption)}
                onChange={() => toggleStatus(statusOption)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {statusOption.replace(/_/g, ' ')}
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
          <div className="min-w-56">
            <label className="block text-sm font-medium text-gray-700" htmlFor="saved-view">
              Saved view
            </label>
            <select
              id="saved-view"
              value={selectedSavedViewId}
              onChange={(event) => applySavedView(event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">No saved view</option>
              {savedViews.map((savedView) => (
                <option key={savedView.viewId} value={savedView.viewId}>
                  {savedView.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-56">
            <label className="block text-sm font-medium text-gray-700" htmlFor="saved-view-name">
              View name
            </label>
            <input
              id="saved-view-name"
              value={savedViewName}
              onChange={(event) => setSavedViewName(event.target.value)}
              placeholder="Save current filters"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => createSavedViewMutation.mutate()}
            disabled={!savedViewName.trim() || createSavedViewMutation.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Bookmark size={16} />
            Save
          </button>
          <button
            type="button"
            onClick={() => selectedSavedView && updateSavedViewMutation.mutate(selectedSavedView)}
            disabled={!selectedSavedView || updateSavedViewMutation.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Save size={16} />
            Update
          </button>
          <button
            type="button"
            onClick={() => selectedSavedView && deleteSavedViewMutation.mutate(selectedSavedView.viewId)}
            disabled={!selectedSavedView || deleteSavedViewMutation.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}
      {(createSavedViewMutation.error || updateSavedViewMutation.error || deleteSavedViewMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(
            createSavedViewMutation.error ?? updateSavedViewMutation.error ?? deleteSavedViewMutation.error,
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
              <th className="p-4 font-medium">ID</th>
              <th className="p-4 font-medium">Customer</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Courier</th>
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
                <td className="p-4 text-gray-500">
                  {couriers.find((courier) => courier.courierId === order.courierId)?.name ?? order.courierId ?? '-'}
                </td>
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
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No orders found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
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
