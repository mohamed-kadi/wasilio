import { useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock, MessageSquare, Package, PhoneCall, Truck, XCircle } from 'lucide-react';
import {
  assignCourier,
  clearConfirmationRequest,
  fetchConfirmationAttempts,
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
  recordConfirmationAttempt,
  recordDeliveryFailureRecovery,
  requestConfirmation,
  resolveDeliveryFollowUp,
  retryFailedDelivery,
} from '../api/client';
import type { ConfirmationAttempt, ConfirmationOutcome, DeliveryFailureRecovery, Order, OrderStatus } from '../api/client';
import {
  IntelligenceBadge,
  IntelligenceHistory,
  IntelligenceScoreKpi,
  IntelligenceSignals,
  IntelligenceSummary,
} from '../components/OrderIntelligence';
import { OrderLineSnapshots } from '../components/OrderLineSnapshots';
import { hasOrderLines } from '../lib/orderLines';

type LifecycleCommand =
  | { action: 'request-confirmation' }
  | { action: 'clear-confirmation-request' }
  | { action: 'assign-courier'; courierId: string }
  | { action: 'pick-up'; courierId: string }
  | { action: 'deliver' }
  | { action: 'fail'; reason: DeliveryFailureReason };

const statusLabels: Record<OrderStatus, string> = {
  CREATED: 'New order',
  CONFIRMATION_REQUESTED: 'Confirmation requested',
  CONFIRMED: 'Ready for assignment',
  REJECTED: 'Rejected',
  ASSIGNED_TO_COURIER: 'Waiting pickup',
  PICKED_UP: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Recovery',
};

const statusDescriptions: Record<OrderStatus, string> = {
  CREATED: 'The order is waiting for customer confirmation.',
  CONFIRMATION_REQUESTED: 'Record the real customer call outcome before sending this order to assignment.',
  CONFIRMED: 'The customer accepted the order. Assign a courier when the package is ready.',
  REJECTED: 'The customer refused or cancelled. This order is closed.',
  ASSIGNED_TO_COURIER: 'A courier has been assigned. Confirm pickup after the package leaves the merchant.',
  PICKED_UP: 'The package is with the courier. Record delivered or failed after the attempt.',
  DELIVERED: 'The order was delivered successfully and is closed.',
  FAILED: 'Delivery failed. Continue recovery, follow-up, retry, refund review, or closure.',
};

