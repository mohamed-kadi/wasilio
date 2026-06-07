import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import {
  type DeliveryFailureReason,
  fetchCouriers,
  fetchDeliveryQueue,
  getErrorMessage,
  markDelivered,
  markFailed,
} from '../api/client';

const failureReasons: DeliveryFailureReason[] = [
  'CUSTOMER_UNREACHABLE',
  'CUSTOMER_REFUSED',
  'INVALID_ADDRESS',
  'CUSTOMER_RESCHEDULED',
  'LOST_PACKAGE',
  'OTHER',
];

export default function DeliveryQueue() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [courierId, setCourierId] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [failureForms, setFailureForms] = useState<Record<string, { reason: DeliveryFailureReason; note: string }>>({});

  const {
    data: queuePage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['courier-delivery-queue', { page, size, courierId, createdFrom, createdTo }],
    queryFn: () => fetchDeliveryQueue({ page, size, courierId, createdFrom: toStartIso(createdFrom), createdTo: toEndIso(createdTo) }),
  });

  const { data: couriersPage } = useQuery({
    queryKey: ['couriers', { page: 0, size: 100 }],
    queryFn: () => fetchCouriers({ page: 0, size: 100 }),
  });

  const deliveredMutation = useMutation({
    mutationFn: (orderId: string) => markDelivered(orderId),
    onSuccess: invalidateDeliveryData,
  });

  const failedMutation = useMutation({
    mutationFn: ({ orderId, reason, note }: { orderId: string; reason: DeliveryFailureReason; note: string }) =>
      markFailed(orderId, reason, note),
    onSuccess: invalidateDeliveryData,
  });

  async function invalidateDeliveryData() {
    await queryClient.invalidateQueries({ queryKey: ['courier-delivery-queue'] });
    await queryClient.invalidateQueries({ queryKey: ['courier-performance'] });
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
    await queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
  }

  function getFailureForm(orderId: string) {
    return failureForms[orderId] ?? { reason: 'CUSTOMER_REFUSED' as DeliveryFailureReason, note: '' };
  }

  function updateFailureForm(orderId: string, updates: Partial<{ reason: DeliveryFailureReason; note: string }>) {
    setFailureForms((current) => ({
      ...current,
      [orderId]: { ...getFailureForm(orderId), ...updates },
    }));
  }

  const orders = queuePage?.content ?? [];
  const couriers = couriersPage?.content ?? [];
  const courierNames = new Map(couriers.map((courier) => [courier.courierId, courier.name]));
  const totalPages = queuePage?.totalPages ?? 0;
  const totalElements = queuePage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const mutationError = deliveredMutation.error ?? failedMutation.error;
  const mutationPending = deliveredMutation.isPending || failedMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Delivery Queue</h2>
        <p className="text-sm text-gray-500">
          {totalElements} picked up orders waiting delivery outcome
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
            value="PICKED_UP"
            disabled
            className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
          >
            <option value="PICKED_UP">PICKED UP</option>
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

      {(error || mutationError) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error ?? mutationError)}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <th className="p-4 font-medium">Order</th>
              <th className="p-4 font-medium">Customer</th>
              <th className="p-4 font-medium">Courier</th>
              <th className="p-4 font-medium">Failure reason</th>
              <th className="p-4 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => {
              const failureForm = getFailureForm(order.id);
              return (
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
                  <td className="p-4">
                    <div className="space-y-2">
                      <select
                        value={failureForm.reason}
                        onChange={(event) => updateFailureForm(order.id, { reason: event.target.value as DeliveryFailureReason })}
                        className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {failureReasons.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason.replaceAll('_', ' ')}
                          </option>
                        ))}
                      </select>
                      <input
                        value={failureForm.note}
                        onChange={(event) => updateFailureForm(order.id, { note: event.target.value })}
                        className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Optional note"
                        maxLength={1000}
                      />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={mutationPending}
                        onClick={() => deliveredMutation.mutate(order.id)}
                        className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        Delivered
                      </button>
                      <button
                        type="button"
                        disabled={mutationPending}
                        onClick={() => failedMutation.mutate({ orderId: order.id, reason: failureForm.reason, note: failureForm.note })}
                        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle size={16} />
                        Failed
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No picked up orders are waiting delivery outcome.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Loading delivery queue...
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
