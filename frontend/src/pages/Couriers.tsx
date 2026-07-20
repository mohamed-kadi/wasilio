import { type SyntheticEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, PlusCircle, Search, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { createCourier, fetchCouriers, getErrorMessage, setCourierActive, type Courier } from '../api/client';

export default function Couriers() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE' | ''>('');

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
      setCreateOpen(false);
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
  const filteredCouriers = couriers.filter((courier) => (
    courierMatchesSearch(courier, searchTerm)
      && (statusFilter === '' || (statusFilter === 'ACTIVE' ? courier.active : !courier.active))
  ));
  const totalPages = couriersPage?.totalPages ?? 0;
  const totalElements = couriersPage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;

  function handleCreate(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Operations</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Couriers</h2>
          <p className="mt-1 text-sm text-gray-500">
            {totalElements} courier resources for assignment, pickup, and delivery workflows
            {isFetching && !isLoading ? ' - Refreshing' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PlusCircle size={18} />
          New Courier
        </button>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <CourierMetric title="Active couriers" value={activeCount} detail="Available for new assignments" tone="green" />
        <CourierMetric title="Inactive couriers" value={inactiveCount} detail="Hidden from active operations" tone="gray" />
        <CourierMetric title="Visible on page" value={couriers.length} detail="Current page of courier records" tone="blue" />
      </section>

      {(error || createMutation.error || activeMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error ?? createMutation.error ?? activeMutation.error)}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1">
            <span className="mb-1 block text-sm font-medium text-gray-700">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, phone, or courier ID"
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </span>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ACTIVE' | 'INACTIVE' | '')}
              className="min-w-40 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Page size</span>
            <select
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(0);
              }}
              className="min-w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('');
            }}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <X size={16} />
            Clear
          </button>
        </div>
      </section>

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
            {filteredCouriers.map((courier) => (
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
                    className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    aria-label={courier.active ? 'Deactivate courier' : 'Activate courier'}
                    title={courier.active ? 'Deactivate courier' : 'Activate courier'}
                  >
                    {courier.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    {courier.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && filteredCouriers.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  <div className="mx-auto max-w-sm">
                    <p className="text-sm font-medium text-gray-900">
                      {couriers.length === 0 ? 'No couriers found.' : 'No couriers match these filters.'}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {couriers.length === 0
                        ? 'Create a courier before assigning confirmed orders.'
                        : 'Clear search or status filters to return to the full courier roster.'}
                    </p>
                    {couriers.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        <PlusCircle size={16} />
                        New Courier
                      </button>
                    )}
                  </div>
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

      {createOpen && (
        <CourierCreatePanel
          name={name}
          phone={phone}
          isSubmitting={createMutation.isPending}
          onNameChange={setName}
          onPhoneChange={setPhone}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}

function CourierCreatePanel({
  name,
  phone,
  isSubmitting,
  onNameChange,
  onPhoneChange,
  onClose,
  onSubmit,
}: {
  name: string;
  phone: string;
  isSubmitting: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Operations resource</p>
            <h3 className="mt-1 text-xl font-bold text-gray-900">New Courier</h3>
            <p className="mt-1 text-sm text-gray-500">Create courier resources before assigning confirmed COD orders.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
            aria-label="Close courier form"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-4 px-6 py-5">
            <label>
              <span className="mb-1 block text-sm font-medium text-gray-700">Name</span>
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                maxLength={255}
              />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium text-gray-700">Phone</span>
              <input
                value={phone}
                onChange={(event) => onPhoneChange(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                maxLength={50}
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <PlusCircle size={18} />
              {isSubmitting ? 'Creating' : 'Create courier'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function courierMatchesSearch(courier: Courier, value: string) {
  const query = value.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return [courier.name, courier.phone, courier.courierId].some((candidate) => candidate.toLowerCase().includes(query));
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
