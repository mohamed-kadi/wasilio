import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, Bookmark, ChevronLeft, ChevronRight, PlusCircle, Save, Trash2, X } from 'lucide-react';
import {
  createOrderSearchSavedView,
  deleteOrderSearchSavedView,
  fetchCouriers,
  fetchFailedOrderRecoveryQueue,
  fetchFailedOrderRecoverySummaries,
  fetchOrders,
  fetchOrderSearchSavedViews,
  getErrorMessage,
  retryFailedDelivery,
  updateOrderSearchSavedView,
} from '../api/client';
import { orderLineSummary } from '../lib/orderLines';
import type {
  DeliveryFailureRecoveryState,
  FailedOrderRecoveryQueueResponse,
  FailedOrderRecoverySummary,
  Order,
  OrdersPageResponse,
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
  CONFIRMED: 'Ready for delivery',
  REJECTED: 'Rejected',
  ASSIGNED_TO_COURIER: 'In delivery',
  PICKED_UP: 'Out for delivery',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
};

const statusStages: Record<OrderStatus, string> = {
  CREATED: 'Needs attention',
  CONFIRMATION_REQUESTED: 'Needs attention',
  CONFIRMED: 'Ready for delivery',
  REJECTED: 'Closed',
  ASSIGNED_TO_COURIER: 'In delivery',
  PICKED_UP: 'In delivery',
  DELIVERED: 'Closed',
  FAILED: 'Needs review',
};

const failureReasonLabels: Record<string, string> = {
  CUSTOMER_UNREACHABLE: 'Customer unreachable',
  CUSTOMER_REFUSED: 'Customer refused',
  INVALID_ADDRESS: 'Invalid address',
  CUSTOMER_RESCHEDULED: 'Customer rescheduled',
  LOST_PACKAGE: 'Lost package',
  OTHER: 'Other',
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

const statusPresets: Array<{ value: string; label: string; statuses: OrderStatus[] }> = [
  { value: 'ALL', label: 'All statuses', statuses: [] },
  { value: 'NEEDS_CONFIRMATION', label: 'Needs confirmation', statuses: ['CREATED', 'CONFIRMATION_REQUESTED'] },
  { value: 'IN_DELIVERY', label: 'In delivery', statuses: ['CONFIRMED', 'ASSIGNED_TO_COURIER', 'PICKED_UP'] },
  { value: 'DELIVERED', label: 'Delivered', statuses: ['DELIVERED'] },
  { value: 'FAILED', label: 'Failed', statuses: ['FAILED'] },
  { value: 'CLOSED', label: 'Completed / closed', statuses: ['DELIVERED', 'REJECTED'] },
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
  failureRecoveryFilter?: FailureRecoveryFilter;
}

type FailureRecoveryFilter = DeliveryFailureRecoveryState;

const failureRecoveryFilters: Array<{ value: FailureRecoveryFilter; label: string; detail: string }> = [
  { value: 'ALL', label: 'All recovery', detail: 'Every failed order in recovery' },
  { value: 'NEEDS_DECISION', label: 'Needs decision', detail: 'Choose retry, follow-up, refund, or close' },
  { value: 'OPEN_FOLLOW_UP', label: 'Waiting follow-up', detail: 'Customer follow-up is still open' },
  { value: 'RETRY_READY', label: 'Retry ready', detail: 'Ready to return to assignment' },
  { value: 'REFUND_REVIEW', label: 'Refund review', detail: 'Refund or customer review recorded' },
  { value: 'CLOSED_UNRECOVERABLE', label: 'Closed', detail: 'No further recovery action' },
];

const recoveryOverviewFilters: FailureRecoveryFilter[] = [
  'NEEDS_DECISION',
  'OPEN_FOLLOW_UP',
  'RETRY_READY',
  'REFUND_REVIEW',
  'CLOSED_UNRECOVERABLE',
];

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

function sameStatuses(left: OrderStatus[], right: OrderStatus[]) {
  return left.length === right.length && left.every((status) => right.includes(status));
}

function statusPresetValue(currentStatuses: OrderStatus[]) {
  const preset = statusPresets.find((option) => sameStatuses(option.statuses, currentStatuses));
  return preset?.value ?? 'CUSTOM';
}

function looksLikePhoneSearch(value: string) {
  return /^[+\d][\d\s().-]{4,}$/.test(value);
}

function looksLikeOrderIdSearch(value: string) {
  return /^[0-9a-f]{8,}/i.test(value) || /^[0-9a-f-]{12,}$/i.test(value);
}

function filtersFromSimpleSearch(value: string, currentFilters: OrderFilters): OrderFilters {
  const nextFilters = {
    ...currentFilters,
    phone: '',
    customerName: '',
    orderId: '',
  };
  const trimmed = value.trim();
  if (!trimmed) {
    return nextFilters;
  }
  if (looksLikePhoneSearch(trimmed)) {
    return { ...nextFilters, phone: trimmed };
  }
  if (looksLikeOrderIdSearch(trimmed)) {
    return { ...nextFilters, orderId: trimmed };
  }
  return { ...nextFilters, customerName: trimmed };
}

function formatFailureReason(reason?: string) {
  if (!reason) {
    return undefined;
  }
  return failureReasonLabels[reason] ?? reason.replace(/_/g, ' ').toLowerCase();
}

function orderMovedToAssignment(order: Order): Order {
  return {
    ...order,
    status: 'CONFIRMED',
    courierId: undefined,
    failureReason: undefined,
    updatedAt: new Date().toISOString(),
    version: order.version + 1,
  };
}

type RecoveryTone = 'gray' | 'red' | 'amber' | 'blue' | 'green';

const recoveryTones: Record<RecoveryTone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-emerald-100 text-emerald-800',
};

