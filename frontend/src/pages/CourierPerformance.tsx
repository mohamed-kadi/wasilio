import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react';
import { fetchCourierPerformance, fetchDeliveryFailures, getErrorMessage } from '../api/client';
import type { CourierPerformance as CourierPerformanceMetric, DeliveryFailureDrilldownItem } from '../api/client';

type DatePreset = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS';

const pageSize = 10;
const datePresets: Array<{ value: DatePreset; label: string; detail: string }> = [
  { value: 'TODAY', label: 'Today', detail: 'Since local midnight' },
  { value: 'LAST_7_DAYS', label: 'Last 7 days', detail: 'Rolling 7-day window' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days', detail: 'Rolling 30-day window' },
];

export default function CourierPerformance() {
  const [datePreset, setDatePreset] = useState<DatePreset>('LAST_7_DAYS');
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [failurePage, setFailurePage] = useState(0);
  const range = useMemo(() => rangeForPreset(datePreset), [datePreset]);

  const {
    data: metrics = [],
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['courier-performance', range],
    queryFn: () => fetchCourierPerformance(range),
  });

  const rankedMetrics = useMemo(() => (
    [...metrics].sort((left, right) => {
      const rightCompleted = completedOrdersFor(right);
      const leftCompleted = completedOrdersFor(left);
      if (rightCompleted !== leftCompleted) {
        return rightCompleted - leftCompleted;
      }
      if (right.deliverySuccessRate !== left.deliverySuccessRate) {
        return right.deliverySuccessRate - left.deliverySuccessRate;
      }
      return left.courierName.localeCompare(right.courierName);
    })
  ), [metrics]);

  const selectedMetric = selectedCourierId
    ? metrics.find((metric) => metric.courierId === selectedCourierId)
    : undefined;
  const {
    data: failuresPage,
    error: failuresError,
    isLoading: loadingFailures,
    isFetching: fetchingFailures,
  } = useQuery({
    queryKey: ['delivery-failures', {
      courierId: selectedCourierId,
      page: failurePage,
      size: pageSize,
      ...range,
    }],
    queryFn: () => fetchDeliveryFailures({
      courierId: selectedCourierId ?? undefined,
      page: failurePage,
      size: pageSize,
      ...range,
    }),
    enabled: Boolean(selectedCourierId),
  });

  const activeCouriers = metrics.filter((metric) => metric.active).length;
  const assignmentAttempts = metrics.reduce((total, metric) => total + metric.assignedOrdersCount, 0);
  const deliveredOrders = metrics.reduce((total, metric) => total + metric.deliveredOrdersCount, 0);
  const failedOrders = metrics.reduce((total, metric) => total + metric.failedOrdersCount, 0);
  const completedOrders = deliveredOrders + failedOrders;
  const overallSuccessRate = completedOrders ? Math.round((deliveredOrders / completedOrders) * 100) : 0;
  const failureTotalPages = failuresPage?.totalPages ?? 0;
  const canPageFailuresBack = failurePage > 0;
  const canPageFailuresForward = failureTotalPages > 0 && failurePage + 1 < failureTotalPages;

  function choosePreset(value: DatePreset) {
    setDatePreset(value);
    setSelectedCourierId(null);
    setFailurePage(0);
  }

  function openFailures(metric: CourierPerformanceMetric) {
    setSelectedCourierId(metric.courierId);
    setFailurePage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Courier performance</h2>
          <p className="text-sm text-gray-500">
            Compare assignment, pickup, delivery, and failed-delivery recovery signals
            {isFetching && !isLoading ? ' - Refreshing' : ''}
          </p>
          <p className="mt-2 text-xs font-medium text-gray-500">
            Showing {rangeLabel(datePreset).toLowerCase()}: {formatDateTime(range.createdFrom)} to {formatDateTime(range.createdTo)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/delivery-follow-ups"
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Delivery follow-ups
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Report range</h3>
            <p className="text-sm text-gray-500">Use the same range for summary metrics and failed-delivery drilldowns.</p>
          </div>
          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-1">
            {datePresets.map((preset) => {
              const isActive = datePreset === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => choosePreset(preset.value)}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title={preset.detail}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <PerformanceMetric
          title="Active couriers"
          value={activeCouriers}
          detail="Can receive work"
          icon={<Truck size={18} />}
          tone="blue"
        />
        <PerformanceMetric
          title="Assignment attempts"
          value={assignmentAttempts}
          detail={rangeLabel(datePreset)}
          icon={<RotateCcw size={18} />}
          tone="amber"
        />
        <PerformanceMetric
          title="Delivered"
          value={deliveredOrders}
          detail="Successful outcomes"
          icon={<CheckCircle2 size={18} />}
          tone="green"
        />
        <PerformanceMetric
          title="Failed deliveries"
          value={failedOrders}
          detail="Available for recovery review"
          icon={<XCircle size={18} />}
          tone={failedOrders > 0 ? 'red' : 'green'}
        />
        <PerformanceMetric
          title="Success rate"
          value={`${overallSuccessRate}%`}
          detail={`${failedOrders} failed deliveries`}
          icon={<BarChart3 size={18} />}
          tone={overallSuccessRate >= 80 || completedOrders === 0 ? 'green' : 'red'}
        />
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h3 className="font-semibold text-gray-900">Courier comparison</h3>
          <p className="mt-1 text-sm text-gray-500">
            Sorted by completed delivery outcomes, then delivery success rate.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <th className="p-4 font-medium">Courier</th>
                <th className="p-4 font-medium">Workload</th>
                <th className="p-4 font-medium">Delivery result</th>
                <th className="p-4 font-medium">Success rate</th>
                <th className="p-4 font-medium">Recovery review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rankedMetrics.map((metric) => {
                const selected = selectedCourierId === metric.courierId;
                const completed = completedOrdersFor(metric);
                const successPercent = successPercentFor(metric);

                return (
                  <tr key={metric.courierId} className={`${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-100 text-sm font-semibold text-gray-700">
                          {initials(metric.courierName)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{metric.courierName}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {metric.active ? 'Active - can receive assignments' : 'Inactive - no new assignments'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="grid grid-cols-2 gap-2">
                        <MiniStat label="Assigned" value={metric.assignedOrdersCount} />
                        <MiniStat label="Picked up" value={metric.pickedUpOrdersCount} />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <OutcomePill tone="green" label="Delivered" value={metric.deliveredOrdersCount} />
                        <OutcomePill tone={metric.failedOrdersCount > 0 ? 'red' : 'gray'} label="Failed" value={metric.failedOrdersCount} />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {completed} completed delivery outcome{completed === 1 ? '' : 's'}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-32 rounded-full bg-gray-100">
                          <div
                            className={`h-2 rounded-full ${successBarClass(metric)}`}
                            style={{ width: `${completed > 0 ? successPercent : 0}%` }}
                          />
                        </div>
                        <span className="font-semibold text-gray-900">{completed > 0 ? `${successPercent}%` : '-'}</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">{successRateLabel(metric)}</p>
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => openFailures(metric)}
                        disabled={metric.failedOrdersCount === 0}
                        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                          metric.failedOrdersCount > 0
                            ? selected
                              ? 'border-blue-300 bg-blue-600 text-white hover:bg-blue-700'
                              : 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
                            : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                        }`}
                      >
                        <AlertTriangle size={16} />
                        {metric.failedOrdersCount > 0 ? 'Review failures' : 'No failures'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && rankedMetrics.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No courier metrics are available for this period.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <span className="inline-flex items-center gap-2">
                      <BarChart3 size={16} />
                      Loading courier metrics...
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedMetric && (
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-red-700" />
                <h3 className="font-semibold text-gray-900">Failed deliveries for review</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {selectedMetric.courierName} - {rangeLabel(datePreset)} - {failuresPage?.totalElements ?? selectedMetric.failedOrdersCount} record{(failuresPage?.totalElements ?? selectedMetric.failedOrdersCount) === 1 ? '' : 's'}
                {fetchingFailures && !loadingFailures ? ' - Refreshing' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCourierId(null)}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close review
            </button>
          </div>

          {failuresError && (
            <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {getErrorMessage(failuresError)}
            </div>
          )}

          {loadingFailures && (
            <p className="px-5 py-6 text-sm text-gray-500">Loading failed delivery records...</p>
          )}

          {!loadingFailures && !failuresError && (failuresPage?.content ?? []).length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-500">
              No failed delivery records for this courier and period.
            </div>
          )}

          {!loadingFailures && !failuresError && (failuresPage?.content ?? []).length > 0 && (
            <div className="divide-y divide-gray-100">
              {(failuresPage?.content ?? []).map((item) => (
                <FailureRecord key={item.failure.failureId} item={item} />
              ))}
            </div>
          )}

          <div className="border-t border-gray-100 px-5 py-4">
            <PaginationControls
              page={failurePage}
              totalPages={failureTotalPages}
              canGoBack={canPageFailuresBack}
              canGoForward={canPageFailuresForward}
              onPrevious={() => setFailurePage((currentPage) => Math.max(0, currentPage - 1))}
              onNext={() => setFailurePage((currentPage) => currentPage + 1)}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function FailureRecord({ item }: { item: DeliveryFailureDrilldownItem }) {
  const { failure, order } = item;
  return (
    <article className="grid gap-4 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
            {formatFailureReason(failure.reason)}
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            Failed {formatDateTime(failure.createdAt)}
          </span>
        </div>
        <h4 className="mt-3 font-semibold text-gray-900">
          {order ? `${order.customerFirstName} ${order.customerLastName}`.trim() : `Order ${shortOrderId(failure.orderId)}`}
        </h4>
        <Link
          to={`/app/orders/${failure.orderId}`}
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
        >
          Order {shortOrderId(failure.orderId)}
          <ArrowRight size={14} />
        </Link>
        {order && (
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <MiniDetail label="Customer phone" value={order.customerPhone} />
            <MiniDetail label="Order value" value={formatMoney(order.amount)} />
            <MiniDetail label="Order status" value={formatOrderStatus(order.status)} />
          </div>
        )}
        {failure.note && (
          <div className="mt-3 rounded-md bg-gray-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase text-gray-500">Courier note</p>
            <p className="mt-1 text-sm text-gray-700">{failure.note}</p>
          </div>
        )}
      </div>
      <Link
        to={`/app/orders/${failure.orderId}`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
      >
        Open order
        <ArrowRight size={16} />
      </Link>
    </article>
  );
}

function rangeForPreset(preset: DatePreset) {
  const now = new Date();
  const from = new Date(now);

  if (preset === 'TODAY') {
    from.setHours(0, 0, 0, 0);
  } else if (preset === 'LAST_7_DAYS') {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }

  return {
    createdFrom: from.toISOString(),
    createdTo: now.toISOString(),
  };
}

function rangeLabel(preset: DatePreset) {
  if (preset === 'TODAY') {
    return 'Today';
  }
  if (preset === 'LAST_7_DAYS') {
    return 'Last 7 days';
  }
  return 'Last 30 days';
}

function completedOrdersFor(metric: CourierPerformanceMetric) {
  return metric.deliveredOrdersCount + metric.failedOrdersCount;
}

function successPercentFor(metric: CourierPerformanceMetric) {
  const clampedRate = Math.max(0, Math.min(1, metric.deliverySuccessRate));
  return Math.round(clampedRate * 100);
}

function successRateLabel(metric: CourierPerformanceMetric) {
  const completed = completedOrdersFor(metric);
  if (completed === 0) {
    return 'No completed outcomes';
  }
  if (metric.failedOrdersCount === 0) {
    return 'No failed deliveries';
  }
  return `${metric.failedOrdersCount} failed deliver${metric.failedOrdersCount === 1 ? 'y' : 'ies'}`;
}

function successBarClass(metric: CourierPerformanceMetric) {
  if (completedOrdersFor(metric) === 0) {
    return 'bg-gray-300';
  }
  return successPercentFor(metric) >= 80 ? 'bg-emerald-600' : 'bg-amber-500';
}

function formatFailureReason(reason: string) {
  return titleize(reason);
}

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    CREATED: 'New order',
    CONFIRMATION_REQUESTED: 'Needs confirmation',
    CONFIRMED: 'Confirmed',
    REJECTED: 'Rejected',
    ASSIGNED_TO_COURIER: 'Assigned to courier',
    PICKED_UP: 'With courier',
    DELIVERED: 'Delivered',
    FAILED: 'Delivery failed',
  };
  return labels[status] ?? titleize(status);
}

function titleize(value: string) {
  const normalized = value.replace(/_/g, ' ').toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'MAD',
  }).format(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortOrderId(orderId: string) {
  return orderId.length > 8 ? `${orderId.slice(0, 8)}...` : orderId;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'C';
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function MiniDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 font-medium text-gray-900">{value}</p>
    </div>
  );
}

function OutcomePill({
  tone,
  label,
  value,
}: {
  tone: 'green' | 'red' | 'gray';
  label: string;
  value: number;
}) {
  const tones = {
    green: 'bg-green-50 text-green-800 ring-green-200',
    red: 'bg-red-50 text-red-800 ring-red-200',
    gray: 'bg-gray-50 text-gray-700 ring-gray-200',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {label}: {value}
    </span>
  );
}

function PaginationControls({
  page,
  totalPages,
  canGoBack,
  canGoForward,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  canGoBack: boolean;
  canGoForward: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-gray-500">Page {totalPages === 0 ? 0 : page + 1} of {totalPages}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canGoBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          aria-label="Previous page"
          title="Previous page"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoForward}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          aria-label="Next page"
          title="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function PerformanceMetric({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: number | string;
  detail: string;
  icon: ReactNode;
  tone: 'blue' | 'amber' | 'green' | 'red';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-md border p-2 ${tones[tone]}`}>{icon}</div>
      </div>
      <p className="mt-2 text-sm text-gray-600">{detail}</p>
    </div>
  );
}
