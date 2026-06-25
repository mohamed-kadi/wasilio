import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, MessageSquare } from 'lucide-react';
import {
  fetchDeliveryFollowUpTasks,
  getErrorMessage,
  resolveDeliveryFollowUp,
} from '../api/client';
import type {
  DeliveryFollowUpOrderSummary,
  DeliveryFollowUpTask,
  DeliveryFollowUpTasksPageResponse,
} from '../api/client';

const pageSize = 10;

export default function DeliveryFollowUps() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const queueQueryKey = ['delivery-follow-ups', { page, size: pageSize, status: 'OPEN' }] as const;

  const {
    data: followUpsPage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: queueQueryKey,
    queryFn: () => fetchDeliveryFollowUpTasks({ page, size: pageSize, status: 'OPEN' }),
  });

  const queueItems = followUpsPage?.content ?? [];
  const tasks = queueItems.map((item) => item.task);
  const totalElements = followUpsPage?.totalElements ?? 0;
  const totalPages = followUpsPage?.totalPages ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const dueNowCount = tasks.filter((task) => isDueNow(task.dueAt)).length;
  const noDueDateCount = tasks.filter((task) => !task.dueAt).length;

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
          <h2 className="text-2xl font-bold text-gray-900">Customer follow-ups</h2>
          <p className="mt-1 text-sm text-gray-500">
            Open failed-delivery tasks sorted by due date
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
            to="/app"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Dashboard
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <QueueMetric
          title="Open follow-ups"
          value={isLoading ? '...' : String(totalElements)}
          detail="Unresolved customer recovery tasks"
          icon={<MessageSquare size={20} />}
        />
        <QueueMetric
          title="Due now"
          value={isLoading ? '...' : String(dueNowCount)}
          detail="Overdue or due today on this page"
          icon={<Clock size={20} />}
        />
        <QueueMetric
          title="No due date"
          value={isLoading ? '...' : String(noDueDateCount)}
          detail="Needs manual priority review"
          icon={<CheckCircle2 size={20} />}
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="font-semibold text-gray-900">Open follow-up queue</h3>
            <p className="text-sm text-gray-500">Resolve tasks after refund, replacement, or customer contact is complete.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
              disabled={!canGoBack}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((currentPage) => currentPage + 1)}
              disabled={!canGoForward}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        {isLoading && <p className="px-5 py-6 text-sm text-gray-500">Loading customer follow-ups...</p>}

        {!isLoading && tasks.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="font-medium text-gray-900">No open customer follow-ups</p>
            <p className="mt-1 text-sm text-gray-500">Failed delivery tasks that need customer contact will appear here.</p>
          </div>
        )}

        {!isLoading && tasks.length > 0 && (
          <div className="divide-y divide-gray-100">
            {queueItems.map((item) => {
              const { task, order } = item;
              const dueBadge = getDueBadge(task.dueAt);
              const isResolving = resolveMutation.isPending && resolveMutation.variables?.task.taskId === task.taskId;

              return (
                <article key={task.taskId} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${dueBadge.className}`}>
                        {dueBadge.label}
                      </span>
                      <span className="text-xs font-medium uppercase text-gray-500">Assigned to {task.assignedTo}</span>
                    </div>

                    <div className="mt-3">
                      <h4 className="text-base font-semibold text-gray-900">
                        {order ? customerName(order) : 'Order unavailable'}
                      </h4>
                      {order ? (
                        <p className="mt-1 text-sm text-gray-600">
                          {order.customerPhone} · {formatMoney(order.amount)} · {order.status.replace(/_/g, ' ')}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-gray-500">
                          Order {task.orderId.slice(0, 8)}
                        </p>
                      )}
                    </div>

                    <p className="mt-3 text-sm text-gray-700">{task.note || 'No follow-up note recorded.'}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      Created {formatDate(task.createdAt)} · Due {formatDate(task.dueAt)}
                    </p>
                  </div>

                  <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                    <label htmlFor={`resolution-${task.taskId}`} className="text-sm font-semibold text-gray-900">
                      Resolution note
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
                      placeholder="Optional note, e.g. refund sent or customer reached"
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => resolveMutation.mutate({ task })}
                        disabled={isResolving}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isResolving ? 'Resolving...' : 'Resolve follow-up'}
                      </button>
                      <Link
                        to={`/app/orders/${task.orderId}`}
                        className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                      >
                        Open recovery
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
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

function QueueMetric({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-2 text-blue-700">{icon}</div>
      </div>
      <p className="mt-2 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

function getDueBadge(value?: string) {
  if (!value) {
    return {
      label: 'No due date',
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

function isDueNow(value?: string) {
  if (!value) {
    return false;
  }
  const dueAt = new Date(value);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return dueAt.getTime() <= todayEnd.getTime();
}

function customerName(order: DeliveryFollowUpOrderSummary) {
  return `${order.customerFirstName} ${order.customerLastName}`;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : 'No due date';
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 2,
  }).format(value);
}
