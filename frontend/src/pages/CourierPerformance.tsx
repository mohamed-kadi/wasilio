import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BarChart3 } from 'lucide-react';
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
            Assignment attempts, delivery outcomes, and failed-delivery drilldowns
            {isFetching && !isLoading ? ' - Refreshing' : ''}
          </p>
          <p className="mt-2 text-xs font-medium text-gray-500">
            Showing {rangeLabel(datePreset).toLowerCase()}: {formatDateTime(range.createdFrom)} to {formatDateTime(range.createdTo)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {datePresets.map((preset) => {
            const isActive = datePreset === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => choosePreset(preset.value)}
                className={`rounded-md border px-3 py-2 text-left text-sm ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="block font-semibold">{preset.label}</span>
                <span className="block text-xs text-gray-500">{preset.detail}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <PerformanceMetric title="Active couriers" value={activeCouriers} detail="Can receive work" tone="blue" />
        <PerformanceMetric title="Assignment attempts" value={assignmentAttempts} detail={rangeLabel(datePreset)} tone="amber" />
        <PerformanceMetric title="Delivered" value={deliveredOrders} detail="Successful outcomes" tone="green" />
        <PerformanceMetric title="Failed deliveries" value={failedOrders} detail="Click a courier failed count to inspect" tone={failedOrders > 0 ? 'red' : 'green'} />
        <PerformanceMetric title="Success rate" value={`${overallSuccessRate}%`} detail={`${failedOrders} failed deliveries`} tone={overallSuccessRate >= 80 ? 'green' : 'red'} />
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <th className="p-4 font-medium">Courier</th>
              <th className="p-4 font-medium">Assignments</th>
              <th className="p-4 font-medium">Pickups</th>
              <th className="p-4 font-medium">Delivered</th>
              <th className="p-4 font-medium">Failed</th>
              <th className="p-4 font-medium">Success rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metrics.map((metric) => (
              <tr key={metric.courierId} className="hover:bg-gray-50">
                <td className="p-4">
                  <p className="font-medium text-gray-900">{metric.courierName}</p>
                  <p className="text-xs text-gray-500">{metric.active ? 'Active - can receive assignments' : 'Inactive - no new assignments'}</p>
                </td>
                <td className="p-4 font-medium">{metric.assignedOrdersCount}</td>
                <td className="p-4 font-medium">{metric.pickedUpOrdersCount}</td>
                <td className="p-4 font-medium text-green-700">{metric.deliveredOrdersCount}</td>
                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => openFailures(metric)}
                    disabled={metric.failedOrdersCount === 0}
                    className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {metric.failedOrdersCount}
                    <span className="text-xs font-medium">View failures</span>
                  </button>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-28 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-green-600"
                        style={{ width: `${Math.round(metric.deliverySuccessRate * 100)}%` }}
                      />
                    </div>
                    <span className="font-medium">{Math.round(metric.deliverySuccessRate * 100)}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && metrics.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No courier metrics are available for this period.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
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

      {selectedMetric && (
        <section className="rounded-lg border border-red-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-red-100 px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle size={18} />
                <h3 className="font-semibold text-gray-900">Failed delivery records</h3>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {selectedMetric.courierName} - {rangeLabel(datePreset)} - {failuresPage?.totalElements ?? selectedMetric.failedOrdersCount} records
                {fetchingFailures && !loadingFailures ? ' - Refreshing' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCourierId(null)}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close drilldown
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

          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4">
            <p className="text-sm text-gray-500">
              Page {failureTotalPages === 0 ? 0 : failurePage + 1} of {failureTotalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFailurePage((currentPage) => Math.max(0, currentPage - 1))}
                disabled={!canPageFailuresBack}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setFailurePage((currentPage) => currentPage + 1)}
                disabled={!canPageFailuresForward}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
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
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
            {formatFailureReason(failure.reason)}
          </span>
          <span className="text-xs font-medium uppercase text-gray-500">{new Date(failure.createdAt).toLocaleString()}</span>
        </div>
        <h4 className="mt-3 font-semibold text-gray-900">
          {order ? `${order.customerFirstName} ${order.customerLastName}` : `Order ${failure.orderId.slice(0, 8)}`}
        </h4>
        {order && (
          <p className="mt-1 text-sm text-gray-600">
            {order.customerPhone} - {formatMoney(order.amount)} - Current status: {order.status.replace(/_/g, ' ')}
          </p>
        )}
        {failure.note && <p className="mt-2 text-sm text-gray-700">{failure.note}</p>}
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

function formatFailureReason(reason: string) {
  return reason.replace(/_/g, ' ').toLowerCase();
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

function PerformanceMetric({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: number | string;
  detail: string;
  tone: 'blue' | 'amber' | 'green' | 'red';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
