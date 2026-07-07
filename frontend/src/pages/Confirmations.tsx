import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  fetchConfirmationCallbacks,
  fetchConfirmationAttempts,
  fetchConfirmationQueue,
  getErrorMessage,
  recordConfirmationAttempt,
  resolveConfirmationCallback,
} from '../api/client';
import { hasOrderLines, orderLineSummary, OrderLineSnapshots } from '../components/OrderLineSnapshots';
import type {
  ConfirmationAttempt,
  ConfirmationCallback,
  ConfirmationCallbackScope,
  ConfirmationCallbackStatus,
  ConfirmationOutcome,
  Order,
} from '../api/client';

const queueStatuses = ['', 'CREATED', 'CONFIRMATION_REQUESTED'] as const;
const callbackScopes: ConfirmationCallbackScope[] = ['DUE', 'OVERDUE', 'UPCOMING'];

const outcomes: ConfirmationOutcome[] = [
  'CONFIRMED',
  'REJECTED',
  'NO_ANSWER',
  'CALL_BACK_LATER',
  'WRONG_NUMBER',
];

const statusColors: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-800',
  CONFIRMATION_REQUESTED: 'bg-blue-100 text-blue-800',
};

const queueStatusLabels: Record<(typeof queueStatuses)[number], string> = {
  '': 'All open confirmation',
  CREATED: 'Not started',
  CONFIRMATION_REQUESTED: 'In follow-up',
};

const outcomeColors: Record<ConfirmationOutcome, string> = {
  CONFIRMED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  NO_ANSWER: 'bg-yellow-100 text-yellow-800',
  CALL_BACK_LATER: 'bg-blue-100 text-blue-800',
  WRONG_NUMBER: 'bg-orange-100 text-orange-800',
};

const outcomeLabels: Record<ConfirmationOutcome, string> = {
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  NO_ANSWER: 'No answer',
  CALL_BACK_LATER: 'Call back later',
  WRONG_NUMBER: 'Wrong number',
};

const outcomeDescriptions: Record<ConfirmationOutcome, string> = {
  CONFIRMED: 'Customer accepted the order. It can move toward courier assignment.',
  REJECTED: 'Customer refused or cancelled. The order leaves the confirmation queue.',
  NO_ANSWER: 'No decision yet. Record the attempt and keep the order in follow-up.',
  CALL_BACK_LATER: 'Customer asked for another call. Schedule the exact callback time.',
  WRONG_NUMBER: 'Phone number is invalid or belongs to the wrong person.',
};

const callbackStatusColors: Record<ConfirmationCallbackStatus, string> = {
  DUE: 'bg-blue-100 text-blue-800',
  OVERDUE: 'bg-red-100 text-red-800',
  UPCOMING: 'bg-gray-100 text-gray-800',
  RESOLVED: 'bg-green-100 text-green-800',
};

const callbackScopeLabels: Record<ConfirmationCallbackScope, string> = {
  DUE: 'Due now',
  OVERDUE: 'Overdue',
  UPCOMING: 'Upcoming',
  ALL: 'All callbacks',
};

interface ConfirmationLocationState {
  createdOrderId?: string;
}

function phoneHref(phone: string) {
  return `tel:${phone}`;
}

function whatsappHref(phone: string) {
  const normalized = phone.replace(/[^\d]/g, '');
  return normalized ? `https://wa.me/${normalized}` : undefined;
}

function customerName(order: Order) {
  return `${order.customer.firstName} ${order.customer.lastName}`.trim() || 'Unknown customer';
}

function shortOrderId(orderId: string) {
  return `${orderId.slice(0, 8)}...`;
}

