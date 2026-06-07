import { type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Save, ToggleLeft, ToggleRight } from 'lucide-react';
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
        <Link to="/couriers" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Couriers
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ? getErrorMessage(error) : 'Courier not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to="/couriers" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Couriers
        </Link>
        <h2 className="mt-2 text-2xl font-bold text-gray-900">{courier.name}</h2>
        <p className="font-mono text-sm text-gray-500">{courier.courierId}</p>
      </div>

      {(updateMutation.error || activeMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(updateMutation.error ?? activeMutation.error)}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-medium text-gray-900">{courier.active ? 'Active' : 'Inactive'}</p>
          </div>
          <button
            type="button"
            onClick={() => activeMutation.mutate(!courier.active)}
            disabled={activeMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {courier.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {courier.active ? 'Deactivate' : 'Activate'}
          </button>
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
