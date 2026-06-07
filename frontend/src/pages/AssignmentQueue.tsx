import { type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Truck } from 'lucide-react';
import { assignCourier, fetchAssignmentQueue, fetchCouriers, getErrorMessage } from '../api/client';

export default function AssignmentQueue() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [selectedCouriers, setSelectedCouriers] = useState<Record<string, string>>({});

  const {
    data: queuePage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['courier-assignment-queue', { page, size, createdFrom, createdTo }],
    queryFn: () => fetchAssignmentQueue({ page, size, createdFrom: toStartIso(createdFrom), createdTo: toEndIso(createdTo) }),
  });

  const { data: couriersPage } = useQuery({
    queryKey: ['couriers', { page: 0, size: 100 }],
    queryFn: () => fetchCouriers({ page: 0, size: 100 }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ orderId, courierId }: { orderId: string; courierId: string }) => assignCourier(orderId, courierId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['courier-assignment-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['courier-pickup-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
    },
  });

  const orders = queuePage?.content ?? [];
  const activeCouriers = (couriersPage?.content ?? []).filter((courier) => courier.active);
  const totalPages = queuePage?.totalPages ?? 0;
  const totalElements = queuePage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;

  return (
    <QueueLayout
      title="Assignment Queue"
      subtitle={`${totalElements} confirmed orders ready for courier assignment`}
      error={error ?? assignMutation.error}
      isFetching={isFetching}
      isLoading={isLoading}
      page={page}
      totalPages={totalPages}
      size={size}
      createdFrom={createdFrom}
      createdTo={createdTo}
      setPage={setPage}
      setSize={setSize}
      setCreatedFrom={setCreatedFrom}
      setCreatedTo={setCreatedTo}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
    >
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <th className="p-4 font-medium">Order</th>
              <th className="p-4 font-medium">Customer</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Courier</th>
              <th className="p-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="p-4 font-mono text-gray-600">{order.id.slice(0, 8)}...</td>
                <td className="p-4">
                  <p className="font-medium text-gray-900">
                    {order.customer.firstName} {order.customer.lastName}
                  </p>
                  <p className="text-gray-500">{order.customer.phone}</p>
                </td>
                <td className="p-4 font-medium">{order.amount.toFixed(2)} MAD</td>
                <td className="p-4">
                  <select
                    value={selectedCouriers[order.id] ?? ''}
                    onChange={(event) => setSelectedCouriers((current) => ({ ...current, [order.id]: event.target.value }))}
                    className="w-56 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select courier</option>
                    {activeCouriers.map((courier) => (
                      <option key={courier.courierId} value={courier.courierId}>
                        {courier.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  <button
                    type="button"
                    disabled={!selectedCouriers[order.id] || assignMutation.isPending}
                    onClick={() => assignMutation.mutate({ orderId: order.id, courierId: selectedCouriers[order.id] })}
                    className="inline-flex items-center gap-2 rounded-md bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
                  >
                    <Truck size={16} />
                    Assign
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && orders.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No orders are ready for assignment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </QueueLayout>
  );
}

interface QueueLayoutProps {
  title: string;
  subtitle: string;
  error: unknown;
  isFetching: boolean;
  isLoading: boolean;
  page: number;
  totalPages: number;
  size: number;
  createdFrom: string;
  createdTo: string;
  setPage: (value: number | ((current: number) => number)) => void;
  setSize: (value: number) => void;
  setCreatedFrom: (value: string) => void;
  setCreatedTo: (value: string) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  children: ReactNode;
}

function QueueLayout({
  title,
  subtitle,
  error,
  isFetching,
  isLoading,
  page,
  totalPages,
  size,
  createdFrom,
  createdTo,
  setPage,
  setSize,
  setCreatedFrom,
  setCreatedTo,
  canGoBack,
  canGoForward,
  children,
}: QueueLayoutProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500">
          {subtitle}
          {isFetching && !isLoading ? ' - Refreshing' : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-4">
        <label>
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">From</span>
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
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">To</span>
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
          <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Size</span>
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
        <div className="flex items-end justify-end">
          <button
            type="button"
            onClick={() => {
              setCreatedFrom('');
              setCreatedTo('');
              setPage(0);
            }}
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Clear filters
          </button>
        </div>
      </div>

      {Boolean(error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      {children}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Page {totalPages === 0 ? 0 : page + 1} of {totalPages}</p>
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
    </div>
  );
}

function toStartIso(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function toEndIso(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999Z`).toISOString() : undefined;
}
