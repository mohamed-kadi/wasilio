import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardList, PackageCheck, PhoneCall, Truck } from 'lucide-react';
import {
  fetchAssignmentQueue,
  fetchConfirmationCallbacks,
  fetchConfirmationQueue,
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

  const queries = [
    confirmationQueueQuery,
    dueCallbacksQuery,
    assignmentQueueQuery,
    pickupQueueQuery,
    deliveryQueueQuery,
    deliveredQuery,
    failedQuery,
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
  const withCouriers = waitingPickup + outForDelivery;
  const courierWorkflow = awaitingAssignment + withCouriers;
  const activeWork = needsConfirmation + courierWorkflow + failed;
  const nextAction = getNextAction({
    dueCallbacks,
    failed,
    needsConfirmation,
    outForDelivery,
    waitingPickup,
    awaitingAssignment,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operations dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">
            {activeWork} active work items across confirmation, courier flow, and delivery exceptions
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

      <section className={`rounded-lg border p-5 ${nextActionTone(nextAction.tone)}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase">Go next</p>
            <h3 className="mt-2 text-xl font-bold text-gray-900">{nextAction.label}</h3>
            <p className="mt-1 max-w-2xl text-sm">{nextAction.detail}</p>
          </div>
          <Link
            to={nextAction.to}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
          >
            {nextAction.cta}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric
          title="Needs confirmation"
          value={needsConfirmation}
          detail={dueCallbacks > 0 ? `${dueCallbacks} due callbacks need attention` : 'New or waiting for customer call'}
          to="/app/confirmations"
          cta="Open confirmations"
          tone="blue"
          isLoading={isLoading}
          icon={<PhoneCall size={22} />}
        />
        <DashboardMetric
          title="Awaiting courier"
          value={awaitingAssignment}
          detail="Confirmed orders need courier assignment"
          to="/app/couriers/assignment"
          cta="Assign couriers"
          tone="amber"
          isLoading={isLoading}
          icon={<Truck size={22} />}
        />
        <DashboardMetric
          title="With couriers"
          value={withCouriers}
          detail={`${waitingPickup} waiting pickup, ${outForDelivery} out for delivery`}
          to={outForDelivery > 0 ? '/app/couriers/delivery' : '/app/couriers/pickup'}
          cta={outForDelivery > 0 ? 'Record delivery' : 'Open pickup queue'}
          tone="green"
          isLoading={isLoading}
          icon={<PackageCheck size={22} />}
        />
        <DashboardMetric
          title="Failed deliveries"
          value={failed}
          detail="Closed as failed and ready for review"
          to="/app/orders"
          cta="Review failures"
          tone="red"
          isLoading={isLoading}
          icon={<AlertCircle size={22} />}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-gray-100 p-2 text-gray-700">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Queue sequence</h3>
              <p className="text-sm text-gray-500">Move work from customer decision to courier outcome.</p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-gray-100">
            <QueueStep
              label="Confirm customers"
              value={needsConfirmation}
              detail="Created and requested orders"
              to="/app/confirmations"
            />
            <QueueStep
              label="Assign couriers"
              value={awaitingAssignment}
              detail="Confirmed orders without a courier"
              to="/app/couriers/assignment"
            />
            <QueueStep
              label="Confirm pickup"
              value={waitingPickup}
              detail="Assigned orders waiting physical pickup"
              to="/app/couriers/pickup"
            />
            <QueueStep
              label="Record delivery result"
              value={outForDelivery}
              detail="Picked up orders with couriers"
              to="/app/couriers/delivery"
            />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Closed outcomes</h3>
              <p className="text-sm text-gray-500">Delivery results recorded so far.</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
              <dt className="text-xs font-semibold uppercase text-gray-500">Delivered</dt>
              <dd className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? '...' : delivered}</dd>
            </div>
            <div className="rounded-md border border-red-100 bg-red-50 p-3">
              <dt className="text-xs font-semibold uppercase text-red-700">Failed</dt>
              <dd className="mt-2 text-2xl font-bold text-gray-900">{isLoading ? '...' : failed}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function getNextAction({
  dueCallbacks,
  failed,
  needsConfirmation,
  outForDelivery,
  waitingPickup,
  awaitingAssignment,
}: {
  dueCallbacks: number;
  failed: number;
  needsConfirmation: number;
  outForDelivery: number;
  waitingPickup: number;
  awaitingAssignment: number;
}): NextAction {
  if (dueCallbacks > 0) {
    return {
      label: 'Call due callbacks',
      detail: `${dueCallbacks} customer callbacks are due now. Start there before new confirmation work piles up.`,
      to: '/app/confirmations',
      cta: 'Open confirmations',
      tone: 'blue',
    };
  }

  if (failed > 0) {
    return {
      label: 'Review failed deliveries',
      detail: `${failed} delivery failures need follow-up, customer recovery, or courier performance review.`,
      to: '/app/orders',
      cta: 'Open orders',
      tone: 'red',
    };
  }

  if (needsConfirmation > 0) {
    return {
      label: 'Work the confirmation queue',
      detail: `${needsConfirmation} orders still need a customer decision before courier assignment.`,
      to: '/app/confirmations',
      cta: 'Open confirmations',
      tone: 'blue',
    };
  }

  if (outForDelivery > 0) {
    return {
      label: 'Record delivery outcomes',
      detail: `${outForDelivery} picked up orders are with couriers and waiting for delivered or failed outcomes.`,
      to: '/app/couriers/delivery',
      cta: 'Open delivery queue',
      tone: 'green',
    };
  }

  if (waitingPickup > 0) {
    return {
      label: 'Confirm courier pickups',
      detail: `${waitingPickup} assigned orders need pickup confirmation before delivery tracking can start.`,
      to: '/app/couriers/pickup',
      cta: 'Open pickup queue',
      tone: 'amber',
    };
  }

  if (awaitingAssignment > 0) {
    return {
      label: 'Assign couriers',
      detail: `${awaitingAssignment} confirmed orders are ready to hand off to active couriers.`,
      to: '/app/couriers/assignment',
      cta: 'Open assignment queue',
      tone: 'amber',
    };
  }

  return {
    label: 'Create or import the next order',
    detail: 'No active operational queues need attention right now.',
    to: '/app/orders/new',
    cta: 'Create order',
    tone: 'green',
  };
}

function DashboardMetric({
  title,
  value,
  detail,
  to,
  cta,
  tone,
  isLoading,
  icon,
}: {
  title: string;
  value: number;
  detail: string;
  to: string;
  cta: string;
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
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-md p-2 ${tones[tone]}`}>{icon}</div>
        <Link to={to} className="text-sm font-medium text-blue-600 hover:underline">
          {cta}
        </Link>
      </div>
      <p className="mt-4 text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{isLoading ? '...' : value}</p>
      <p className="mt-2 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

function QueueStep({ label, value, detail, to }: { label: string; value: number; detail: string; to: string }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-4 py-3 hover:bg-gray-50">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{detail}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-900">{value}</span>
        <ArrowRight size={16} className="text-gray-400" />
      </div>
    </Link>
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
