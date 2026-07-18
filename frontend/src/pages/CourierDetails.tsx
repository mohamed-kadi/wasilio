import { type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Phone, Save, ToggleLeft, ToggleRight, Truck } from 'lucide-react';
import { fetchCourier, getErrorMessage, setCourierActive, updateCourier } from '../api/client';

export default function CourierDetails() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const {
    data: courier,
    error,
    isLoading,
  } = useQuery({
    queryKey: ['courier', id],
    queryFn: () => fetchCourier(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ name, phone }: { name: string; phone: string }) => updateCourier(id!, { name, phone }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['courier', id] });
      await queryClient.invalidateQueries({ queryKey: ['couriers'] });
    },
  });

  const activeMutation = useMutation({
    mutationFn: (active: boolean) => setCourierActive(id!, active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['courier', id] });
      await queryClient.invalidateQueries({ queryKey: ['couriers'] });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateMutation.mutate({
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
    });
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error || !courier) {
    return (
      <div className="space-y-4">
        <Link to="/app/couriers" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Couriers
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ? getErrorMessage(error) : 'Courier not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/couriers" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Couriers
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">{courier.name}</h2>
          <p className="mt-1 text-sm text-gray-500">Courier resource used across Assignment, Pickup, Delivery, and Recovery reporting.</p>
          <p className="mt-2 font-mono text-xs text-gray-500">{courier.courierId}</p>
        </div>
        <Link
          to="/app/couriers/performance"
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
        >
          View performance
          <ArrowRight size={16} />
        </Link>
      </div>

      <section className={`rounded-lg border p-5 ${courier.active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase">Courier availability</p>
            <h3 className="mt-2 text-xl font-bold text-gray-900">{courier.active ? 'Active for assignment' : 'Inactive courier'}</h3>
            <p className="mt-2 max-w-2xl text-sm">
              {courier.active
                ? 'This courier can be selected in assignment, pickup, and delivery workflows.'
                : 'Inactive couriers stay in records but should not receive new operational assignments.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => activeMutation.mutate(!courier.active)}
            disabled={activeMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {courier.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {courier.active ? 'Deactivate courier' : 'Activate courier'}
          </button>
        </div>
      </section>

      {(updateMutation.error || activeMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(updateMutation.error ?? activeMutation.error)}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <CourierDetailTile
          title="Phone"
          value={courier.phone}
          detail="Visible to operations teams"
          icon={<Phone size={18} />}
        />
        <CourierDetailTile
          title="Profile created"
          value={formatDate(courier.createdAt)}
          detail="Courier record start date"
          icon={<CalendarDays size={18} />}
        />
        <CourierDetailTile
          title="Workflow use"
          value="Assignment -> Pickup -> Delivery"
          detail="Recovery metrics come from failed deliveries"
          icon={<Truck size={18} />}
        />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-5">
          <h3 className="text-sm font-semibold uppercase text-gray-500">Courier profile</h3>
          <p className="mt-1 text-sm text-gray-600">Keep the name and phone number clear for operations teams.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Name</span>
            <input
              name="name"
              defaultValue={courier.name}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength={255}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Phone</span>
            <input
              name="phone"
              defaultValue={courier.phone}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              maxLength={50}
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={18} />
              Save
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CourierDetailTile({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-gray-500">{title}</p>
          <p className="mt-2 truncate text-base font-semibold text-gray-900">{value}</p>
          <p className="mt-1 text-sm text-gray-500">{detail}</p>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-blue-700">{icon}</div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
