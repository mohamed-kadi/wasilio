import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, BarChart3, CheckCircle2, Clock, Inbox, MessageSquare, PackageCheck, PhoneCall, Truck } from 'lucide-react';
import {
  type DeliveryFailureRecoveryState,
  type OrderSource,
  type OrderStatus,
  fetchAssignmentQueue,
  fetchConfirmationCallbacks,
  fetchConfirmationQueue,
  fetchDeliveryQueue,
  fetchFailedOrderRecoveryQueue,
  fetchInboundOrderSummary,
  fetchOrders,
  fetchPickupQueue,
  getErrorMessage,
} from '../api/client';

type OrdersNavigationState = {
  statuses?: OrderStatus[];
  recoveryFocus?: boolean;
  failureRecoveryFilter?: DeliveryFailureRecoveryState;
};

interface NextAction {
  label: string;
  detail: string;
  to: string;
  cta: string;
  tone: 'red' | 'blue' | 'green' | 'amber';
  icon: ReactNode;
  state?: OrdersNavigationState;
}

const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  MANUAL: 'Manual',
  WASILIO_STOREFRONT: 'Wasilio storefront',
  CUSTOM_API: 'Custom API',
  CSV_IMPORT: 'CSV import',
  YOUCAN: 'YouCan',
  SHOPIFY: 'Shopify',
  WOOCOMMERCE: 'WooCommerce',
  WHATSAPP: 'WhatsApp',
  FACEBOOK_LEAD_FORM: 'Facebook lead form',
};

