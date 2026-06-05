import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, Order } from '../api/client';
import { CheckCircle2, XCircle, Truck, Package, Clock } from 'lucide-react';

interface DomainEvent {
  eventId: string;
  eventType: string;
  version: number;
  timestamp: string;
  payload: string;
}

const fetchOrder = async (id: string): Promise<Order> => {
  const res = await fetch(`${API_BASE_URL}/orders/${id}`);
  if (!res.ok) throw new Error('Failed to fetch order');
  return res.json();
};

const fetchOrderEvents = async (id: string): Promise<DomainEvent[]> => {
  const res = await fetch(`${API_BASE_URL}/orders/${id}/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
};

export default function OrderDetails() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: order, isLoading: loadingOrder } = useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id!),
    enabled: !!id,
  });

  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['order-events', id],
    queryFn: () => fetchOrderEvents(id!),
    enabled: !!id,
  });

  const mutation = useMutation({
    mutationFn: async ({ action, payload }: { action: string, payload?: any }) => {
      const res = await fetch(`${API_BASE_URL}/orders/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined
      });
      if (!res.ok) throw new Error(`Failed to ${action}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['order-events', id] });
    }
  });

  if (loadingOrder || loadingEvents) return <div>Loading...</div>;
  if (!order) return <div>Order not found</div>;

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
      <div className="flex justify-between items-center">
        <div>
          <Link to="/orders" className="text-sm text-blue-600 hover:underline mb-2 block">&larr; Back to Orders</Link>
          <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
          <p className="text-sm text-gray-500 font-mono mt-1">{order.id}</p>
        </div>
        <div className="flex gap-2">
          {order.status === 'CREATED' && (
            <button onClick={() => mutation.mutate({ action: 'request-confirmation' })} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Request Confirmation</button>
          )}
          {order.status === 'CONFIRMATION_REQUESTED' && (
            <>
              <button onClick={() => mutation.mutate({ action: 'confirm' })} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Confirm Order</button>
              <button onClick={() => mutation.mutate({ action: 'reject', payload: { reason: 'Customer unreachable' } })} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Reject</button>
            </>
          )}
          {order.status === 'CONFIRMED' && (
            <button onClick={() => mutation.mutate({ action: 'assign-courier', payload: { courierId: 'C-100' } })} className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700">Assign Courier</button>
          )}
          {order.status === 'ASSIGNED_TO_COURIER' && (
            <button onClick={() => mutation.mutate({ action: 'pick-up', payload: { courierId: 'C-100' } })} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">Mark Picked Up</button>
          )}
          {order.status === 'PICKED_UP' && (
            <>
              <button onClick={() => mutation.mutate({ action: 'deliver' })} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Mark Delivered</button>
              <button onClick={() => mutation.mutate({ action: 'fail', payload: { reason: 'Customer refused' } })} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Mark Failed</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-4">Customer Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-medium">{order.customer.firstName} {order.customer.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contact</p>
                <p className="font-medium">{order.customer.phone}</p>
                <p className="text-sm">{order.customer.email}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{order.address.street}</p>
                <p>{order.address.city}, {order.address.state} {order.address.zipCode}</p>
                <p>{order.address.country}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-4">Order Summary</h3>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Status</span>
              <span className="font-medium px-2.5 py-1 bg-gray-100 rounded-full text-sm">{order.status}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-600">Total Amount</span>
              <span className="font-bold text-lg">${order.amount.toFixed(2)}</span>
            </div>
            {order.failureReason && (
              <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
                <p className="font-medium text-sm">Failure Reason:</p>
                <p>{order.failureReason}</p>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-6">Event Timeline</h3>
          <div className="space-y-6">
            {events.map((event, index) => (
              <div key={event.eventId} className="relative flex gap-4">
                {index !== events.length - 1 && (
                  <div className="absolute left-2.5 top-8 bottom-0 w-px bg-gray-200 -mb-6"></div>
                )}
                <div className="relative z-10 flex-shrink-0 bg-white">
                  <EventIcon type={event.eventType} />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">{event.eventType.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
