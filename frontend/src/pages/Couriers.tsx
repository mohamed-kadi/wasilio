import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PlusCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { createCourier, fetchCouriers, getErrorMessage, setCourierActive } from '../api/client';

export default function Couriers() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const {
    data: couriersPage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['couriers', { page, size }],
    queryFn: () => fetchCouriers({ page, size }),
  });

  const createMutation = useMutation({
    mutationFn: () => createCourier({ name, phone }),
    onSuccess: async () => {
      setName('');
      setPhone('');
      await queryClient.invalidateQueries({ queryKey: ['couriers'] });
    },
  });

  const activeMutation = useMutation({
    mutationFn: ({ courierId, active }: { courierId: string; active: boolean }) => setCourierActive(courierId, active),
    onSuccess: async (_courier, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['couriers'] });
      await queryClient.invalidateQueries({ queryKey: ['courier', variables.courierId] });
    },
  });

  const couriers = couriersPage?.content ?? [];
  const activeCount = couriers.filter((courier) => courier.active).length;
  const inactiveCount = couriers.length - activeCount;
  const totalPages = couriersPage?.totalPages ?? 0;
  const totalElements = couriersPage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Couriers</h2>
        <p className="text-sm text-gray-500">{totalElements} courier resources for assignment, pickup, and delivery workflows</p>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CourierMetric title="Active couriers" value={activeCount} detail="Available for new assignments" tone="green" />
        <CourierMetric title="Inactive couriers" value={inactiveCount} detail="Hidden from active operations" tone="gray" />
        <CourierMetric title="Visible on page" value={couriers.length} detail="Current page of courier records" tone="blue" />
      </section>

      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold uppercase text-gray-500">Add courier</h3>
          <p className="mt-1 text-sm text-gray-600">Create courier resources before assigning confirmed COD orders.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3">
          <label>
            <span className="block text-xs font-medium uppercase text-gray-500 mb-1">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength={255}
            />
          </label>
          <label>
            <span className="block text-xs font-medium uppercase text-gray-500 mb-1">Phone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength={50}
            />
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center justify-center gap-2 self-end rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <PlusCircle size={18} />
            Create
          </button>
        </div>
      </form>

      {(error || createMutation.error || activeMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error ?? createMutation.error ?? activeMutation.error)}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700" htmlFor="courier-page-size">
          Page size
        </label>
        <select
          id="courier-page-size"
          value={size}
          onChange={(event) => {
            setSize(Number(event.target.value));
            setPage(0);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[10, 20, 50, 100].map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <th className="p-4 font-medium">Courier</th>
              <th className="p-4 font-medium">Phone</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Created</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {couriers.map((courier) => (
              <tr key={courier.courierId} className="hover:bg-gray-50">
                <td className="p-4">
                  <Link to={`/app/couriers/${courier.courierId}`} className="font-medium text-blue-600 hover:underline">
                    {courier.name}
                  </Link>
                  <p className="font-mono text-xs text-gray-500">{courier.courierId.slice(0, 8)}...</p>
                </td>
                <td className="p-4 text-gray-700">{courier.phone}</td>
                <td className="p-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${courier.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                    {courier.active ? 'Active' : 'Inactive'}
                  </span>
                  <p className="mt-1 text-xs text-gray-500">{courier.active ? 'Can receive assignments' : 'Not used for new assignments'}</p>
                </td>
                <td className="p-4 text-gray-500">{new Date(courier.createdAt).toLocaleDateString()}</td>
                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => activeMutation.mutate({ courierId: courier.courierId, active: !courier.active })}
                    disabled={activeMutation.isPending}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    aria-label={courier.active ? 'Deactivate courier' : 'Activate courier'}
                    title={courier.active ? 'Deactivate courier' : 'Activate courier'}
                  >
                    {courier.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && couriers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No couriers found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  Loading couriers...
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
    </div>
  );
}

function CourierMetric({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  tone: 'green' | 'gray' | 'blue';
}) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-600',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
