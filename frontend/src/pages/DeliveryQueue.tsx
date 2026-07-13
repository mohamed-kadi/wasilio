import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, SlidersHorizontal, XCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  type DeliveryFailureReason,
  type Order,
  fetchCouriers,
  fetchDeliveryQueue,
  getErrorMessage,
  markDelivered,
  markFailed,
} from '../api/client';
import { orderLineSummary } from '../lib/orderLines';

const failureReasons: DeliveryFailureReason[] = [
  'CUSTOMER_UNREACHABLE',
  'CUSTOMER_REFUSED',
  'INVALID_ADDRESS',
  'CUSTOMER_RESCHEDULED',
  'LOST_PACKAGE',
  'OTHER',
];

const failureReasonLabels: Record<DeliveryFailureReason, string> = {
  CUSTOMER_UNREACHABLE: 'Customer unreachable',
  CUSTOMER_REFUSED: 'Customer refused',
  INVALID_ADDRESS: 'Invalid address',
  CUSTOMER_RESCHEDULED: 'Customer rescheduled',
  LOST_PACKAGE: 'Lost package',
  OTHER: 'Other',
};

interface DeliveryLocationState {
  pickedUpOrderId?: string;
  pickedUpCourierId?: string;
}

export default function DeliveryQueue() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationState = location.state as DeliveryLocationState | null;
  const pickedUpOrderId = typeof locationState?.pickedUpOrderId === 'string' ? locationState.pickedUpOrderId : undefined;
  const pickedUpCourierId =
    typeof locationState?.pickedUpCourierId === 'string' ? locationState.pickedUpCourierId : undefined;
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [courierId, setCourierId] = useState(pickedUpCourierId ?? '');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [failureForms, setFailureForms] = useState<Record<string, { reason: DeliveryFailureReason; note: string }>>({});
  const [deliveryConfirmationId, setDeliveryConfirmationId] = useState<string | null>(null);
  const [failureReviewOrderId, setFailureReviewOrderId] = useState<string | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

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
    onSuccess: async () => {
      setDeliveryConfirmationId(null);
      setFailureReviewOrderId(null);
      await invalidateDeliveryData();
    },
  });

  const failedMutation = useMutation({
    mutationFn: ({ orderId, reason, note }: { orderId: string; reason: DeliveryFailureReason; note: string }) =>
      markFailed(orderId, reason, note),
    onSuccess: async () => {
      setDeliveryConfirmationId(null);
      setFailureReviewOrderId(null);
      await invalidateDeliveryData();
    },
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
  const highlightedOrder = pickedUpOrderId ? orders.find((order) => order.id === pickedUpOrderId) : undefined;
  const deliveryConfirmationOrder = deliveryConfirmationId
    ? orders.find((order) => order.id === deliveryConfirmationId) ?? null
    : null;
  const failureReviewOrder = failureReviewOrderId
    ? orders.find((order) => order.id === failureReviewOrderId) ?? null
    : null;

  function resetFilters() {
    setCourierId('');
    setCreatedFrom('');
    setCreatedTo('');
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Delivery Queue</h2>
        <p className="text-sm text-gray-500">
          {totalElements} picked up orders waiting delivery outcome
          {isFetching && !isLoading ? ' - Refreshing' : ''}
        </p>
      </div>

      <section className="rounded-lg border border-green-200 bg-green-50 p-5 text-green-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase">Courier stage</p>
            <h3 className="mt-2 text-xl font-bold text-gray-900">Delivery outcome</h3>
            <p className="mt-2 max-w-2xl text-sm">
              These packages are already with couriers. Record the final result after the delivery attempt.
            </p>
          </div>
          <div className="rounded-md bg-white/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Next action</p>
            <p className="mt-1 font-semibold text-gray-900">Choose delivered or document the failure reason.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Out for delivery"
          value={String(totalElements)}
          detail={isFetching && !isLoading ? 'Refreshing queue' : 'Picked up orders'}
        />
        <SummaryMetric
          label="Couriers"
          value={courierId ? (courierNames.get(courierId) ?? 'Filtered') : String(couriers.length)}
          detail={courierId ? 'Filtered courier' : 'Available in filter'}
        />
        <SummaryMetric
          label="Highlighted"
          value={highlightedOrder ? shortId(highlightedOrder.id) : 'None'}
          detail={pickedUpOrderId ? 'From pickup' : 'No handoff selected'}
        />
        <SummaryMetric
          label="Next stage"
          value="Recovery"
          detail="Only if delivery fails"
        />
      </section>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Delivery queue</h3>
            <p className="text-sm text-gray-500">Picked up orders waiting for the courier delivery result.</p>
          </div>
          <button
            type="button"
            aria-expanded={advancedFiltersOpen}
            onClick={() => setAdvancedFiltersOpen((open) => !open)}
            className="inline-flex min-w-[12rem] items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <SlidersHorizontal size={16} />
            Advanced filters
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
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
          <button
            type="button"
            onClick={resetFilters}
            className="self-end rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Clear filters
          </button>
        </div>

        {advancedFiltersOpen && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 md:grid-cols-4">
            <label>
              <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Delivery stage</span>
              <select
                value="OUT_FOR_DELIVERY"
                disabled
                className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              >
                <option value="OUT_FOR_DELIVERY">Out for delivery</option>
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Created from</span>
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
              <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Created to</span>
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
              <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Rows per page</span>
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
        )}
      </div>

      {(error || mutationError) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error ?? mutationError)}
        </div>
      )}

      {pickedUpOrderId && highlightedOrder && (
        <section className="rounded-lg border border-green-200 bg-green-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-green-950">Picked up order ready for delivery outcome</p>
              <p className="mt-1 text-sm text-green-800">
                This order came from pickup confirmation. Mark it delivered only after the courier reports a successful
                delivery; otherwise choose the failure reason.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
              {highlightedOrder.id.slice(0, 8)}...
            </span>
          </div>
        </section>
      )}

      {pickedUpOrderId && !highlightedOrder && !isLoading && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-950">Picked up order is not visible in this delivery view</p>
              <p className="mt-1 text-sm text-amber-800">
                It may already have a delivery outcome, outside the current filters, or on another page.
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
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <th className="p-4 font-medium">Order</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Products</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Courier</th>
                <th className="p-4 font-medium">Next action</th>
                <th className="p-4 font-medium">Created</th>
                <th className="p-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const highlighted = pickedUpOrderId === order.id;

                return (
                  <tr key={order.id} className={`hover:bg-gray-50 ${highlighted ? 'bg-green-50' : ''}`}>
                    <td className="p-4">
                      <Link to={`/app/orders/${order.id}`} className="font-mono text-blue-600 hover:underline">
                        {shortId(order.id)}
                      </Link>
                      {highlighted && (
                        <span className="mt-2 inline-flex rounded-full bg-green-700 px-2.5 py-1 text-xs font-semibold text-white">
                          From pickup
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
                      {orderLineSummary(order.orderLines) ? (
                        <span className="font-medium text-gray-800">{orderLineSummary(order.orderLines)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 font-medium">{order.amount.toFixed(2)} MAD</td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{courierNames.get(order.courierId ?? '') ?? 'Unknown courier'}</p>
                      <p className="font-mono text-xs text-gray-500">{order.courierId}</p>
                    </td>
                    <td className="p-4 text-gray-700">Awaiting delivery result</td>
                    <td className="p-4 text-gray-500">{new Date(order.createdAt).toLocaleString()}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={mutationPending}
                          onClick={() => {
                            setFailureReviewOrderId(null);
                            setDeliveryConfirmationId(order.id);
                          }}
                          className="inline-flex min-h-10 items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} />
                          Record delivered
                        </button>
                        <button
                          type="button"
                          disabled={mutationPending}
                          onClick={() => {
                            setDeliveryConfirmationId(null);
                            setFailureReviewOrderId(order.id);
                          }}
                          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          Record failed delivery
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    <div className="mx-auto max-w-sm">
                      <p className="text-sm font-medium text-gray-900">No picked up orders are waiting delivery outcome.</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Mark packages picked up first, or clear filters to check the full delivery queue.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Link
                          to="/app/couriers/pickup"
                          className="inline-flex items-center rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
                        >
                          Open pickup queue
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
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    <p className="text-sm font-medium text-gray-900">Loading delivery queue</p>
                    <p className="mt-1 text-sm text-gray-500">Fetching picked up orders that need a final outcome.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deliveryConfirmationOrder && (
        <DeliveryOutcomePanel
          order={deliveryConfirmationOrder}
          courierName={courierNames.get(deliveryConfirmationOrder.courierId ?? '') ?? 'Unknown courier'}
          mutationPending={mutationPending}
          onCancel={() => setDeliveryConfirmationId(null)}
          onConfirm={() => deliveredMutation.mutate(deliveryConfirmationOrder.id)}
        />
      )}

      {failureReviewOrder && (
        <FailureOutcomePanel
          order={failureReviewOrder}
          courierName={courierNames.get(failureReviewOrder.courierId ?? '') ?? 'Unknown courier'}
          failureForm={getFailureForm(failureReviewOrder.id)}
          mutationPending={mutationPending}
          onChange={(updates) => updateFailureForm(failureReviewOrder.id, updates)}
          onCancel={() => setFailureReviewOrderId(null)}
          onConfirm={() => {
            const failureForm = getFailureForm(failureReviewOrder.id);
            failedMutation.mutate({
              orderId: failureReviewOrder.id,
              reason: failureForm.reason,
              note: failureForm.note,
            });
          }}
        />
      )}

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

function DeliveryOutcomePanel({
  order,
  courierName,
  mutationPending,
  onCancel,
  onConfirm,
}: {
  order: Order;
  courierName: string;
  mutationPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase">Delivery outcome</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">Record delivered?</h3>
          <p className="mt-1 text-sm">
            {customerName(order)} with {courierName}. This records a successful delivery and closes the order from courier tracking.
          </p>
          <p className="mt-2 font-mono text-xs text-green-800">{order.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={mutationPending}
            onClick={onConfirm}
            className="inline-flex items-center rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
          >
            Record delivered
          </button>
          <button
            type="button"
            disabled={mutationPending}
            onClick={onCancel}
            className="inline-flex items-center rounded-md border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-900 hover:bg-green-100 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

function FailureOutcomePanel({
  order,
  courierName,
  failureForm,
  mutationPending,
  onChange,
  onCancel,
  onConfirm,
}: {
  order: Order;
  courierName: string;
  failureForm: { reason: DeliveryFailureReason; note: string };
  mutationPending: boolean;
  onChange: (updates: Partial<{ reason: DeliveryFailureReason; note: string }>) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase">Failed delivery</p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">Record failed delivery</h3>
          <p className="mt-1 text-sm">
            {customerName(order)} with {courierName}. A failed outcome sends this order into recovery review.
          </p>
          <p className="mt-2 font-mono text-xs text-red-800">{order.id}</p>
        </div>
        <button
          type="button"
          disabled={mutationPending}
          onClick={onCancel}
          className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[260px_minmax(0,1fr)_auto]">
        <label>
          <span className="mb-1 block text-sm font-medium text-red-950">Reason</span>
          <select
            value={failureForm.reason}
            onChange={(event) => onChange({ reason: event.target.value as DeliveryFailureReason })}
            className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {failureReasons.map((reason) => (
              <option key={reason} value={reason}>
                {failureReasonLabels[reason]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium text-red-950">Delivery note</span>
          <input
            value={failureForm.note}
            onChange={(event) => onChange({ note: event.target.value })}
            className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
            placeholder="Optional courier or customer note"
            maxLength={1000}
          />
        </label>
        <button
          type="button"
          disabled={mutationPending}
          onClick={onConfirm}
          className="self-end rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {mutationPending ? 'Recording...' : 'Record failed delivery'}
        </button>
      </div>
    </section>
  );
}

function customerName(order: Order) {
  return `${order.customer.firstName} ${order.customer.lastName}`.trim() || 'Unknown customer';
}

function shortId(id: string) {
  return `${id.slice(0, 8)}...`;
}

function toStartIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function toEndIso(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : undefined;
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold text-gray-900">{value}</p>
      <p className="mt-1 truncate text-xs text-gray-500">{detail}</p>
    </div>
  );
}
