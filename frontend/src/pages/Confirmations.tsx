import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, PhoneCall, RefreshCw, Search, XCircle } from 'lucide-react';
import {
  fetchConfirmationAttempts,
  fetchConfirmationQueue,
  getErrorMessage,
  recordConfirmationAttempt,
} from '../api/client';
import type { ConfirmationOutcome, Order } from '../api/client';

const queueStatuses = ['', 'CREATED', 'CONFIRMATION_REQUESTED'] as const;

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

export default function Confirmations() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [status, setStatus] = useState<(typeof queueStatuses)[number]>('');
  const [search, setSearch] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [outcome, setOutcome] = useState<ConfirmationOutcome>('NO_ANSWER');
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
      return recordConfirmationAttempt(selectedOrder.id, outcome, note);
    },
    onSuccess: async (attempt) => {
      if (selectedOrder) {
        await queryClient.invalidateQueries({ queryKey: ['confirmation-attempts', selectedOrder.id] });
        await queryClient.invalidateQueries({ queryKey: ['order', selectedOrder.id] });
      }
      await queryClient.invalidateQueries({ queryKey: ['confirmation-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
      setNote('');
      if (attempt.outcome === 'CONFIRMED' || attempt.outcome === 'REJECTED') {
        setSelectedOrder(null);
      }
    },
  });

  const orders = queuePage?.content ?? [];
  const totalPages = queuePage?.totalPages ?? 0;
  const totalElements = queuePage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;

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
                    onChange={(event) => setOutcome(event.target.value as ConfirmationOutcome)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {outcomes.map((outcomeOption) => (
                      <option key={outcomeOption} value={outcomeOption}>
                        {outcomeOption.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </label>

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
