import { useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, Bookmark, ChevronLeft, ChevronRight, PlusCircle, Save, Trash2, X } from 'lucide-react';
import {
  createOrderSearchSavedView,
  deleteOrderSearchSavedView,
  fetchDeliveryFollowUps,
  fetchCouriers,
  fetchDeliveryFailureRecoveries,
  fetchOrders,
  fetchOrderSearchSavedViews,
  getErrorMessage,
  resolveDeliveryFollowUp,
  retryFailedDelivery,
  updateOrderSearchSavedView,
} from '../api/client';
import type {
  DeliveryFailureRecovery,
  DeliveryFailureRecoveryDecision,
  DeliveryFollowUpTask,
  Order,
  OrderSearchSavedView,
  OrderStatus,
} from '../api/client';

const statusColors: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-800',
  CONFIRMATION_REQUESTED: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-indigo-100 text-indigo-800',
  REJECTED: 'bg-red-100 text-red-800',
  ASSIGNED_TO_COURIER: 'bg-yellow-100 text-yellow-800',
  PICKED_UP: 'bg-orange-100 text-orange-800',
  DELIVERED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

const statusLabels: Record<OrderStatus, string> = {
  CREATED: 'New order',
  CONFIRMATION_REQUESTED: 'Needs confirmation',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  ASSIGNED_TO_COURIER: 'Assigned',
  PICKED_UP: 'Picked up',
  DELIVERED: 'Delivered',
  FAILED: 'Failed delivery',
};

const statusStages: Record<OrderStatus, string> = {
  CREATED: 'Confirm',
  CONFIRMATION_REQUESTED: 'Confirm',
  CONFIRMED: 'Assign',
  REJECTED: 'Closed',
  ASSIGNED_TO_COURIER: 'Pickup',
  PICKED_UP: 'Deliver',
  DELIVERED: 'Closed',
  FAILED: 'Closed',
};

const nextActions: Record<OrderStatus, string> = {
  CREATED: 'Request confirmation',
  CONFIRMATION_REQUESTED: 'Call customer',
  CONFIRMED: 'Assign courier',
  REJECTED: 'No action',
  ASSIGNED_TO_COURIER: 'Wait for pickup',
  PICKED_UP: 'Record delivery result',
  DELIVERED: 'Complete',
  FAILED: 'Review failure',
};

const failureReasonLabels: Record<string, string> = {
  CUSTOMER_UNREACHABLE: 'Customer unreachable',
  CUSTOMER_REFUSED: 'Customer refused',
  INVALID_ADDRESS: 'Invalid address',
  CUSTOMER_RESCHEDULED: 'Customer rescheduled',
  LOST_PACKAGE: 'Lost package',
  OTHER: 'Other',
};

const recoveryDecisionLabels: Record<DeliveryFailureRecoveryDecision, string> = {
  RETRY_DELIVERY: 'Retry delivery',
  REFUND_OR_CUSTOMER_FOLLOW_UP: 'Refund / customer follow-up',
  CLOSE_UNRECOVERABLE: 'Close as unrecoverable',
};

const statuses: OrderStatus[] = [
  'CREATED',
  'CONFIRMATION_REQUESTED',
  'CONFIRMED',
  'REJECTED',
  'ASSIGNED_TO_COURIER',
  'PICKED_UP',
  'DELIVERED',
  'FAILED',
];

interface OrderFilters {
  statuses: OrderStatus[];
  phone: string;
  customerName: string;
  orderId: string;
  courierId: string;
  createdFrom: string;
  createdTo: string;
}

interface OrdersLocationState {
  statuses?: OrderStatus[];
  recoveryFocus?: boolean;
}

const emptyFilters: OrderFilters = {
  statuses: [],
  phone: '',
  customerName: '',
  orderId: '',
  courierId: '',
  createdFrom: '',
  createdTo: '',
};

