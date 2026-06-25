import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, ClipboardList, MessageSquare, PackageCheck, PhoneCall, Truck } from 'lucide-react';
import {
  type OrderStatus,
  fetchAssignmentQueue,
  fetchConfirmationCallbacks,
  fetchConfirmationQueue,
  fetchDeliveryFollowUpTasks,
  fetchDeliveryQueue,
  fetchOrders,
  fetchPickupQueue,
  getErrorMessage,
} from '../api/client';

interface NextAction {
  label: string;
  detail: string;
  to: string;
  cta: string;
  tone: 'red' | 'blue' | 'green' | 'amber';
  icon: ReactNode;
  state?: {
    statuses?: OrderStatus[];
    recoveryFocus?: boolean;
  };
}

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

  const failedQuery = useQuery({
    queryKey: ['orders-summary', 'failed'],
    queryFn: () => fetchOrders({ page: 0, size: 1, status: 'FAILED' }),
  });

  const openFollowUpsQuery = useQuery({
    queryKey: ['delivery-follow-ups', { page: 0, size: 1, status: 'OPEN' }],
    queryFn: () => fetchDeliveryFollowUpTasks({ page: 0, size: 1, status: 'OPEN' }),
  });

  const queries = [
    confirmationQueueQuery,
    dueCallbacksQuery,
    assignmentQueueQuery,
    pickupQueueQuery,
    deliveryQueueQuery,
    deliveredQuery,
    failedQuery,
    openFollowUpsQuery,
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
  const failed = failedQuery.data?.totalElements ?? 0;
  const openFollowUps = openFollowUpsQuery.data?.totalElements ?? 0;
  const withCouriers = waitingPickup + outForDelivery;
  const courierWorkflow = awaitingAssignment + withCouriers;
  const failedWithoutFollowUp = Math.max(0, failed - openFollowUps);
  const activeWork = needsConfirmation + courierWorkflow + failed;
  const nextAction = getNextAction({
    dueCallbacks,
    failed,
    needsConfirmation,
    openFollowUps,
    outForDelivery,
    waitingPickup,
    awaitingAssignment,
  });
  const recoveryTarget = openFollowUps > 0 ? '/app/delivery-follow-ups' : '/app/orders';
  const recoveryState: NextAction['state'] | undefined = openFollowUps > 0
    ? undefined
    : { statuses: ['FAILED'], recoveryFocus: true };
  const recoveryCta = openFollowUps > 0 ? 'Open follow-ups' : 'Review failed orders';
  const closedOutcomes = delivered + failed;
  const deliverySuccessRate = closedOutcomes > 0 ? Math.round((delivered / closedOutcomes) * 100) : 0;
  const priorityTone: NextAction['tone'] = isLoading ? 'blue' : nextAction.tone;

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
                <PriorityPill label="Open follow-ups" value={openFollowUps} isLoading={isLoading} />
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
          <LaneItem label="Due callbacks" value={dueCallbacks} isLoading={isLoading} highlight={dueCallbacks > 0} />
          <LaneItem label="Confirmation queue" value={needsConfirmation} isLoading={isLoading} />
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
          <LaneItem label="Needs courier" value={awaitingAssignment} isLoading={isLoading} />
          <LaneItem label="Waiting pickup" value={waitingPickup} isLoading={isLoading} />
          <LaneItem label="Out for delivery" value={outForDelivery} isLoading={isLoading} highlight={outForDelivery > 0} />
        </WorkloadLane>

        <WorkloadLane
          title="Failed recovery"
          value={failed}
          detail={openFollowUps > 0 ? `${openFollowUps} failures have active customer follow-up tasks.` : 'Failed orders need a retry, customer decision, or closure.'}
          to={recoveryTarget}
          state={recoveryState}
          cta={recoveryCta}
          tone="red"
          isLoading={isLoading}
          icon={<AlertCircle size={22} />}
        >
          <LaneItem label="Open follow-ups" value={openFollowUps} isLoading={isLoading} highlight={openFollowUps > 0} />
          <LaneItem label="Failed orders to review" value={failedWithoutFollowUp} isLoading={isLoading} />
        </WorkloadLane>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-gray-100 p-2 text-gray-700">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Operational map</h3>
              <p className="text-sm text-gray-500">Read left to right: confirm, hand off, deliver, then recover exceptions.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5">
            <FlowStep label="Confirm" value={needsConfirmation} to="/app/confirmations" isLoading={isLoading} />
            <FlowStep label="Assign" value={awaitingAssignment} to="/app/couriers/assignment" isLoading={isLoading} />
            <FlowStep label="Pickup" value={waitingPickup} to="/app/couriers/pickup" isLoading={isLoading} />
            <FlowStep label="Deliver" value={outForDelivery} to="/app/couriers/delivery" isLoading={isLoading} />
            <FlowStep label="Recover" value={openFollowUps || failed} to={recoveryTarget} state={recoveryState} isLoading={isLoading} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Delivery outcomes</h3>
              <p className="text-sm text-gray-500">Closed delivery results recorded so far.</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-3 gap-3">
            <OutcomeStat label="Delivered" value={delivered} isLoading={isLoading} />
            <OutcomeStat label="Failed" value={failed} isLoading={isLoading} tone="red" />
            <OutcomeStat label="Success" value={`${deliverySuccessRate}%`} isLoading={isLoading} />
          </dl>
          <Link
            to="/app/couriers/performance"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
          >
            Review courier performance
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function getNextAction({
  dueCallbacks,
  failed,
  needsConfirmation,
  openFollowUps,
  outForDelivery,
  waitingPickup,
  awaitingAssignment,
}: {
  dueCallbacks: number;
  failed: number;
  needsConfirmation: number;
  openFollowUps: number;
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

  if (failed > 0) {
    return {
      label: 'Review failed deliveries',
      detail: `${failed} delivery failures need follow-up, customer recovery, or courier performance review.`,
      to: '/app/orders',
      state: { statuses: ['FAILED'], recoveryFocus: true },
      cta: 'Open failed orders',
      tone: 'red',
      icon: <AlertCircle size={24} />,
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
}: {
  label: string;
  value: number;
  isLoading: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${highlight ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'}`}>
      <span>{label}</span>
      <span className="font-semibold text-gray-900">{isLoading ? '...' : value}</span>
    </div>
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

function FlowStep({
  label,
  value,
  to,
  state,
  isLoading,
}: {
  label: string;
  value: number;
  to: string;
  state?: {
    statuses?: OrderStatus[];
    recoveryFocus?: boolean;
  };
  isLoading: boolean;
}) {
  return (
    <Link
      to={to}
      state={state}
      className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-3 text-sm hover:border-blue-200 hover:bg-blue-50"
    >
      <span className="font-semibold text-gray-800">{label}</span>
      <span className="rounded-full bg-white px-2.5 py-1 font-bold text-gray-900">{isLoading ? '...' : value}</span>
    </Link>
  );
}

function OutcomeStat({
  label,
  value,
  isLoading,
  tone = 'green',
}: {
  label: string;
  value: number | string;
  isLoading: boolean;
  tone?: 'green' | 'red';
}) {
  const labelTone = tone === 'red' ? 'text-red-700' : 'text-gray-500';

  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
      <dt className={`text-xs font-semibold uppercase ${labelTone}`}>{label}</dt>
      <dd className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? '...' : value}</dd>
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
