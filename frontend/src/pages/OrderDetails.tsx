import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, MessageSquare, Package, PhoneCall, Truck, XCircle } from 'lucide-react';
import {
  assignCourier,
  confirmOrder,
  type DeliveryFailureRecoveryDecision,
  type DeliveryFailureReason,
  type DeliveryFollowUpTask,
  fetchDeliveryFailureRecoveries,
  fetchDeliveryFollowUps,
  fetchCouriers,
  fetchOrder,
  fetchOrderTimeline,
  getErrorMessage,
  markDelivered,
  markFailed,
  markPickedUp,
  recordDeliveryFailureRecovery,
  rejectOrder,
  requestConfirmation,
  resolveDeliveryFollowUp,
  retryFailedDelivery,
} from '../api/client';
import type { Order, OrderStatus } from '../api/client';

type LifecycleCommand =
  | { action: 'request-confirmation' }
  | { action: 'confirm' }
  | { action: 'reject'; reason: string }
  | { action: 'assign-courier'; courierId: string }
  | { action: 'pick-up'; courierId: string }
  | { action: 'deliver' }
  | { action: 'fail'; reason: DeliveryFailureReason };

const statusLabels: Record<OrderStatus, string> = {
  CREATED: 'New order',
  CONFIRMATION_REQUESTED: 'Needs confirmation',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  ASSIGNED_TO_COURIER: 'Assigned',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  FAILED: 'Failed delivery',
};

const statusDescriptions: Record<OrderStatus, string> = {
  CREATED: 'The order exists, but customer confirmation has not started.',
  CONFIRMATION_REQUESTED: 'The customer must be called before this order goes to courier operations.',
  CONFIRMED: 'The customer accepted the order. Assign a courier when ready.',
  REJECTED: 'The customer refused or cancelled. This order is closed.',
  ASSIGNED_TO_COURIER: 'A courier has been assigned and pickup is pending.',
  PICKED_UP: 'The package is with the courier. Record delivered or failed after the attempt.',
  DELIVERED: 'The order was delivered successfully.',
  FAILED: 'Delivery failed. Review the failure reason before any follow-up.',
};

const nextActions: Record<OrderStatus, string> = {
  CREATED: 'Request confirmation',
  CONFIRMATION_REQUESTED: 'Confirm or reject after customer contact',
  CONFIRMED: 'Assign courier',
  REJECTED: 'No action needed',
  ASSIGNED_TO_COURIER: 'Mark picked up when courier collects it',
  PICKED_UP: 'Record delivery result',
  DELIVERED: 'No action needed',
  FAILED: 'Review failure',
};

const statusTones: Record<OrderStatus, string> = {
  CREATED: 'border-gray-200 bg-gray-50 text-gray-700',
  CONFIRMATION_REQUESTED: 'border-blue-200 bg-blue-50 text-blue-700',
  CONFIRMED: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-700',
  ASSIGNED_TO_COURIER: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  PICKED_UP: 'border-orange-200 bg-orange-50 text-orange-800',
  DELIVERED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  FAILED: 'border-red-200 bg-red-50 text-red-700',
};

const failureReasonLabels: Record<string, string> = {
  CUSTOMER_UNREACHABLE: 'Customer unreachable',
  CUSTOMER_REFUSED: 'Customer refused',
  INVALID_ADDRESS: 'Invalid address',
  CUSTOMER_RESCHEDULED: 'Customer rescheduled',
  LOST_PACKAGE: 'Lost package',
  OTHER: 'Other',
};

const recoveryDecisionLabels: Record<DeliveryFailureRecoveryDecision, string> = {
  RETRY_DELIVERY: 'Retry delivery',
  REFUND_OR_CUSTOMER_FOLLOW_UP: 'Refund / customer follow-up',
  CLOSE_UNRECOVERABLE: 'Close as unrecoverable',
};

const recoveryDecisionDescriptions: Record<DeliveryFailureRecoveryDecision, string> = {
  RETRY_DELIVERY: 'Use when the customer still wants the order and operations should prepare a new delivery attempt.',
  REFUND_OR_CUSTOMER_FOLLOW_UP: 'Use when the merchant must refund, replace, or contact the customer before any next action.',
  CLOSE_UNRECOVERABLE: 'Use when the order should stay closed and no further delivery action is expected.',
};