function filtersToSavedPayload(filters: OrderFilters): Record<string, string> {
  const payload: Record<string, string> = {};
  if (filters.statuses.length > 0) {
    payload.status = filters.statuses.join(',');
  }
  if (filters.phone) payload.phone = filters.phone;
  if (filters.customerName) payload.customerName = filters.customerName;
  if (filters.orderId) payload.orderId = filters.orderId;
  if (filters.courierId) payload.courierId = filters.courierId;
  if (filters.createdFrom) payload.createdFrom = filters.createdFrom;
  if (filters.createdTo) payload.createdTo = filters.createdTo;
  return payload;
}

function savedPayloadToFilters(payload: Record<string, string>): OrderFilters {
  const parsedStatuses = (payload.status ?? '')
    .split(',')
    .filter((status): status is OrderStatus => statuses.includes(status as OrderStatus));
  return {
    statuses: parsedStatuses,
    phone: payload.phone ?? '',
    customerName: payload.customerName ?? '',
    orderId: payload.orderId ?? '',
    courierId: payload.courierId ?? '',
    createdFrom: payload.createdFrom ?? '',
    createdTo: payload.createdTo ?? '',
  };
}

function toInstantFromDate(date: string, endOfDay = false) {
  if (!date) return undefined;
  return `${date}T${endOfDay ? '23:59:59' : '00:00:00'}Z`;
}

function countByStatus(orders: Order[], status: OrderStatus) {
  return orders.filter((order) => order.status === status).length;
}

function getLocationStatuses(state: OrdersLocationState | null): OrderStatus[] {
  return (state?.statuses ?? []).filter((status): status is OrderStatus => statuses.includes(status));
}

function formatFailureReason(reason?: string) {
  if (!reason) {
    return undefined;
  }
  return failureReasonLabels[reason] ?? reason.replace(/_/g, ' ').toLowerCase();
}

function latestRecovery(recoveries: DeliveryFailureRecovery[]) {
  return recoveries.length > 0 ? recoveries[recoveries.length - 1] : undefined;
}

function formatRecoveryDecision(decision: DeliveryFailureRecoveryDecision | string) {
  return recoveryDecisionLabels[decision as DeliveryFailureRecoveryDecision] ?? decision.replace(/_/g, ' ').toLowerCase();
}

function formatFollowUpDate(value?: string) {
  return value ? new Date(value).toLocaleString() : 'No due date';
}

function failedOrderNextAction(latestRecovery?: DeliveryFailureRecovery, openFollowUp?: DeliveryFollowUpTask) {
  if (openFollowUp) {
    return 'Resolve customer follow-up';
  }
  if (!latestRecovery) {
    return 'Record recovery decision';
  }
  if (latestRecovery.decision === 'RETRY_DELIVERY') {
    return 'Move to assignment';
  }
  if (latestRecovery.decision === 'CLOSE_UNRECOVERABLE') {
    return 'No active recovery action';
  }
  return 'Review recovery';
}

