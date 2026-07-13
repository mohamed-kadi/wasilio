import { useState, type ReactNode } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  SlidersHorizontal,
} from 'lucide-react';
import {
  fetchDeliveryFollowUpTasks,
  getErrorMessage,
  resolveDeliveryFollowUp,
} from '../api/client';
import type {
  DeliveryFollowUpDueFilter,
  DeliveryFollowUpOrderSummary,
  DeliveryFollowUpTask,
  DeliveryFollowUpTasksPageResponse,
} from '../api/client';

const pageSize = 10;
const dueFilterOptions: Array<{
  value: DeliveryFollowUpDueFilter;
  label: string;
  detail: string;
}> = [
  { value: 'ALL', label: 'All open', detail: 'Every follow-up still waiting for action' },
  { value: 'DUE_NOW', label: 'Due now', detail: 'Call or message now' },
  { value: 'SCHEDULED', label: 'Scheduled later', detail: 'Planned customer contact' },
  { value: 'NO_DUE_DATE', label: 'Needs priority', detail: 'No callback time selected' },
];

export default function DeliveryFollowUps() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [dueFilter, setDueFilter] = useState<DeliveryFollowUpDueFilter>('ALL');
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const queueQueryKey = ['delivery-follow-ups', { page, size: pageSize, status: 'OPEN', dueFilter }] as const;

  const {
    data: followUpsPage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queueQueryKey,
    queryFn: () => fetchDeliveryFollowUpTasks({ page, size: pageSize, status: 'OPEN', dueFilter }),
  });

  const summaryQueries = useQueries({
    queries: dueFilterOptions.map((option) => ({
      queryKey: ['delivery-follow-ups-summary', { page: 0, size: 1, status: 'OPEN', dueFilter: option.value }],
      queryFn: () => fetchDeliveryFollowUpTasks({
        page: 0,
        size: 1,
        status: 'OPEN',
        dueFilter: option.value,
      }),
    })),
  });

  const summaryCounts = new Map<DeliveryFollowUpDueFilter, number>(
    dueFilterOptions.map((option, index) => [
      option.value,
      summaryQueries[index]?.data?.totalElements ?? 0,
    ]),
  );
  const summaryLoading = summaryQueries.some((query) => query.isLoading);
  const queueItems = followUpsPage?.content ?? [];
  const totalPages = followUpsPage?.totalPages ?? 0;
  const totalElements = followUpsPage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const activeFilterLabel = dueFilterOptions.find((option) => option.value === dueFilter)?.label ?? 'All open';

  const resolveMutation = useMutation({
    mutationFn: ({ task }: { task: DeliveryFollowUpTask }) => resolveDeliveryFollowUp(task.orderId, task.taskId, {
      note: resolutionNotes[task.taskId]?.trim() || undefined,
    }),
    onSuccess: (resolvedTask) => {
      setResolutionNotes((currentNotes) => {
        const nextNotes = { ...currentNotes };
        delete nextNotes[resolvedTask.taskId];
        return nextNotes;
      });
      queryClient.setQueryData<DeliveryFollowUpTasksPageResponse | undefined>(
        queueQueryKey,
        (currentPage) => removeResolvedTask(currentPage, resolvedTask.taskId),
      );
      queryClient.setQueryData<DeliveryFollowUpTask[] | undefined>(
        ['delivery-follow-ups', resolvedTask.orderId],
        (currentTasks) => currentTasks?.map((task) => (
          task.taskId === resolvedTask.taskId ? resolvedTask : task
        )) ?? [resolvedTask],
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['delivery-follow-ups'] }),
        queryClient.invalidateQueries({ queryKey: ['delivery-follow-ups-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['order-timeline', resolvedTask.orderId] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-summary'] }),
      ]);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Delivery follow-ups</h2>
          <p className="mt-1 text-sm text-gray-500">
            Customer recovery work after failed delivery attempts
            {isFetching && !isLoading ? ' - Refreshing' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/orders"
            state={{ statuses: ['FAILED'], recoveryFocus: true }}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Review failed orders
          </Link>
          <Link
            to="/app/couriers/performance"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Performance
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-blue-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase">Operations stage</p>
            <h3 className="mt-2 text-xl font-bold text-gray-900">Recovery follow-ups</h3>
            <p className="mt-2 max-w-2xl text-sm">
              Resolve customer calls, refund checks, and replacement follow-ups before reviewing courier performance.
            </p>
          </div>
          <div className="rounded-md bg-white/80 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Next stage</p>
            <p className="mt-1 font-semibold text-gray-900">Performance review</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <WorkloadMetric
          title="Open follow-ups"
          value={summaryLoading ? '...' : String(summaryCounts.get('ALL') ?? 0)}
          detail="Waiting for a team action"
          icon={<MessageSquare size={20} />}
          tone="blue"
        />
        <WorkloadMetric
          title="Due now"
          value={summaryQueries[1]?.isLoading ? '...' : String(summaryCounts.get('DUE_NOW') ?? 0)}
          detail="Call or message now"
          icon={<Clock size={20} />}
          tone="red"
        />
        <WorkloadMetric
          title="Scheduled later"
          value={summaryQueries[2]?.isLoading ? '...' : String(summaryCounts.get('SCHEDULED') ?? 0)}
          detail="Planned customer contact"
          icon={<CalendarClock size={20} />}
          tone="amber"
        />
        <WorkloadMetric
          title="Needs priority"
          value={summaryQueries[3]?.isLoading ? '...' : String(summaryCounts.get('NO_DUE_DATE') ?? 0)}
          detail="No callback time selected"
          icon={<CheckCircle2 size={20} />}
          tone="gray"
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Follow-up view</h3>
            <p className="text-sm text-gray-500">
              Showing {totalElements} {activeFilterLabel.toLowerCase()} item{totalElements === 1 ? '' : 's'}.
            </p>
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

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-green-50 px-3 py-1 font-medium text-green-800 ring-1 ring-green-200">
            Status: Open follow-ups
          </span>
          <span className="rounded-full bg-gray-50 px-3 py-1 font-medium text-gray-700 ring-1 ring-gray-200">
            Due view: {activeFilterLabel}
          </span>
        </div>

        {advancedFiltersOpen && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Due date filter</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {dueFilterOptions.map((option, index) => {
                const isActive = dueFilter === option.value;
                const count = summaryQueries[index]?.isLoading ? '...' : summaryCounts.get(option.value) ?? 0;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setDueFilter(option.value);
                      setPage(0);
                    }}
                    className={`rounded-md border px-3 py-2 text-left text-sm ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="block font-semibold">{option.label} ({count})</span>
                    <span className="block text-xs text-gray-500">{option.detail}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Resolved follow-ups leave this queue automatically.
            </p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="font-semibold text-gray-900">Recovery follow-up queue</h3>
            <p className="text-sm text-gray-500">
              Mark a follow-up done only after the customer, refund, or replacement action is complete.
            </p>
          </div>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onPrevious={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
            onNext={() => setPage((currentPage) => currentPage + 1)}
          />
        </div>

        {isLoading && <p className="px-5 py-6 text-sm text-gray-500">Loading delivery follow-ups...</p>}

        {!isLoading && queueItems.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="font-medium text-gray-900">No {activeFilterLabel.toLowerCase()} delivery follow-ups</p>
            <p className="mt-1 text-sm text-gray-500">
              Use another filter or review failed orders that still need a recovery decision.
            </p>
          </div>
        )}

        {!isLoading && queueItems.length > 0 && (
          <div className="divide-y divide-gray-100">
            {queueItems.map((item) => {
              const { task, order } = item;
              const dueBadge = getDueBadge(task.dueAt);
              const statusBadge = getFollowUpStatusBadge(task.status);
              const isResolving = resolveMutation.isPending && resolveMutation.variables?.task.taskId === task.taskId;

              return (
                <article key={task.taskId} className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${dueBadge.className}`}>
                        {dueBadge.label}
                      </span>
                      {order?.failureReason && (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
                          {formatFailureReason(order.failureReason)}
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <h4 className="text-base font-semibold text-gray-900">
                        {order ? customerName(order) : 'Order unavailable'}
                      </h4>
                      <Link
                        to={`/app/orders/${task.orderId}`}
                        className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
                      >
                        Order {shortOrderId(task.orderId)}
                        <ArrowRight size={14} />
                      </Link>
                    </div>

                    {order ? (
                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                        <DetailBlock label="Customer phone" value={order.customerPhone} />
                        <DetailBlock label="Order value" value={formatMoney(order.amount)} />
                        <DetailBlock label="Order status" value={formatOrderStatus(order.status)} />
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-gray-500">
                        The follow-up is still open, but the order summary was not returned with this page.
                      </p>
                    )}

                    <div className="mt-4 rounded-md bg-gray-50 px-3 py-3">
                      <p className="text-xs font-semibold uppercase text-gray-500">Follow-up note</p>
                      <p className="mt-1 text-sm text-gray-700">{task.note || 'No follow-up note recorded.'}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>Owner: {task.assignedTo || 'Unassigned'}</span>
                      <span>Created: {formatDate(task.createdAt)}</span>
                      <span>Due: {formatDate(task.dueAt)}</span>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4">
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900">Close the follow-up</h5>
                      <p className="mt-1 text-xs text-gray-500">
                        Add an optional note for the customer contact or refund action.
                      </p>
                    </div>
                    <label htmlFor={`resolution-${task.taskId}`} className="sr-only">
                      Resolution note for order {shortOrderId(task.orderId)}
                    </label>
                    <textarea
                      id={`resolution-${task.taskId}`}
                      value={resolutionNotes[task.taskId] ?? ''}
                      onChange={(event) => setResolutionNotes((currentNotes) => ({
                        ...currentNotes,
                        [task.taskId]: event.target.value,
                      }))}
                      rows={3}
                      maxLength={1000}
                      placeholder="Optional note, e.g. customer reached or refund sent"
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => resolveMutation.mutate({ task })}
                        disabled={isResolving}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isResolving ? 'Saving...' : 'Mark follow-up done'}
                      </button>
                      <Link
                        to={`/app/orders/${task.orderId}`}
                        className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Open order
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="border-t border-gray-100 px-5 py-4">
          <PaginationControls
            page={page}
            totalPages={totalPages}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onPrevious={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
            onNext={() => setPage((currentPage) => currentPage + 1)}
          />
        </div>
      </section>
    </div>
  );
}

function removeResolvedTask(
  currentPage: DeliveryFollowUpTasksPageResponse | undefined,
  taskId: string,
) {
  if (!currentPage || !currentPage.content.some((item) => item.task.taskId === taskId)) {
    return currentPage;
  }
  const totalElements = Math.max(0, currentPage.totalElements - 1);
  return {
    ...currentPage,
    content: currentPage.content.filter((item) => item.task.taskId !== taskId),
    totalElements,
    totalPages: currentPage.size > 0 ? Math.ceil(totalElements / currentPage.size) : currentPage.totalPages,
  };
}

function WorkloadMetric({
  title,
  value,
  detail,
  icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
  tone: 'blue' | 'amber' | 'red' | 'gray';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    gray: 'border-gray-200 bg-white text-gray-600',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-md border p-2 ${tones[tone]}`}>{icon}</div>
      </div>
      <p className="mt-2 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 font-medium text-gray-900">{value}</p>
    </div>
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

function getFollowUpStatusBadge(status: DeliveryFollowUpTask['status']) {
  if (status === 'RESOLVED') {
    return {
      label: 'Done',
      className: 'bg-gray-100 text-gray-700',
    };
  }
  return {
    label: 'Open',
    className: 'bg-green-100 text-green-800',
  };
}

function getDueBadge(value?: string) {
  if (!value) {
    return {
      label: 'Needs priority',
      className: 'bg-gray-100 text-gray-700',
    };
  }
  const dueAt = new Date(value);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  if (dueAt.getTime() < Date.now()) {
    return {
      label: 'Overdue',
      className: 'bg-red-100 text-red-800',
    };
  }
  if (dueAt.getTime() <= todayEnd.getTime()) {
    return {
      label: 'Due today',
      className: 'bg-amber-100 text-amber-800',
    };
  }
  return {
    label: `Due ${dueAt.toLocaleDateString()}`,
    className: 'bg-blue-100 text-blue-800',
  };
}

function customerName(order: DeliveryFollowUpOrderSummary) {
  return `${order.customerFirstName} ${order.customerLastName}`.trim() || 'Unknown customer';
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

function formatFailureReason(reason: string) {
  return titleize(reason);
}

function titleize(value: string) {
  const normalized = value.replace(/_/g, ' ').toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : 'No due date';
}

function shortOrderId(orderId: string) {
  return orderId.length > 8 ? `${orderId.slice(0, 8)}...` : orderId;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  }).format(value);
}
