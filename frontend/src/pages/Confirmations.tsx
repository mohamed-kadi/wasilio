import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  RefreshCw,
  Search,
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

const outcomeColors: Record<ConfirmationOutcome, string> = {
  CONFIRMED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  NO_ANSWER: 'bg-yellow-100 text-yellow-800',
  CALL_BACK_LATER: 'bg-blue-100 text-blue-800',
  WRONG_NUMBER: 'bg-orange-100 text-orange-800',
};

const callbackStatusColors: Record<ConfirmationCallbackStatus, string> = {
  DUE: 'bg-blue-100 text-blue-800',
  OVERDUE: 'bg-red-100 text-red-800',
  UPCOMING: 'bg-gray-100 text-gray-800',
  RESOLVED: 'bg-green-100 text-green-800',
};

export default function Confirmations() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [callbackPage, setCallbackPage] = useState(0);
  const [callbackScope, setCallbackScope] = useState<ConfirmationCallbackScope>('DUE');
  const [status, setStatus] = useState<(typeof queueStatuses)[number]>('');
  const [search, setSearch] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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
      if (selectedOrder) {
        await queryClient.invalidateQueries({ queryKey: ['confirmation-attempts', selectedOrder.id] });
        await queryClient.invalidateQueries({ queryKey: ['order', selectedOrder.id] });
      }
      await queryClient.invalidateQueries({ queryKey: ['confirmation-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['confirmation-callbacks'] });
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

  function resetFilters() {
    setSearch('');
    setStatus('');
    setCreatedFrom('');
    setCreatedTo('');
    setPage(0);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate();
  }

  function selectCallback(callback: ConfirmationCallback) {
    setSelectedOrder(callback.order);
    setOutcome('NO_ANSWER');
    setCallbackAt('');
    setNote(callback.note ?? '');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Confirmations</h2>
          <p className="text-sm text-gray-500">{totalElements} orders awaiting confirmation</p>
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

      <section className="bg-white border border-gray-200 rounded-lg px-4 py-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">Follow-up callbacks</h3>
              <p className="text-sm text-gray-500">
                {callbackTotalElements} {callbackScope.toLowerCase()} callbacks
                {callbacksFetching && !callbacksLoading ? ' - Refreshing' : ''}
              </p>
            </div>
          </div>
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
                {scope.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        {callbacksError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getErrorMessage(callbacksError)}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
          {callbacks.map((callback) => (
            <article key={callback.callbackId} className="rounded-md border border-gray-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {callback.order.customer.firstName} {callback.order.customer.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{callback.order.customer.phone}</p>
                </div>
                <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${callbackStatusColors[callback.status]}`}>
                  {callback.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-gray-700">{new Date(callback.callbackAt).toLocaleString()}</p>
              {callback.note && <p className="mt-2 text-sm text-gray-600 line-clamp-2">{callback.note}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => selectCallback(callback)}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Select
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
            <p className="text-sm text-gray-500">No callbacks in this view.</p>
          )}
          {callbacksLoading && <p className="text-sm text-gray-500">Loading callbacks...</p>}
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
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6">
        <section className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <label className="md:col-span-2">
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
                    placeholder="Name or phone"
                  />
                </div>
              </label>

              <label>
                <span className="block text-xs font-medium uppercase text-gray-500 mb-1">Status</span>
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
                      {statusOption ? statusOption.replace(/_/g, ' ') : 'All queue'}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="block text-xs font-medium uppercase text-gray-500 mb-1">From</span>
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
                <span className="block text-xs font-medium uppercase text-gray-500 mb-1">To</span>
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
                <span className="block text-xs font-medium uppercase text-gray-500 mb-1">Size</span>
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
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Clear filters
              </button>
            </div>
          </div>

          {queueError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {getErrorMessage(queueError)}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase">
                  <th className="p-4 font-medium">Order</th>
                  <th className="p-4 font-medium">Customer</th>
                  <th className="p-4 font-medium">Amount</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {orders.map((order) => {
                  const selected = selectedOrder?.id === order.id;
                  return (
                    <tr
                      key={order.id}
                      className={`cursor-pointer hover:bg-gray-50 ${selected ? 'bg-blue-50' : ''}`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="p-4 font-mono text-gray-600">{order.id.slice(0, 8)}...</td>
                      <td className="p-4">
                        <p className="font-medium text-gray-900">
                          {order.customer.firstName} {order.customer.lastName}
                        </p>
                        <p className="text-gray-500">{order.customer.phone}</p>
                      </td>
                      <td className="p-4 font-medium">{order.amount.toFixed(2)} MAD</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500">{new Date(order.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {!isLoading && orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No orders in the confirmation queue.
                    </td>
                  </tr>
                )}
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      Loading confirmation queue...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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

        <aside className="bg-white border border-gray-200 rounded-lg p-5 space-y-5 h-fit">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Attempt</h3>
          </div>

          {!selectedOrder && <p className="text-sm text-gray-500">Select an order to record a confirmation attempt.</p>}

          {selectedOrder && (
            <>
              <div className="rounded-md border border-gray-200 p-4">
                <p className="text-xs uppercase text-gray-500">Selected order</p>
                <p className="mt-1 font-mono text-sm text-gray-700">{selectedOrder.id}</p>
                <p className="mt-3 font-medium text-gray-900">
                  {selectedOrder.customer.firstName} {selectedOrder.customer.lastName}
                </p>
                <p className="text-sm text-gray-500">{selectedOrder.customer.phone}</p>
                <p className="mt-2 text-sm font-medium">{selectedOrder.amount.toFixed(2)} MAD</p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
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
                        {outcomeOption.replace(/_/g, ' ')}
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
                  <span className="block text-sm font-medium text-gray-700 mb-1">Note</span>
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {outcome === 'CONFIRMED' ? <CheckCircle2 size={18} /> : outcome === 'REJECTED' ? <XCircle size={18} /> : <PhoneCall size={18} />}
                  Record attempt
                </button>
              </form>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900">Attempts</h4>
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
                          {attempt.outcome.replace(/_/g, ' ')}
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
