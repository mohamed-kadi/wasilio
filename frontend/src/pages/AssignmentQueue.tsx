import { type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, PackageCheck, Phone, SlidersHorizontal, Truck, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { assignCourier, fetchAssignmentQueue, fetchCouriers, getErrorMessage } from '../api/client';
import { orderLineSummary } from '../lib/orderLines';
import type { Courier, Order } from '../api/client';

interface AssignmentLocationState {
  confirmedOrderId?: string;
}

interface AssignedHandoff {
  order: Order;
  courierId: string;
  courierName: string;
}

export default function AssignmentQueue() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationState = location.state as AssignmentLocationState | null;
  const confirmedOrderId =
    typeof locationState?.confirmedOrderId === 'string' ? locationState.confirmedOrderId : undefined;
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [selectedCouriers, setSelectedCouriers] = useState<Record<string, string>>({});
  const [assignedHandoff, setAssignedHandoff] = useState<AssignedHandoff | null>(null);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);

  const {
    data: queuePage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['courier-assignment-queue', { page, size, createdFrom, createdTo }],
    queryFn: () => fetchAssignmentQueue({ page, size, createdFrom: toStartIso(createdFrom), createdTo: toEndIso(createdTo) }),
  });

  const { data: couriersPage, isLoading: couriersLoading } = useQuery({
    queryKey: ['couriers', { page: 0, size: 100 }],
    queryFn: () => fetchCouriers({ page: 0, size: 100 }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ orderId, courierId }: { orderId: string; courierId: string }) => assignCourier(orderId, courierId),
    onSuccess: async (_result, variables) => {
      const assignedOrder = orders.find((order) => order.id === variables.orderId);
      const assignedCourier = activeCouriers.find((courier) => courier.courierId === variables.courierId);

      if (assignedOrder) {
        setAssignedHandoff({
          order: assignedOrder,
          courierId: variables.courierId,
          courierName: assignedCourier?.name ?? variables.courierId,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['courier-assignment-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['courier-pickup-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
    },
  });

  const orders = queuePage?.content ?? [];
  const activeCouriers = (couriersPage?.content ?? []).filter((courier) => courier.active);
  const totalPages = queuePage?.totalPages ?? 0;
  const totalElements = queuePage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const highlightedOrder = confirmedOrderId ? orders.find((order) => order.id === confirmedOrderId) : undefined;
  const confirmedOrderAssigned = confirmedOrderId === assignedHandoff?.order.id;
  const addressReadyCount = orders.filter(hasDeliveryAddress).length;
  const highConfidenceCount = orders.filter((order) => order.intelligence?.level === 'HIGH_CONFIDENCE').length;

  function resetFilters() {
    setCreatedFrom('');
    setCreatedTo('');
    setPage(0);
  }

  function assignOrder(order: Order) {
    const selectedCourierId = selectedCouriers[order.id];
    if (!selectedCourierId) {
      return;
    }

    setAssignedHandoff(null);
    assignMutation.mutate({ orderId: order.id, courierId: selectedCourierId });
  }

  return (
    <QueueLayout
      title="Courier Assignment"
      subtitle={`${totalElements} confirmed orders ready for courier assignment`}
      stageTitle="Assign courier"
      stageDescription="These orders are confirmed by the customer. Choose the courier who should collect each package."
      nextAction="Assign a courier to move the order into pickup."
      error={error ?? assignMutation.error}
      isFetching={isFetching}
      isLoading={isLoading}
      page={page}
      totalPages={totalPages}
      size={size}
      createdFrom={createdFrom}
      createdTo={createdTo}
      setPage={setPage}
      setSize={setSize}
      setCreatedFrom={setCreatedFrom}
      setCreatedTo={setCreatedTo}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      advancedFiltersOpen={advancedFiltersOpen}
      setAdvancedFiltersOpen={setAdvancedFiltersOpen}
    >
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Ready for assignment"
          value={String(totalElements)}
          detail={isFetching && !isLoading ? 'Refreshing queue' : 'Confirmed orders'}
        />
        <SummaryMetric
          label="Active couriers"
          value={String(activeCouriers.length)}
          detail={couriersLoading ? 'Loading couriers' : 'Available for assignment'}
        />
        <SummaryMetric
          label="Address ready"
          value={`${addressReadyCount}/${orders.length}`}
          detail="Visible rows with delivery basics"
        />
        <SummaryMetric
          label="Fast handoff"
          value={String(highConfidenceCount)}
          detail="Visible high-confidence orders"
        />
      </section>

      {confirmedOrderId && highlightedOrder && !confirmedOrderAssigned && (
        <section className="rounded-lg border border-green-200 bg-green-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-green-950">Confirmed order ready for courier assignment</p>
              <p className="mt-1 text-sm text-green-800">
                This order came from confirmations. Select an active courier and assign it for pickup.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-200">
              {shortOrderId(highlightedOrder.id)}
            </span>
          </div>
        </section>
      )}

      {confirmedOrderId && !highlightedOrder && !isLoading && !confirmedOrderAssigned && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-950">Confirmed order is not visible in this queue view</p>
              <p className="mt-1 text-sm text-amber-800">
                It may already be assigned, outside the current filters, or on another page.
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

      {!couriersLoading && activeCouriers.length === 0 && orders.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-950">No active couriers available</p>
              <p className="mt-1 text-sm text-amber-800">
                Activate or create a courier before these confirmed orders can move into pickup.
              </p>
            </div>
            <Link
              to="/app/couriers"
              className="inline-flex items-center rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              Manage couriers
            </Link>
          </div>
        </section>
      )}

      {assignedHandoff && (
        <section className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-orange-950">Order assigned and moved to pickup</p>
              <p className="mt-1 text-sm text-orange-800">
                {customerName(assignedHandoff.order)} is assigned to {assignedHandoff.courierName}. Confirm pickup
                when the package leaves the merchant.
              </p>
              <p className="mt-2 font-mono text-xs text-orange-700">{assignedHandoff.order.id}</p>
            </div>
            <Link
              to="/app/couriers/pickup"
              state={{
                assignedOrderId: assignedHandoff.order.id,
                assignedCourierId: assignedHandoff.courierId,
              }}
              className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
            >
              <Truck size={16} />
              Open pickup queue
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Users size={18} />
              Active courier options
            </h3>
            <p className="mt-1 text-sm text-gray-500">Use the same active courier list before assigning each confirmed order.</p>
          </div>
          <Link
            to="/app/couriers"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Manage couriers
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {couriersLoading && (
            <div className="rounded-md border border-gray-200 px-3 py-3 text-sm text-gray-500">Loading courier options.</div>
          )}
          {!couriersLoading && activeCouriers.length === 0 && (
            <div className="rounded-md border border-gray-200 px-3 py-3 text-sm text-gray-500">No active couriers available.</div>
          )}
          {activeCouriers.slice(0, 4).map((courier) => (
            <CourierOptionCard key={courier.courierId} courier={courier} />
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div data-testid="assignment-queue-table-wrap" className="overflow-x-hidden">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <th className="w-[15%] p-4 font-medium">Order</th>
                <th className="w-[18%] p-4 font-medium">Customer</th>
                <th className="w-[18%] p-4 font-medium">Product</th>
                <th className="w-[25%] p-4 font-medium">Confirmation handoff</th>
                <th className="w-[24%] p-4 font-medium">Courier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const highlighted = confirmedOrderId === order.id;
                return (
                  <tr
                    key={order.id}
                    className={`border-l-4 hover:bg-gray-50 ${highlighted ? 'border-l-green-500 bg-green-50' : 'border-l-transparent'}`}
                  >
                    <td className="p-4 align-top">
                      <Link to={`/app/orders/${order.id}`} className="font-mono text-blue-600 hover:underline">
                        {shortOrderId(order.id)}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-xs font-medium text-gray-500">{sourceLabel(order.source)}</p>
                      {highlighted && (
                        <span className="mt-2 inline-flex rounded-full bg-green-700 px-2.5 py-1 text-xs font-semibold text-white">
                          From confirmation
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-top">
                      <p className="font-medium text-gray-900">{customerName(order)}</p>
                      <p className="mt-1 truncate text-gray-500">{order.customer.phone}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">{deliveryArea(order)}</p>
                    </td>
                    <td className="p-4 align-top">
                      {orderLineSummary(order.orderLines) ? (
                        <span className="line-clamp-2 font-medium text-gray-800">{orderLineSummary(order.orderLines)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                      <p className="mt-1 whitespace-nowrap text-xs font-semibold text-gray-900">{formatAmount(order.amount)}</p>
                    </td>
                    <td className="p-4 align-top">
                      <AssignmentHandoff order={order} />
                    </td>
                    <td className="p-4 align-top">
                      <select
                        value={selectedCouriers[order.id] ?? ''}
                        onChange={(event) =>
                          setSelectedCouriers((current) => ({ ...current, [order.id]: event.target.value }))
                        }
                        className="w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select courier</option>
                        {activeCouriers.map((courier) => (
                          <option key={courier.courierId} value={courier.courierId}>
                            {courier.name} - {courier.phone}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedCouriers[order.id] || assignMutation.isPending}
                        onClick={() => assignOrder(order)}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
                      >
                        <PackageCheck size={16} />
                        Assign courier
                      </button>
                      <p className="mt-2 text-xs leading-5 text-gray-500">Moves to pickup after assignment.</p>
                    </td>
                  </tr>
                );
              })}
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <p className="text-sm font-medium text-gray-900">Loading assignment queue</p>
                    <p className="mt-1 text-sm text-gray-500">Fetching confirmed orders that need a courier.</p>
                  </td>
                </tr>
              )}
              {!isLoading && orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <div className="mx-auto max-w-sm">
                      <p className="text-sm font-medium text-gray-900">No confirmed orders need assignment.</p>
                      <p className="mt-1 text-sm text-gray-500">
                        Confirm customer orders first, or clear filters to check the full assignment queue.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </QueueLayout>
  );
}

interface QueueLayoutProps {
  title: string;
  subtitle: string;
  stageTitle: string;
  stageDescription: string;
  nextAction: string;
  error: unknown;
  isFetching: boolean;
  isLoading: boolean;
  page: number;
  totalPages: number;
  size: number;
  createdFrom: string;
  createdTo: string;
  setPage: (value: number | ((current: number) => number)) => void;
  setSize: (value: number) => void;
  setCreatedFrom: (value: string) => void;
  setCreatedTo: (value: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  advancedFiltersOpen: boolean;
  setAdvancedFiltersOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  children: ReactNode;
}

function QueueLayout({
  title,
  subtitle,
  stageTitle,
  stageDescription,
  nextAction,
  error,
  isFetching,
  isLoading,
  page,
  totalPages,
  size,
  createdFrom,
  createdTo,
  setPage,
  setSize,
  setCreatedFrom,
  setCreatedTo,
  canGoBack,
  canGoForward,
  advancedFiltersOpen,
  setAdvancedFiltersOpen,
  children,
}: QueueLayoutProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">
          {subtitle}
          {isFetching && !isLoading ? ' - Refreshing' : ''}
        </p>
      </div>

      <section className="rounded-lg border border-yellow-200 bg-yellow-50 p-5 text-yellow-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase">Courier stage</p>
            <h3 className="mt-2 text-xl font-bold text-gray-900">{stageTitle}</h3>
            <p className="mt-2 max-w-2xl text-sm">{stageDescription}</p>
          </div>
          <div className="rounded-md bg-white/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Next action</p>
            <p className="mt-1 font-semibold text-gray-900">{nextAction}</p>
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Assignment queue</h3>
            <p className="text-sm text-gray-500">Confirmed orders waiting for courier assignment.</p>
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

        {advancedFiltersOpen && (
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 md:grid-cols-4">
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
            <div className="flex items-end justify-end">
              <button
                type="button"
                onClick={() => {
                  setCreatedFrom('');
                  setCreatedTo('');
                  setPage(0);
                }}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>

      {Boolean(error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      {children}

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

function customerName(order: Order) {
  return `${order.customer.firstName} ${order.customer.lastName}`.trim() || 'Unknown customer';
}

function shortOrderId(orderId: string) {
  return `${orderId.slice(0, 8)}...`;
}

function sourceLabel(source?: string) {
  if (source === 'WASILIO_STOREFRONT') {
    return 'Storefront / landing-engine';
  }
  if (!source || source === 'MANUAL') {
    return 'Manual order';
  }
  return source
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function deliveryArea(order: Order) {
  return [order.address.city, order.address.state, order.address.country].filter(Boolean).join(', ') || 'Address needs review';
}

function hasDeliveryAddress(order: Order) {
  return Boolean(order.address.street?.trim() && order.address.city?.trim() && order.address.country?.trim());
}

function formatAmount(amount: number) {
  return `MAD ${amount.toFixed(2)}`;
}

function AssignmentHandoff({ order }: { order: Order }) {
  const addressReady = hasDeliveryAddress(order);
  const confidence = order.intelligence?.confirmationConfidenceScore;
  const risk = order.intelligence?.fraudRiskScore;
  const topSignal = order.intelligence?.signals[0]?.label;

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          Customer confirmed
        </span>
        <span
          className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${
            addressReady
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {addressReady ? 'Address ready' : 'Check address'}
        </span>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-1.5">
        <ScoreMini label="Confidence" value={confidence} tone="confidence" />
        <ScoreMini label="Risk" value={risk} tone="risk" />
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-gray-500">{topSignal ?? order.intelligence?.summary ?? 'No score signal yet.'}</p>
    </div>
  );
}

function ScoreMini({
  label,
  value,
  tone,
}: {
  label: string;
  value?: number;
  tone: 'confidence' | 'risk';
}) {
  const valueLabel = value === undefined ? 'Pending' : `${value}/100`;
  const fillClassName = value === undefined
    ? 'bg-gray-300'
    : tone === 'confidence'
      ? confidenceFillClass(value)
      : riskFillClass(value);

  return (
    <div className="min-w-0 rounded-md border border-gray-200 bg-white px-2 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-semibold uppercase text-gray-500">{label}</p>
        <p className="shrink-0 text-xs font-semibold text-gray-900">{valueLabel}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${fillClassName}`} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

function CourierOptionCard({ courier }: { courier: Courier }) {
  return (
    <div className="min-w-0 rounded-md border border-gray-200 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{courier.name}</p>
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-gray-500">
            <Phone size={13} />
            {courier.phone}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          Active
        </span>
      </div>
    </div>
  );
}

function confidenceFillClass(value: number) {
  if (value >= 75) {
    return 'bg-emerald-500';
  }
  if (value >= 50) {
    return 'bg-amber-500';
  }
  return 'bg-red-500';
}

function riskFillClass(value: number) {
  if (value >= 70) {
    return 'bg-red-500';
  }
  if (value >= 40) {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
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
