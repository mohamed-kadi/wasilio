import { useAuthStore, type BlockedTenantStatus } from '../store/authStore';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export interface FieldError {
  field: string;
  message: string;
}

export interface ProblemResponse {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  error?: string;
  timestamp?: string;
  tenantStatus?: string;
  fieldErrors?: FieldError[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly fieldErrors: FieldError[];
  readonly tenantStatus?: string;

  constructor(status: number, problem: ProblemResponse) {
    const title = problem.title ?? 'Request failed';
    const detail = problem.detail ?? problem.error ?? `Request failed with status ${status}`;
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.fieldErrors = problem.fieldErrors ?? [];
    this.tenantStatus = problem.tenantStatus;
  }
}

export interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export type OrderStatus =
  | 'CREATED'
  | 'CONFIRMATION_REQUESTED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'ASSIGNED_TO_COURIER'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'FAILED';

export interface Order {
  id: string;
  tenantId: string;
  status: OrderStatus;
  customer: Customer;
  address: Address;
  amount: number;
  courierId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface OrdersPageResponse {
  content: Order[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface Courier {
  courierId: string;
  tenantId: string;
  name: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

export interface CouriersPageResponse {
  content: Courier[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CouriersQuery {
  page?: number;
  size?: number;
}

export interface CourierPayload {
  name: string;
  phone: string;
}

export interface CourierOperationsQueueQuery {
  page?: number;
  size?: number;
  courierId?: string;
  status?: OrderStatus | '';
  createdFrom?: string;
  createdTo?: string;
}

export type DeliveryFailureReason =
  | 'CUSTOMER_UNREACHABLE'
  | 'CUSTOMER_REFUSED'
  | 'INVALID_ADDRESS'
  | 'CUSTOMER_RESCHEDULED'
  | 'LOST_PACKAGE'
  | 'OTHER';

export interface DeliveryFailure {
  failureId: string;
  tenantId: string;
  orderId: string;
  courierId: string;
  reason: DeliveryFailureReason;
  note?: string;
  createdAt: string;
}

export interface CourierPerformance {
  courierId: string;
  courierName: string;
  active: boolean;
  assignedOrdersCount: number;
  pickedUpOrdersCount: number;
  deliveredOrdersCount: number;
  failedOrdersCount: number;
  deliverySuccessRate: number;
}

export interface OrdersQuery {
  page?: number;
  size?: number;
  status?: OrderStatus | OrderStatus[] | '';
  phone?: string;
  customerName?: string;
  orderId?: string;
  courierId?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface OrderSearchSavedView {
  viewId: string;
  name: string;
  filters: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSearchSavedViewPayload {
  name: string;
  filters: Record<string, string>;
}

export type ConfirmationOutcome =
  | 'CONFIRMED'
  | 'REJECTED'
  | 'NO_ANSWER'
  | 'CALL_BACK_LATER'
  | 'WRONG_NUMBER';

export interface ConfirmationQueueQuery {
  page?: number;
  size?: number;
  status?: 'CREATED' | 'CONFIRMATION_REQUESTED' | '';
  createdFrom?: string;
  createdTo?: string;
  search?: string;
}

export interface ConfirmationAttempt {
  attemptId: string;
  tenantId: string;
  orderId: string;
  attemptNumber: number;
  outcome: ConfirmationOutcome;
  note?: string;
  callbackAt?: string;
  callbackResolvedAt?: string;
  callbackResolvedBy?: string;
  createdBy: string;
  createdAt: string;
}

export type ConfirmationCallbackScope = 'DUE' | 'OVERDUE' | 'UPCOMING' | 'ALL';

export type ConfirmationCallbackStatus = 'DUE' | 'OVERDUE' | 'UPCOMING' | 'RESOLVED';

export interface ConfirmationCallback {
  callbackId: string;
  tenantId: string;
  orderId: string;
  attemptNumber: number;
  callbackAt: string;
  status: ConfirmationCallbackStatus;
  note?: string;
  createdBy: string;
  createdAt: string;
  order: Order;
}

export interface ConfirmationCallbacksPageResponse {
  content: ConfirmationCallback[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ConfirmationCallbacksQuery {
  page?: number;
  size?: number;
  scope?: ConfirmationCallbackScope;
  callbackFrom?: string;
  callbackTo?: string;
}

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateSequence: number;
  eventSchemaVersion: number;
  timestamp: string;
  payload: string;
}

export type OrderTimelineSource = 'DOMAIN_EVENT' | 'OPERATIONAL_RECORD';

export type OrderTimelineCategory = 'LIFECYCLE' | 'CONFIRMATION' | 'CALLBACK' | 'DELIVERY';

export interface OrderTimelineItem {
  itemId: string;
  source: OrderTimelineSource;
  category: OrderTimelineCategory;
  type: string;
  title: string;
  timestamp: string;
  actor?: string;
  details: Record<string, unknown>;
}

export interface CreateOrderPayload {
  customer: Customer;
  address: Address;
  amount: number;
}

export interface LoginResponse {
  token: string;
}

export interface TenantOnboardingPayload {
  tenantName: string;
  adminName: string;
  adminEmail: string;
  password: string;
}

export interface TenantOnboardingResponse {
  tenantId: string;
  tenantName: string;
  workspaceId: string;
  workspaceName: string;
  adminUserId: string;
  adminEmail: string;
  adminRole: string;
}

export type TenantStatus = 'ACTIVE' | 'TRIALING' | 'OVERDUE' | 'SUSPENDED' | 'DISABLED';

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED' | 'CANCELED';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';

export type MarketingLeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'REJECTED' | 'ONBOARDED';

export interface SubscriptionPlan {
  planId: string;
  code: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  orderLimit?: number;
  userLimit?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSubscription {
  subscriptionId: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantPayment {
  paymentId: string;
  tenantId: string;
  subscriptionId?: string;
  receiptNumber: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
  paidAt: string;
  periodStart?: string;
  periodEnd?: string;
  collectedBy: string;
  notes?: string;
  createdAt: string;
}

export interface TenantPaymentReceipt extends TenantPayment {
  tenantName: string;
  tenantStatus: TenantStatus;
  subscriptionStatus?: SubscriptionStatus;
  plan?: SubscriptionPlan;
}

export interface AdminTenantSummary {
  tenantId: string;
  name: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  usersCount: number;
  ordersCount: number;
  subscription?: TenantSubscription;
  plan?: SubscriptionPlan;
}

export interface AdminTenantDetail extends AdminTenantSummary {
  payments: TenantPayment[];
}

export interface CreateSubscriptionPlanPayload {
  code: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  orderLimit?: number;
  userLimit?: number;
}

export interface UpsertTenantSubscriptionPayload {
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
}

export interface RecordTenantPaymentPayload {
  method: PaymentMethod;
  amount: number;
  currency: string;
  paidAt?: string;
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
}

export interface MarketingLeadPayload {
  contactName: string;
  storeName: string;
  phone: string;
  email?: string;
  city?: string;
  monthlyOrderVolume?: string;
  message?: string;
  campaignSource?: string;
}

export interface MarketingLead {
  leadId: string;
  contactName: string;
  storeName: string;
  phone: string;
  email?: string;
  city?: string;
  monthlyOrderVolume?: string;
  message?: string;
  campaignSource?: string;
  status: MarketingLeadStatus;
  nextFollowUpAt?: string;
  internalNotes?: string;
  createdAt: string;
}

export interface MarketingLeadFollowUpPayload {
  status: MarketingLeadStatus;
  nextFollowUpAt?: string;
  internalNotes?: string;
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, password }),
  });
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/password-reset/request', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/password-reset/confirm', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function onboardTenant(data: TenantOnboardingPayload): Promise<TenantOnboardingResponse> {
  return apiRequest<TenantOnboardingResponse>('/onboarding/tenants', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(data),
  });
}

export async function captureMarketingLead(data: MarketingLeadPayload): Promise<MarketingLead> {
  return apiRequest<MarketingLead>('/marketing/leads', {
    method: 'POST',
    auth: false,
    body: JSON.stringify(data),
  });
}

export async function fetchMarketingLeads(): Promise<MarketingLead[]> {
  return apiRequest<MarketingLead[]>('/marketing/leads');
}

export async function updateMarketingLeadFollowUp(
  leadId: string,
  data: MarketingLeadFollowUpPayload,
): Promise<MarketingLead> {
  return apiRequest<MarketingLead>(`/marketing/leads/${leadId}/follow-up`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function fetchAdminTenants(): Promise<AdminTenantSummary[]> {
  return apiRequest<AdminTenantSummary[]>('/admin/tenants');
}

export async function fetchAdminTenant(tenantId: string): Promise<AdminTenantDetail> {
  return apiRequest<AdminTenantDetail>(`/admin/tenants/${tenantId}`);
}

export async function updateAdminTenantStatus(tenantId: string, status: TenantStatus): Promise<AdminTenantDetail> {
  return apiRequest<AdminTenantDetail>(`/admin/tenants/${tenantId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return apiRequest<SubscriptionPlan[]>('/admin/plans');
}

export async function createSubscriptionPlan(payload: CreateSubscriptionPlanPayload): Promise<SubscriptionPlan> {
  return apiRequest<SubscriptionPlan>('/admin/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function upsertTenantSubscription(
  tenantId: string,
  payload: UpsertTenantSubscriptionPayload,
): Promise<AdminTenantDetail> {
  return apiRequest<AdminTenantDetail>(`/admin/tenants/${tenantId}/subscription`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function recordTenantPayment(
  tenantId: string,
  payload: RecordTenantPaymentPayload,
): Promise<TenantPayment> {
  return apiRequest<TenantPayment>(`/admin/tenants/${tenantId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchTenantPaymentReceipt(tenantId: string, paymentId: string): Promise<TenantPaymentReceipt> {
  return apiRequest<TenantPaymentReceipt>(`/admin/tenants/${tenantId}/payments/${paymentId}/receipt`);
}

export async function fetchOrders(query: OrdersQuery = {}): Promise<OrdersPageResponse> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 20));
  const statuses = Array.isArray(query.status) ? query.status : query.status ? [query.status] : [];
  statuses.forEach((status) => params.append('status', status));
  if (query.phone) {
    params.set('phone', query.phone);
  }
  if (query.customerName) {
    params.set('customerName', query.customerName);
  }
  if (query.orderId) {
    params.set('orderId', query.orderId);
  }
  if (query.courierId) {
    params.set('courierId', query.courierId);
  }
  if (query.createdFrom) {
    params.set('createdFrom', query.createdFrom);
  }
  if (query.createdTo) {
    params.set('createdTo', query.createdTo);
  }

  return apiRequest<OrdersPageResponse>(`/orders?${params.toString()}`);
}

export async function fetchOrderSearchSavedViews(): Promise<OrderSearchSavedView[]> {
  return apiRequest<OrderSearchSavedView[]>('/orders/search-views');
}

export async function createOrderSearchSavedView(
  payload: OrderSearchSavedViewPayload,
): Promise<OrderSearchSavedView> {
  return apiRequest<OrderSearchSavedView>('/orders/search-views', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOrderSearchSavedView(
  viewId: string,
  payload: OrderSearchSavedViewPayload,
): Promise<OrderSearchSavedView> {
  return apiRequest<OrderSearchSavedView>(`/orders/search-views/${viewId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOrderSearchSavedView(viewId: string): Promise<void> {
  return apiRequest<void>(`/orders/search-views/${viewId}`, {
    method: 'DELETE',
  });
}

export async function fetchCouriers(query: CouriersQuery = {}): Promise<CouriersPageResponse> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 20));

  return apiRequest<CouriersPageResponse>(`/couriers?${params.toString()}`);
}

export async function fetchCourier(id: string): Promise<Courier> {
  return apiRequest<Courier>(`/couriers/${id}`);
}

export async function createCourier(data: CourierPayload): Promise<Courier> {
  return apiRequest<Courier>('/couriers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCourier(id: string, data: CourierPayload): Promise<Courier> {
  return apiRequest<Courier>(`/couriers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function setCourierActive(id: string, active: boolean): Promise<Courier> {
  return apiRequest<Courier>(`/couriers/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
}

export async function fetchAssignmentQueue(query: CourierOperationsQueueQuery = {}): Promise<OrdersPageResponse> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 20));
  params.set('status', 'CONFIRMED');
  if (query.createdFrom) {
    params.set('createdFrom', query.createdFrom);
  }
  if (query.createdTo) {
    params.set('createdTo', query.createdTo);
  }

  return apiRequest<OrdersPageResponse>(`/courier-operations/assignment-queue?${params.toString()}`);
}

export async function fetchPickupQueue(query: CourierOperationsQueueQuery = {}): Promise<OrdersPageResponse> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 20));
  params.set('status', 'ASSIGNED_TO_COURIER');
  if (query.courierId) {
    params.set('courierId', query.courierId);
  }
  if (query.createdFrom) {
    params.set('createdFrom', query.createdFrom);
  }
  if (query.createdTo) {
    params.set('createdTo', query.createdTo);
  }

  return apiRequest<OrdersPageResponse>(`/courier-operations/pickup-queue?${params.toString()}`);
}

export async function fetchDeliveryQueue(query: CourierOperationsQueueQuery = {}): Promise<OrdersPageResponse> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 20));
  params.set('status', 'PICKED_UP');
  if (query.courierId) {
    params.set('courierId', query.courierId);
  }
  if (query.createdFrom) {
    params.set('createdFrom', query.createdFrom);
  }
  if (query.createdTo) {
    params.set('createdTo', query.createdTo);
  }

  return apiRequest<OrdersPageResponse>(`/courier-operations/delivery-queue?${params.toString()}`);
}

export async function fetchCourierPerformance(): Promise<CourierPerformance[]> {
  return apiRequest<CourierPerformance[]>('/courier-operations/courier-performance');
}

export async function fetchConfirmationQueue(query: ConfirmationQueueQuery = {}): Promise<OrdersPageResponse> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 20));
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.createdFrom) {
    params.set('createdFrom', query.createdFrom);
  }
  if (query.createdTo) {
    params.set('createdTo', query.createdTo);
  }
  if (query.search?.trim()) {
    params.set('search', query.search.trim());
  }

  return apiRequest<OrdersPageResponse>(`/confirmations/queue?${params.toString()}`);
}

export async function fetchConfirmationCallbacks(
  query: ConfirmationCallbacksQuery = {},
): Promise<ConfirmationCallbacksPageResponse> {
  const params = new URLSearchParams();
  params.set('page', String(query.page ?? 0));
  params.set('size', String(query.size ?? 20));
  params.set('scope', query.scope ?? 'DUE');
  if (query.callbackFrom) {
    params.set('callbackFrom', query.callbackFrom);
  }
  if (query.callbackTo) {
    params.set('callbackTo', query.callbackTo);
  }

  return apiRequest<ConfirmationCallbacksPageResponse>(`/confirmations/callbacks?${params.toString()}`);
}

export async function fetchOrder(id: string): Promise<Order> {
  return apiRequest<Order>(`/orders/${id}`);
}

export async function fetchOrderEvents(id: string): Promise<DomainEvent[]> {
  return apiRequest<DomainEvent[]>(`/orders/${id}/events`);
}

export async function fetchOrderTimeline(id: string): Promise<OrderTimelineItem[]> {
  return apiRequest<OrderTimelineItem[]>(`/orders/${id}/timeline`);
}

export async function fetchConfirmationAttempts(orderId: string): Promise<ConfirmationAttempt[]> {
  return apiRequest<ConfirmationAttempt[]>(`/orders/${orderId}/confirmation-attempts`);
}

export async function createOrder(data: CreateOrderPayload): Promise<string> {
  return apiRequest<string>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function requestConfirmation(orderId: string): Promise<void> {
  await apiRequest<void>(`/orders/${orderId}/request-confirmation`, { method: 'POST' });
}

export async function confirmOrder(orderId: string): Promise<void> {
  await apiRequest<void>(`/orders/${orderId}/confirm`, { method: 'POST' });
}

export async function rejectOrder(orderId: string, reason: string): Promise<void> {
  await apiRequest<void>(`/orders/${orderId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function recordConfirmationAttempt(
  orderId: string,
  outcome: ConfirmationOutcome,
  note: string,
  callbackAt?: string,
): Promise<ConfirmationAttempt> {
  return apiRequest<ConfirmationAttempt>(`/orders/${orderId}/confirmation-attempts`, {
    method: 'POST',
    body: JSON.stringify({ outcome, note, callbackAt }),
  });
}

export async function resolveConfirmationCallback(callbackId: string): Promise<ConfirmationAttempt> {
  return apiRequest<ConfirmationAttempt>(`/confirmations/callbacks/${callbackId}/resolve`, {
    method: 'POST',
  });
}

export async function assignCourier(orderId: string, courierId: string): Promise<void> {
  await apiRequest<void>(`/orders/${orderId}/assign-courier`, {
    method: 'POST',
    body: JSON.stringify({ courierId }),
  });
}

export async function markPickedUp(orderId: string, courierId: string): Promise<void> {
  await apiRequest<void>(`/orders/${orderId}/pick-up`, {
    method: 'POST',
    body: JSON.stringify({ courierId }),
  });
}

export async function markDelivered(orderId: string): Promise<void> {
  await apiRequest<void>(`/courier-operations/orders/${orderId}/deliver`, { method: 'POST' });
}

export async function markFailed(orderId: string, reason: DeliveryFailureReason, note?: string): Promise<DeliveryFailure> {
  return apiRequest<DeliveryFailure>(`/courier-operations/orders/${orderId}/fail`, {
    method: 'POST',
    body: JSON.stringify({ reason, note }),
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.title}: ${error.detail}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers: optionHeaders, ...requestOptions } = options;
  const headers = new Headers(optionHeaders);

  if (requestOptions.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = useAuthStore.getState().session?.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers,
  });

  if (response.status === 401) {
    useAuthStore.getState().clearSession();
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (isBlockedTenantError(error)) {
      useAuthStore.getState().setTenantBlocked(error.tenantStatus as BlockedTenantStatus);
    }
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

function isBlockedTenantError(error: ApiError): boolean {
  return error.status === 403
    && error.title === 'Tenant account blocked'
    && ['OVERDUE', 'SUSPENDED', 'DISABLED'].includes(error.tenantStatus ?? '');
}

async function toApiError(response: Response): Promise<ApiError> {
  const fallback: ProblemResponse = {
    title: response.statusText || 'Request failed',
    status: response.status,
    detail: `Request failed with status ${response.status}`,
  };

  try {
    const problem = (await response.json()) as ProblemResponse;
    return new ApiError(response.status, { ...fallback, ...problem });
  } catch {
    return new ApiError(response.status, fallback);
  }
}
