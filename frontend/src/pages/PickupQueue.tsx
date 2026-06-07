import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PackageCheck } from 'lucide-react';
import { fetchCouriers, fetchPickupQueue, getErrorMessage, markPickedUp } from '../api/client';

export default function PickupQueue() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [courierId, setCourierId] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const {
    data: queuePage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['courier-pickup-queue', { page, size, courierId, createdFrom, createdTo }],
    queryFn: () => fetchPickupQueue({ page, size, courierId, createdFrom: toStartIso(createdFrom), createdTo: toEndIso(createdTo) }),
  });

  const { data: couriersPage } = useQuery({
    queryKey: ['couriers', { page: 0, size: 100 }],
    queryFn: () => fetchCouriers({ page: 0, size: 100 }),
  });

  const pickupMutation = useMutation({
    mutationFn: ({ orderId, assignedCourierId }: { orderId: string; assignedCourierId: string }) => markPickedUp(orderId, assignedCourierId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['courier-pickup-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
    },
  });

  const orders = queuePage?.content ?? [];
  const couriers = couriersPage?.content ?? [];
  const courierNames = new Map(couriers.map((courier) => [courier.courierId, courier.name]));
  const totalPages = queuePage?.totalPages ?? 0;
  const totalElements = queuePage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pickup Queue</h2>
        <p className="text-sm text-gray-500">
          {totalElements} assigned orders waiting pickup
          {isFetching && !isLoading ? ' - Refreshing' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-5">
        <label>
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Courier</span>
          <select
            value={courierId}
            onChange={(event) => {
              setCourierId(event.target.value);
              setPage(0);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All couriers</option>
            {couriers.map((courier) => (
              <option key={courier.courierId} value={courier.courierId}>
                {courier.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Status</span>
          <select
            value="ASSIGNED_TO_COURIER"
            disabled
            className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          >
            <option value="ASSIGNED_TO_COURIER">ASSIGNED TO COURIER</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">From</span>
          <input
            type="date"
            value={createdFrom}
            onChange={(event) => {
              setCreatedFrom(event.target.value);
              setPage(0);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">To</span>
          <input
            type="date"
            value={createdTo}
            onChange={(event) => {
              setCreatedTo(event.target.value);
              setPage(0);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Size</span>
          <select
            value={size}
            onChange={(event) => {
              setSize(Number(event.target.value));
              setPage(0);
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 20, 50, 100].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(error || pickupMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error ?? pickupMutation.error)}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <th className="p-4 font-medium">Order</th>
              <th className="p-4 font-medium">Customer</th>
              <th className="p-4 font-medium">Courier</th>
              <th className="p-4 font-medium">Created</th>
              <th className="p-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="p-4 font-mono text-gray-600">{order.id.slice(0, 8)}...</td>
                <td className="p-4">
                  <p className="font-medium text-gray-900">
                    {order.customer.firstName} {order.customer.lastName}
                  </p>
                  <p className="text-gray-500">{order.customer.phone}</p>
                </td>
                <td className="p-4">
                  <p className="font-medium text-gray-900">{courierNames.get(order.courierId ?? '') ?? 'Unknown courier'}</p>
                  <p className="font-mono text-xs text-gray-500">{order.courierId}</p>
                </td>
                <td className="p-4 text-gray-500">{new Date(order.createdAt).toLocaleString()}</td>
                <td className="p-4">
                  <button
                    type="button"
                    disabled={!order.courierId || pickupMutation.isPending}
                    onClick={() => pickupMutation.mutate({ orderId: order.id, assignedCourierId: order.courierId! })}
                    className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    <PackageCheck size={16} />
                    Picked up
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No assigned orders are waiting pickup.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Loading pickup queue...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Page {totalPages === 0 ? 0 : page + 1} of {totalPages}</p>
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

function toStartIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function toEndIso(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : undefined;
}