export default function Confirmations() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationState = location.state as ConfirmationLocationState | null;
  const createdOrderId = typeof locationState?.createdOrderId === 'string' ? locationState.createdOrderId : undefined;
  const appliedCreatedOrderId = useRef<string | null>(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [callbackPage, setCallbackPage] = useState(0);
  const [callbackScope, setCallbackScope] = useState<ConfirmationCallbackScope>('DUE');
  const [status, setStatus] = useState<(typeof queueStatuses)[number]>('');
  const [search, setSearch] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirmedHandoffOrder, setConfirmedHandoffOrder] = useState<Order | null>(null);
  const [callbacksExpanded, setCallbacksExpanded] = useState(false);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [outcome, setOutcome] = useState<ConfirmationOutcome>('NO_ANSWER');
  const [callbackAt, setCallbackAt] = useState('');
  const [note, setNote] = useState('');

  const {
    data: queuePage,
    error: queueError,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['confirmation-queue', { page, size, status, search, createdFrom, createdTo }],
    queryFn: () => fetchConfirmationQueue({ page, size, status, search, createdFrom, createdTo }),
  });

  const {
    data: callbacksPage,
    error: callbacksError,
    isLoading: callbacksLoading,
    isFetching: callbacksFetching,
  } = useQuery({
    queryKey: ['confirmation-callbacks', { callbackPage, callbackScope }],
    queryFn: () => fetchConfirmationCallbacks({ page: callbackPage, size: 6, scope: callbackScope }),
  });

  const {
    data: attempts = [],
    error: attemptsError,
    isLoading: attemptsLoading,
  } = useQuery({
    queryKey: ['confirmation-attempts', selectedOrder?.id],
    queryFn: () => fetchConfirmationAttempts(selectedOrder!.id),
    enabled: !!selectedOrder,
  });

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedOrder) {
        throw new Error('Select an order before recording an attempt');
      }
      const scheduledCallbackAt = outcome === 'CALL_BACK_LATER' ? toIsoFromLocalDateTime(callbackAt) : undefined;
      if (outcome === 'CALL_BACK_LATER' && !scheduledCallbackAt) {
        throw new Error('Callback time is required for call-back-later attempts');
      }
      return recordConfirmationAttempt(selectedOrder.id, outcome, note, scheduledCallbackAt);
    },
    onSuccess: async (attempt) => {
      const attemptedOrder = selectedOrder;

      if (attempt.outcome === 'CONFIRMED' && attemptedOrder) {
        setConfirmedHandoffOrder(attemptedOrder);
      } else if (attempt.outcome === 'REJECTED') {
        setConfirmedHandoffOrder(null);
      }

      if (attemptedOrder) {
        await queryClient.invalidateQueries({ queryKey: ['confirmation-attempts', attemptedOrder.id] });
        await queryClient.invalidateQueries({ queryKey: ['order', attemptedOrder.id] });
      }
      await queryClient.invalidateQueries({ queryKey: ['confirmation-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['confirmation-callbacks'] });
      await queryClient.invalidateQueries({ queryKey: ['courier-assignment-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
      setNote('');
      setCallbackAt('');
      if (attempt.outcome === 'CONFIRMED' || attempt.outcome === 'REJECTED') {
        setSelectedOrder(null);
      }
    },
  });

  const resolveCallbackMutation = useMutation({
    mutationFn: (callbackId: string) => resolveConfirmationCallback(callbackId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['confirmation-callbacks'] });
      if (selectedOrder) {
        await queryClient.invalidateQueries({ queryKey: ['confirmation-attempts', selectedOrder.id] });
      }
    },
  });

  const orders = queuePage?.content ?? [];
  const totalPages = queuePage?.totalPages ?? 0;
  const totalElements = queuePage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const callbacks = callbacksPage?.content ?? [];
  const callbackTotalPages = callbacksPage?.totalPages ?? 0;
  const callbackTotalElements = callbacksPage?.totalElements ?? 0;
  const canGoBackCallbacks = callbackPage > 0;
  const canGoForwardCallbacks = callbackTotalPages > 0 && callbackPage + 1 < callbackTotalPages;
  const highlightedOrder = createdOrderId ? orders.find((order) => order.id === createdOrderId) : undefined;
  const visibleNotStarted = orders.filter((order) => order.status === 'CREATED').length;
  const visibleInFollowUp = orders.filter((order) => order.status === 'CONFIRMATION_REQUESTED').length;
  const selectedOrderLabel = selectedOrder ? customerName(selectedOrder) : 'None selected';

  useEffect(() => {
    if (!highlightedOrder || appliedCreatedOrderId.current === highlightedOrder.id) {
      return;
    }

    appliedCreatedOrderId.current = highlightedOrder.id;
    setSelectedOrder(highlightedOrder);
    setOutcome('NO_ANSWER');
    setCallbackAt('');
    setNote('');
  }, [highlightedOrder]);

  function resetFilters() {
    setSearch('');
    setStatus('');
    setCreatedFrom('');
    setCreatedTo('');
    setPage(0);
  }

  function selectOrder(order: Order) {
    setSelectedOrder(order);
    setConfirmedHandoffOrder(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  function selectCallback(callback: ConfirmationCallback) {
    setSelectedOrder(callback.order);
    setConfirmedHandoffOrder(null);
    setOutcome('NO_ANSWER');
    setCallbackAt('');
    setNote(callback.note ?? '');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Confirmation Ops</h2>
          <p className="text-sm text-gray-500">Call customers, record decisions, and schedule follow-ups.</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
          aria-label="Refresh queue"
          title="Refresh queue"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric
          label="Open queue"
          value={String(totalElements)}
          detail={isFetching && !isLoading ? 'Refreshing queue' : 'Awaiting customer decision'}
        />
        <SummaryMetric
          label="Not started"
          value={String(visibleNotStarted)}
          detail="Visible on this page"
        />
        <SummaryMetric
          label="In follow-up"
          value={String(visibleInFollowUp)}
          detail="Visible on this page"
        />
        <SummaryMetric
          label="Selected"
          value={selectedOrderLabel}
          detail={selectedOrder ? shortOrderId(selectedOrder.id) : 'Choose a queue row'}
        />
      </section>

      {createdOrderId && highlightedOrder && (
        <section className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-950">New order ready for confirmation</p>
              <p className="mt-1 text-sm text-blue-800">
                This order was just created from intake. It is selected in the action panel so the next step is to
                call the customer.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
              {highlightedOrder.id.slice(0, 8)}...
            </span>
          </div>
        </section>
      )}

      {createdOrderId && !highlightedOrder && !isLoading && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-950">New order is not visible in this queue view</p>
              <p className="mt-1 text-sm text-amber-800">
                Refresh the queue or clear filters to find the order created from intake.
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

      {confirmedHandoffOrder && (
        <section className="rounded-lg border border-green-200 bg-green-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-green-950">Order confirmed and moved to courier assignment</p>
              <p className="mt-1 text-sm text-green-800">
                {confirmedHandoffOrder.customer.firstName} {confirmedHandoffOrder.customer.lastName} is no longer in
                the confirmation queue. Assign a courier to start pickup.
              </p>
              <p className="mt-2 font-mono text-xs text-green-700">{confirmedHandoffOrder.id}</p>
            </div>
            <Link
              to="/app/couriers/assignment"
              state={{ confirmedOrderId: confirmedHandoffOrder.id }}
              className="inline-flex items-center gap-2 rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800"
            >
              <Truck size={16} />
              Open assignment queue
            </Link>
          </div>
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg px-4 py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">Follow-up callbacks</h3>
              <p className="text-sm text-gray-500">
                {callbackTotalElements} {callbackScopeLabels[callbackScope].toLowerCase()} callbacks
                {callbacksFetching && !callbacksLoading ? ' - Refreshing' : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={callbackScope}
              onChange={(event) => {
                setCallbackScope(event.target.value as ConfirmationCallbackScope);
                setCallbackPage(0);
              }}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {callbackScopes.map((scope) => (
                <option key={scope} value={scope}>
                  {callbackScopeLabels[scope]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCallbacksExpanded((expanded) => !expanded)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <ListChecks size={16} />
              {callbacksExpanded ? 'Hide callbacks' : 'Review callbacks'}
            </button>
          </div>
        </div>

        {callbacksError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getErrorMessage(callbacksError)}
          </div>
        )}

        {!callbacksExpanded && (
          <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">
              {callbackTotalElements === 0
                ? `No ${callbackScopeLabels[callbackScope].toLowerCase()} callbacks.`
                : `${callbackTotalElements} ${callbackScopeLabels[callbackScope].toLowerCase()} callbacks are available.`}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Keep the queue focused by opening callbacks only when working follow-up calls.
            </p>
          </div>
        )}

        {callbacksExpanded && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
              {callbacks.map((callback) => (
                <article key={callback.callbackId} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{customerName(callback.order)}</p>
                      <p className="text-sm text-gray-500">{callback.order.customer.phone}</p>
                      {orderLineSummary(callback.order.orderLines) && (
                        <p className="mt-1 text-sm font-medium text-gray-700">
                          {orderLineSummary(callback.order.orderLines)}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${callbackStatusColors[callback.status]}`}>
                      {callback.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-700">{new Date(callback.callbackAt).toLocaleString()}</p>
                  {callback.note && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{callback.note}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={phoneHref(callback.order.customer.phone)}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <PhoneCall size={14} />
                      Call
                    </a>
                    {whatsappHref(callback.order.customer.phone) && (
                      <a
                        href={whatsappHref(callback.order.customer.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-800 hover:bg-green-100"
                      >
                        <MessageCircle size={14} />
                        WhatsApp
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => selectCallback(callback)}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Open order
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveCallbackMutation.mutate(callback.callbackId)}
                      disabled={resolveCallbackMutation.isPending}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                </article>
              ))}
              {!callbacksLoading && callbacks.length === 0 && (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">No {callbackScopeLabels[callbackScope].toLowerCase()} callbacks.</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Scheduled follow-ups for this window will appear here when customers need another call.
                  </p>
                </div>
              )}
              {callbacksLoading && (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">Loading callbacks</p>
                  <p className="mt-1 text-sm text-gray-500">Checking scheduled follow-ups for this view.</p>
                </div>
              )}
            </div>

            {callbackTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Page {callbackTotalPages === 0 ? 0 : callbackPage + 1} of {callbackTotalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCallbackPage((currentPage) => currentPage - 1)}
                    disabled={!canGoBackCallbacks}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    aria-label="Previous callback page"
                    title="Previous callback page"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCallbackPage((currentPage) => currentPage + 1)}
                    disabled={!canGoForwardCallbacks}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    aria-label="Next callback page"
                    title="Next callback page"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {resolveCallbackMutation.error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {getErrorMessage(resolveCallbackMutation.error)}
              </div>
            )}
          </>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <section className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Confirmation queue</h3>
                <p className="text-sm text-gray-500">{totalElements} orders awaiting a customer decision</p>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedFiltersOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <SlidersHorizontal size={16} />
                {advancedFiltersOpen ? 'Hide advanced filters' : 'Advanced filters'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_16rem_auto]">
              <label>
                <span className="block text-xs font-medium uppercase text-gray-500 mb-1">Search</span>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                    className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Customer, phone, or order ID"
                  />
                </div>
              </label>

              <label>
                <span className="block text-xs font-medium uppercase text-gray-500 mb-1">Queue status</span>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as (typeof queueStatuses)[number]);
                    setPage(0);
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {queueStatuses.map((statusOption) => (
                    <option key={statusOption || 'ALL'} value={statusOption}>
                      {queueStatusLabels[statusOption]}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={resetFilters}
                className="self-end rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Clear filters
              </button>
            </div>

            {advancedFiltersOpen && (
              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 md:grid-cols-3">
                <label>
                  <span className="block text-xs font-medium uppercase text-gray-500 mb-1">Created from</span>
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
                  <span className="block text-xs font-medium uppercase text-gray-500 mb-1">Created to</span>
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
                  <span className="block text-xs font-medium uppercase text-gray-500 mb-1">Rows per page</span>
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
              </div>
            )}
          </div>

          {queueError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {getErrorMessage(queueError)}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                    <th className="p-4 font-medium">Order</th>
                    <th className="p-4 font-medium">Customer</th>
                    <th className="p-4 font-medium">Products</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Next action</th>
                    <th className="p-4 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {orders.map((order) => {
                    const selected = selectedOrder?.id === order.id;
                    const highlighted = createdOrderId === order.id;
                    const productSummary = orderLineSummary(order.orderLines);
                    return (
                      <tr
                        key={order.id}
                        className={`cursor-pointer hover:bg-gray-50 ${selected || highlighted ? 'bg-blue-50' : ''}`}
                        onClick={() => selectOrder(order)}
                      >
                        <td className="p-4">
                          <p className="font-mono text-gray-600">{shortOrderId(order.id)}</p>
                          {highlighted && (
                            <span className="mt-2 inline-flex rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                              Start here
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="font-medium text-gray-900">{customerName(order)}</p>
                          <p className="text-gray-500">{order.customer.phone}</p>
                        </td>
                        <td className="p-4">
                          {productSummary ? (
                            <span className="text-sm font-medium text-gray-800">{productSummary}</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="p-4 font-medium">{order.amount.toFixed(2)} MAD</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                            {queueStatusLabels[order.status as (typeof queueStatuses)[number]] ?? order.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-gray-700">
                          {order.status === 'CREATED' ? 'Call customer' : 'Record follow-up attempt'}
                        </td>
                        <td className="p-4 text-gray-500">{new Date(order.createdAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                  {!isLoading && orders.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        <div className="mx-auto max-w-sm">
                          <p className="text-sm font-medium text-gray-900">No orders waiting for confirmation.</p>
                          <p className="mt-1 text-sm text-gray-500">
                            Create a COD order or clear the filters to check the full queue.
                          </p>
                          <div className="mt-4 flex flex-wrap justify-center gap-2">
                            <Link
                              to="/app/orders/new"
                              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                            >
                              Create COD order
                            </Link>
                            <button
                              type="button"
                              onClick={resetFilters}
                              className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                            >
                              Clear filters
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isLoading && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        <p className="text-sm font-medium text-gray-900">Loading confirmation queue</p>
                        <p className="mt-1 text-sm text-gray-500">
                          Fetching orders that still need a customer decision.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
              {isFetching && !isLoading ? ' - Refreshing' : ''}
            </p>
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
        </section>

        <aside className="bg-white border border-gray-200 rounded-lg p-5 space-y-5 h-fit xl:sticky xl:top-6">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Call workspace</h3>
          </div>

          {!selectedOrder && (
            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">No order selected.</p>
              <p className="mt-1 text-sm text-gray-500">
                Choose a row from the queue to open customer contact and decision controls.
              </p>
            </div>
          )}

          {selectedOrder && (
            <>
              <div className="rounded-md border border-gray-200 p-4">
                <p className="text-xs uppercase text-gray-500">Selected order</p>
                <p className="mt-1 font-mono text-sm text-gray-700">{shortOrderId(selectedOrder.id)}</p>
                <p className="mt-3 font-medium text-gray-900">{customerName(selectedOrder)}</p>
                <p className="text-sm text-gray-500">{selectedOrder.customer.phone}</p>
                <p className="mt-2 text-sm font-medium">{selectedOrder.amount.toFixed(2)} MAD</p>
                <p className="mt-2 text-sm text-gray-500">
                  {selectedOrder.address.city}, {selectedOrder.address.country}
                </p>
                {hasOrderLines(selectedOrder.orderLines) && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase text-gray-500">Product snapshot</p>
                      <p className="text-xs font-medium text-gray-500">
                        {selectedOrder.orderLines?.length} {selectedOrder.orderLines?.length === 1 ? 'line' : 'lines'}
                      </p>
                    </div>
                    <OrderLineSnapshots orderLines={selectedOrder.orderLines} compact className="mt-3" />
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={phoneHref(selectedOrder.customer.phone)}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <PhoneCall size={16} />
                    Call customer
                  </a>
                  {whatsappHref(selectedOrder.customer.phone) && (
                    <a
                      href={whatsappHref(selectedOrder.customer.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100"
                    >
                      <MessageCircle size={16} />
                      WhatsApp
                    </a>
                  )}
                  <Link
                    to={`/app/orders/${selectedOrder.id}`}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    View details
                  </Link>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                  <p className="text-xs font-semibold uppercase text-blue-700">Selected outcome</p>
                  <p className="mt-1 text-sm font-medium text-blue-950">{outcomeLabels[outcome]}</p>
                  <p className="mt-1 text-sm text-blue-800">{outcomeDescriptions[outcome]}</p>
                </div>

                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Outcome</span>
                  <select
                    value={outcome}
                    onChange={(event) => {
                      const nextOutcome = event.target.value as ConfirmationOutcome;
                      setOutcome(nextOutcome);
                      if (nextOutcome !== 'CALL_BACK_LATER') {
                        setCallbackAt('');
                      }
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {outcomes.map((outcomeOption) => (
                      <option key={outcomeOption} value={outcomeOption}>
                        {outcomeLabels[outcomeOption]}
                      </option>
                    ))}
                  </select>
                </label>

                {outcome === 'CALL_BACK_LATER' && (
                  <label className="block">
                    <span className="block text-sm font-medium text-gray-700 mb-1">Callback time</span>
                    <input
                      type="datetime-local"
                      value={callbackAt}
                      min={toLocalDateTimeInputValue(new Date())}
                      onChange={(event) => setCallbackAt(event.target.value)}
                      required
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                )}

                <label className="block">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Call note</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={1000}
                    rows={4}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>

                {mutation.error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {getErrorMessage(mutation.error)}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                    outcome === 'CONFIRMED'
                      ? 'bg-green-700 hover:bg-green-800'
                      : outcome === 'REJECTED'
                        ? 'bg-red-700 hover:bg-red-800'
                        : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {outcome === 'CONFIRMED' ? <CheckCircle2 size={18} /> : outcome === 'REJECTED' ? <XCircle size={18} /> : <PhoneCall size={18} />}
                  Save: {outcomeLabels[outcome]}
                </button>
              </form>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900">Call history</h4>
                {attemptsError && (
                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {getErrorMessage(attemptsError)}
                  </div>
                )}
                <div className="mt-3 space-y-3">
                  {attempts.map((attempt) => (
                    <div key={attempt.attemptId} className="rounded-md border border-gray-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-gray-900">#{attempt.attemptNumber}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${outcomeColors[attempt.outcome]}`}>
                          {outcomeLabels[attempt.outcome]}
                        </span>
                      </div>
                      {attempt.note && <p className="mt-2 text-sm text-gray-700">{attempt.note}</p>}
                      {attempt.callbackAt && (
                        <div className="mt-2 rounded-md bg-gray-50 px-2 py-2 text-xs text-gray-600">
                          <div className="flex items-center justify-between gap-2">
                            <span>{new Date(attempt.callbackAt).toLocaleString()}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium ${
                                callbackStatusColors[getAttemptCallbackStatus(attempt)]
                              }`}
                            >
                              {getAttemptCallbackStatus(attempt)}
                            </span>
                          </div>
                          {attempt.callbackResolvedAt && (
                            <p className="mt-1">
                              Resolved by {attempt.callbackResolvedBy} -{' '}
                              {new Date(attempt.callbackResolvedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-gray-500">
                        {attempt.createdBy} - {new Date(attempt.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  {!attemptsLoading && attempts.length === 0 && (
                    <p className="text-sm text-gray-500">No attempts recorded yet.</p>
                  )}
                  {attemptsLoading && <p className="text-sm text-gray-500">Loading attempts...</p>}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
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

function getAttemptCallbackStatus(attempt: ConfirmationAttempt): ConfirmationCallbackStatus {
  if (attempt.callbackResolvedAt) {
    return 'RESOLVED';
  }
  if (!attempt.callbackAt) {
    return 'UPCOMING';
  }
  const callbackDate = new Date(attempt.callbackAt);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (callbackDate < todayStart) {
    return 'OVERDUE';
  }
  return callbackDate <= new Date() ? 'DUE' : 'UPCOMING';
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