export default function Dashboard() {
  const confirmationQueueQuery = useQuery({
    queryKey: ['confirmation-queue', { page: 0, size: 1 }],
    queryFn: () => fetchConfirmationQueue({ page: 0, size: 1 }),
  });

  const dueCallbacksQuery = useQuery({
    queryKey: ['confirmation-callbacks', { page: 0, size: 1, scope: 'DUE' }],
    queryFn: () => fetchConfirmationCallbacks({ page: 0, size: 1, scope: 'DUE' }),
  });

  const assignmentQueueQuery = useQuery({
    queryKey: ['courier-assignment-queue', { page: 0, size: 1 }],
    queryFn: () => fetchAssignmentQueue({ page: 0, size: 1 }),
  });

  const pickupQueueQuery = useQuery({
    queryKey: ['courier-pickup-queue', { page: 0, size: 1 }],
    queryFn: () => fetchPickupQueue({ page: 0, size: 1 }),
  });

  const deliveryQueueQuery = useQuery({
    queryKey: ['courier-delivery-queue', { page: 0, size: 1 }],
    queryFn: () => fetchDeliveryQueue({ page: 0, size: 1 }),
  });

  const deliveredQuery = useQuery({
    queryKey: ['orders-summary', 'delivered'],
    queryFn: () => fetchOrders({ page: 0, size: 1, status: 'DELIVERED' }),
  });

  const failedRecoveryQueueQuery = useQuery({
    queryKey: ['failed-order-recovery-queue', { page: 0, size: 1, state: 'ALL' }],
    queryFn: () => fetchFailedOrderRecoveryQueue({ page: 0, size: 1, state: 'ALL' }),
  });

  const inboundSummaryQuery = useQuery({
    queryKey: ['inbound-orders-summary'],
    queryFn: fetchInboundOrderSummary,
  });

  const queries = [
    confirmationQueueQuery,
    dueCallbacksQuery,
    assignmentQueueQuery,
    pickupQueueQuery,
    deliveryQueueQuery,
    deliveredQuery,
    failedRecoveryQueueQuery,
    inboundSummaryQuery,
  ];
  const isLoading = queries.some((query) => query.isLoading);
  const isFetching = queries.some((query) => query.isFetching);
  const error = queries.find((query) => query.error)?.error;

  const needsConfirmation = confirmationQueueQuery.data?.totalElements ?? 0;
  const dueCallbacks = dueCallbacksQuery.data?.totalElements ?? 0;
  const awaitingAssignment = assignmentQueueQuery.data?.totalElements ?? 0;
  const waitingPickup = pickupQueueQuery.data?.totalElements ?? 0;
  const outForDelivery = deliveryQueueQuery.data?.totalElements ?? 0;
  const delivered = deliveredQuery.data?.totalElements ?? 0;
  const recoveryCounts = failedRecoveryQueueQuery.data?.counts;
  const failed = recoveryCounts?.all ?? 0;
  const needsRecoveryDecision = recoveryCounts?.needsDecision ?? 0;
  const openFollowUps = recoveryCounts?.openFollowUp ?? 0;
  const retryReady = recoveryCounts?.retryReady ?? 0;
  const refundReview = recoveryCounts?.refundReview ?? 0;
  const closedUnrecoverable = recoveryCounts?.closedUnrecoverable ?? 0;
  const withCouriers = waitingPickup + outForDelivery;
  const courierWorkflow = awaitingAssignment + withCouriers;
  const activeFailedRecovery = Math.max(0, failed - closedUnrecoverable);
  const activeWork = needsConfirmation + courierWorkflow + activeFailedRecovery;
  const nextAction = getNextAction({
    dueCallbacks,
    needsConfirmation,
    needsRecoveryDecision,
    openFollowUps,
    refundReview,
    retryReady,
    outForDelivery,
    waitingPickup,
    awaitingAssignment,
  });
  const nextRecoveryFilter = needsRecoveryDecision > 0
    ? 'NEEDS_DECISION'
    : retryReady > 0
      ? 'RETRY_READY'
      : refundReview > 0
        ? 'REFUND_REVIEW'
        : 'ALL';
  const recoveryTarget = openFollowUps > 0 ? '/app/delivery-follow-ups' : '/app/orders';
  const recoveryState: NextAction['state'] | undefined = openFollowUps > 0 ? undefined : recoveryOrdersState(nextRecoveryFilter);
  const recoveryCta = openFollowUps > 0 ? 'Open follow-ups' : 'Review failed orders';
  const closedOutcomes = delivered + failed;
  const deliverySuccessRate = closedOutcomes > 0 ? Math.round((delivered / closedOutcomes) * 100) : 0;
  const priorityTone: NextAction['tone'] = isLoading ? 'blue' : nextAction.tone;
  const inboundSummary = inboundSummaryQuery.data;
  const rejectedInboundCount = inboundSummary?.rejectedCount ?? 0;
  const normalizedTodayCount = inboundSummary?.normalizedTodayCount ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Operations command center</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Operations dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isLoading ? 'Loading live queue totals' : `${activeWork} active orders need confirmation, courier movement, or recovery`}
            {isFetching && !isLoading ? ' - Refreshing' : ''}
          </p>
        </div>
        <Link
          to="/app/orders/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create order
          <ArrowRight size={16} />
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      <section className={`rounded-lg border p-5 ${nextActionTone(priorityTone)}`} aria-label="Next dashboard action">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/70 sm:flex">
              {isLoading ? <Clock size={24} /> : nextAction.icon}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase">Work this next</p>
              <h3 className="mt-2 text-xl font-bold text-gray-900">{isLoading ? 'Loading priorities' : nextAction.label}</h3>
              <p className="mt-1 max-w-2xl text-sm">{isLoading ? 'Checking the current queues before choosing the next operational step.' : nextAction.detail}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <PriorityPill label="Confirmation" value={needsConfirmation} isLoading={isLoading} />
                <PriorityPill label="With couriers" value={withCouriers} isLoading={isLoading} />
                <PriorityPill label="Failed recovery" value={activeFailedRecovery} isLoading={isLoading} />
              </div>
            </div>
          </div>
          {isLoading ? (
            <span className="inline-flex items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-500 shadow-sm">
              Loading queues
            </span>
          ) : (
            <Link
              to={nextAction.to}
              state={nextAction.state}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
            >
              {nextAction.cta}
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5" aria-label="Operations workflow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Operations workflow</p>
            <h3 className="mt-1 text-lg font-semibold text-gray-900">Confirmation to performance</h3>
          </div>
          <Link
            to="/app/couriers/performance"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
          >
            Courier performance
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <WorkflowStageCard
            step="01"
            title="Confirmation"
            value={needsConfirmation}
            detail={`${dueCallbacks} due callbacks`}
            to="/app/confirmations"
            tone="blue"
            isLoading={isLoading}
            icon={<PhoneCall size={18} />}
          />
          <WorkflowStageCard
            step="02"
            title="Assignment"
            value={awaitingAssignment}
            detail="Confirmed orders"
            to="/app/couriers/assignment"
            tone="amber"
            isLoading={isLoading}
            icon={<Truck size={18} />}
          />
          <WorkflowStageCard
            step="03"
            title="Pickup"
            value={waitingPickup}
            detail="Assigned packages"
            to="/app/couriers/pickup"
            tone="amber"
            isLoading={isLoading}
            icon={<PackageCheck size={18} />}
          />
          <WorkflowStageCard
            step="04"
            title="Delivery"
            value={outForDelivery}
            detail="Awaiting outcome"
            to="/app/couriers/delivery"
            tone="green"
            isLoading={isLoading}
            icon={<Truck size={18} />}
          />
          <WorkflowStageCard
            step="05"
            title="Recovery"
            value={activeFailedRecovery}
            detail={`${retryReady} retry ready`}
            to={recoveryTarget}
            state={recoveryState}
            tone="red"
            isLoading={isLoading}
            icon={<AlertCircle size={18} />}
          />
          <WorkflowStageCard
            step="06"
            title="Performance"
            value={`${deliverySuccessRate}%`}
            detail={`${delivered} delivered / ${failed} failed`}
            to="/app/couriers/performance"
            tone="green"
            isLoading={isLoading}
            icon={<BarChart3 size={18} />}
          />
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5" aria-label="Ingestion health">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <Inbox size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-blue-700">Ingestion health</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">Inbound order intake</h3>
              <p className="mt-1 text-sm text-gray-500">Watch rejected source payloads before they disappear from daily operations.</p>
            </div>
          </div>
          <Link
            to="/app/inbound-orders?status=REJECTED"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
          >
            View rejected inbound orders
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <IngestionMetric
            title="Rejected inbound"
            value={rejectedInboundCount}
            detail="Last 24 hours"
            tone={rejectedInboundCount > 0 ? 'red' : 'gray'}
            isLoading={inboundSummaryQuery.isLoading}
          />
          <IngestionMetric
            title="Normalized today"
            value={normalizedTodayCount}
            detail="Created Wasilio orders today"
            tone="green"
            isLoading={inboundSummaryQuery.isLoading}
          />
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Latest rejected source</p>
            {inboundSummaryQuery.isLoading ? (
              <p className="mt-2 text-2xl font-bold text-gray-900">...</p>
            ) : inboundSummary?.latestRejectedSource ? (
              <>
                <p className="mt-2 text-xl font-bold text-gray-900">{sourceLabel(inboundSummary.latestRejectedSource)}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {inboundSummary.latestRejectedAt ? formatDateTime(inboundSummary.latestRejectedAt) : 'No timestamp recorded'}
                </p>
                {inboundSummary.latestRejectedReason && (
                  <p className="mt-2 line-clamp-2 text-sm text-red-700">{inboundSummary.latestRejectedReason}</p>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-xl font-bold text-gray-900">None</p>
                <p className="mt-1 text-sm text-gray-500">No rejected inbound orders recorded.</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3" aria-label="Operational workload lanes">
        <WorkloadLane
          title="Needs confirmation"
          value={needsConfirmation}
          detail={dueCallbacks > 0 ? `${dueCallbacks} due callbacks should be handled first.` : 'New orders are waiting for a customer decision.'}
          to="/app/confirmations"
          cta="Open confirmations"
          tone="blue"
          isLoading={isLoading}
          icon={<PhoneCall size={22} />}
        >
          <LaneItem label="Due callbacks" value={dueCallbacks} isLoading={isLoading} highlight={dueCallbacks > 0} to="/app/confirmations" />
          <LaneItem label="Confirmation queue" value={needsConfirmation} isLoading={isLoading} to="/app/confirmations" />
        </WorkloadLane>

        <WorkloadLane
          title="Courier movement"
          value={courierWorkflow}
          detail={`${awaitingAssignment} need assignment. ${withCouriers} are already with couriers.`}
          to={awaitingAssignment > 0 ? '/app/couriers/assignment' : outForDelivery > 0 ? '/app/couriers/delivery' : '/app/couriers/pickup'}
          cta={awaitingAssignment > 0 ? 'Assign couriers' : outForDelivery > 0 ? 'Record delivery' : 'Open pickup queue'}
          tone="amber"
          isLoading={isLoading}
          icon={<Truck size={22} />}
        >
          <LaneItem label="Needs courier" value={awaitingAssignment} isLoading={isLoading} to="/app/couriers/assignment" />
          <LaneItem label="Waiting pickup" value={waitingPickup} isLoading={isLoading} to="/app/couriers/pickup" />
          <LaneItem label="Out for delivery" value={outForDelivery} isLoading={isLoading} highlight={outForDelivery > 0} to="/app/couriers/delivery" />
        </WorkloadLane>

        <WorkloadLane
          title="Failed recovery"
          value={activeFailedRecovery}
          detail={activeFailedRecovery > 0
            ? `${activeFailedRecovery} failed deliveries need a decision, follow-up, retry, or refund review.`
            : failed > 0
              ? `${closedUnrecoverable} failed deliveries are closed as unrecoverable.`
              : 'No failed deliveries need recovery right now.'}
          to={recoveryTarget}
          state={recoveryState}
          cta={recoveryCta}
          tone="red"
          isLoading={isLoading}
          icon={<AlertCircle size={22} />}
        >
          <LaneItem label="Needs decision" value={needsRecoveryDecision} isLoading={isLoading} highlight={needsRecoveryDecision > 0} to="/app/orders" state={recoveryOrdersState('NEEDS_DECISION')} />
          <LaneItem label="Open follow-ups" value={openFollowUps} isLoading={isLoading} highlight={openFollowUps > 0} to="/app/delivery-follow-ups" />
          <LaneItem label="Retry ready" value={retryReady} isLoading={isLoading} highlight={retryReady > 0} to="/app/orders" state={recoveryOrdersState('RETRY_READY')} />
          <LaneItem label="Refund review" value={refundReview} isLoading={isLoading} to="/app/orders" state={recoveryOrdersState('REFUND_REVIEW')} />
        </WorkloadLane>
      </section>

    </div>
  );
}

function getNextAction({
  dueCallbacks,
  needsConfirmation,
  needsRecoveryDecision,
  openFollowUps,
  refundReview,
  retryReady,
  outForDelivery,
  waitingPickup,
  awaitingAssignment,
}: {
  dueCallbacks: number;
  needsConfirmation: number;
  needsRecoveryDecision: number;
  openFollowUps: number;
  refundReview: number;
  retryReady: number;
  outForDelivery: number;
  waitingPickup: number;
  awaitingAssignment: number;
}): NextAction {
  if (dueCallbacks > 0) {
    return {
      label: 'Call due callbacks',
      detail: `${dueCallbacks} customer callbacks are due now. Clear these before starting new confirmation work.`,
      to: '/app/confirmations',
      cta: 'Open confirmations',
      tone: 'blue',
      icon: <Clock size={24} />,
    };
  }

  if (openFollowUps > 0) {
    return {
      label: 'Resolve failed-delivery follow-ups',
      detail: `${openFollowUps} failed deliveries are waiting for refund, replacement, or customer contact decisions.`,
      to: '/app/delivery-follow-ups',
      cta: 'Open recovery queue',
      tone: 'red',
      icon: <MessageSquare size={24} />,
    };
  }

  if (needsRecoveryDecision > 0) {
    return {
      label: 'Record failed-delivery decisions',
      detail: `${needsRecoveryDecision} failed deliveries do not have a recovery path yet. Choose retry, follow-up, or close as unrecoverable.`,
      to: '/app/orders',
      state: recoveryOrdersState('NEEDS_DECISION'),
      cta: 'Open decisions',
      tone: 'red',
      icon: <AlertCircle size={24} />,
    };
  }

  if (retryReady > 0) {
    return {
      label: 'Move retry-ready orders',
      detail: `${retryReady} failed deliveries are ready to return to courier assignment.`,
      to: '/app/orders',
      state: recoveryOrdersState('RETRY_READY'),
      cta: 'Open retry-ready',
      tone: 'red',
      icon: <AlertCircle size={24} />,
    };
  }

  if (refundReview > 0) {
    return {
      label: 'Review refund follow-ups',
      detail: `${refundReview} failed deliveries have a refund or customer follow-up decision recorded.`,
      to: '/app/orders',
      state: recoveryOrdersState('REFUND_REVIEW'),
      cta: 'Open refund review',
      tone: 'red',
      icon: <MessageSquare size={24} />,
    };
  }

  if (needsConfirmation > 0) {
    return {
      label: 'Work the confirmation queue',
      detail: `${needsConfirmation} orders still need a customer decision before courier assignment.`,
      to: '/app/confirmations',
      cta: 'Open confirmations',
      tone: 'blue',
      icon: <PhoneCall size={24} />,
    };
  }

  if (outForDelivery > 0) {
    return {
      label: 'Record delivery outcomes',
      detail: `${outForDelivery} picked up orders are with couriers and waiting for delivered or failed outcomes.`,
      to: '/app/couriers/delivery',
      cta: 'Open delivery queue',
      tone: 'green',
      icon: <PackageCheck size={24} />,
    };
  }

  if (waitingPickup > 0) {
    return {
      label: 'Confirm courier pickups',
      detail: `${waitingPickup} assigned orders need pickup confirmation before delivery tracking can start.`,
      to: '/app/couriers/pickup',
      cta: 'Open pickup queue',
      tone: 'amber',
      icon: <Truck size={24} />,
    };
  }

  if (awaitingAssignment > 0) {
    return {
      label: 'Assign couriers',
      detail: `${awaitingAssignment} confirmed orders are ready to hand off to active couriers.`,
      to: '/app/couriers/assignment',
      cta: 'Open assignment queue',
      tone: 'amber',
      icon: <Truck size={24} />,
    };
  }

  return {
    label: 'Create or import the next order',
    detail: 'No active operational queues need attention right now.',
    to: '/app/orders/new',
    cta: 'Create order',
    tone: 'green',
    icon: <CheckCircle2 size={24} />,
  };
}

function WorkloadLane({
  title,
  value,
  detail,
  to,
  state,
  cta,
  tone,
  isLoading,
  icon,
  children,
}: {
  title: string;
  value: number;
  detail: string;
  to: string;
  state?: {
    statuses?: OrderStatus[];
    recoveryFocus?: boolean;
    failureRecoveryFilter?: DeliveryFailureRecoveryState;
  };
  cta: string;
  tone: 'blue' | 'amber' | 'green' | 'red';
  isLoading: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-md p-2 ${tones[tone]}`}>{icon}</div>
        <Link to={to} state={state} className="text-sm font-semibold text-blue-700 hover:underline">
          {cta}
        </Link>
      </div>
      <p className="mt-4 text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{isLoading ? '...' : value}</p>
      <p className="mt-2 min-h-10 text-sm text-gray-600">{isLoading ? 'Loading current queue totals.' : detail}</p>
      <div className="mt-4 space-y-2">{children}</div>
    </div>
  );
}

function LaneItem({
  label,
  value,
  isLoading,
  highlight = false,
  to,
  state,
}: {
  label: string;
  value: number;
  isLoading: boolean;
  highlight?: boolean;
  to?: string;
  state?: OrdersNavigationState;
}) {
  const className = `flex items-center justify-between rounded-md px-3 py-2 text-sm ${
    highlight ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'
  } ${to ? 'hover:bg-white hover:ring-1 hover:ring-blue-100' : ''}`;
  const content = (
    <>
      <span>{label}</span>
      <span className="font-semibold text-gray-900">{isLoading ? '...' : value}</span>
    </>
  );

  return to ? (
    <Link to={to} state={state} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function PriorityPill({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-gray-800">
      {label}
      <span className="text-gray-950">{isLoading ? '...' : value}</span>
    </span>
  );
}

function WorkflowStageCard({
  step,
  title,
  value,
  detail,
  to,
  state,
  tone,
  isLoading,
  icon,
}: {
  step: string;
  title: string;
  value: number | string;
  detail: string;
  to: string;
  state?: OrdersNavigationState;
  tone: 'blue' | 'amber' | 'green' | 'red';
  isLoading: boolean;
  icon: ReactNode;
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <Link
      to={to}
      state={state}
      className="min-w-0 rounded-md border border-gray-200 bg-gray-50 p-4 hover:border-blue-200 hover:bg-blue-50"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase text-gray-500">{step}</span>
        <span className={`rounded-md border p-1.5 ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-4 text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-950">{isLoading ? '...' : value}</p>
      <p className="mt-1 truncate text-xs text-gray-500">{isLoading ? 'Loading' : detail}</p>
    </Link>
  );
}

function IngestionMetric({
  title,
  value,
  detail,
  tone,
  isLoading,
}: {
  title: string;
  value: number;
  detail: string;
  tone: 'red' | 'green' | 'gray';
  isLoading: boolean;
}) {
  const tones = {
    red: 'border-red-200 bg-red-50 text-red-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-600',
  };

  return (
    <div className={`rounded-md border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? '...' : value}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}

function nextActionTone(tone: NextAction['tone']) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-red-200 bg-red-50 text-red-900',
  };
  return tones[tone];
}

function recoveryOrdersState(failureRecoveryFilter: DeliveryFailureRecoveryState = 'ALL'): OrdersNavigationState {
  return {
    statuses: ['FAILED'],
    recoveryFocus: true,
    failureRecoveryFilter,
  };
}

function sourceLabel(source: OrderSource) {
  return ORDER_SOURCE_LABELS[source] ?? source;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