const nextActions: Record<OrderStatus, string> = {
  CREATED: 'Request confirmation',
  CONFIRMATION_REQUESTED: 'Record confirmation outcome',
  CONFIRMED: 'Assign courier',
  REJECTED: 'View closed order',
  ASSIGNED_TO_COURIER: 'Confirm pickup',
  PICKED_UP: 'Record delivery result',
  DELIVERED: 'View closed order',
  FAILED: 'Continue recovery',
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

const confirmationOutcomes: ConfirmationOutcome[] = [
  'CONFIRMED',
  'NO_ANSWER',
  'CALL_BACK_LATER',
  'WRONG_NUMBER',
  'REJECTED',
];

const confirmationOutcomeLabels: Record<ConfirmationOutcome, string> = {
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  NO_ANSWER: 'No answer',
  CALL_BACK_LATER: 'Call back later',
  WRONG_NUMBER: 'Wrong number',
};

const confirmationOutcomeDescriptions: Record<ConfirmationOutcome, string> = {
  CONFIRMED: 'Customer accepted the order. This moves it to courier assignment.',
  REJECTED: 'Customer refused or cancelled. This closes the order as rejected.',
  NO_ANSWER: 'No decision yet. Keep the order in confirmation follow-up.',
  CALL_BACK_LATER: 'Customer asked for another call. Schedule the exact callback time.',
  WRONG_NUMBER: 'The phone number is invalid or belongs to the wrong person.',
};

const confirmationOutcomeTones: Record<ConfirmationOutcome, string> = {
  CONFIRMED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  REJECTED: 'border-red-200 bg-red-50 text-red-800',
  NO_ANSWER: 'border-amber-200 bg-amber-50 text-amber-800',
  CALL_BACK_LATER: 'border-blue-200 bg-blue-50 text-blue-800',
  WRONG_NUMBER: 'border-orange-200 bg-orange-50 text-orange-800',
};

const recoveryDecisionLabels: Record<DeliveryFailureRecoveryDecision, string> = {
  RETRY_DELIVERY: 'Retry delivery',
  REFUND_OR_CUSTOMER_FOLLOW_UP: 'Refund / customer follow-up',
  CLOSE_UNRECOVERABLE: 'Close as unreachable / unrecoverable',
};

const recoveryDecisionDescriptions: Record<DeliveryFailureRecoveryDecision, string> = {
  RETRY_DELIVERY: 'Use when the customer still wants the order and operations should prepare a new delivery attempt.',
  REFUND_OR_CUSTOMER_FOLLOW_UP: 'Use when the merchant must refund, replace, or contact the customer before any next action.',
  CLOSE_UNRECOVERABLE: 'Use when the customer cannot be reached or the order should stay failed with no more delivery action.',
};

type WorkflowStage = 'CONFIRMATION' | 'ASSIGNMENT' | 'PICKUP' | 'DELIVERY' | 'RECOVERY' | 'CLOSED';

const workflowStages: Array<{ value: WorkflowStage; label: string; detail: string }> = [
  { value: 'CONFIRMATION', label: 'Confirmation', detail: 'Customer decision' },
  { value: 'ASSIGNMENT', label: 'Assignment', detail: 'Courier handoff' },
  { value: 'PICKUP', label: 'Pickup', detail: 'Package leaves merchant' },
  { value: 'DELIVERY', label: 'Delivery', detail: 'Courier outcome' },
  { value: 'RECOVERY', label: 'Recovery', detail: 'Failed delivery follow-up' },
  { value: 'CLOSED', label: 'Closed', detail: 'Finished order' },
];

function formatFailureReason(reason?: string) {
  if (!reason) {
    return undefined;
  }
  return failureReasonLabels[reason] ?? reason.replace(/_/g, ' ').toLowerCase();
}

function formatRecoveryDecision(decision: DeliveryFailureRecoveryDecision | string) {
  return recoveryDecisionLabels[decision as DeliveryFailureRecoveryDecision] ?? decision.replace(/_/g, ' ').toLowerCase();
}

function recoverySubmitLabel(decision: DeliveryFailureRecoveryDecision) {
  if (decision === 'RETRY_DELIVERY') {
    return 'Record retry decision';
  }
  if (decision === 'REFUND_OR_CUSTOMER_FOLLOW_UP') {
    return 'Create follow-up task';
  }
  return 'Close as unreachable';
}

function confirmationSubmitLabel(outcome: ConfirmationOutcome) {
  if (outcome === 'CONFIRMED') {
    return 'Save confirmation';
  }
  if (outcome === 'CALL_BACK_LATER') {
    return 'Schedule callback';
  }
  if (outcome === 'WRONG_NUMBER') {
    return 'Save wrong number';
  }
  if (outcome === 'REJECTED') {
    return 'Reject order';
  }
  return 'Save follow-up attempt';
}

function toLocalDateTimeInputValue(date: Date): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoFromLocalDateTime(value: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toInstantFromDate(date: string, endOfDay = false) {
  if (!date) return undefined;
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`;
}

function formatFollowUpDate(value?: string) {
  return value ? new Date(value).toLocaleString() : 'No due date';
}

function formatOrderSource(source?: string) {
  if (source === 'WASILIO_STOREFRONT') {
    return 'Storefront / landing-engine';
  }
  if (!source) {
    return 'Manual order';
  }
  return source
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function workflowStageForStatus(status: OrderStatus): WorkflowStage {
  if (status === 'CREATED' || status === 'CONFIRMATION_REQUESTED') {
    return 'CONFIRMATION';
  }
  if (status === 'CONFIRMED') {
    return 'ASSIGNMENT';
  }
  if (status === 'ASSIGNED_TO_COURIER') {
    return 'PICKUP';
  }
  if (status === 'PICKED_UP') {
    return 'DELIVERY';
  }
  if (status === 'FAILED') {
    return 'RECOVERY';
  }
  return 'CLOSED';
}

function workflowStageLabel(status: OrderStatus) {
  const stage = workflowStageForStatus(status);
  return workflowStages.find((workflowStage) => workflowStage.value === stage)?.label ?? 'Workflow';
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

function formatTimelineKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase());
}

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [courierId, setCourierId] = useState('');
  const [confirmationOutcome, setConfirmationOutcome] = useState<ConfirmationOutcome>('NO_ANSWER');
  const [confirmationCallbackAt, setConfirmationCallbackAt] = useState('');
  const [confirmationNote, setConfirmationNote] = useState('');
  const [failureReason, setFailureReason] = useState<DeliveryFailureReason>('CUSTOMER_REFUSED');
  const [confirmDeliverOpen, setConfirmDeliverOpen] = useState(false);
  const [recoveryDecision, setRecoveryDecision] = useState<DeliveryFailureRecoveryDecision>('RETRY_DELIVERY');
  const [recoveryNote, setRecoveryNote] = useState('');
  const [recoveryFormError, setRecoveryFormError] = useState<string | null>(null);
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

  const {
    data: confirmationAttempts = [],
    error: confirmationAttemptsError,
    isLoading: loadingConfirmationAttempts,
  } = useQuery({
    queryKey: ['confirmation-attempts', id],
    queryFn: () => fetchConfirmationAttempts(id!),
    enabled: !!id && (order?.status === 'CREATED' || order?.status === 'CONFIRMATION_REQUESTED'),
  });

  const mutation = useMutation({
    mutationFn: async (command: LifecycleCommand) => {
      if (!id) {
        throw new Error('Order ID is missing');
      }

      switch (command.action) {
        case 'request-confirmation':
          return requestConfirmation(id);
        case 'clear-confirmation-request':
          return clearConfirmationRequest(id);
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
      queryClient.invalidateQueries({ queryKey: ['confirmation-attempts', id] });
      queryClient.invalidateQueries({ queryKey: ['confirmation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['confirmation-callbacks'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
    },
  });

  const confirmationAttemptMutation = useMutation({
    mutationFn: async () => {
      if (!id) {
        throw new Error('Order ID is missing');
      }
      const scheduledCallbackAt = confirmationOutcome === 'CALL_BACK_LATER'
        ? toIsoFromLocalDateTime(confirmationCallbackAt)
        : undefined;
      if (confirmationOutcome === 'CALL_BACK_LATER' && !scheduledCallbackAt) {
        throw new Error('Callback time is required for call-back-later attempts');
      }
      return recordConfirmationAttempt(id, confirmationOutcome, confirmationNote, scheduledCallbackAt);
    },
    onSuccess: () => {
      setConfirmationNote('');
      setConfirmationCallbackAt('');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', id] }),
        queryClient.invalidateQueries({ queryKey: ['order-timeline', id] }),
        queryClient.invalidateQueries({ queryKey: ['confirmation-attempts', id] }),
        queryClient.invalidateQueries({ queryKey: ['confirmation-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['confirmation-callbacks'] }),
        queryClient.invalidateQueries({ queryKey: ['courier-assignment-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-summary'] }),
      ]);
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
    onSuccess: (recovery) => {
      setRecoveryFormError(null);
      setRecoveryNote('');
      setFollowUpDueDate('');
      queryClient.setQueryData<DeliveryFailureRecovery[] | undefined>(
        ['delivery-failure-recoveries', id],
        (currentRecoveries) => {
          const recoveries = currentRecoveries ?? [];
          if (recoveries.some((currentRecovery) => currentRecovery.recoveryId === recovery.recoveryId)) {
            return recoveries;
          }
          return [...recoveries, recovery];
        },
      );
      if (recovery.followUpTask) {
        queryClient.setQueryData<DeliveryFollowUpTask[] | undefined>(
          ['delivery-follow-ups', id],
          (currentTasks) => {
            const tasks = currentTasks ?? [];
            if (tasks.some((currentTask) => currentTask.taskId === recovery.followUpTask?.taskId)) {
              return tasks;
            }
            return [...tasks, recovery.followUpTask!];
          },
        );
      } else if (recovery.decision !== 'REFUND_OR_CUSTOMER_FOLLOW_UP') {
        queryClient.setQueryData<DeliveryFollowUpTask[] | undefined>(
          ['delivery-follow-ups', id],
          (currentTasks) => currentTasks?.map((task) => (
            task.status === 'OPEN'
              ? {
                  ...task,
                  status: 'RESOLVED',
                  resolvedAt: recovery.createdAt,
                  resolvedBy: recovery.createdBy,
                  resolutionNote: `Superseded by ${formatRecoveryDecision(recovery.decision)}`,
                }
              : task
          )),
        );
      }
      queryClient.invalidateQueries({ queryKey: ['delivery-failure-recoveries', id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-follow-ups', id] });
      queryClient.invalidateQueries({ queryKey: ['failed-order-recovery-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['failed-order-recovery-queue'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-follow-ups-summary'] });
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
    onSuccess: (task, variables) => {
      setFollowUpResolutionNotes((currentNotes) => {
        const nextNotes = { ...currentNotes };
        delete nextNotes[variables.taskId];
        return nextNotes;
      });
      queryClient.setQueryData<DeliveryFollowUpTask[] | undefined>(
        ['delivery-follow-ups', id],
        (currentTasks) => currentTasks?.map((currentTask) => currentTask.taskId === task.taskId ? task : currentTask) ?? [task],
      );
      queryClient.invalidateQueries({ queryKey: ['delivery-follow-ups', id] });
      queryClient.invalidateQueries({ queryKey: ['failed-order-recovery-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['failed-order-recovery-queue'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-follow-ups-summary'] });
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
    onMutate: async () => {
      if (!id) {
        return {};
      }
      await queryClient.cancelQueries({ queryKey: ['order', id] });
      const previousOrder = queryClient.getQueryData<Order>(['order', id]);

      queryClient.setQueryData<Order | undefined>(
        ['order', id],
        (currentOrder) => (currentOrder ? orderMovedToAssignment(currentOrder) : currentOrder),
      );

      return { previousOrder };
    },
    onError: (_error, _variables, context) => {
      if (id && context?.previousOrder) {
        queryClient.setQueryData(['order', id], context.previousOrder);
      }
    },
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', id] }),
        queryClient.invalidateQueries({ queryKey: ['order-timeline', id] }),
        queryClient.invalidateQueries({ queryKey: ['failed-order-recovery-summaries'] }),
        queryClient.invalidateQueries({ queryKey: ['failed-order-recovery-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['courier-assignment-queue'] }),
      ]);
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

  const mutationDisabled = mutation.isPending || confirmationAttemptMutation.isPending;
  const activeCouriers = (couriersPage?.content ?? []).filter((courier) => courier.active);
  const selectedPickupCourierId = order.courierId ?? courierId;
  const selectedCourierName = activeCouriers.find((courier) => courier.courierId === order.courierId)?.name ?? order.courierId;
  const formattedFailureReason = formatFailureReason(order.failureReason);
  const latestFailureRecovery = failureRecoveries.length > 0
    ? failureRecoveries[failureRecoveries.length - 1]
    : undefined;
  const openFollowUpTasks = followUpTasks.filter((task) => task.status === 'OPEN');
  const canMoveBackToAssignment = latestFailureRecovery?.decision === 'RETRY_DELIVERY';
  const latestRecoveryClosed = latestFailureRecovery?.decision === 'CLOSE_UNRECOVERABLE';
  const closeDecisionMissingNote = recoveryDecision === 'CLOSE_UNRECOVERABLE' && !recoveryNote.trim();
  const duplicateFollowUpBlocked = recoveryDecision === 'REFUND_OR_CUSTOMER_FOLLOW_UP' && openFollowUpTasks.length > 0;
  const recoverySubmitDisabled = recoveryMutation.isPending || duplicateFollowUpBlocked;
  const recentConfirmationAttempts = confirmationAttempts.slice(-3).reverse();
  const confirmationSubmitDisabled = mutationDisabled || (confirmationOutcome === 'CALL_BACK_LATER' && !confirmationCallbackAt);
  const recoveryNextAction = openFollowUpTasks.length > 0
    ? 'Resolve customer follow-up'
    : canMoveBackToAssignment
      ? 'Move back to assignment queue'
      : latestFailureRecovery
        ? latestRecoveryClosed
          ? 'Recovery closed'
          : 'Record next decision'
        : 'Record recovery decision';
  const customerName = `${order.customer.firstName} ${order.customer.lastName}`.trim() || 'Unknown customer';
  const amountLabel = `${order.amount.toFixed(2)} MAD`;
  const closedOrder = order.status === 'DELIVERED' || order.status === 'REJECTED';
  const workflowActionDescription = order.status === 'FAILED'
    ? 'Recovery work is handled in the failed delivery workspace below.'
    : closedOrder
      ? 'This order is closed. Use the timeline and notes for investigation.'
      : 'Use the action that matches the current workflow stage.';

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
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/orders" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Orders
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-900">Order Detail</h2>
            <span className={`rounded-full border px-2.5 py-1 text-sm font-medium ${statusTones[order.status]}`}>
              {statusLabels[order.status]}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-gray-500">{order.id}</p>
        </div>
        <div className="text-left text-sm text-gray-500 sm:text-right">
          <p>Created {formatDateTime(order.createdAt)}</p>
          <p>Updated {formatDateTime(order.updatedAt)}</p>
        </div>
      </header>

      <section className={`rounded-lg border p-5 ${statusTones[order.status]}`}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase">Current workflow stage</p>
            <h3 className="mt-2 text-2xl font-bold text-gray-900">{workflowStageLabel(order.status)}</h3>
            <p className="mt-2 text-sm">{statusDescriptions[order.status]}</p>
            <p className="mt-2 text-xs font-semibold uppercase text-gray-600">Status: {statusLabels[order.status]}</p>
          </div>
          <div className="rounded-md bg-white/75 px-4 py-3 text-sm shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-500">Next action</p>
            <p className="mt-1 font-semibold text-gray-900">{nextActions[order.status]}</p>
          </div>
        </div>
        <WorkflowStageTrail status={order.status} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Customer" value={customerName} detail={order.customer.phone} />
          <SummaryTile label="Order total" value={amountLabel} detail="Cash on delivery" />
          <SummaryTile label="Source" value={formatOrderSource(order.source)} detail={order.externalOrderId ?? 'No external reference'} />
          <SummaryTile label="Courier" value={selectedCourierName ?? 'Not assigned'} detail={order.courierId ? 'Assigned courier' : 'Pending assignment'} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500">Intelligence</h3>
            <IntelligenceSummary intelligence={order.intelligence} className="mt-1 text-sm text-gray-600" />
          </div>
          <IntelligenceBadge intelligence={order.intelligence} showScores={false} />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div>
            <IntelligenceScoreKpi intelligence={order.intelligence} showHeader={false} />
            <div className="mt-5 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Signals</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{order.intelligence?.signals.length ?? 0}</p>
                <p className="mt-1 text-xs text-gray-500">Current score reasons</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Score use</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">Operations KPI</p>
                <p className="mt-1 text-xs text-gray-500">No automatic lifecycle action</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Score reasons</p>
            <div className="mt-3">
              <IntelligenceSignals intelligence={order.intelligence} />
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-gray-100 pt-5">
          <IntelligenceHistory intelligence={order.intelligence} />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500">Stage action</h3>
            <p className="mt-1 text-sm text-gray-600">{workflowActionDescription}</p>
          </div>
          <div className="flex max-w-2xl flex-wrap justify-end gap-2">
            {order.status === 'CREATED' && (
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => mutation.mutate({ action: 'request-confirmation' })}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Request Confirmation
              </button>
            )}

            {order.status === 'CONFIRMATION_REQUESTED' && (
              <div className="basis-full rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-blue-950">Record customer confirmation</p>
                    <p className="mt-1 text-sm text-blue-800">
                      Save the real call outcome. Non-final outcomes keep the order in confirmation follow-up.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={mutationDisabled}
                    onClick={() => mutation.mutate({ action: 'clear-confirmation-request' })}
                    className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100 disabled:opacity-50"
                  >
                    Return to New order
                  </button>
                </div>

                <form
                  className="mt-4 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    confirmationAttemptMutation.mutate();
                  }}
                >
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Outcome</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      {confirmationOutcomes.map((outcomeOption) => {
                        const selected = confirmationOutcome === outcomeOption;
                        return (
                          <button
                            key={outcomeOption}
                            type="button"
                            onClick={() => {
                              setConfirmationOutcome(outcomeOption);
                              if (outcomeOption !== 'CALL_BACK_LATER') {
                                setConfirmationCallbackAt('');
                              }
                            }}
                            className={`min-h-16 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                              selected
                                ? confirmationOutcomeTones[outcomeOption]
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span className="font-semibold">{confirmationOutcomeLabels[outcomeOption]}</span>
                            <span className="mt-1 block text-xs opacity-80">{confirmationOutcomeDescriptions[outcomeOption]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {confirmationOutcome === 'CALL_BACK_LATER' && (
                    <label className="block max-w-xs">
                      <span className="mb-1 block text-sm font-medium text-gray-700">Callback time</span>
                      <input
                        type="datetime-local"
                        value={confirmationCallbackAt}
                        min={toLocalDateTimeInputValue(new Date())}
                        onChange={(event) => setConfirmationCallbackAt(event.target.value)}
                        required
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  )}

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      {confirmationOutcome === 'REJECTED' ? 'Rejection reason' : 'Call note'}
                    </span>
                    <textarea
                      value={confirmationNote}
                      onChange={(event) => setConfirmationNote(event.target.value)}
                      maxLength={1000}
                      rows={3}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  {confirmationAttemptMutation.error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {getErrorMessage(confirmationAttemptMutation.error)}
                    </div>
                  )}

                  {confirmationAttemptsError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {getErrorMessage(confirmationAttemptsError)}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="submit"
                      disabled={confirmationSubmitDisabled}
                      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                        confirmationOutcome === 'CONFIRMED'
                          ? 'bg-emerald-700 hover:bg-emerald-800'
                          : confirmationOutcome === 'REJECTED'
                            ? 'bg-red-700 hover:bg-red-800'
                            : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {confirmationOutcome === 'CONFIRMED'
                        ? <CheckCircle2 size={18} />
                        : confirmationOutcome === 'REJECTED'
                          ? <XCircle size={18} />
                          : <PhoneCall size={18} />}
                      {confirmationSubmitLabel(confirmationOutcome)}
                    </button>
                    <p className="text-xs text-gray-500">
                      Returning to New order only clears the requested stage; timeline history remains.
                    </p>
                  </div>
                </form>

                <div className="mt-4 border-t border-blue-100 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-gray-500">Recent attempts</p>
                    <Link to="/app/confirmations" className="text-xs font-medium text-blue-700 hover:underline">
                      Open confirmation queue
                    </Link>
                  </div>
                  <div className="mt-3 space-y-2">
                    {recentConfirmationAttempts.map((attempt) => (
                      <ConfirmationAttemptItem key={attempt.attemptId} attempt={attempt} compact />
                    ))}
                    {!loadingConfirmationAttempts && recentConfirmationAttempts.length === 0 && (
                      <p className="text-sm text-gray-500">No confirmation attempts recorded yet.</p>
                    )}
                    {loadingConfirmationAttempts && <p className="text-sm text-gray-500">Loading confirmation attempts...</p>}
                  </div>
                </div>
              </div>
            )}

            {order.status === 'CONFIRMED' && (
              <>
                <select
                  value={courierId}
                  onChange={(event) => setCourierId(event.target.value)}
                  className="w-52 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
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
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
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
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Mark Delivered
                </button>
                <select
                  value={failureReason}
                  onChange={(event) => setFailureReason(event.target.value as DeliveryFailureReason)}
                  className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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

            {(order.status === 'FAILED' || closedOrder) && (
              <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                No direct lifecycle action
              </span>
            )}
          </div>
        </div>
      </section>

      {mutation.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(mutation.error)}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <SectionHeader
            eyebrow="Investigation"
            title="Customer and Order"
            description="Core information for customer contact, address checks, and product verification."
          />

          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Customer</h4>
              <dl className="mt-3 space-y-3">
                <DetailRow label="Name" value={customerName} />
                <DetailRow label="Phone" value={order.customer.phone} />
                <DetailRow label="Email" value={order.customer.email} />
              </dl>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900">Delivery Address</h4>
              <dl className="mt-3 space-y-3">
                <DetailRow label="Street" value={order.address.street} />
                <DetailRow label="City" value={order.address.city} />
                <DetailRow label="State / ZIP" value={`${order.address.state} ${order.address.zipCode}`.trim()} />
                <DetailRow label="Country" value={order.address.country} />
              </dl>
            </div>
          </div>

          {hasOrderLines(order.orderLines) && (
            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900">Product Snapshot</h4>
                <span className="text-xs font-medium text-gray-500">
                  {order.orderLines?.length} {order.orderLines?.length === 1 ? 'line' : 'lines'}
                </span>
              </div>
              <OrderLineSnapshots orderLines={order.orderLines} className="mt-3" />
            </div>
          )}
        </section>

        <aside className="rounded-lg border border-gray-200 bg-white p-6">
          <SectionHeader
            eyebrow="Operations"
            title="Workflow Snapshot"
            description="Operational identifiers and fulfillment context."
          />
          <dl className="mt-6 space-y-3">
            <DetailRow label="Stage" value={workflowStageLabel(order.status)} />
            <DetailRow label="Status">
              <span className={`rounded-full border px-2.5 py-1 text-sm font-medium ${statusTones[order.status]}`}>
                {statusLabels[order.status]}
              </span>
            </DetailRow>
            <DetailRow label="Next action" value={nextActions[order.status]} />
            <DetailRow label="Total Amount" value={amountLabel} />
            <DetailRow label="Source" value={formatOrderSource(order.source)} />
            <DetailRow label="External order ID" value={order.externalOrderId} mono />
            <DetailRow label="Inbound order ID" value={order.inboundOrderId} mono />
            <DetailRow label="Courier" value={selectedCourierName} />
            <DetailRow label="Failure reason" value={formattedFailureReason} />
            <DetailRow label="Version" value={String(order.version)} />
          </dl>
        </aside>
      </div>

      {order.status === 'FAILED' && (
        <section className="overflow-hidden rounded-lg border border-red-200 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-red-100 bg-red-50/80 px-5 py-4 text-red-950">
            <div>
              <div className="flex items-center gap-2">
                <AlertCircle size={18} />
                <h3 className="text-base font-semibold">Failed delivery recovery</h3>
              </div>
              <p className="mt-1 text-sm text-red-800">
                Failure reason: <span className="font-semibold">{formattedFailureReason ?? 'Not recorded'}</span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/app/orders"
                state={{ statuses: ['FAILED'], recoveryFocus: true }}
                className="inline-flex min-h-10 items-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
              >
                Failed deliveries
              </Link>
              <Link
                to="/app/couriers/performance"
                className="inline-flex min-h-10 items-center rounded-md border border-red-700 bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
              >
                Courier performance
              </Link>
            </div>
          </div>

          <div className="grid gap-3 border-b border-gray-100 px-5 py-4 md:grid-cols-3">
            <RecoveryMetric
              title="Latest decision"
              value={latestFailureRecovery ? formatRecoveryDecision(latestFailureRecovery.decision) : 'None recorded'}
              detail={latestFailureRecovery ? `By ${latestFailureRecovery.createdBy}` : 'Choose the next recovery path below'}
            />
            <RecoveryMetric
              title="Open follow-ups"
              value={String(openFollowUpTasks.length)}
              detail={openFollowUpTasks[0] ? `Due: ${formatFollowUpDate(openFollowUpTasks[0].dueAt)}` : 'No customer task waiting'}
            />
            <RecoveryMetric
              title="Next action"
              value={recoveryNextAction}
              detail="Use the matching recovery control below"
            />
          </div>

          <div className="grid items-start gap-5 px-5 py-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-4">
              <form
                className="space-y-4 rounded-md border border-gray-200 bg-white p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (closeDecisionMissingNote) {
                    setRecoveryFormError('Add a closure note before closing this failed recovery.');
                    return;
                  }
                  if (duplicateFollowUpBlocked) {
                    setRecoveryFormError('Resolve the open follow-up before creating another customer follow-up.');
                    return;
                  }
                  setRecoveryFormError(null);
                  recoveryMutation.mutate();
                }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Recovery action</p>
                  <h4 className="mt-1 text-sm font-semibold text-gray-900">Record recovery decision</h4>
                </div>
                <div>
                  <label htmlFor="recovery-decision" className="text-sm font-semibold text-gray-900">
                    Recovery decision
                  </label>
                  <select
                    id="recovery-decision"
                    value={recoveryDecision}
                    onChange={(event) => {
                      setRecoveryDecision(event.target.value as DeliveryFailureRecoveryDecision);
                      setRecoveryFormError(null);
                    }}
                    className="mt-1 min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                  >
                    {Object.entries(recoveryDecisionLabels).map(([decision, label]) => (
                      <option key={decision} value={decision}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-600">{recoveryDecisionDescriptions[recoveryDecision]}</p>
                </div>

                <div>
                  <label htmlFor="recovery-note" className="text-sm font-semibold text-gray-900">
                    Recovery note
                  </label>
                  <textarea
                    id="recovery-note"
                    value={recoveryNote}
                    onChange={(event) => {
                      setRecoveryNote(event.target.value);
                      if (event.target.value.trim()) {
                        setRecoveryFormError(null);
                      }
                    }}
                    maxLength={1000}
                    rows={3}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                    placeholder={recoveryDecision === 'CLOSE_UNRECOVERABLE'
                      ? 'Required: why this failed order is being closed'
                      : 'Customer asked for retry tomorrow, refund requested, or closure reason'}
                  />
                  {closeDecisionMissingNote && (
                    <p className="mt-1 text-xs font-medium text-red-700">
                      A closure note is required so the team can audit why this recovery was closed.
                    </p>
                  )}
                </div>

                {recoveryDecision === 'REFUND_OR_CUSTOMER_FOLLOW_UP' && (
                  <div>
                    <label htmlFor="follow-up-due-date" className="text-sm font-semibold text-gray-900">
                      Follow-up due date
                    </label>
                    <input
                      id="follow-up-due-date"
                      type="date"
                      value={followUpDueDate}
                      onChange={(event) => setFollowUpDueDate(event.target.value)}
                      className="mt-1 min-h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <p className="mt-1 text-xs text-gray-600">Assigns an open follow-up task to the current user.</p>
                    {duplicateFollowUpBlocked && (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Resolve the open follow-up before creating another customer follow-up.
                      </p>
                    )}
                  </div>
                )}

                {recoveryMutation.error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {getErrorMessage(recoveryMutation.error)}
                  </div>
                )}
                {recoveryFormError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {recoveryFormError}
                  </div>
                )}
                {resolveFollowUpMutation.error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {getErrorMessage(resolveFollowUpMutation.error)}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={recoverySubmitDisabled}
                  className="min-h-10 rounded-md border border-red-700 bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {recoveryMutation.isPending
                    ? 'Recording...'
                    : duplicateFollowUpBlocked
                      ? 'Resolve open follow-up first'
                      : recoverySubmitLabel(recoveryDecision)}
                </button>
              </form>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-900">Return to assignment</p>
                <p className="mt-1 text-sm text-gray-600">
                  Available after the latest recovery decision is Retry delivery.
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
                  className="mt-3 min-h-10 w-full rounded-md border border-red-700 bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-200 disabled:text-gray-500 disabled:opacity-100"
                >
                  {retryDeliveryMutation.isPending ? 'Moving...' : 'Move back to assignment queue'}
                </button>
                {!canMoveBackToAssignment && (
                  <p className="mt-2 text-xs text-gray-500">Record Retry delivery as the latest decision first.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Current recovery status</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{recoveryNextAction}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {openFollowUpTasks.length > 0
                    ? 'Resolve the customer task when the refund, replacement, or customer contact is complete.'
                    : canMoveBackToAssignment
                      ? 'The latest decision is Retry delivery, so this order can return to assignment.'
                      : latestRecoveryClosed
                        ? 'This failed order recovery is closed. Record another decision only if new information arrives.'
                        : 'Record a decision to unlock the next recovery action.'}
                </p>
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-gray-900">Recovery decision history</h4>
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
                  <div className="mt-3 divide-y divide-gray-100">
                    {failureRecoveries.map((recovery) => (
                      <article key={recovery.recoveryId} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">{formatRecoveryDecision(recovery.decision)}</p>
                          <span className="text-xs text-gray-500">{new Date(recovery.createdAt).toLocaleString()}</span>
                        </div>
                        {recovery.note && (
                          <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">{recovery.note}</p>
                        )}
                        <p className="mt-2 text-xs text-gray-500">Recorded by {recovery.createdBy}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-gray-900">Customer follow-ups</h4>
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
                  <div className="mt-3 divide-y divide-gray-100">
                    {followUpTasks.map((task: DeliveryFollowUpTask) => {
                      const isResolvingTask = resolveFollowUpMutation.isPending
                        && resolveFollowUpMutation.variables?.taskId === task.taskId;
                      return (
                        <article key={task.taskId} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {task.status === 'OPEN' ? 'Open follow-up' : 'Resolved follow-up'}
                            </p>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              task.status === 'OPEN'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {task.status === 'OPEN' ? 'Waiting' : 'Resolved'}
                            </span>
                          </div>
                          {task.note && <p className="mt-2 text-sm text-gray-700">{task.note}</p>}
                          <div className="mt-2 grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                            <p>Owner: {task.assignedTo}</p>
                            <p>Due: {formatFollowUpDate(task.dueAt)}</p>
                            {task.resolvedAt && (
                              <p className="sm:col-span-2">
                                Resolved by {task.resolvedBy ?? 'unknown'} on {new Date(task.resolvedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                          {task.resolutionNote && <p className="mt-2 text-xs text-gray-600">{task.resolutionNote}</p>}
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
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                              />
                              <button
                                type="button"
                                disabled={isResolvingTask}
                                onClick={() => resolveFollowUpMutation.mutate({
                                  taskId: task.taskId,
                                  note: followUpResolutionNotes[task.taskId] ?? '',
                                })}
                                className="min-h-10 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                              >
                                {isResolvingTask ? 'Resolving...' : 'Resolve follow-up'}
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <SectionHeader
          eyebrow="Audit"
          title="Event Timeline"
          description="Lifecycle, confirmation, courier, recovery, and follow-up history."
        />
        {timelineError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getErrorMessage(timelineError)}
          </div>
        )}
        <div className="mt-6 space-y-6">
          {timeline.map((item, index) => {
            const details = timelineDetails(item.details);

            return (
              <div key={item.itemId} className="relative flex gap-4">
                {index !== timeline.length - 1 && (
                  <div className="absolute bottom-0 left-2.5 top-8 -mb-6 w-px bg-gray-200" />
                )}
                <div className="relative z-10 flex-shrink-0 bg-white">
                  <TimelineIcon type={item.type} category={item.category} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-500">
                      {item.category.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</p>
                  {item.actor && <p className="text-xs text-gray-500">By {item.actor}</p>}
                  {details.length > 0 && (
                    <dl className="mt-3 grid gap-2 rounded-md bg-gray-50 p-3 sm:grid-cols-2">
                      {details.map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <dt className="text-[11px] font-semibold uppercase text-gray-500">{formatTimelineKey(key)}</dt>
                          <dd className="break-words text-xs text-gray-700">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            );
          })}
          {timeline.length === 0 && !timelineError && <p className="text-sm text-gray-500">No timeline items recorded.</p>}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-gray-500">{eyebrow}</p>
      <h3 className="mt-1 text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="rounded-md bg-white/75 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-gray-900">{value}</p>
      {detail && <p className="mt-1 truncate text-xs text-gray-600">{detail}</p>}
    </div>
  );
}

function WorkflowStageTrail({ status }: { status: OrderStatus }) {
  const activeStage = workflowStageForStatus(status);

  return (
    <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Order workflow stages">
      {workflowStages.map((stage, index) => {
        const isActive = activeStage === stage.value;
        return (
          <div
            key={stage.value}
            className={`min-h-[5.5rem] rounded-md border px-3 py-3 ${
              isActive
                ? 'border-blue-300 bg-white text-blue-900 ring-1 ring-inset ring-blue-400'
                : 'border-white/60 bg-white/60 text-gray-700'
            }`}
          >
            <p className="text-[11px] font-semibold uppercase text-gray-500">{String(index + 1).padStart(2, '0')}</p>
            <p className="mt-2 text-sm font-semibold">{stage.label}</p>
            <p className="mt-1 line-clamp-2 text-xs opacity-80">{stage.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  children,
}: {
  label: string;
  value?: ReactNode;
  mono?: boolean;
  children?: ReactNode;
}) {
  const content = value ?? children ?? 'Not recorded';

  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className={`max-w-[70%] text-right text-sm font-medium text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {content}
      </dd>
    </div>
  );
}

function ConfirmationAttemptItem({
  attempt,
  compact = false,
}: {
  attempt: ConfirmationAttempt;
  compact?: boolean;
}) {
  return (
    <article className={`rounded-md border border-gray-200 bg-white ${compact ? 'px-3 py-2' : 'p-3'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">Attempt #{attempt.attemptNumber}</p>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${confirmationOutcomeTones[attempt.outcome]}`}>
          {confirmationOutcomeLabels[attempt.outcome]}
        </span>
      </div>
      {attempt.note && <p className="mt-2 text-sm text-gray-700">{attempt.note}</p>}
      {attempt.callbackAt && (
        <p className="mt-2 text-xs font-medium text-blue-700">
          Callback: {new Date(attempt.callbackAt).toLocaleString()}
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        {attempt.createdBy} - {new Date(attempt.createdAt).toLocaleString()}
      </p>
    </article>
  );
}

function RecoveryMetric({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase text-gray-500">{title}</p>
      <p className="mt-2 text-base font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-600">{detail}</p>
    </div>
  );
}

function orderMovedToAssignment(order: Order): Order {
  return {
    ...order,
    status: 'CONFIRMED',
    courierId: undefined,
    failureReason: undefined,
    updatedAt: new Date().toISOString(),
    version: order.version + 1,
  };
}