interface RecoveryListStatus {
  label: string;
  actionLabel: string;
  tone: RecoveryTone;
  retryReady: boolean;
}

function recoveryListStatus(summary?: FailedOrderRecoverySummary): RecoveryListStatus {
  const latestRecovery = summary?.latestRecovery ?? undefined;
  const openFollowUp = summary?.openFollowUp ?? undefined;

  if (!latestRecovery) {
    return {
      label: 'Needs decision',
      actionLabel: 'Continue Recovery',
      tone: 'red',
      retryReady: false,
    };
  }

  if (openFollowUp) {
    return {
      label: 'Waiting follow-up',
      actionLabel: 'Continue Follow-up',
      tone: 'amber',
      retryReady: false,
    };
  }

  if (latestRecovery.decision === 'RETRY_DELIVERY') {
    return {
      label: 'Retry ready',
      actionLabel: 'Return to Assignment',
      tone: 'blue',
      retryReady: true,
    };
  }

  if (latestRecovery.decision === 'REFUND_OR_CUSTOMER_FOLLOW_UP') {
    return {
      label: 'Refund review',
      actionLabel: 'Review Refund',
      tone: 'amber',
      retryReady: false,
    };
  }

  return {
    label: 'Closed',
    actionLabel: 'View Details',
    tone: 'gray',
    retryReady: false,
  };
}

function orderActionLabel(order: Order, recoveryStatus?: RecoveryListStatus) {
  if (order.status === 'FAILED') {
    return recoveryStatus?.actionLabel ?? 'Continue Recovery';
  }
  if (order.status === 'CREATED' || order.status === 'CONFIRMATION_REQUESTED') {
    return 'Continue Confirmation';
  }
  if (order.status === 'CONFIRMED') {
    return 'Assign Courier';
  }
  if (order.status === 'ASSIGNED_TO_COURIER') {
    return 'Courier Details';
  }
  if (order.status === 'PICKED_UP') {
    return 'Delivery Details';
  }
  return 'View Details';
}

function updateRecoveryQueueAfterRetry(pageData: FailedOrderRecoveryQueueResponse | undefined, orderId: string) {
  if (!pageData || !pageData.content.some((item) => item.order.id === orderId)) {
    return pageData;
  }

  const nextTotalElements = Math.max(0, pageData.totalElements - 1);
  return {
    ...pageData,
    content: pageData.content.filter((item) => item.order.id !== orderId),
    totalElements: nextTotalElements,
    totalPages: pageData.size > 0 ? Math.ceil(nextTotalElements / pageData.size) : pageData.totalPages,
    counts: {
      ...pageData.counts,
      all: Math.max(0, pageData.counts.all - 1),
      retryReady: Math.max(0, pageData.counts.retryReady - 1),
    },
  };
}

