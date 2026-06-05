import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Package, Truck, XCircle } from 'lucide-react';
import {
  assignCourier,
  confirmOrder,
  fetchOrder,
  fetchOrderEvents,
  getErrorMessage,
  markDelivered,
  markFailed,
  markPickedUp,
  rejectOrder,
  requestConfirmation,
} from '../api/client';

type LifecycleCommand =
  | { action: 'request-confirmation' }
  | { action: 'confirm' }
  | { action: 'reject'; reason: string }
  | { action: 'assign-courier'; courierId: string }
  | { action: 'pick-up'; courierId: string }
  | { action: 'deliver' }
  | { action: 'fail'; reason: string };

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [courierId, setCourierId] = useState('C-100');
  const [rejectReason, setRejectReason] = useState('Customer unreachable');
  const [failureReason, setFailureReason] = useState('Customer refused');

  const {
    data: order,
    error: orderError,
    isLoading: loadingOrder,
  } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });

  const {
    data: events = [],
    error: eventsError,
    isLoading: loadingEvents,
  } = useQuery({
    queryKey: ['order-events', id],
    queryFn: () => fetchOrderEvents(id!),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async (command: LifecycleCommand) => {
      if (!id) {
        throw new Error('Order ID is missing');
      }

      switch (command.action) {
        case 'request-confirmation':
          return requestConfirmation(id);
        case 'confirm':
          return confirmOrder(id);
        case 'reject':
          return rejectOrder(id, command.reason);
        case 'assign-courier':
          return assignCourier(id, command.courierId);
        case 'pick-up':
          return markPickedUp(id, command.courierId);
        case 'deliver':
          return markDelivered(id);
        case 'fail':
          return markFailed(id, command.reason);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['order-events', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
    },
  });

  if (loadingOrder || loadingEvents) {
    return <div>Loading...</div>;
  }

  if (orderError) {
    return (
      <div className="space-y-4">
        <Link to="/orders" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Orders
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(orderError)}
        </div>
      </div>
    );
  }

  if (!order) {
    return <div>Order not found</div>;
  }

  const mutationDisabled = mutation.isPending;

  const EventIcon = ({ type }: { type: string }) => {
    if (type.includes('Created')) return <Package className="w-5 h-5 text-blue-500" />;
    if (type.includes('Confirmed')) return <CheckCircle2 className="w-5 h-5 text-indigo-500" />;
    if (type.includes('Assigned') || type.includes('PickedUp')) return <Truck className="w-5 h-5 text-yellow-500" />;
    if (type.includes('Delivered')) return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (type.includes('Failed') || type.includes('Rejected')) return <XCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-gray-400" />;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <Link to="/orders" className="text-sm text-blue-600 hover:underline mb-2 block">
            &larr; Back to Orders
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
          <p className="text-sm text-gray-500 font-mono mt-1">{order.id}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 max-w-xl">
          {order.status === 'CREATED' && (
            <button
              type="button"
              disabled={mutationDisabled}
              onClick={() => mutation.mutate({ action: 'request-confirmation' })}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Request Confirmation
            </button>
          )}

          {order.status === 'CONFIRMATION_REQUESTED' && (
            <>
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => mutation.mutate({ action: 'confirm' })}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Confirm Order
              </button>
              <input
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="w-52 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Rejection reason"
              />
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => mutation.mutate({ action: 'reject', reason: rejectReason })}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}

          {order.status === 'CONFIRMED' && (
            <>
              <input
                value={courierId}
                onChange={(event) => setCourierId(event.target.value)}
                className="w-40 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Courier ID"
              />
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => mutation.mutate({ action: 'assign-courier', courierId })}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
              >
                Assign Courier
              </button>
            </>
          )}

          {order.status === 'ASSIGNED_TO_COURIER' && (
            <>
              <input
                value={courierId}
                onChange={(event) => setCourierId(event.target.value)}
                className="w-40 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Pickup courier ID"
              />
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => mutation.mutate({ action: 'pick-up', courierId })}
                className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                Mark Picked Up
              </button>
            </>
          )}

          {order.status === 'PICKED_UP' && (
            <>
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => mutation.mutate({ action: 'deliver' })}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                Mark Delivered
              </button>
              <input
                value={failureReason}
                onChange={(event) => setFailureReason(event.target.value)}
                className="w-48 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Failure reason"
              />
              <button
                type="button"
                disabled={mutationDisabled}
                onClick={() => mutation.mutate({ action: 'fail', reason: failureReason })}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Mark Failed
              </button>
            </>
          )}
        </div>
      </div>

      {mutation.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(mutation.error)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-4">Customer Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">
                  {order.customer.firstName} {order.customer.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contact</p>
                <p className="font-medium">{order.customer.phone}</p>
                <p className="text-sm">{order.customer.email}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{order.address.street}</p>
                <p>
                  {order.address.city}, {order.address.state} {order.address.zipCode}
                </p>
                <p>{order.address.country}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-4">Order Summary</h3>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Status</span>
              <span className="font-medium px-2.5 py-1 bg-gray-100 rounded-full text-sm">{order.status}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Total Amount</span>
              <span className="font-bold text-lg">{order.amount.toFixed(2)} MAD</span>
            </div>
            {order.courierId && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Courier</span>
                <span className="font-medium">{order.courierId}</span>
              </div>
            )}
            {order.failureReason && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-md">
                <p className="font-medium text-sm">Failure Reason</p>
                <p>{order.failureReason}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-6">Event Timeline</h3>
          {eventsError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {getErrorMessage(eventsError)}
            </div>
          )}
          <div className="space-y-6">
            {events.map((event, index) => (
              <div key={event.eventId} className="relative flex gap-4">
                {index !== events.length - 1 && (
                  <div className="absolute left-2.5 top-8 bottom-0 w-px bg-gray-200 -mb-6" />
                )}
                <div className="relative z-10 flex-shrink-0 bg-white">
                  <EventIcon type={event.eventType} />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {event.eventType.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">Sequence {event.aggregateSequence}</p>
                </div>
              </div>
            ))}
            {events.length === 0 && !eventsError && <p className="text-sm text-gray-500">No events recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