export default function OrdersList() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationState = location.state as OrdersLocationState | null;
  const locationStatuses = getLocationStatuses(locationState);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState<OrderFilters>(() => ({
    ...emptyFilters,
    statuses: locationStatuses,
  }));
  const [recoveryFocus, setRecoveryFocus] = useState(Boolean(locationState?.recoveryFocus));
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewName, setSavedViewName] = useState('');

  const {
    data: ordersPage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['orders', { page, size, filters }],
    queryFn: () =>
      fetchOrders({
        page,
        size,
        status: filters.statuses,
        phone: filters.phone,
        customerName: filters.customerName,
        orderId: filters.orderId,
        courierId: filters.courierId,
        createdFrom: toInstantFromDate(filters.createdFrom),
        createdTo: toInstantFromDate(filters.createdTo, true),
      }),
  });

  const { data: couriersPage } = useQuery({
    queryKey: ['couriers', { page: 0, size: 100 }],
    queryFn: () => fetchCouriers({ page: 0, size: 100 }),
  });

  const { data: savedViews = [] } = useQuery({
    queryKey: ['order-search-saved-views'],
    queryFn: fetchOrderSearchSavedViews,
  });

  const createSavedViewMutation = useMutation({
    mutationFn: () =>
      createOrderSearchSavedView({
        name: savedViewName.trim(),
        filters: filtersToSavedPayload(filters),
      }),
    onSuccess: async (savedView) => {
      setSelectedSavedViewId(savedView.viewId);
      setSavedViewName(savedView.name);
      await queryClient.invalidateQueries({ queryKey: ['order-search-saved-views'] });
    },
  });

  const updateSavedViewMutation = useMutation({
    mutationFn: (savedView: OrderSearchSavedView) =>
      updateOrderSearchSavedView(savedView.viewId, {
        name: savedViewName.trim() || savedView.name,
        filters: filtersToSavedPayload(filters),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['order-search-saved-views'] });
    },
  });

  const deleteSavedViewMutation = useMutation({
    mutationFn: deleteOrderSearchSavedView,
    onSuccess: async () => {
      setSelectedSavedViewId('');
      setSavedViewName('');
      await queryClient.invalidateQueries({ queryKey: ['order-search-saved-views'] });
    },
  });

  const orders = ordersPage?.content ?? [];
  const couriers = couriersPage?.content ?? [];
  const totalPages = ordersPage?.totalPages ?? 0;
  const totalElements = ordersPage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const selectedSavedView = savedViews.find((view) => view.viewId === selectedSavedViewId);
  const visibleFailedOrders = orders.filter((order) => order.status === 'FAILED');
  const isFailureRecoveryView = recoveryFocus || filters.statuses.includes('FAILED');
  const failureRecoveryQueries = useQueries({
    queries: visibleFailedOrders.map((order) => ({
      queryKey: ['delivery-failure-recoveries', order.id],
      queryFn: () => fetchDeliveryFailureRecoveries(order.id),
      enabled: order.status === 'FAILED',
    })),
  });
  const recoveriesByOrderId = new Map<string, DeliveryFailureRecovery[]>(
    visibleFailedOrders.map((order, index) => [order.id, failureRecoveryQueries[index]?.data ?? []]),
  );
  const recoveryQueryErrorsByOrderId = new Map<string, unknown>(
    visibleFailedOrders
      .map((order, index) => [order.id, failureRecoveryQueries[index]?.error] as const)
      .filter(([, queryError]) => queryError),
  );
  const followUpQueries = useQueries({
    queries: visibleFailedOrders.map((order) => ({
      queryKey: ['delivery-follow-ups', order.id],
      queryFn: () => fetchDeliveryFollowUps(order.id),
      enabled: order.status === 'FAILED',
    })),
  });
  const followUpsByOrderId = new Map<string, DeliveryFollowUpTask[]>(
    visibleFailedOrders.map((order, index) => [order.id, followUpQueries[index]?.data ?? []]),
  );
  const followUpQueryErrorsByOrderId = new Map<string, unknown>(
    visibleFailedOrders
      .map((order, index) => [order.id, followUpQueries[index]?.error] as const)
      .filter(([, queryError]) => queryError),
  );
  const visibleJourneyCounts = {
    confirm: countByStatus(orders, 'CREATED') + countByStatus(orders, 'CONFIRMATION_REQUESTED'),
    courier:
      countByStatus(orders, 'CONFIRMED') + countByStatus(orders, 'ASSIGNED_TO_COURIER') + countByStatus(orders, 'PICKED_UP'),
    closed: countByStatus(orders, 'DELIVERED') + countByStatus(orders, 'FAILED') + countByStatus(orders, 'REJECTED'),
    failed: visibleFailedOrders.length,
  };

  const quickResolveFollowUpMutation = useMutation({
    mutationFn: ({ orderId, taskId }: { orderId: string; taskId: string }) => resolveDeliveryFollowUp(orderId, taskId),
    onSuccess: async (task, variables) => {
      queryClient.setQueryData<DeliveryFollowUpTask[] | undefined>(
        ['delivery-follow-ups', variables.orderId],
        (currentTasks) => currentTasks?.map((currentTask) => currentTask.taskId === task.taskId ? task : currentTask) ?? [task],
      );
      await queryClient.invalidateQueries({ queryKey: ['delivery-follow-ups', variables.orderId] });
      await queryClient.invalidateQueries({ queryKey: ['order-timeline', variables.orderId] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
    },
  });

  const quickRetryMutation = useMutation({
    mutationFn: (orderId: string) => retryFailedDelivery(orderId),
    onSuccess: async (_result, orderId) => {
      await queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      await queryClient.invalidateQueries({ queryKey: ['delivery-failure-recoveries', orderId] });
      await queryClient.invalidateQueries({ queryKey: ['orders'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-summary'] });
      await queryClient.invalidateQueries({ queryKey: ['courier-assignment-queue'] });
    },
  });

  function updateFilter<K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
    if (key === 'statuses') {
      setRecoveryFocus((value as OrderStatus[]).includes('FAILED'));
    }
    setPage(0);
  }

  function toggleStatus(status: OrderStatus) {
    const nextStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((currentStatus) => currentStatus !== status)
      : [...filters.statuses, status];
    updateFilter('statuses', nextStatuses);
  }

  function applySavedView(viewId: string) {
    setSelectedSavedViewId(viewId);
    const savedView = savedViews.find((view) => view.viewId === viewId);
    if (!savedView) {
      setSavedViewName('');
      return;
    }
    setFilters(savedPayloadToFilters(savedView.filters));
    setSavedViewName(savedView.name);
    setPage(0);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setRecoveryFocus(false);
    setSelectedSavedViewId('');
    setSavedViewName('');
    setPage(0);
  }

  function applyFailedRecoveryView() {
    setFilters({
      ...emptyFilters,
      statuses: ['FAILED'],
    });
    setRecoveryFocus(true);
    setSelectedSavedViewId('');
    setSavedViewName('');
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-500">{totalElements} total orders across confirmation, courier, and closed stages</p>
        </div>
        <Link
          to="/app/orders/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          <PlusCircle size={18} />
          New Order
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <JourneyMetric title="Needs confirmation" value={visibleJourneyCounts.confirm} detail="New or waiting for customer call" tone="blue" />
        <JourneyMetric title="Courier workflow" value={visibleJourneyCounts.courier} detail="Confirmed, assigned, or picked up" tone="amber" />
        <JourneyMetric title="Closed orders" value={visibleJourneyCounts.closed} detail="Delivered, failed, or rejected" tone="green" />
        <JourneyMetric title="Failed recovery" value={visibleJourneyCounts.failed} detail="Visible failures needing review" tone="red" />
      </section>

      {isFailureRecoveryView && (
        <section className="rounded-lg border border-red-200 bg-red-50 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-950">Failed delivery recovery</p>
              <p className="mt-1 max-w-3xl text-sm text-red-800">
                Use this view to see the current recovery state. Record decisions on the order detail page; retry-ready
                orders can still be moved back to assignment from here.
              </p>
            </div>
            <Link
              to="/app/couriers/performance"
              className="inline-flex items-center rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Review courier performance
            </Link>
          </div>
        </section>
      )}

      <div className="space-y-4 bg-white border border-gray-200 rounded-lg px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500">Search and filters</h3>
            <p className="mt-1 text-sm text-gray-600">Find orders by customer, courier, status, or recovery state.</p>
          </div>
          <button
            type="button"
            onClick={applyFailedRecoveryView}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            <AlertCircle size={16} />
            Review failed deliveries
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="customer-name">
              Customer
            </label>
            <input
              id="customer-name"
              value={filters.customerName}
              onChange={(event) => updateFilter('customerName', event.target.value)}
              placeholder="Name"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              value={filters.phone}
              onChange={(event) => updateFilter('phone', event.target.value)}
              placeholder="0600000000"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="order-id">
              Order ID
            </label>
            <input
              id="order-id"
              value={filters.orderId}
              onChange={(event) => updateFilter('orderId', event.target.value)}
              placeholder="Full or partial ID"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="courier">
              Courier
            </label>
            <select
              id="courier"
              value={filters.courierId}
              onChange={(event) => updateFilter('courierId', event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">All couriers</option>
              {couriers.map((courier) => (
                <option key={courier.courierId} value={courier.courierId}>
                  {courier.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="created-from">
              From
            </label>
            <input
              id="created-from"
              type="date"
              value={filters.createdFrom}
              onChange={(event) => updateFilter('createdFrom', event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="created-to">
              To
            </label>
            <input
              id="created-to"
              type="date"
              value={filters.createdTo}
              onChange={(event) => updateFilter('createdTo', event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="page-size">
              Page size
            </label>
            <select
              id="page-size"
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(0);
              }}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {[10, 20, 50, 100].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <X size={16} />
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {statuses.map((statusOption) => (
            <label
              key={statusOption}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={filters.statuses.includes(statusOption)}
                onChange={() => toggleStatus(statusOption)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {statusOption.replace(/_/g, ' ')}
              <span className="text-xs text-gray-400">({statusLabels[statusOption]})</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
          <div className="min-w-56">
            <label className="block text-sm font-medium text-gray-700" htmlFor="saved-view">
              Saved view
            </label>
            <select
              id="saved-view"
              value={selectedSavedViewId}
              onChange={(event) => applySavedView(event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">No saved view</option>
              {savedViews.map((savedView) => (
                <option key={savedView.viewId} value={savedView.viewId}>
                  {savedView.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-56">
            <label className="block text-sm font-medium text-gray-700" htmlFor="saved-view-name">
              View name
            </label>
            <input
              id="saved-view-name"
              value={savedViewName}
              onChange={(event) => setSavedViewName(event.target.value)}
              placeholder="Save current filters"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => createSavedViewMutation.mutate()}
            disabled={!savedViewName.trim() || createSavedViewMutation.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Bookmark size={16} />
            Save
          </button>
          <button
            type="button"
            onClick={() => selectedSavedView && updateSavedViewMutation.mutate(selectedSavedView)}
            disabled={!selectedSavedView || updateSavedViewMutation.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Save size={16} />
            Update
          </button>
          <button
            type="button"
            onClick={() => selectedSavedView && deleteSavedViewMutation.mutate(selectedSavedView.viewId)}
            disabled={!selectedSavedView || deleteSavedViewMutation.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}
      {(createSavedViewMutation.error || updateSavedViewMutation.error || deleteSavedViewMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(
            createSavedViewMutation.error ?? updateSavedViewMutation.error ?? deleteSavedViewMutation.error,
          )}
        </div>
      )}
      {(quickRetryMutation.error || quickResolveFollowUpMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(quickRetryMutation.error ?? quickResolveFollowUpMutation.error)}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                <th className="p-4 font-medium">ID</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Courier</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Next action</th>
                <th className="p-4 font-medium">Recovery</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {orders.map((order) => {
                const failureReason = formatFailureReason(order.failureReason);
                const recoveries = recoveriesByOrderId.get(order.id) ?? [];
                const latestFailureRecovery = latestRecovery(recoveries);
                const followUps = followUpsByOrderId.get(order.id) ?? [];
                const openFollowUp = followUps.find((followUp) => followUp.status === 'OPEN');
                const latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : undefined;
                const recoveryQueryError = recoveryQueryErrorsByOrderId.get(order.id);
                const followUpQueryError = followUpQueryErrorsByOrderId.get(order.id);
                const canMoveToAssignment = latestFailureRecovery?.decision === 'RETRY_DELIVERY';
                const failedAction = failedOrderNextAction(latestFailureRecovery, openFollowUp);
                const isResolvingThisOrder = quickResolveFollowUpMutation.isPending
                  && quickResolveFollowUpMutation.variables?.orderId === order.id;
                const isRetryingThisOrder = quickRetryMutation.isPending
                  && quickRetryMutation.variables === order.id;

                return (
                  <tr key={order.id} className={order.status === 'FAILED' ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-gray-50'}>
                    <td className="p-4 font-mono text-gray-500">
                      <Link to={`/app/orders/${order.id}`} className="text-blue-600 hover:underline">
                        {order.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">
                        {order.customer.firstName} {order.customer.lastName}
                      </p>
                      <p className="text-gray-500">{order.customer.phone}</p>
                    </td>
                    <td className="p-4 font-medium">{order.amount.toFixed(2)} MAD</td>
                    <td className="p-4 text-gray-500">
                      {couriers.find((courier) => courier.courierId === order.courierId)?.name ?? order.courierId ?? '-'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                        {statusLabels[order.status]}
                      </span>
                      <p className="mt-1 text-xs text-gray-500">{statusStages[order.status]} stage</p>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium text-gray-900">
                        {order.status === 'FAILED' ? failedAction : nextActions[order.status]}
                      </span>
                    </td>
                    <td className="p-4">
                      {order.status === 'FAILED' ? (
                        <div className="max-w-sm space-y-3">
                          <p className="text-sm font-medium text-red-900">
                            Reason: {failureReason ?? 'Not recorded'}
                          </p>
                          <div className="rounded-md border border-red-100 bg-white p-3">
                            <p className="text-xs font-semibold uppercase text-gray-500">Latest recovery</p>
                            {recoveryQueryError ? (
                              <p className="mt-1 text-xs text-red-700">{getErrorMessage(recoveryQueryError)}</p>
                            ) : latestFailureRecovery ? (
                              <>
                                <p className="mt-1 text-sm font-semibold text-gray-900">
                                  {formatRecoveryDecision(latestFailureRecovery.decision)}
                                </p>
                                {latestFailureRecovery.note && (
                                  <p className="mt-1 text-xs text-gray-600">{latestFailureRecovery.note}</p>
                                )}
                                {followUpQueryError && (
                                  <p className="mt-2 text-xs text-red-700">{getErrorMessage(followUpQueryError)}</p>
                                )}
                                {openFollowUp && (
                                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs text-amber-900">
                                    <p className="font-semibold">Open follow-up</p>
                                    <p>Owner: {openFollowUp.assignedTo}</p>
                                    <p>Due: {formatFollowUpDate(openFollowUp.dueAt)}</p>
                                  </div>
                                )}
                                {!openFollowUp && latestFollowUp && (
                                  <p className="mt-2 text-xs text-gray-500">
                                    Follow-up task: {latestFollowUp.status === 'RESOLVED' ? 'Resolved' : latestFollowUp.status}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="mt-1 text-sm font-semibold text-red-800">No recovery decision recorded</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {!latestFailureRecovery && (
                              <Link
                                to={`/app/orders/${order.id}`}
                                className="inline-flex items-center rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-800"
                              >
                                Record decision
                              </Link>
                            )}
                            {openFollowUp && (
                              <button
                                type="button"
                                onClick={() => quickResolveFollowUpMutation.mutate({
                                  orderId: order.id,
                                  taskId: openFollowUp.taskId,
                                })}
                                disabled={isRetryingThisOrder || isResolvingThisOrder}
                                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                              >
                                {isResolvingThisOrder ? 'Resolving...' : 'Mark follow-up resolved'}
                              </button>
                            )}
                            {canMoveToAssignment && (
                              <button
                                type="button"
                                onClick={() => quickRetryMutation.mutate(order.id)}
                                disabled={isRetryingThisOrder || isResolvingThisOrder}
                                className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
                              >
                                {isRetryingThisOrder ? 'Moving...' : 'Move to assignment'}
                              </button>
                            )}
                            <Link
                              to={`/app/orders/${order.id}`}
                              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                            >
                              Open recovery detail
                            </Link>
                          </div>
                          {!latestFailureRecovery && (
                            <p className="text-xs text-gray-500">Open the order detail to choose retry, customer follow-up, or closure.</p>
                          )}
                          {latestFailureRecovery && !canMoveToAssignment && !openFollowUp && (
                            <p className="text-xs text-gray-500">No row action is pending. Open the detail page to review or record another decision.</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
              {!isLoading && orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No orders found.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Loading orders...
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
          {isFetching && !isLoading ? ' • Refreshing' : ''}
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

function JourneyMetric({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  tone: 'blue' | 'amber' | 'green' | 'red';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