function updateOrdersPageAfterRetry(
  pageData: OrdersPageResponse | undefined,
  orderId: string,
  activeStatuses: OrderStatus[],
) {
  if (!pageData || !pageData.content.some((order) => order.id === orderId)) {
    return pageData;
  }

  const shouldRemoveFromCurrentPage = activeStatuses.length > 0 && !activeStatuses.includes('CONFIRMED');
  if (shouldRemoveFromCurrentPage) {
    const nextTotalElements = Math.max(0, pageData.totalElements - 1);
    return {
      ...pageData,
      content: pageData.content.filter((order) => order.id !== orderId),
      totalElements: nextTotalElements,
      totalPages: pageData.size > 0 ? Math.ceil(nextTotalElements / pageData.size) : pageData.totalPages,
    };
  }

  return {
    ...pageData,
    content: pageData.content.map((order) => (order.id === orderId ? orderMovedToAssignment(order) : order)),
  };
}

export default function OrdersList() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const locationState = location.state as OrdersLocationState | null;
  const locationStatuses = getLocationStatuses(locationState);
  const initialStatuses: OrderStatus[] = locationState?.failureRecoveryFilter && !locationStatuses.includes('FAILED')
    ? ['FAILED']
    : locationStatuses;
  const initialFailureRecoveryFilter = failureRecoveryFilters.some((filterOption) => (
    filterOption.value === locationState?.failureRecoveryFilter
  ))
    ? locationState?.failureRecoveryFilter ?? 'ALL'
    : 'ALL';
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [filters, setFilters] = useState<OrderFilters>(() => ({
    ...emptyFilters,
    statuses: initialStatuses,
  }));
  const [simpleSearch, setSimpleSearch] = useState('');
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(
    statusPresetValue(initialStatuses) === 'CUSTOM' || initialFailureRecoveryFilter !== 'ALL',
  );
  const [recoveryFocus, setRecoveryFocus] = useState(Boolean(locationState?.recoveryFocus || locationState?.failureRecoveryFilter));
  const [failureRecoveryFilter, setFailureRecoveryFilter] = useState<FailureRecoveryFilter>(initialFailureRecoveryFilter);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('');
  const [savedViewName, setSavedViewName] = useState('');
  const isFailureRecoveryView = recoveryFocus || filters.statuses.includes('FAILED');
  const ordersQueryKey = ['orders', { page, size, filters }] as const;
  const failedRecoveryQueueQueryKey = ['failed-order-recovery-queue', { page, size, filters, state: failureRecoveryFilter }] as const;

  const {
    data: ordersPage,
    error: ordersError,
    isLoading: isLoadingOrders,
    isFetching: isFetchingOrders,
  } = useQuery({
    queryKey: ordersQueryKey,
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
    enabled: !isFailureRecoveryView,
  });

  const {
    data: failedRecoveryQueuePage,
    error: failedRecoveryQueueError,
    isLoading: isLoadingFailedRecoveryQueue,
    isFetching: isFetchingFailedRecoveryQueue,
  } = useQuery({
    queryKey: failedRecoveryQueueQueryKey,
    queryFn: () =>
      fetchFailedOrderRecoveryQueue({
        page,
        size,
        state: failureRecoveryFilter,
        phone: filters.phone,
        customerName: filters.customerName,
        orderId: filters.orderId,
        courierId: filters.courierId,
        createdFrom: toInstantFromDate(filters.createdFrom),
        createdTo: toInstantFromDate(filters.createdTo, true),
      }),
    enabled: isFailureRecoveryView,
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

  const standardOrders = ordersPage?.content ?? [];
  const failedRecoveryItems = failedRecoveryQueuePage?.content ?? [];
  const orders = isFailureRecoveryView ? failedRecoveryItems.map((item) => item.order) : standardOrders;
  const couriers = couriersPage?.content ?? [];
  const totalPages = isFailureRecoveryView ? failedRecoveryQueuePage?.totalPages ?? 0 : ordersPage?.totalPages ?? 0;
  const totalElements = isFailureRecoveryView ? failedRecoveryQueuePage?.totalElements ?? 0 : ordersPage?.totalElements ?? 0;
  const error = isFailureRecoveryView ? failedRecoveryQueueError : ordersError;
  const isLoading = isFailureRecoveryView ? isLoadingFailedRecoveryQueue : isLoadingOrders;
  const isFetching = isFailureRecoveryView ? isFetchingFailedRecoveryQueue : isFetchingOrders;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const selectedSavedView = savedViews.find((view) => view.viewId === selectedSavedViewId);
  const visibleFailedOrders = orders.filter((order) => order.status === 'FAILED');
  const failedOrderIds = isFailureRecoveryView ? [] : visibleFailedOrders.map((order) => order.id);
  const recoverySummariesQueryKey = ['failed-order-recovery-summaries', failedOrderIds] as const;
  const {
    data: recoverySummaries = [],
    error: recoverySummariesError,
    isFetching: isFetchingRecoverySummaries,
  } = useQuery({
    queryKey: recoverySummariesQueryKey,
    queryFn: () => fetchFailedOrderRecoverySummaries(failedOrderIds),
    enabled: !isFailureRecoveryView && failedOrderIds.length > 0,
  });
  const failedRecoveryQueueSummariesByOrderId = new Map<string, FailedOrderRecoverySummary>(
    failedRecoveryItems.map((item) => [item.recovery.orderId, item.recovery]),
  );
  const recoverySummariesByOrderId = new Map<string, FailedOrderRecoverySummary>(
    isFailureRecoveryView
      ? failedRecoveryQueueSummariesByOrderId
      : recoverySummaries.map((summary) => [summary.orderId, summary]),
  );
  const recoveryCounts = failedRecoveryQueuePage?.counts;
  const visibleJourneyCounts = {
    confirm: countByStatus(orders, 'CREATED') + countByStatus(orders, 'CONFIRMATION_REQUESTED'),
    courier:
      countByStatus(orders, 'CONFIRMED') + countByStatus(orders, 'ASSIGNED_TO_COURIER') + countByStatus(orders, 'PICKED_UP'),
    closed: countByStatus(orders, 'DELIVERED') + countByStatus(orders, 'REJECTED'),
    failed: isFailureRecoveryView ? recoveryCounts?.all ?? 0 : visibleFailedOrders.length,
  };
  const recoveryFilterCounts = new Map<FailureRecoveryFilter, number>(
    failureRecoveryFilters.map((filterOption) => [
      filterOption.value,
      {
        ALL: recoveryCounts?.all ?? visibleFailedOrders.length,
        NEEDS_DECISION: recoveryCounts?.needsDecision ?? 0,
        OPEN_FOLLOW_UP: recoveryCounts?.openFollowUp ?? 0,
        RETRY_READY: recoveryCounts?.retryReady ?? 0,
        REFUND_REVIEW: recoveryCounts?.refundReview ?? 0,
        CLOSED_UNRECOVERABLE: recoveryCounts?.closedUnrecoverable ?? 0,
      }[filterOption.value],
    ]),
  );
  const displayedOrders = orders;
  const selectedStatusPreset = statusPresetValue(filters.statuses);
  const advancedFiltersActive = selectedStatusPreset === 'CUSTOM'
    || Boolean(filters.courierId)
    || failureRecoveryFilter !== 'ALL'
    || selectedSavedViewId !== ''
    || size !== 20;

  const quickRetryMutation = useMutation({
    mutationFn: (orderId: string) => retryFailedDelivery(orderId),
    onMutate: async (orderId) => {
      await queryClient.cancelQueries({ queryKey: ordersQueryKey });
      await queryClient.cancelQueries({ queryKey: failedRecoveryQueueQueryKey });
      const previousOrdersPage = queryClient.getQueryData<OrdersPageResponse>(ordersQueryKey);
      const previousFailedRecoveryQueue = queryClient.getQueryData<FailedOrderRecoveryQueueResponse>(failedRecoveryQueueQueryKey);
      const previousOrder = queryClient.getQueryData<Order>(['order', orderId]);

      queryClient.setQueryData<OrdersPageResponse | undefined>(
        ordersQueryKey,
        (currentPage) => updateOrdersPageAfterRetry(currentPage, orderId, filters.statuses),
      );
      queryClient.setQueryData<FailedOrderRecoveryQueueResponse | undefined>(
        failedRecoveryQueueQueryKey,
        (currentPage) => updateRecoveryQueueAfterRetry(currentPage, orderId),
      );
      queryClient.setQueryData<Order | undefined>(
        ['order', orderId],
        (currentOrder) => (currentOrder ? orderMovedToAssignment(currentOrder) : currentOrder),
      );

      return { previousFailedRecoveryQueue, previousOrder, previousOrdersPage };
    },
    onError: (_error, orderId, context) => {
      if (context?.previousOrdersPage) {
        queryClient.setQueryData(ordersQueryKey, context.previousOrdersPage);
      }
      if (context?.previousFailedRecoveryQueue) {
        queryClient.setQueryData(failedRecoveryQueueQueryKey, context.previousFailedRecoveryQueue);
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(['order', orderId], context.previousOrder);
      }
    },
    onSuccess: (_result, orderId) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['order', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['delivery-failure-recoveries', orderId] }),
        queryClient.invalidateQueries({ queryKey: ['failed-order-recovery-summaries'] }),
        queryClient.invalidateQueries({ queryKey: ['failed-order-recovery-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['courier-assignment-queue'] }),
      ]);
    },
  });

  function updateFilter<K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
    if (key === 'statuses') {
      setRecoveryFocus((value as OrderStatus[]).includes('FAILED'));
      if (!(value as OrderStatus[]).includes('FAILED')) {
        setFailureRecoveryFilter('ALL');
      }
    }
    setPage(0);
  }

  function updatePreciseSearchFilter<K extends 'customerName' | 'phone' | 'orderId'>(key: K, value: OrderFilters[K]) {
    setSimpleSearch('');
    updateFilter(key, value);
  }

  function updateSimpleSearch(value: string) {
    setSimpleSearch(value);
    setFilters((currentFilters) => filtersFromSimpleSearch(value, currentFilters));
    setPage(0);
  }

  function applyStatusPreset(presetValue: string) {
    const preset = statusPresets.find((option) => option.value === presetValue);
    if (!preset) {
      return;
    }
    updateFilter('statuses', preset.statuses);
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
    const nextFilters = savedPayloadToFilters(savedView.filters);
    setSimpleSearch('');
    setAdvancedFiltersOpen(true);
    setFilters(nextFilters);
    setRecoveryFocus(nextFilters.statuses.includes('FAILED'));
    if (!nextFilters.statuses.includes('FAILED')) {
      setFailureRecoveryFilter('ALL');
    }
    setSavedViewName(savedView.name);
    setPage(0);
  }

  function clearFilters() {
    setSimpleSearch('');
    setFilters(emptyFilters);
    setRecoveryFocus(false);
    setFailureRecoveryFilter('ALL');
    setSelectedSavedViewId('');
    setSavedViewName('');
    setAdvancedFiltersOpen(false);
    setPage(0);
  }

  function applyFailedRecoveryView() {
    setSimpleSearch('');
    setFilters({
      ...emptyFilters,
      statuses: ['FAILED'],
    });
    setRecoveryFocus(true);
    setFailureRecoveryFilter('ALL');
    setSelectedSavedViewId('');
    setSavedViewName('');
    setAdvancedFiltersOpen(false);
    setPage(0);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Orders</h2>
          <p className="text-sm text-gray-500">{totalElements} total orders across attention, progress, closed, and review states</p>
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
        <JourneyMetric title="Needs attention" value={visibleJourneyCounts.confirm} detail="New orders or waiting for confirmation" tone="blue" />
        <JourneyMetric title="In progress" value={visibleJourneyCounts.courier} detail="Confirmed, assigned, or in delivery" tone="amber" />
        <JourneyMetric title="Completed / closed" value={visibleJourneyCounts.closed} detail="Delivered or rejected orders" tone="green" />
        <JourneyMetric title="Failed / needs review" value={visibleJourneyCounts.failed} detail="Failed deliveries needing review" tone="red" />
      </section>

      {isFailureRecoveryView && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase">Recovery stage</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">Failed delivery recovery</h3>
              <p className="mt-1 max-w-3xl text-sm text-red-800">
                Decide the next action for failed deliveries, continue open follow-ups, return retry-ready orders to assignment,
                or review refund and closed recovery work.
              </p>
            </div>
            <Link
              to="/app/couriers/performance"
              className="inline-flex h-10 items-center rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Review courier performance
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {recoveryOverviewFilters.map((filterValue) => {
              const filterOption = failureRecoveryFilters.find((option) => option.value === filterValue);
              if (!filterOption) {
                return null;
              }
              return (
                <RecoveryCountCard
                  key={filterValue}
                  label={filterOption.label}
                  value={recoveryFilterCounts.get(filterValue) ?? 0}
                  detail={filterOption.detail}
                  tone={recoveryToneForFilter(filterValue)}
                />
              );
            })}
          </div>

          <div className="mt-4 border-t border-red-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-red-950">Recovery status</p>
                <p className="text-xs text-red-700">Filter failed orders without changing recovery rules.</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-800 ring-1 ring-red-200">
                {failureRecoveryFilters.find((option) => option.value === failureRecoveryFilter)?.label ?? 'All recovery'}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
              {failureRecoveryFilters.map((filterOption) => {
                const isActive = failureRecoveryFilter === filterOption.value;
                const count = recoveryFilterCounts.get(filterOption.value) ?? 0;

                return (
                  <button
                    key={filterOption.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setFailureRecoveryFilter(filterOption.value);
                      setPage(0);
                    }}
                    className={`min-h-[4.5rem] rounded-md border border-red-200 px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? 'bg-white text-red-950 ring-1 ring-inset ring-red-500'
                        : 'bg-red-50 text-red-800 hover:bg-white'
                    }`}
                  >
                    <span className="block font-semibold">{filterOption.label} ({count})</span>
                    <span className="block text-xs text-red-700">{filterOption.detail}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <div className="space-y-4 bg-white border border-gray-200 rounded-lg px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500">Search and filters</h3>
            <p className="mt-1 text-sm text-gray-600">Find orders quickly, then open advanced filters for operations work.</p>
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

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="order-search">
              Search
            </label>
            <input
              id="order-search"
              value={simpleSearch}
              onChange={(event) => updateSimpleSearch(event.target.value)}
              placeholder="Customer, phone, or order ID"
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="status-preset">
              Status
            </label>
            <select
              id="status-preset"
              value={selectedStatusPreset}
              onChange={(event) => applyStatusPreset(event.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {selectedStatusPreset === 'CUSTOM' && <option value="CUSTOM" disabled>Custom advanced statuses</option>}
              {statusPresets.map((preset) => (
                <option key={preset.value} value={preset.value}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
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
            <span className="block text-sm font-medium text-transparent">Clear</span>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <X size={16} />
              Clear
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <button
            type="button"
            aria-expanded={advancedFiltersOpen}
            onClick={() => setAdvancedFiltersOpen((open) => !open)}
            className="inline-flex h-9 min-w-[12rem] items-center justify-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Advanced filters
            <span
              aria-hidden="true"
              className={`rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ${
                advancedFiltersActive ? '' : 'invisible'
              }`}
            >
              Active
            </span>
          </button>

          {advancedFiltersOpen && (
            <div className="mt-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
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
              <div>
                <label className="block text-sm font-medium text-gray-700" htmlFor="recovery-state">
                  Failed recovery state
                </label>
                <select
                  id="recovery-state"
                  value={failureRecoveryFilter}
                  onChange={(event) => {
                    const nextRecoveryFilter = event.target.value as FailureRecoveryFilter;
                    setFailureRecoveryFilter(nextRecoveryFilter);
                    if (nextRecoveryFilter !== 'ALL' && !filters.statuses.includes('FAILED')) {
                      updateFilter('statuses', ['FAILED']);
                    }
                    setPage(0);
                  }}
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {failureRecoveryFilters.map((filterOption) => (
                    <option key={filterOption.value} value={filterOption.value}>
                      {filterOption.label}
                    </option>
                  ))}
                </select>
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
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Precise search fields</p>
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700" htmlFor="customer-name">
                    Customer
                  </label>
                  <input
                    id="customer-name"
                    value={filters.customerName}
                    onChange={(event) => updatePreciseSearchFilter('customerName', event.target.value)}
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
                    onChange={(event) => updatePreciseSearchFilter('phone', event.target.value)}
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
                    onChange={(event) => updatePreciseSearchFilter('orderId', event.target.value)}
                    placeholder="Full or partial ID"
                    className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Lifecycle status</p>
              <div className="mt-2 flex flex-wrap gap-2">
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
                    {statusLabels[statusOption]}
                  </label>
                ))}
              </div>
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
          )}
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
      {quickRetryMutation.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(quickRetryMutation.error)}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Order ID</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">{isFailureRecoveryView ? 'Failure reason' : 'Current status'}</th>
                <th className="px-4 py-3 font-medium">Recovery status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {displayedOrders.map((order) => {
                const failureReason = formatFailureReason(order.failureReason);
                const recoverySummary = recoverySummariesByOrderId.get(order.id);
                const recoveryStatus = order.status === 'FAILED' ? recoveryListStatus(recoverySummary) : undefined;
                const recoverySummaryUnavailable = order.status === 'FAILED' && Boolean(recoverySummariesError);
                const recoverySummaryPending = order.status === 'FAILED' && isFetchingRecoverySummaries && !recoverySummary;
                const productSummary = orderLineSummary(order.orderLines);
                const isRetryingThisOrder = quickRetryMutation.isPending
                  && quickRetryMutation.variables === order.id;
                const actionLabel = recoverySummaryUnavailable || recoverySummaryPending
                  ? 'View Details'
                  : orderActionLabel(order, recoveryStatus);
                const showRetryAction = recoveryStatus?.retryReady && !recoverySummaryUnavailable && !recoverySummaryPending;

                const rowClassName = isFailureRecoveryView
                  ? 'hover:bg-gray-50'
                  : order.status === 'FAILED'
                    ? 'bg-red-50/40 hover:bg-red-50'
                    : 'hover:bg-gray-50';

                return (
                  <tr key={order.id} className={rowClassName}>
                    <td className="px-4 py-3 font-mono text-gray-500">
                      <Link to={`/app/orders/${order.id}`} className="text-blue-600 hover:underline">
                        {order.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {order.customer.firstName} {order.customer.lastName}
                      </p>
                      <p className="text-gray-500">{order.customer.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      {productSummary ? (
                        <span className="text-sm font-medium text-gray-800">{productSummary}</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{order.amount.toFixed(2)} MAD</td>
                    <td className="px-4 py-3">
                      {isFailureRecoveryView ? (
                        <span className="text-sm font-medium text-gray-800">{failureReason ?? 'Not recorded'}</span>
                      ) : (
                        <>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                            {statusLabels[order.status]}
                          </span>
                          <p className="mt-1 text-xs text-gray-500">{statusStages[order.status]}</p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'FAILED' ? (
                        <>
                          {recoverySummariesError ? (
                            <span className="text-sm font-medium text-red-700">Recovery unavailable</span>
                          ) : isFetchingRecoverySummaries && !recoverySummary ? (
                            <span className="text-sm font-medium text-gray-500">Loading...</span>
                          ) : (
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${recoveryTones[recoveryStatus?.tone ?? 'red']}`}>
                              {recoveryStatus?.label}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {showRetryAction ? (
                        <button
                          type="button"
                          onClick={() => quickRetryMutation.mutate(order.id)}
                          disabled={isRetryingThisOrder}
                          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isRetryingThisOrder ? 'Returning...' : actionLabel}
                        </button>
                      ) : (
                        <Link
                          to={`/app/orders/${order.id}`}
                          className={`inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium ${
                            order.status === 'FAILED' && recoveryStatus?.tone !== 'gray'
                              ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {actionLabel}
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && displayedOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    {isFailureRecoveryView ? 'No failed orders match this recovery filter.' : 'No orders found.'}
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

function RecoveryCountCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: RecoveryTone;
}) {
  const tones = {
    gray: 'border-gray-200 bg-white text-gray-600',
    red: 'border-red-200 bg-white text-red-700',
    amber: 'border-amber-200 bg-white text-amber-700',
    blue: 'border-blue-200 bg-white text-blue-700',
    green: 'border-emerald-200 bg-white text-emerald-700',
  };

  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs">{detail}</p>
    </div>
  );
}

function recoveryToneForFilter(filter: FailureRecoveryFilter): RecoveryTone {
  if (filter === 'NEEDS_DECISION') {
    return 'red';
  }
  if (filter === 'OPEN_FOLLOW_UP' || filter === 'REFUND_REVIEW') {
    return 'amber';
  }
  if (filter === 'RETRY_READY') {
    return 'blue';
  }
  return 'gray';
}
