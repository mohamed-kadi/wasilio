import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PackageCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { fetchCouriers, fetchPickupQueue, getErrorMessage, markPickedUp } from '../api/client';

interface PickupLocationState {
  assignedOrderId?: string;
  assignedCourierId?: string;
}

export default function PickupQueue() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationState = location.state as PickupLocationState | null;
  const assignedOrderId = typeof locationState?.assignedOrderId === 'string' ? locationState.assignedOrderId : undefined;
  const assignedCourierId =
    typeof locationState?.assignedCourierId === 'string' ? locationState.assignedCourierId : undefined;
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [courierId, setCourierId] = useState(assignedCourierId ?? '');
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
  const highlightedOrder = assignedOrderId ? orders.find((order) => order.id === assignedOrderId) : undefined;

  function resetFilters() {
    setCourierId('');
    setCreatedFrom('');
    setCreatedTo('');
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pickup Queue</h2>
        <p className="text-sm text-gray-500">
          {totalElements} assigned orders waiting pickup
          {isFetching && !isLoading ? ' - Refreshing' : ''}
        </p>
      </div>

      <section className="rounded-lg border border-orange-200 bg-orange-50 p-5 text-orange-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase">Courier stage</p>
            <h3 className="mt-2 text-xl font-bold text-gray-900">Pickup confirmation</h3>
            <p className="mt-2 max-w-2xl text-sm">
              These orders already have a courier assigned. Confirm pickup only when the package has physically left the merchant.
            </p>
          </div>
          <div className="rounded-md bg-white/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Next action</p>
            <p className="mt-1 font-semibold text-gray-900">Mark picked up to move the order into delivery.</p>
          </div>
        </div>
      </section>

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

      {assignedOrderId && highlightedOrder && (
        <section className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-orange-950">Assigned order ready for pickup confirmation</p>
              <p className="mt-1 text-sm text-orange-800">
                This order came from courier assignment. Confirm pickup only after the package leaves the merchant.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200">
              {highlightedOrder.id.slice(0, 8)}...
            </span>
          </div>
        </section>
      )}

      {assignedOrderId && !highlightedOrder && !isLoading && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-950">Assigned order is not visible in this pickup view</p>
              <p className="mt-1 text-sm text-amber-800">
                It may already be picked up, outside the current filters, or on another page.
              </p>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Clear filters
            </button>
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <th className="p-4 font-medium">Order</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Courier</th>
                <th className="p-4 font-medium">Next action</th>
                <th className="p-4 font-medium">Created</th>
                <th className="p-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const highlighted = assignedOrderId === order.id;
                return (
                  <tr key={order.id} className={`hover:bg-gray-50 ${highlighted ? 'bg-orange-50' : ''}`}>
                    <td className="p-4">
                      <p className="font-mono text-gray-600">{order.id.slice(0, 8)}...</p>
                      {highlighted && (
                        <span className="mt-2 inline-flex rounded-full bg-orange-600 px-2.5 py-1 text-xs font-semibold text-white">
                          From assignment
                        </span>
                      )}
                    </td>
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
                    <td className="p-4 text-gray-700">Confirm package pickup</td>
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
                );
              })}
              {!isLoading && orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <div className="mx-auto max-w-sm">
                      <p className="text-sm font-medium text-gray-900">No assigned orders are waiting pickup.</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Assign a courier first, or clear filters to check the full pickup queue.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Link
                          to="/app/couriers/assignment"
                          className="inline-flex items-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-700"
                        >
                          Open assignment queue
                        </Link>
                        <button
                          type="button"
                          onClick={resetFilters}
                          className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                          Clear filters
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <p className="text-sm font-medium text-gray-900">Loading pickup queue</p>
                    <p className="mt-1 text-sm text-gray-500">Fetching assigned orders that need physical pickup.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