function formatFailureReason(reason?: string) {
  if (!reason) {
    return undefined;
  }
  return failureReasonLabels[reason] ?? reason.replace(/_/g, ' ').toLowerCase();
}

function formatRecoveryDecision(decision: DeliveryFailureRecoveryDecision | string) {
  return recoveryDecisionLabels[decision as DeliveryFailureRecoveryDecision] ?? decision.replace(/_/g, ' ').toLowerCase();
}

function toInstantFromDate(date: string, endOfDay = false) {
  if (!date) return undefined;
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`;
}

function formatFollowUpDate(value?: string) {
  return value ? new Date(value).toLocaleString() : 'No due date';
}

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [courierId, setCourierId] = useState('');
  const [rejectReason, setRejectReason] = useState('Customer unreachable');
  const [failureReason, setFailureReason] = useState<DeliveryFailureReason>('CUSTOMER_REFUSED');
  const [confirmDeliverOpen, setConfirmDeliverOpen] = useState(false);
  const [recoveryDecision, setRecoveryDecision] = useState<DeliveryFailureRecoveryDecision>('RETRY_DELIVERY');
  const [recoveryNote, setRecoveryNote] = useState('');
  const [followUpDueDate, setFollowUpDueDate] = useState('');
  const [followUpResolutionNotes, setFollowUpResolutionNotes] = useState<Record<string, string>>({});

  const {
    data: order,
    error: orderError,
    isLoading: loadingOrder,
  } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });

  const {
    data: timeline = [],
    error: timelineError,
    isLoading: loadingTimeline,
  } = useQuery({
    queryKey: ['order-timeline', id],
    queryFn: () => fetchOrderTimeline(id!),
    enabled: !!id,
  });

  const { data: couriersPage } = useQuery({
    queryKey: ['couriers', { page: 0, size: 100 }],
    queryFn: () => fetchCouriers({ page: 0, size: 100 }),
  });

  const {
    data: failureRecoveries = [],
    error: failureRecoveriesError,
    isLoading: loadingFailureRecoveries,
  } = useQuery({
    queryKey: ['delivery-failure-recoveries', id],
    queryFn: () => fetchDeliveryFailureRecoveries(id!),
    enabled: !!id && order?.status === 'FAILED',
  });

  const {
    data: followUpTasks = [],
    error: followUpTasksError,
    isLoading: loadingFollowUpTasks,
  } = useQuery({
    queryKey: ['delivery-follow-ups', id],
    queryFn: () => fetchDeliveryFollowUps(id!),
    enabled: !!id && order?.status === 'FAILED',
  });

  const mutation = useMutation({
    mutationFn: async (command: LifecycleCommand) => {
      if (!id) {
        throw new Error('Order ID is missing');
      }

      switch (command.action) {
        case 'request-confirmation':
          return requestConfirmation(id);
        case 'confirm':
          return confirmOrder(id);
        case 'reject':
          return rejectOrder(id, command.reason);
        case 'assign-courier':
          return assignCourier(id, command.courierId);
        case 'pick-up':
          return markPickedUp(id, command.courierId);
        case 'deliver':
          return markDelivered(id);
        case 'fail':
          return markFailed(id, command.reason);
      }
    },
    onSuccess: () => {
      setConfirmDeliverOpen(false);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['order-timeline', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
    },
  });

  const recoveryMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error('Order ID is missing');
      }
      return recordDeliveryFailureRecovery(id, {
        decision: recoveryDecision,
        note: recoveryNote.trim() || undefined,
        followUpDueAt: recoveryDecision === 'REFUND_OR_CUSTOMER_FOLLOW_UP'
          ? toInstantFromDate(followUpDueDate, true)
          : undefined,
      });
    },
    onSuccess: () => {
      setRecoveryNote('');
      setFollowUpDueDate('');
      queryClient.invalidateQueries({ queryKey: ['delivery-failure-recoveries', id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-follow-ups', id] });
      queryClient.invalidateQueries({ queryKey: ['order-timeline', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
    },
  });

  const resolveFollowUpMutation = useMutation({
    mutationFn: async ({ taskId, note }: { taskId: string; note: string }) => {
      if (!id) {
        throw new Error('Order ID is missing');
      }
      return resolveDeliveryFollowUp(id, taskId, {
        note: note.trim() || undefined,
      });
    },
    onSuccess: (_task, variables) => {
      setFollowUpResolutionNotes((currentNotes) => {
        const nextNotes = { ...currentNotes };
        delete nextNotes[variables.taskId];
        return nextNotes;
      });
      queryClient.invalidateQueries({ queryKey: ['delivery-follow-ups', id] });
      queryClient.invalidateQueries({ queryKey: ['order-timeline', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
    },
  });

  const retryDeliveryMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error('Order ID is missing');
      }
      return retryFailedDelivery(id);
    },
    onSuccess: () => {
      queryClient.setQueryData<Order | undefined>(['order', id], (currentOrder) => currentOrder
        ? {
            ...currentOrder,
            status: 'CONFIRMED',
            courierId: undefined,
            failureReason: undefined,
          }
        : currentOrder);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['order-timeline', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
      queryClient.invalidateQueries({ queryKey: ['courier-assignment-queue'] });
    },
  });

  if (loadingOrder || loadingTimeline) {
    return <div>Loading...</div>;
  }

  if (orderError) {
    return (
      <div className="space-y-4">
        <Link to="/app/orders" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Orders
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(orderError)}
        </div>
      </div>
    );
  }

  if (!order) {
    return <div>Order not found</div>;
  }

  const mutationDisabled = mutation.isPending;
  const activeCouriers = (couriersPage?.content ?? []).filter((courier) => courier.active);
  const selectedPickupCourierId = order.courierId ?? courierId;
  const selectedCourierName = activeCouriers.find((courier) => courier.courierId === order.courierId)?.name ?? order.courierId;
  const formattedFailureReason = formatFailureReason(order.failureReason);
  const latestFailureRecovery = failureRecoveries.length > 0
    ? failureRecoveries[failureRecoveries.length - 1]
    : undefined;
  const openFollowUpTasks = followUpTasks.filter((task) => task.status === 'OPEN');
  const canMoveBackToAssignment = latestFailureRecovery?.decision === 'RETRY_DELIVERY';

  const TimelineIcon = ({ type, category }: { type: string; category: string }) => {
    if (category === 'CALLBACK') return <PhoneCall className="w-5 h-5 text-purple-500" />;
    if (category === 'CONFIRMATION') return <MessageSquare className="w-5 h-5 text-indigo-500" />;
    if (type.includes('Created')) return <Package className="w-5 h-5 text-blue-500" />;
    if (type.includes('Confirmed')) return <CheckCircle2 className="w-5 h-5 text-indigo-500" />;
    if (type.includes('Assigned') || type.includes('PickedUp')) return <Truck className="w-5 h-5 text-yellow-500" />;
    if (type.includes('Delivered')) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (type.includes('FollowUp')) return <PhoneCall className="w-5 h-5 text-amber-500" />;
    if (type.includes('Failed') || type.includes('Rejected') || type.includes('Failure')) return <XCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  const detailValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value).toLocaleString();
    }
    return String(value);
  };

  const timelineDetails = (details: Record<string, unknown>) =>
    ['outcome', 'decision', 'status', 'note', 'callbackAt', 'dueAt', 'assignedTo', 'resolvedBy', 'resolvedAt', 'resolutionNote', 'courierId', 'reason', 'recoveryId', 'aggregateSequence']
      .map((key) => {
        const rawValue = details[key];
        const value = key === 'decision' && typeof rawValue === 'string'
          ? formatRecoveryDecision(rawValue)
          : detailValue(rawValue);
        return [key, value] as const;
      })
      .filter(([, value]) => value);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <Link to="/app/orders" className="text-sm text-blue-600 hover:underline mb-2 block">
            &larr; Back to Orders
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
          <p className="text-sm text-gray-500 font-mono mt-1">{order.id}</p>
        </div>
      </div>

      <section className={`rounded-lg border p-5 ${statusTones[order.status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase">Current COD stage</p>
            <h3 className="mt-2 text-2xl font-bold text-gray-900">{statusLabels[order.status]}</h3>
            <p className="mt-2 max-w-2xl text-sm">{statusDescriptions[order.status]}</p>
          </div>
          <div className="rounded-md bg-white/70 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Next action</p>
            <p className="mt-1 font-semibold text-gray-900">{nextActions[order.status]}</p>
          </div>
        </div>
      </section>

      {order.status === 'FAILED' && (
        <section className="space-y-5 rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertCircle size={18} />
                <p className="text-sm font-semibold">Failed delivery recovery</p>
              </div>
              <p className="mt-2 text-sm">
                Failure reason: <span className="font-semibold">{formattedFailureReason ?? 'Not recorded'}</span>
              </p>
              <p className="mt-1 max-w-3xl text-sm text-red-800">
                Contact the customer or courier, confirm what happened, then decide whether this needs retry,
                refund, or closure outside the active courier queue.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/app/orders"
                state={{ statuses: ['FAILED'], recoveryFocus: true }}
                className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100"
              >
                Back to failed deliveries
              </Link>
              <Link
                to="/app/couriers/performance"
                className="inline-flex items-center rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              >
                Review courier performance
              </Link>
            </div>
          </div>

          <div className="grid gap-4 border-t border-red-200 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                recoveryMutation.mutate();
              }}
            >
              <div>
                <label htmlFor="recovery-decision" className="text-sm font-semibold">
                  Recovery decision
                </label>
                <select
                  id="recovery-decision"
                  value={recoveryDecision}
                  onChange={(event) => setRecoveryDecision(event.target.value as DeliveryFailureRecoveryDecision)}
                  className="mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  {Object.entries(recoveryDecisionLabels).map(([decision, label]) => (
                    <option key={decision} value={decision}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-red-800">{recoveryDecisionDescriptions[recoveryDecision]}</p>
              </div>

              <div>
                <label htmlFor="recovery-note" className="text-sm font-semibold">
                  Recovery note
                </label>
                <textarea
                  id="recovery-note"
                  value={recoveryNote}
                  onChange={(event) => setRecoveryNote(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="Customer asked for retry tomorrow, refund requested, or closure reason"
                />
              </div>

              {recoveryDecision === 'REFUND_OR_CUSTOMER_FOLLOW_UP' && (
                <div>
                  <label htmlFor="follow-up-due-date" className="text-sm font-semibold">
                    Follow-up due date
                  </label>
                  <input
                    id="follow-up-due-date"
                    type="date"
                    value={followUpDueDate}
                    onChange={(event) => setFollowUpDueDate(event.target.value)}
                    className="mt-1 w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                  <p className="mt-1 text-xs text-red-800">Assigns an open follow-up task to the current user.</p>
                </div>
              )}

              {recoveryMutation.error && (
                <div className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-700">
                  {getErrorMessage(recoveryMutation.error)}
                </div>
              )}
              {resolveFollowUpMutation.error && (
                <div className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-red-700">
                  {getErrorMessage(resolveFollowUpMutation.error)}
                </div>
              )}

              <button
                type="submit"
                disabled={recoveryMutation.isPending}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {recoveryMutation.isPending ? 'Recording...' : 'Record recovery decision'}
              </button>
            </form>

            <div className="rounded-md border border-red-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-gray-900">Recorded recovery decisions</h4>
              {loadingFailureRecoveries && <p className="mt-3 text-sm text-gray-500">Loading recovery decisions...</p>}
              {failureRecoveriesError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {getErrorMessage(failureRecoveriesError)}
                </div>
              )}
              {!loadingFailureRecoveries && !failureRecoveriesError && failureRecoveries.length === 0 && (
                <p className="mt-3 text-sm text-gray-500">No recovery decision recorded yet.</p>
              )}
              {failureRecoveries.length > 0 && (
                <div className="mt-3 space-y-3">
                  {failureRecoveries.map((recovery) => (
                    <div key={recovery.recoveryId} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                      <p className="text-sm font-semibold text-gray-900">{formatRecoveryDecision(recovery.decision)}</p>
                      {recovery.note && <p className="mt-1 text-sm text-gray-600">{recovery.note}</p>}
                      <p className="mt-1 text-xs text-gray-500">
                        By {recovery.createdBy} on {new Date(recovery.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 border-t border-red-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-900">Customer follow-up tasks</h4>
                {loadingFollowUpTasks && <p className="mt-3 text-sm text-gray-500">Loading follow-up tasks...</p>}
                {followUpTasksError && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {getErrorMessage(followUpTasksError)}
                  </div>
                )}
                {!loadingFollowUpTasks && !followUpTasksError && followUpTasks.length === 0 && (
                  <p className="mt-3 text-sm text-gray-500">No customer follow-up task is open for this failure.</p>
                )}
                {followUpTasks.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {followUpTasks.map((task: DeliveryFollowUpTask) => {
                      const isResolvingTask = resolveFollowUpMutation.isPending
                        && resolveFollowUpMutation.variables?.taskId === task.taskId;
                      return (
                        <div key={task.taskId} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {task.status === 'OPEN' ? 'Open follow-up' : 'Resolved follow-up'}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              task.status === 'OPEN'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {task.status}
                            </span>
                          </div>
                          {task.note && <p className="mt-1 text-sm text-gray-600">{task.note}</p>}
                          <p className="mt-1 text-xs text-gray-500">Owner: {task.assignedTo}</p>
                          <p className="mt-1 text-xs text-gray-500">Due: {formatFollowUpDate(task.dueAt)}</p>
                          {task.resolvedAt && (
                            <p className="mt-1 text-xs text-gray-500">
                              Resolved by {task.resolvedBy ?? 'unknown'} on {new Date(task.resolvedAt).toLocaleString()}
                            </p>
                          )}
                          {task.resolutionNote && <p className="mt-1 text-xs text-gray-600">{task.resolutionNote}</p>}
                          {task.status === 'OPEN' && (
                            <div className="mt-3 space-y-2">
                              <textarea
                                value={followUpResolutionNotes[task.taskId] ?? ''}
                                onChange={(event) => setFollowUpResolutionNotes((currentNotes) => ({
                                  ...currentNotes,
                                  [task.taskId]: event.target.value,
                                }))}
                                maxLength={1000}
                                rows={2}
                                aria-label={`Resolution note for follow-up ${task.taskId.slice(0, 8)}`}
                                placeholder="Optional resolution note"
                                className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                              />
                              <button
                                type="button"
                                disabled={isResolvingTask}
                                onClick={() => resolveFollowUpMutation.mutate({
                                  taskId: task.taskId,
                                  note: followUpResolutionNotes[task.taskId] ?? '',
                                })}
                                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                              >
                                {isResolvingTask ? 'Resolving...' : 'Resolve follow-up'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {openFollowUpTasks.length > 0 && (
                  <p className="mt-3 text-xs text-gray-500">
                    Resolve the customer follow-up when the refund, replacement, or customer contact is complete.
                  </p>
                )}
              </div>
              <div className="mt-4 border-t border-red-100 pt-4">
                <p className="text-sm font-semibold text-gray-900">Retry execution</p>
                <p className="mt-1 text-sm text-gray-600">
                  Move this order back to the assignment queue only after the latest decision is Retry delivery.
                </p>
                {retryDeliveryMutation.error && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {getErrorMessage(retryDeliveryMutation.error)}
                  </div>
                )}
                <button
                  type="button"
                  disabled={!canMoveBackToAssignment || retryDeliveryMutation.isPending}
                  onClick={() => retryDeliveryMutation.mutate()}
                  className="mt-3 w-full rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {retryDeliveryMutation.isPending ? 'Moving...' : 'Move back to assignment queue'}
                </button>
                {!canMoveBackToAssignment && (
                  <p className="mt-2 text-xs text-gray-500">Record Retry delivery as the latest decision first.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500">Available actions</h3>
            <p className="mt-1 text-sm text-gray-600">Use the action that matches the current COD stage.</p>
          </div>
        <div className="flex flex-wrap justify-end gap-2 max-w-xl">
          {order.status === 'CREATED' && (
            <button
              type="button"
              disabled={mutationDisabled}
              onClick={() => mutation.mutate({ action: 'request-confirmation' })}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Request Confirmation
            </button>
          )}

          {order.status === 'CONFIRMATION_REQUESTED' && (
            <>
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => mutation.mutate({ action: 'confirm' })}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Confirm Order
              </button>
              <input
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="w-52 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Rejection reason"
              />
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => mutation.mutate({ action: 'reject', reason: rejectReason })}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}

          {order.status === 'CONFIRMED' && (
            <>
              <select
                value={courierId}
                onChange={(event) => setCourierId(event.target.value)}
                className="w-52 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Courier ID"
              >
                <option value="">Select courier</option>
                {activeCouriers.map((courier) => (
                  <option key={courier.courierId} value={courier.courierId}>
                    {courier.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={mutationDisabled || !courierId}
                onClick={() => mutation.mutate({ action: 'assign-courier', courierId })}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
              >
                Assign Courier
              </button>
            </>
          )}

          {order.status === 'ASSIGNED_TO_COURIER' && (
            <>
              <span className="inline-flex items-center rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700">
                Courier {selectedPickupCourierId.slice(0, 8)}...
              </span>
              <button
                type="button"
                disabled={mutationDisabled || !selectedPickupCourierId}
                onClick={() => mutation.mutate({ action: 'pick-up', courierId: selectedPickupCourierId })}
                className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                Mark Picked Up
              </button>
            </>
          )}

          {order.status === 'PICKED_UP' && (
            <>
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => setConfirmDeliverOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Mark Delivered
              </button>
              <select
                value={failureReason}
                onChange={(event) => setFailureReason(event.target.value as DeliveryFailureReason)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Failure reason"
              >
                <option value="CUSTOMER_UNREACHABLE">Customer unreachable</option>
                <option value="CUSTOMER_REFUSED">Customer refused</option>
                <option value="INVALID_ADDRESS">Invalid address</option>
                <option value="CUSTOMER_RESCHEDULED">Customer rescheduled</option>
                <option value="LOST_PACKAGE">Lost package</option>
                <option value="OTHER">Other</option>
              </select>
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => {
                  setConfirmDeliverOpen(false);
                  mutation.mutate({ action: 'fail', reason: failureReason });
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Mark Failed
              </button>
              {confirmDeliverOpen && (
                <div className="basis-full rounded-md border border-green-200 bg-green-50 p-3 text-left">
                  <p className="text-sm font-semibold text-green-950">
                    Are you sure this delivery should be marked delivered?
                  </p>
                  <p className="mt-1 text-sm text-green-800">
                    This records a successful delivery and closes the order from courier tracking.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={mutationDisabled}
                      onClick={() => mutation.mutate({ action: 'deliver' })}
                      className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
                    >
                      Yes, mark delivered
                    </button>
                    <button
                      type="button"
                      disabled={mutationDisabled}
                      onClick={() => setConfirmDeliverOpen(false)}
                      className="rounded-md border border-green-300 bg-white px-3 py-2 text-sm font-medium text-green-900 hover:bg-green-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </section>

      {mutation.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(mutation.error)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-4">Customer Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contact</p>
                <p className="font-medium">{order.customer.phone}</p>
                <p className="text-sm">{order.customer.email}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{order.address.street}</p>
                <p>
                  {order.address.city}, {order.address.state} {order.address.zipCode}
                </p>
                <p>{order.address.country}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-4">Order Summary</h3>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Status</span>
              <span className={`rounded-full border px-2.5 py-1 text-sm font-medium ${statusTones[order.status]}`}>{statusLabels[order.status]}</span>
            </div>
            <div className="flex justify-between items-center gap-4 py-2">
              <span className="text-gray-600">Next action</span>
              <span className="text-right font-medium">{nextActions[order.status]}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Total Amount</span>
              <span className="font-bold text-lg">{order.amount.toFixed(2)} MAD</span>
            </div>
            {order.courierId && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Courier</span>
                <span className="font-medium">{selectedCourierName}</span>
              </div>
            )}
            {order.failureReason && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
                <p className="font-medium text-sm">Failure Reason</p>
                <p>{formattedFailureReason ?? order.failureReason}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-6">Order Timeline</h3>
          {timelineError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {getErrorMessage(timelineError)}
            </div>
          )}
          <div className="space-y-6">
            {timeline.map((item, index) => {
              const details = timelineDetails(item.details);

              return (
              <div key={item.itemId} className="relative flex gap-4">
                {index !== timeline.length - 1 && (
                  <div className="absolute left-2.5 top-8 bottom-0 w-px bg-gray-200 -mb-6" />
                )}
                <div className="relative z-10 flex-shrink-0 bg-white">
                  <TimelineIcon type={item.type} category={item.category} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-sm text-gray-900">{item.title}</p>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                      {item.category.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
                  {item.actor && <p className="text-xs text-gray-500">By {item.actor}</p>}
                  {details.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {details.map(([key, value]) => (
                        <p key={key} className="break-words text-xs text-gray-500">
                          <span className="font-medium text-gray-600">{key}:</span> {value}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
            {timeline.length === 0 && !timelineError && <p className="text-sm text-gray-500">No timeline items recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
