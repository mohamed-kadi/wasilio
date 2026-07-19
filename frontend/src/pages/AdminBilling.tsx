import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  Banknote,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  FileText,
  Mail,
  MessageCircle,
  PhoneCall,
  PlusCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  createSubscriptionPlan,
  convertMarketingLeadToTenant,
  deleteSubscriptionPlan,
  downloadAdminPaymentRecordsCsv,
  fetchAdminPaymentRecordsSummary,
  fetchAdminTenant,
  fetchAdminTenants,
  fetchMarketingLeads,
  fetchSubscriptionPlans,
  fetchTenantPaymentReceipt,
  getErrorMessage,
  recordTenantPayment,
  updateSubscriptionPlanStatus,
  updateMarketingLeadFollowUp,
  updateAdminTenantStatus,
  upsertTenantSubscription,
  type AdminTenantDetail,
  type AdminTenantSummary,
  type AdminPaymentRecordsQuery,
  type MarketingLead,
  type MarketingLeadStatus,
  type PaymentMethod,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type TenantPayment,
  type TenantPaymentReceipt,
  type TenantStatus,
} from '../api/client';
import { useAuthStore } from '../store/authStore';

const tenantStatuses: TenantStatus[] = ['ACTIVE', 'TRIALING', 'OVERDUE', 'SUSPENDED', 'DISABLED'];
const subscriptionStatuses: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'OVERDUE', 'SUSPENDED', 'CANCELED'];
const paymentMethods: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHECK', 'OTHER'];
const marketingLeadStatuses: MarketingLeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'REJECTED', 'ONBOARDED'];
const blockedStatuses: TenantStatus[] = ['OVERDUE', 'SUSPENDED', 'DISABLED'];
const workspaceSections = ['tenants', 'billing', 'payments', 'plans', 'leads'] as const;
type WorkspaceTab = typeof workspaceSections[number];
type LeadFilter = MarketingLeadStatus | 'ALL' | 'CAMPAIGN';

interface CampaignAttribution {
  raw: string;
  fields: Array<{ label: string; value: string }>;
  hasPaidSignal: boolean;
  clickIds: string[];
}

const workspaceSectionMeta: Record<WorkspaceTab, { title: string; detail: string }> = {
  tenants: {
    title: 'Merchant Workspaces',
    detail: 'Review workspace health, access status, and current activity.',
  },
  billing: {
    title: 'Billing',
    detail: 'Manage the selected workspace subscription and billing period.',
  },
  payments: {
    title: 'Payments',
    detail: 'Record manual payments and generate receipts.',
  },
  plans: {
    title: 'Plans',
    detail: 'Review and create subscription plans.',
  },
  leads: {
    title: 'Demo Requests',
    detail: 'Review interested merchants before creating pilot workspaces.',
  },
};

const leadStatusLabels: Record<MarketingLeadStatus, string> = {
  NEW: 'New request',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  REJECTED: 'Not a fit',
  ONBOARDED: 'Workspace created',
};

const tenantStatusLabels: Record<TenantStatus, string> = {
  ACTIVE: 'Active',
  TRIALING: 'Trial',
  OVERDUE: 'Payment overdue',
  SUSPENDED: 'Suspended',
  DISABLED: 'Disabled',
};

const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  TRIALING: 'Trial',
  ACTIVE: 'Active',
  OVERDUE: 'Payment overdue',
  SUSPENDED: 'Suspended',
  CANCELED: 'Canceled',
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  BANK_TRANSFER: 'Bank transfer',
  CHECK: 'Check',
  OTHER: 'Other',
};

function toDateTimeLocal(value?: string) {
  return value ? value.slice(0, 16) : '';
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function fromDateFilterStart(value: string) {
  return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;
}

function fromDateFilterEnd(value: string) {
  if (!value) {
    return undefined;
  }
  const exclusiveEnd = new Date(`${value}T00:00:00.000Z`);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  return exclusiveEnd.toISOString();
}

function money(amount: number | undefined, currency = 'MAD') {
  return `${amount ?? 0} ${currency}`;
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString() : 'Not set';
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : 'Not set';
}

function formatPeriod(start?: string, end?: string) {
  if (!start && !end) {
    return 'Not specified';
  }
  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatFinancialTotals(totals: Array<{ amount: number; currency: string }>) {
  if (!totals.length) {
    return '0 MAD';
  }
  return totals.map((total) => money(total.amount, total.currency)).join(' · ');
}

function formatMonth(value: string) {
  return new Date(`${value}-01T00:00:00.000Z`).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthDateRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return {
    from: dateInputValue(start),
    to: dateInputValue(end),
  };
}

function saveBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function isFollowUpDue(value?: string) {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

function whatsappHref(phone: string) {
  const normalized = phone.replace(/[^\d]/g, '');
  return normalized ? `https://wa.me/${normalized}` : undefined;
}

function isBlocked(status: TenantStatus) {
  return blockedStatuses.includes(status);
}

function isWorkspaceTab(value: string | null): value is WorkspaceTab {
  return workspaceSections.includes(value as WorkspaceTab);
}

function leadStatusLabel(status: MarketingLeadStatus) {
  return leadStatusLabels[status];
}

function tenantStatusLabel(status: TenantStatus) {
  return tenantStatusLabels[status];
}

function subscriptionStatusLabel(status?: SubscriptionStatus) {
  return status ? subscriptionStatusLabels[status] : 'No subscription';
}

function paymentMethodLabel(method: PaymentMethod) {
  return paymentMethodLabels[method];
}

function workspaceAccessCopy(status: TenantStatus) {
  if (status === 'ACTIVE') {
    return {
      summary: 'Merchant workflows are available',
      detail: 'The merchant can use orders, products, storefront, and operations tools.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }
  if (status === 'TRIALING') {
    return {
      summary: 'Pilot access is available',
      detail: 'The merchant can use Wasilio during the trial period.',
      className: 'border-blue-200 bg-blue-50 text-blue-800',
    };
  }
  if (status === 'OVERDUE') {
    return {
      summary: 'Access is blocked until payment is handled',
      detail: 'Keep this state for merchants who need a payment follow-up before access resumes.',
      className: 'border-amber-200 bg-amber-50 text-amber-800',
    };
  }
  if (status === 'SUSPENDED') {
    return {
      summary: 'Access is suspended',
      detail: 'Use this when Wasilio staff intentionally pauses the workspace.',
      className: 'border-red-200 bg-red-50 text-red-800',
    };
  }
  return {
    summary: 'Access is disabled',
    detail: 'Use this for workspaces that should not be used by the merchant.',
    className: 'border-gray-200 bg-gray-50 text-gray-700',
  };
}

export default function AdminBilling() {
  const queryClient = useQueryClient();
  const session = useAuthStore((state) => state.session);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantStatus, setTenantStatus] = useState<TenantStatus | ''>('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatus | 'ALL'>('ALL');
  const [planId, setPlanId] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | ''>('');
  const [currentPeriodStart, setCurrentPeriodStart] = useState('');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState('MAD');
  const [paymentPaidAt, setPaymentPaidAt] = useState('');
  const [paymentPeriodStart, setPaymentPeriodStart] = useState('');
  const [paymentPeriodEnd, setPaymentPeriodEnd] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [financialPaidFrom, setFinancialPaidFrom] = useState('');
  const [financialPaidTo, setFinancialPaidTo] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planCurrency, setPlanCurrency] = useState('MAD');
  const [planOrderLimit, setPlanOrderLimit] = useState('');
  const [planUserLimit, setPlanUserLimit] = useState('');
  const [receiptPaymentId, setReceiptPaymentId] = useState('');
  const [showPlanForm, setShowPlanForm] = useState(false);
  const sectionParam = searchParams.get('section');
  const activeTab: WorkspaceTab = isWorkspaceTab(sectionParam) ? sectionParam : 'tenants';
  const activeSection = workspaceSectionMeta[activeTab];

  const tenantsQuery = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: fetchAdminTenants,
  });

  const plansQuery = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: fetchSubscriptionPlans,
  });

  const leadsQuery = useQuery({
    queryKey: ['marketing-leads'],
    queryFn: fetchMarketingLeads,
  });

  const tenants = useMemo(() => tenantsQuery.data ?? [], [tenantsQuery.data]);
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  const leads = useMemo(() => leadsQuery.data ?? [], [leadsQuery.data]);
  const sortedPlans = useMemo(() => {
    return [...plans].sort((first, second) => {
      if (first.active !== second.active) {
        return first.active ? -1 : 1;
      }
      return first.monthlyPrice - second.monthlyPrice || first.name.localeCompare(second.name);
    });
  }, [plans]);
  const planAssignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    tenants.forEach((tenant) => {
      const assignedPlanId = tenant.subscription?.planId;
      if (assignedPlanId) {
        counts.set(assignedPlanId, (counts.get(assignedPlanId) ?? 0) + 1);
      }
    });
    return counts;
  }, [tenants]);
  const planStats = useMemo(() => {
    const active = plans.filter((plan) => plan.active).length;
    const archived = plans.length - active;
    const entryPrice = sortedPlans.find((plan) => plan.active)?.monthlyPrice;
    const currency = sortedPlans.find((plan) => plan.active)?.currency ?? 'MAD';
    return { active, archived, entryPrice, currency };
  }, [plans, sortedPlans]);

  const filteredTenants = useMemo(() => {
    const normalizedSearch = tenantSearch.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesSearch = !normalizedSearch || tenant.name.toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === 'ALL' || tenant.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [statusFilter, tenantSearch, tenants]);

  const effectiveTenantId = selectedTenantId || tenants[0]?.tenantId || '';

  const selectedTenant = useMemo<AdminTenantSummary | undefined>(() => {
    return tenants.find((tenant) => tenant.tenantId === effectiveTenantId);
  }, [effectiveTenantId, tenants]);

  const kpis = useMemo(() => {
    const activeTenants = tenants.filter((tenant) => tenant.status === 'ACTIVE' || tenant.status === 'TRIALING');
    const blockedTenants = tenants.filter((tenant) => isBlocked(tenant.status));
    const subscribedTenants = tenants.filter((tenant) => tenant.plan && tenant.subscription?.status !== 'CANCELED');
    const mrr = subscribedTenants.reduce((total, tenant) => total + (tenant.plan?.monthlyPrice ?? 0), 0);
    const totalOrders = tenants.reduce((total, tenant) => total + tenant.ordersCount, 0);

    return {
      totalTenants: tenants.length,
      activeTenants: activeTenants.length,
      blockedTenants: blockedTenants.length,
      subscribedTenants: subscribedTenants.length,
      mrr,
      currency: subscribedTenants[0]?.plan?.currency ?? 'MAD',
      totalOrders,
    };
  }, [tenants]);

  const detailQuery = useQuery({
    queryKey: ['admin-tenant', effectiveTenantId],
    queryFn: () => fetchAdminTenant(effectiveTenantId),
    enabled: Boolean(effectiveTenantId),
  });

  const detail = detailQuery.data;
  const defaultPlanId = plans.find((currentPlan) => currentPlan.active)?.planId || '';
  const effectiveTenantStatus = tenantStatus || detail?.status || selectedTenant?.status || 'ACTIVE';
  const effectivePlanId = planId || detail?.subscription?.planId || selectedTenant?.subscription?.planId || defaultPlanId;
  const effectiveSubscriptionStatus = subscriptionStatus || detail?.subscription?.status || selectedTenant?.subscription?.status || 'TRIALING';
  const effectiveCurrentPeriodStart = currentPeriodStart || toDateTimeLocal(detail?.subscription?.currentPeriodStart);
  const effectiveCurrentPeriodEnd = currentPeriodEnd || toDateTimeLocal(detail?.subscription?.currentPeriodEnd);
  const effectiveTrialEndsAt = trialEndsAt || toDateTimeLocal(detail?.subscription?.trialEndsAt);
  const assignablePlans = useMemo(() => {
    return plans.filter((currentPlan) => currentPlan.active || currentPlan.planId === effectivePlanId);
  }, [effectivePlanId, plans]);
  const staffReceiptName = session?.user.name || session?.user.email || 'Staff account';
  const financialRecordsQuery = useMemo<AdminPaymentRecordsQuery>(() => ({
    paidFrom: fromDateFilterStart(financialPaidFrom),
    paidTo: fromDateFilterEnd(financialPaidTo),
  }), [financialPaidFrom, financialPaidTo]);

  const statusMutation = useMutation({
    mutationFn: () => updateAdminTenantStatus(effectiveTenantId, effectiveTenantStatus),
    onSuccess: refreshTenantData,
  });

  const subscriptionMutation = useMutation({
    mutationFn: () =>
      upsertTenantSubscription(effectiveTenantId, {
        planId: effectivePlanId,
        status: effectiveSubscriptionStatus,
        currentPeriodStart: fromDateTimeLocal(effectiveCurrentPeriodStart),
        currentPeriodEnd: fromDateTimeLocal(effectiveCurrentPeriodEnd),
        trialEndsAt: fromDateTimeLocal(effectiveTrialEndsAt),
      }),
    onSuccess: refreshTenantData,
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      recordTenantPayment(effectiveTenantId, {
        method: paymentMethod,
        amount: Number(paymentAmount),
        currency: paymentCurrency,
        paidAt: fromDateTimeLocal(paymentPaidAt),
        periodStart: fromDateTimeLocal(paymentPeriodStart),
        periodEnd: fromDateTimeLocal(paymentPeriodEnd),
        notes: paymentNotes || undefined,
      }),
    onSuccess: async (payment) => {
      setReceiptPaymentId(payment.paymentId);
      setActiveTab('payments');
      setPaymentAmount('');
      setPaymentNotes('');
      await refreshTenantData();
    },
  });

  const planMutation = useMutation({
    mutationFn: () =>
      createSubscriptionPlan({
        code: planCode,
        name: planName,
        monthlyPrice: Number(planPrice),
        currency: planCurrency,
        orderLimit: planOrderLimit ? Number(planOrderLimit) : undefined,
        userLimit: planUserLimit ? Number(planUserLimit) : undefined,
      }),
    onSuccess: async () => {
      setPlanCode('');
      setPlanName('');
      setPlanPrice('');
      setPlanOrderLimit('');
      setPlanUserLimit('');
      setShowPlanForm(false);
      await queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
    },
  });

  const planStatusMutation = useMutation({
    mutationFn: (payload: { planId: string; active: boolean }) =>
      updateSubscriptionPlanStatus(payload.planId, payload.active),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
  });

  const planDeleteMutation = useMutation({
    mutationFn: (targetPlanId: string) => deleteSubscriptionPlan(targetPlanId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
    },
  });

  const leadFollowUpMutation = useMutation({
    mutationFn: (payload: { leadId: string; status: MarketingLeadStatus; nextFollowUpAt?: string; internalNotes?: string }) =>
      updateMarketingLeadFollowUp(payload.leadId, {
        status: payload.status,
        nextFollowUpAt: payload.nextFollowUpAt,
        internalNotes: payload.internalNotes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['marketing-leads'] });
    },
  });

  const leadConversionMutation = useMutation({
    mutationFn: (payload: { leadId: string; tenantName: string; adminName: string; adminEmail: string; internalNotes?: string }) =>
      convertMarketingLeadToTenant(payload.leadId, {
        tenantName: payload.tenantName,
        adminName: payload.adminName,
        adminEmail: payload.adminEmail,
        internalNotes: payload.internalNotes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['marketing-leads'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
  });

  const financialSummaryQuery = useQuery({
    queryKey: ['admin-payment-records-summary', financialRecordsQuery],
    queryFn: () => fetchAdminPaymentRecordsSummary(financialRecordsQuery),
    enabled: activeTab === 'payments',
  });

  const financialExportMutation = useMutation({
    mutationFn: () => downloadAdminPaymentRecordsCsv(financialRecordsQuery),
    onSuccess: (blob) => {
      const period = financialPaidFrom || financialPaidTo
        ? `${financialPaidFrom || 'start'}-${financialPaidTo || 'today'}`
        : new Date().toISOString().slice(0, 10);
      saveBlob(blob, `wasilio-payment-records-${period}.csv`);
    },
  });

  const receiptQuery = useQuery({
    queryKey: ['tenant-payment-receipt', effectiveTenantId, receiptPaymentId],
    queryFn: () => fetchTenantPaymentReceipt(effectiveTenantId, receiptPaymentId),
    enabled: Boolean(effectiveTenantId && receiptPaymentId),
  });

  const payments = detail?.payments ?? [];
  const latestPayment = payments[0];
  const financialSummary = financialSummaryQuery.data;
  const latestFinancialMonth = financialSummary?.monthlyTotals[0];
  const error =
    tenantsQuery.error ??
    plansQuery.error ??
    leadsQuery.error ??
    detailQuery.error ??
    statusMutation.error ??
    subscriptionMutation.error ??
    paymentMutation.error ??
    planMutation.error ??
    planStatusMutation.error ??
    planDeleteMutation.error ??
    leadFollowUpMutation.error ??
    leadConversionMutation.error ??
    financialSummaryQuery.error ??
    financialExportMutation.error ??
    receiptQuery.error;

  async function refreshTenantData() {
    await queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    await queryClient.invalidateQueries({ queryKey: ['admin-tenant', effectiveTenantId] });
  }

  function handleTenantStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    statusMutation.mutate();
  }

  function handleTenantSelect(tenantId: string) {
    const tenant = tenants.find((item) => item.tenantId === tenantId);
    setSelectedTenantId(tenantId);
    setTenantStatus(tenant?.status ?? '');
    setPlanId(tenant?.subscription?.planId ?? '');
    setSubscriptionStatus(tenant?.subscription?.status ?? '');
    setCurrentPeriodStart(toDateTimeLocal(tenant?.subscription?.currentPeriodStart));
    setCurrentPeriodEnd(toDateTimeLocal(tenant?.subscription?.currentPeriodEnd));
    setTrialEndsAt(toDateTimeLocal(tenant?.subscription?.trialEndsAt));
    setReceiptPaymentId('');
  }

  function handleSubscription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    subscriptionMutation.mutate();
  }

  function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    paymentMutation.mutate();
  }

  function handlePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    planMutation.mutate();
  }

  function handlePrintReceipt() {
    window.print();
  }

  function handleDownloadFinancialRecords() {
    financialExportMutation.mutate();
  }

  function handleFinancialPreset(offset: number) {
    const range = monthDateRange(offset);
    setFinancialPaidFrom(range.from);
    setFinancialPaidTo(range.to);
  }

  function handleClearFinancialFilters() {
    setFinancialPaidFrom('');
    setFinancialPaidTo('');
  }

  function handlePlanStatus(planId: string, active: boolean) {
    planStatusMutation.mutate({ planId, active });
  }

  function handlePlanDelete(targetPlan: SubscriptionPlan) {
    const confirmed = window.confirm(`Delete ${targetPlan.name}? Only unused archived plans should be deleted.`);
    if (confirmed) {
      planDeleteMutation.mutate(targetPlan.planId);
    }
  }

  function setActiveTab(tab: WorkspaceTab) {
    setSearchParams({ section: tab });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Wasilio Staff Workspace</h2>
          <p className="text-sm text-gray-500">Merchant workspace health, billing status, manual payments, receipts, and demo requests</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refreshTenantData();
            void queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
          }}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Building2 size={18} />} label="Merchant workspaces" value={String(kpis.totalTenants)} detail={`${kpis.activeTenants} active or trialing`} />
        <KpiCard icon={<ShieldAlert size={18} />} label="Needs action" value={String(kpis.blockedTenants)} detail="Overdue, suspended, or disabled" tone={kpis.blockedTenants ? 'warning' : 'neutral'} />
        <KpiCard icon={<TrendingUp size={18} />} label="Projected MRR" value={money(kpis.mrr, kpis.currency)} detail={`${kpis.subscribedTenants} subscribed workspaces`} />
        <KpiCard icon={<CreditCard size={18} />} label="Orders under management" value={String(kpis.totalOrders)} detail="Across all workspaces" />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="min-w-0 border-b border-gray-200 xl:border-b-0 xl:border-r">
            <TenantSelector
              filteredTenants={filteredTenants}
              selectedTenantId={effectiveTenantId}
              tenantSearch={tenantSearch}
              statusFilter={statusFilter}
              isLoading={tenantsQuery.isLoading}
              onSearch={setTenantSearch}
              onStatusFilter={setStatusFilter}
              onSelect={handleTenantSelect}
            />
          </aside>

          <main className="min-w-0 p-4">
            <div className="mb-4 border-b border-gray-100 pb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Staff section</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">{activeSection.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{activeSection.detail}</p>
            </div>
            <TenantSummaryCard detail={detail} selectedTenant={selectedTenant} latestPayment={latestPayment} />

            {activeTab === 'tenants' && (
              <section className="mt-6 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <AdminInfoTile
                    label="Workspace access"
                    value={tenantStatusLabel(effectiveTenantStatus)}
                    detail={workspaceAccessCopy(effectiveTenantStatus).summary}
                    tone={isBlocked(effectiveTenantStatus) ? 'warning' : 'success'}
                  />
                  <AdminInfoTile
                    label="Team members"
                    value={String(detail?.usersCount ?? selectedTenant?.usersCount ?? 0)}
                    detail="People who can sign in"
                  />
                  <AdminInfoTile
                    label="Orders managed"
                    value={String(detail?.ordersCount ?? selectedTenant?.ordersCount ?? 0)}
                    detail="Orders in this workspace"
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <form onSubmit={handleTenantStatus} className="rounded-lg border border-gray-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold uppercase text-gray-500">Workspace Access</h3>
                        <p className="mt-1 text-sm text-gray-600">Change whether the merchant can use Wasilio workflows.</p>
                      </div>
                      <StatusBadge status={effectiveTenantStatus} />
                    </div>
                    <label className="mt-4 block">
                      <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Access status</span>
                      <select
                        value={effectiveTenantStatus}
                        onChange={(event) => setTenantStatus(event.target.value as TenantStatus)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {tenantStatuses.map((status) => (
                          <option key={status} value={status}>
                            {tenantStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <WorkspaceAccessPanel status={effectiveTenantStatus} />
                    <button
                      type="submit"
                      disabled={!effectiveTenantId || statusMutation.isPending}
                      className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Save size={16} />
                      Save access status
                    </button>
                  </form>

                  <section className="rounded-lg border border-gray-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase text-gray-500">Workspace Snapshot</h3>
                    <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                      <ReceiptField label="Plan" value={detail?.plan?.name ?? selectedTenant?.plan?.name ?? 'No plan'} />
                      <ReceiptField label="Subscription" value={subscriptionStatusLabel(detail?.subscription?.status ?? selectedTenant?.subscription?.status)} />
                      <ReceiptField label="Created" value={formatDate(detail?.createdAt ?? selectedTenant?.createdAt)} />
                      <ReceiptField label="Last updated" value={formatDateTime(detail?.updatedAt ?? selectedTenant?.updatedAt)} />
                    </div>
                  </section>
                </div>
              </section>
            )}

            {activeTab === 'billing' && (
              <section className="mt-6 space-y-4">
                <form onSubmit={handleSubscription} className="rounded-lg border border-gray-200 bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase text-gray-500">Subscription Update</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        Current period: {formatPeriod(detail?.subscription?.currentPeriodStart ?? selectedTenant?.subscription?.currentPeriodStart, detail?.subscription?.currentPeriodEnd ?? selectedTenant?.subscription?.currentPeriodEnd)}
                      </p>
                    </div>
                    <SubscriptionStatusBadge status={effectiveSubscriptionStatus} />
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Plan</span>
                      <select
                        value={effectivePlanId}
                        onChange={(event) => setPlanId(event.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select plan</option>
                        {assignablePlans.map((plan) => (
                          <option key={plan.planId} value={plan.planId}>
                            {plan.name} · {money(plan.monthlyPrice, plan.currency)}{plan.active ? '' : ' · archived'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SelectInput
                      label="Subscription status"
                      value={effectiveSubscriptionStatus}
                      onChange={(value) => setSubscriptionStatus(value as SubscriptionStatus)}
                      options={subscriptionStatuses}
                      formatOption={(value) => subscriptionStatusLabel(value as SubscriptionStatus)}
                    />
                    <DateInput label="Current period starts" value={effectiveCurrentPeriodStart} onChange={setCurrentPeriodStart} />
                    <DateInput label="Current period ends" value={effectiveCurrentPeriodEnd} onChange={setCurrentPeriodEnd} />
                    <DateInput label="Trial ends" value={effectiveTrialEndsAt} onChange={setTrialEndsAt} />
                  </div>
                  <button
                    type="submit"
                    disabled={!effectiveTenantId || !effectivePlanId || subscriptionMutation.isPending}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save size={16} />
                    Save subscription
                  </button>
                </form>
              </section>
            )}

            {activeTab === 'payments' && (
              <section className="mt-6 space-y-4">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold uppercase text-gray-500">Financial Records</h3>
                      <p className="mt-1 text-xs text-gray-500">Filter and download manual payment records for tax and bookkeeping review.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadFinancialRecords}
                      disabled={financialExportMutation.isPending}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Download size={16} />
                      {financialExportMutation.isPending ? 'Preparing' : 'Download records'}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleFinancialPreset(0)}
                      className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      This month
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFinancialPreset(-1)}
                      className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Previous month
                    </button>
                    <button
                      type="button"
                      onClick={handleClearFinancialFilters}
                      className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Clear dates
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
                    <TextInput label="Paid from" value={financialPaidFrom} onChange={setFinancialPaidFrom} type="date" />
                    <TextInput label="Paid to" value={financialPaidTo} onChange={setFinancialPaidTo} type="date" />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <AdminInfoTile
                        label="Matched receipts"
                        value={financialSummaryQuery.isLoading ? '...' : String(financialSummary?.paymentCount ?? 0)}
                        detail={financialPaidFrom || financialPaidTo ? 'Filtered period' : 'All recorded payments'}
                      />
                      <AdminInfoTile
                        label="Period total"
                        value={financialSummaryQuery.isLoading ? '...' : formatFinancialTotals(financialSummary?.totals ?? [])}
                        detail="Manual payments collected"
                      />
                      <AdminInfoTile
                        label="Latest month"
                        value={latestFinancialMonth ? money(latestFinancialMonth.amount, latestFinancialMonth.currency) : 'None'}
                        detail={latestFinancialMonth ? `${formatMonth(latestFinancialMonth.month)} · ${latestFinancialMonth.paymentCount} receipts` : 'No payment records'}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <AdminInfoTile label="Recorded payments" value={String(payments.length)} detail="Manual receipts in this workspace" />
                  <AdminInfoTile label="Latest payment" value={latestPayment ? money(latestPayment.amount, latestPayment.currency) : 'None'} detail={latestPayment ? formatDateTime(latestPayment.paidAt) : 'No payment recorded'} />
                  <AdminInfoTile label="Receipt selected" value={receiptPaymentId ? 'Ready to preview' : 'None selected'} detail="Open a receipt from payment history" />
                  <AdminInfoTile label="Receipt identity" value={staffReceiptName} detail="Shown as collected by" />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)]">
                  <form onSubmit={handlePayment} className="rounded-lg border border-gray-200 bg-white p-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase text-gray-500">
                      <Banknote size={16} />
                      Record Payment
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">Capture cash, transfer, check, or another manual payment for the selected workspace.</p>
                    <div className="mt-4 grid grid-cols-1 gap-3">
                      <SelectInput
                        label="Payment method"
                        value={paymentMethod}
                        onChange={(value) => setPaymentMethod(value as PaymentMethod)}
                        options={paymentMethods}
                        formatOption={(value) => paymentMethodLabel(value as PaymentMethod)}
                      />
                      <TextInput label="Amount" value={paymentAmount} onChange={setPaymentAmount} type="number" required />
                      <TextInput label="Currency" value={paymentCurrency} onChange={setPaymentCurrency} maxLength={3} required />
                      <DateInput label="Paid at" value={paymentPaidAt} onChange={setPaymentPaidAt} />
                      <DateInput label="Period starts" value={paymentPeriodStart} onChange={setPaymentPeriodStart} />
                      <DateInput label="Period ends" value={paymentPeriodEnd} onChange={setPaymentPeriodEnd} />
                    </div>
                    <label className="mt-3 block">
                      <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Notes</span>
                      <textarea
                        value={paymentNotes}
                        onChange={(event) => setPaymentNotes(event.target.value)}
                        className="min-h-20 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        maxLength={1000}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={!effectiveTenantId || !paymentAmount || paymentMutation.isPending}
                      className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <PlusCircle size={16} />
                      Record payment
                    </button>
                  </form>

                  <PaymentHistory
                    payments={payments}
                    isLoading={detailQuery.isLoading}
                    onReceipt={(paymentId) => setReceiptPaymentId(paymentId)}
                  />
                </div>

                {receiptQuery.data && (
                  <section className="receipt-shell rounded-lg border border-gray-200 bg-white p-5">
                    <div className="receipt-actions mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase text-gray-500">
                          <FileText size={16} />
                          Receipt Preview
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">Printable manual payment confirmation.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePrintReceipt}
                        className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                      >
                        <Printer size={16} />
                        Print
                      </button>
                    </div>
                    <ReceiptDocument receipt={receiptQuery.data} />
                  </section>
                )}
              </section>
            )}

            {activeTab === 'plans' && (
              <section className="mt-6 space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <LeadMetric label="Active plans" value={planStats.active} detail="Available for new billing" tone="success" />
                  <LeadMetric label="Archived plans" value={planStats.archived} detail="Kept for history" />
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase text-gray-600">Entry price</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">
                      {planStats.entryPrice === undefined ? 'Not set' : money(planStats.entryPrice, planStats.currency)}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">Lowest active monthly plan</p>
                  </div>
                </div>

                <section className="rounded-lg border border-gray-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
                    <div>
                      <h3 className="text-sm font-semibold uppercase text-gray-500">Subscription Plans</h3>
                      <p className="mt-1 text-xs text-gray-500">Active plans are listed first. Archived plans should remain for billing history.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPlanForm((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      <PlusCircle size={16} />
                      Create plan
                      {showPlanForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {showPlanForm && (
                    <form onSubmit={handlePlan} className="border-b border-gray-200 bg-gray-50 p-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-[110px_minmax(180px,1fr)_120px_90px_120px_120px]">
                        <TextInput label="Code" value={planCode} onChange={setPlanCode} required />
                        <TextInput label="Name" value={planName} onChange={setPlanName} required />
                        <TextInput label="Monthly price" value={planPrice} onChange={setPlanPrice} type="number" required />
                        <TextInput label="Currency" value={planCurrency} onChange={setPlanCurrency} maxLength={3} required />
                        <TextInput label="Order limit" value={planOrderLimit} onChange={setPlanOrderLimit} type="number" />
                        <TextInput label="Team seats" value={planUserLimit} onChange={setPlanUserLimit} type="number" />
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="submit"
                          disabled={!planCode || !planName || !planPrice || planMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <PlusCircle size={16} />
                          {planMutation.isPending ? 'Creating' : 'Create plan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPlanForm(false)}
                          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
                    {sortedPlans.map((plan) => (
                      <PlanCard
                        key={plan.planId}
                        plan={plan}
                        assignedWorkspaces={planAssignmentCounts.get(plan.planId) ?? 0}
                        isUpdating={planStatusMutation.variables?.planId === plan.planId && planStatusMutation.isPending}
                        isDeleting={planDeleteMutation.variables === plan.planId && planDeleteMutation.isPending}
                        onArchive={() => handlePlanStatus(plan.planId, false)}
                        onRestore={() => handlePlanStatus(plan.planId, true)}
                        onDelete={() => handlePlanDelete(plan)}
                      />
                    ))}
                    {plansQuery.isLoading && <p className="text-sm text-gray-500">Loading plans...</p>}
                    {!plansQuery.isLoading && !plans.length && (
                      <p className="text-sm text-gray-500">No plans created.</p>
                    )}
                  </div>
                </section>
              </section>
            )}

            {activeTab === 'leads' && (
              <LeadList
                leads={leads}
                isLoading={leadsQuery.isLoading}
                updatingLeadId={leadFollowUpMutation.variables?.leadId}
                convertingLeadId={leadConversionMutation.variables?.leadId}
                onUpdate={(payload) => leadFollowUpMutation.mutate(payload)}
                onConvert={(payload) => leadConversionMutation.mutate(payload)}
              />
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

function LeadList({
  leads,
  isLoading,
  updatingLeadId,
  convertingLeadId,
  onUpdate,
  onConvert,
}: {
  leads: MarketingLead[];
  isLoading: boolean;
  updatingLeadId?: string;
  convertingLeadId?: string;
  onUpdate: (payload: { leadId: string; status: MarketingLeadStatus; nextFollowUpAt?: string; internalNotes?: string }) => void;
  onConvert: (payload: { leadId: string; tenantName: string; adminName: string; adminEmail: string; internalNotes?: string }) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<LeadFilter>('ALL');
  const stats = useMemo(() => {
    const open = leads.filter((lead) => lead.status !== 'REJECTED' && lead.status !== 'ONBOARDED').length;
    const due = leads.filter((lead) => isFollowUpDue(lead.nextFollowUpAt) && lead.status !== 'ONBOARDED').length;
    const qualified = leads.filter((lead) => lead.status === 'QUALIFIED').length;
    const onboarded = leads.filter((lead) => lead.status === 'ONBOARDED').length;
    const campaign = leads.filter((lead) => Boolean(parseCampaignAttribution(lead.campaignSource))).length;
    const priorityCampaign = leads.filter(needsCampaignFollowUp).length;

    return { open, due, qualified, onboarded, campaign, priorityCampaign };
  }, [leads]);
  const filteredLeads = useMemo(() => {
    const sortedLeads = [...leads].sort(compareLeadsForFollowUp);
    if (statusFilter === 'ALL') {
      return sortedLeads;
    }
    if (statusFilter === 'CAMPAIGN') {
      return sortedLeads.filter((lead) => Boolean(parseCampaignAttribution(lead.campaignSource)));
    }
    return sortedLeads.filter((lead) => lead.status === statusFilter);
  }, [leads, statusFilter]);

  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500">Demo Requests</h3>
            <p className="mt-1 text-sm text-gray-600">
              Review new demo requests, schedule follow-up, qualify serious merchants, then create pilot workspaces.
            </p>
            <p className="mt-2 text-xs font-medium text-blue-700">
              Campaign requests and due follow-ups are shown first.
            </p>
          </div>
          <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1">
            <LeadFilterButton active={statusFilter === 'ALL'} label="All" count={leads.length} onClick={() => setStatusFilter('ALL')} />
            <LeadFilterButton active={statusFilter === 'CAMPAIGN'} label="Campaign" count={stats.campaign} onClick={() => setStatusFilter('CAMPAIGN')} />
            {marketingLeadStatuses.map((leadStatus) => (
              <LeadFilterButton
                key={leadStatus}
                active={statusFilter === leadStatus}
                label={leadStatusLabel(leadStatus)}
                count={leads.filter((lead) => lead.status === leadStatus).length}
                onClick={() => setStatusFilter(leadStatus)}
              />
            ))}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <LeadMetric label="Open requests" value={stats.open} detail="Needs decision" />
          <LeadMetric label="Follow-up due" value={stats.due} detail="Call or message now" tone={stats.due ? 'warning' : 'neutral'} />
          <LeadMetric label="Campaign requests" value={stats.campaign} detail={`${stats.priorityCampaign} new paid/campaign request${stats.priorityCampaign === 1 ? '' : 's'}`} tone={stats.priorityCampaign ? 'warning' : 'neutral'} />
          <LeadMetric label="Qualified" value={stats.qualified} detail="Ready to convert" tone="success" />
          <LeadMetric label="Onboarded" value={stats.onboarded} detail="Pilot created" />
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3 text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{filteredLeads.length}</span> of {leads.length} demo requests
        </div>
        <div className="divide-y divide-gray-100">
          {filteredLeads.map((lead) => (
            <LeadCard
              key={lead.leadId}
              lead={lead}
              isUpdating={updatingLeadId === lead.leadId}
              isConverting={convertingLeadId === lead.leadId}
              onUpdate={onUpdate}
              onConvert={onConvert}
            />
          ))}
          {isLoading && <p className="p-5 text-sm text-gray-500">Loading demo requests...</p>}
          {!isLoading && !leads.length && <p className="p-5 text-sm text-gray-500">No demo requests captured yet.</p>}
          {!isLoading && Boolean(leads.length) && !filteredLeads.length && (
            <p className="p-5 text-sm text-gray-500">No demo requests match this status.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function LeadCard({
  lead,
  isUpdating,
  isConverting,
  onUpdate,
  onConvert,
}: {
  lead: MarketingLead;
  isUpdating: boolean;
  isConverting: boolean;
  onUpdate: (payload: { leadId: string; status: MarketingLeadStatus; nextFollowUpAt?: string; internalNotes?: string }) => void;
  onConvert: (payload: { leadId: string; tenantName: string; adminName: string; adminEmail: string; internalNotes?: string }) => void;
}) {
  const [status, setStatus] = useState<MarketingLeadStatus>(lead.status);
  const [nextFollowUpAt, setNextFollowUpAt] = useState(toDateTimeLocal(lead.nextFollowUpAt));
  const [internalNotes, setInternalNotes] = useState(lead.internalNotes ?? '');
  const [showConversion, setShowConversion] = useState(false);
  const [tenantName, setTenantName] = useState(lead.storeName);
  const [adminName, setAdminName] = useState(lead.contactName);
  const [adminEmail, setAdminEmail] = useState(lead.email ?? '');
  const [conversionNotes, setConversionNotes] = useState('Qualified for guided pilot onboarding.');
  const due = isFollowUpDue(lead.nextFollowUpAt);
  const waLink = whatsappHref(lead.phone);
  const attribution = parseCampaignAttribution(lead.campaignSource);
  const campaignPriority = needsCampaignFollowUp(lead);
  const nextAction = getLeadNextAction(lead);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onUpdate({
      leadId: lead.leadId,
      status,
      nextFollowUpAt: fromDateTimeLocal(nextFollowUpAt),
      internalNotes: internalNotes || undefined,
    });
  }

  function handleConvert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConvert({
      leadId: lead.leadId,
      tenantName,
      adminName,
      adminEmail,
      internalNotes: conversionNotes || undefined,
    });
  }

  const isConverted = Boolean(lead.convertedTenantId);

  return (
    <article className={`grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1fr_380px] ${due ? 'bg-amber-50/35' : campaignPriority ? 'bg-blue-50/40' : ''}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-gray-900">{lead.storeName}</h4>
          <LeadStatusBadge status={lead.status} />
          {due && <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">FOLLOW-UP DUE</span>}
          {attribution && <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">CAMPAIGN REQUEST</span>}
          {campaignPriority && <span className="rounded-md bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">PRIORITY FOLLOW-UP</span>}
          {lead.city && <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{lead.city}</span>}
          {lead.monthlyOrderVolume && <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{lead.monthlyOrderVolume}</span>}
        </div>
        <p className="mt-2 text-sm text-gray-700">{lead.contactName} · {lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
        <div className={`mt-4 rounded-md border p-3 ${nextAction.className}`}>
          <p className="text-xs font-semibold uppercase">Next action</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{nextAction.label}</p>
          <p className="mt-1 text-xs">{nextAction.detail}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            <PhoneCall size={14} />
            Call
          </a>
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
              <MessageCircle size={14} />
              WhatsApp
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              <Mail size={14} />
              Email
            </a>
          )}
        </div>
        {lead.message && <p className="mt-2 text-sm leading-6 text-gray-600">{lead.message}</p>}
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <LeadFact label="Captured" value={formatDateTime(lead.createdAt)} />
          <LeadFact label="Follow-up" value={formatDateTime(lead.nextFollowUpAt)} />
          {lead.convertedAt && <LeadFact label="Converted" value={formatDateTime(lead.convertedAt)} />}
          {lead.convertedTenantId && <LeadFact label="Workspace ID" value={lead.convertedTenantId} />}
        </div>
        {attribution && <CampaignAttributionPanel attribution={attribution} />}
      </div>

      <div className="space-y-3">
        <form onSubmit={handleSubmit} className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-3">
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Request status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as MarketingLeadStatus)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {marketingLeadStatuses.map((leadStatus) => (
                  <option key={leadStatus} value={leadStatus}>{leadStatusLabel(leadStatus)}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Next follow-up</span>
              <input
                type="datetime-local"
                value={nextFollowUpAt}
                onChange={(event) => setNextFollowUpAt(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Internal notes</span>
              <textarea
                rows={3}
                value={internalNotes}
                onChange={(event) => setInternalNotes(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isUpdating}
              className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <Save size={16} />
              {isUpdating ? 'Saving' : 'Save follow-up'}
            </button>
            {status !== 'QUALIFIED' && (
              <button
                type="button"
                onClick={() => setStatus('QUALIFIED')}
                className="inline-flex rounded-md border border-green-200 bg-white px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-50"
              >
                Mark qualified
              </button>
            )}
          </div>
        </form>
        {!isConverted && (
          <div className="rounded-md border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-semibold text-gray-900">Guided pilot conversion</h5>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  Create a pilot workspace and email the merchant owner an account setup link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConversion((current) => !current)}
                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                {showConversion ? 'Hide' : 'Convert'}
              </button>
            </div>
            {showConversion && (
              <form onSubmit={handleConvert} className="mt-4 grid gap-3">
                <FieldInput
                  label="Store / business name"
                  help="This becomes the merchant workspace name."
                  value={tenantName}
                  onChange={setTenantName}
                />
                <FieldInput
                  label="Merchant owner full name"
                  help="This person will manage the merchant workspace."
                  value={adminName}
                  onChange={setAdminName}
                />
                <FieldInput label="Merchant owner email" value={adminEmail} onChange={setAdminEmail} type="email" />
                <label>
                  <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Conversion notes</span>
                  <textarea
                    rows={3}
                    value={conversionNotes}
                    onChange={(event) => setConversionNotes(event.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
                <p className="text-xs leading-5 text-gray-500">The merchant receives a setup link by email and chooses their own password.</p>
                <button
                  type="submit"
                  disabled={isConverting}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  <PlusCircle size={16} />
                  {isConverting ? 'Converting' : 'Create pilot workspace'}
                </button>
              </form>
            )}
          </div>
        )}
        {isConverted && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Demo request converted to a pilot workspace. Continue setup from Merchant Workspaces or Billing in the sidebar.
          </div>
        )}
      </div>
    </article>
  );
}

function getLeadNextAction(lead: MarketingLead) {
  if (lead.status === 'ONBOARDED') {
    return {
      label: 'Workspace created',
      detail: 'Continue setup from Merchant Workspaces or Billing.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  if (lead.status === 'REJECTED') {
    return {
      label: 'Closed',
      detail: 'No pilot action is needed unless the merchant reopens interest.',
      className: 'border-gray-200 bg-gray-50 text-gray-600',
    };
  }
  if (isFollowUpDue(lead.nextFollowUpAt)) {
    return {
      label: 'Continue follow-up',
      detail: 'Call or WhatsApp the merchant and update the request status.',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  if (needsCampaignFollowUp(lead)) {
    return {
      label: 'Review paid request',
      detail: 'Campaign traffic should be checked quickly before it cools down.',
      className: 'border-orange-200 bg-orange-50 text-orange-700',
    };
  }
  if (lead.status === 'QUALIFIED') {
    return {
      label: 'Convert to pilot workspace',
      detail: 'Create the merchant workspace when onboarding is agreed.',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
  }
  if (lead.status === 'CONTACTED') {
    return {
      label: 'Schedule next step',
      detail: 'Set the next follow-up time or qualify the merchant.',
      className: 'border-blue-200 bg-blue-50 text-blue-700',
    };
  }
  return {
    label: 'Review request',
    detail: 'Check merchant fit, then call or message the contact.',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
  };
}

function LeadFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}

function LeadFilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-2.5 py-2 text-xs font-semibold ${
        active ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>{count}</span>
    </button>
  );
}

function LeadMetric({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  detail: string;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  const tones = {
    neutral: 'border-gray-200 bg-gray-50 text-gray-600',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-md border p-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs">{detail}</p>
    </div>
  );
}

function CampaignAttributionPanel({ attribution }: { attribution: CampaignAttribution }) {
  return (
    <div className="mt-4 rounded-md border border-blue-100 bg-blue-50/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-blue-900">
          <TrendingUp size={15} />
          Campaign attribution
        </div>
        {attribution.hasPaidSignal && (
          <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-blue-800">
            Paid signal
          </span>
        )}
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {attribution.fields.map((field) => (
          <div key={`${field.label}-${field.value}`} className="rounded-md bg-white px-3 py-2">
            <dt className="text-xs font-semibold uppercase text-blue-700">{field.label}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-gray-900">{field.value}</dd>
          </div>
        ))}
      </dl>
      {attribution.clickIds.length > 0 && (
        <p className="mt-3 text-xs font-medium text-blue-800">
          Click IDs captured: {attribution.clickIds.join(', ')}
        </p>
      )}
    </div>
  );
}

function compareLeadsForFollowUp(first: MarketingLead, second: MarketingLead) {
  const priorityDiff = leadFollowUpRank(first) - leadFollowUpRank(second);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  return timestamp(second.createdAt) - timestamp(first.createdAt);
}

function leadFollowUpRank(lead: MarketingLead) {
  if (isFollowUpDue(lead.nextFollowUpAt) && !isClosedLead(lead)) {
    return 0;
  }
  if (needsCampaignFollowUp(lead)) {
    return 1;
  }
  if (lead.status === 'NEW') {
    return 2;
  }
  if (lead.status === 'QUALIFIED') {
    return 3;
  }
  if (lead.status === 'CONTACTED') {
    return 4;
  }
  return 5;
}

function needsCampaignFollowUp(lead: MarketingLead) {
  const attribution = parseCampaignAttribution(lead.campaignSource);
  return Boolean(attribution?.hasPaidSignal && lead.status === 'NEW');
}

function isClosedLead(lead: MarketingLead) {
  return lead.status === 'REJECTED' || lead.status === 'ONBOARDED';
}

function timestamp(value?: string) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCampaignAttribution(source?: string): CampaignAttribution | undefined {
  if (!source?.trim()) {
    return undefined;
  }

  const raw = source.trim();
  const params = new URLSearchParams(raw);
  const fields: Array<{ label: string; value: string }> = [];
  const clickIds: string[] = [];

  addCampaignField(fields, params, 'utm_source', 'Source');
  addCampaignField(fields, params, 'utm_medium', 'Medium');
  addCampaignField(fields, params, 'utm_campaign', 'Campaign');
  addCampaignField(fields, params, 'utm_content', 'Content');
  addCampaignField(fields, params, 'utm_term', 'Term');
  addCampaignField(fields, params, 'ref', 'Ref');

  const fbclid = params.get('fbclid');
  if (fbclid) {
    clickIds.push('fbclid');
    fields.push({ label: 'Facebook click ID', value: compactValue(fbclid) });
  }

  const gclid = params.get('gclid');
  if (gclid) {
    clickIds.push('gclid');
    fields.push({ label: 'Google click ID', value: compactValue(gclid) });
  }

  const referrer = params.get('referrer');
  if (referrer) {
    fields.push({ label: 'Referrer', value: readableReferrer(referrer) });
  }

  if (fields.length === 0) {
    fields.push({ label: 'Raw source', value: raw });
  }

  const paidSignalText = [
    params.get('utm_source'),
    params.get('utm_medium'),
    params.get('utm_campaign'),
    raw,
  ].filter(Boolean).join(' ');
  const hasPaidSignal = clickIds.length > 0 || /facebook|instagram|meta|google|tiktok|ads|paid|cpc|ppc/i.test(paidSignalText);

  return { raw, fields, hasPaidSignal, clickIds };
}

function addCampaignField(
  fields: Array<{ label: string; value: string }>,
  params: URLSearchParams,
  key: string,
  label: string,
) {
  const value = params.get(key);
  if (value) {
    fields.push({ label, value });
  }
}

function readableReferrer(value: string) {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function compactValue(value: string) {
  if (value.length <= 28) {
    return value;
  }
  return `${value.slice(0, 14)}...${value.slice(-8)}`;
}

function FieldInput({
  label,
  help,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  help?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">{label}</span>
      {help && <span className="mb-2 block text-xs leading-5 text-gray-500">{help}</span>}
      <input
        type={type}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function LeadStatusBadge({ status }: { status: MarketingLeadStatus }) {
  const tones: Record<MarketingLeadStatus, string> = {
    NEW: 'bg-blue-50 text-blue-700',
    CONTACTED: 'bg-amber-50 text-amber-700',
    QUALIFIED: 'bg-green-50 text-green-700',
    REJECTED: 'bg-gray-100 text-gray-600',
    ONBOARDED: 'bg-purple-50 text-purple-700',
  };

  return <span className={`whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${tones[status]}`}>{leadStatusLabel(status)}</span>;
}

function TenantSelector({
  filteredTenants,
  selectedTenantId,
  tenantSearch,
  statusFilter,
  isLoading,
  onSearch,
  onStatusFilter,
  onSelect,
}: {
  filteredTenants: AdminTenantSummary[];
  selectedTenantId: string;
  tenantSearch: string;
  statusFilter: TenantStatus | 'ALL';
  isLoading: boolean;
  onSearch: (value: string) => void;
  onStatusFilter: (value: TenantStatus | 'ALL') => void;
  onSelect: (tenantId: string) => void;
}) {
  return (
    <div>
      <div className="space-y-2 border-b border-gray-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase text-gray-500">Workspaces</h3>
          <p className="text-xs text-gray-500">{filteredTenants.length} shown</p>
        </div>
        <div className="grid gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              value={tenantSearch}
              onChange={(event) => onSearch(event.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search workspaces"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilter(event.target.value as TenantStatus | 'ALL')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All</option>
            {tenantStatuses.map((status) => (
              <option key={status} value={status}>
                {tenantStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-h-[540px] divide-y divide-gray-100 overflow-auto">
        {filteredTenants.map((tenant) => (
          <button
            key={tenant.tenantId}
            type="button"
            onClick={() => onSelect(tenant.tenantId)}
            className={`block w-full px-3 py-2.5 text-left hover:bg-gray-50 ${
              tenant.tenantId === selectedTenantId ? 'bg-blue-50' : ''
            }`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900">{tenant.name}</span>
                <span className="mt-1 block text-xs text-gray-500">{tenant.plan?.name ?? 'No plan'} · {tenant.ordersCount} orders</span>
              </span>
              <StatusBadge status={tenant.status} />
            </span>
          </button>
        ))}
        {isLoading && <p className="p-4 text-sm text-gray-500">Loading workspaces...</p>}
        {!isLoading && !filteredTenants.length && (
          <p className="p-4 text-sm text-gray-500">No workspaces match the current filters.</p>
        )}
      </div>
    </div>
  );
}

function TenantSummaryCard({
  detail,
  selectedTenant,
  latestPayment,
}: {
  detail?: AdminTenantDetail;
  selectedTenant?: AdminTenantSummary;
  latestPayment?: TenantPayment;
}) {
  const currentStatus = detail?.status ?? selectedTenant?.status ?? 'ACTIVE';

  return (
    <section className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-gray-900">{detail?.name ?? selectedTenant?.name ?? 'Merchant workspace'}</h3>
            <StatusBadge status={currentStatus} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {detail?.usersCount ?? selectedTenant?.usersCount ?? 0} team members · {detail?.ordersCount ?? selectedTenant?.ordersCount ?? 0} orders
          </p>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 text-sm sm:grid-cols-3 lg:max-w-2xl">
          <SummaryMetric icon={<CreditCard size={16} />} label="Plan" value={detail?.plan?.name ?? selectedTenant?.plan?.name ?? 'No plan'} />
          <SummaryMetric icon={<CalendarClock size={16} />} label="Subscription" value={subscriptionStatusLabel(detail?.subscription?.status ?? selectedTenant?.subscription?.status)} />
          <SummaryMetric icon={<Banknote size={16} />} label="Last payment" value={latestPayment ? money(latestPayment.amount, latestPayment.currency) : 'None'} />
        </div>
      </div>
      {isBlocked(currentStatus) && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <p>Merchant APIs are blocked for this workspace until its access status is changed to Active or Trial.</p>
        </div>
      )}
    </section>
  );
}

function PaymentHistory({
  payments,
  isLoading,
  onReceipt,
}: {
  payments: TenantPayment[];
  isLoading: boolean;
  onReceipt: (paymentId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase text-gray-500">Payment History</h3>
          <p className="mt-1 text-xs text-gray-500">Receipts, collection details, and covered billing periods.</p>
        </div>
      </div>
      <div className="max-h-[540px] divide-y divide-gray-100 overflow-auto">
        {payments.map((payment) => (
          <article key={payment.paymentId} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="break-all text-base font-semibold text-gray-900">{payment.receiptNumber}</h4>
                  <PaymentMethodBadge method={payment.method} />
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900">{money(payment.amount, payment.currency)}</p>
                <p className="mt-1 text-xs text-gray-500">Paid {formatDateTime(payment.paidAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => onReceipt(payment.paymentId)}
                className="inline-flex shrink-0 items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <FileText size={14} />
                View receipt
              </button>
            </div>
            <dl className="mt-3 grid gap-3 rounded-md bg-gray-50 p-3 text-sm md:grid-cols-2">
              <PaymentFact label="Collected by" value={payment.collectedBy} />
              <PaymentFact label="Billing period" value={formatPeriod(payment.periodStart, payment.periodEnd)} />
              {payment.notes && <PaymentFact label="Notes" value={payment.notes} wide />}
            </dl>
          </article>
        ))}
        {isLoading && <p className="p-4 text-sm text-gray-500">Loading payments...</p>}
        {!isLoading && !payments.length && (
          <p className="p-4 text-sm text-gray-500">No payments recorded.</p>
        )}
      </div>
    </section>
  );
}

function PaymentFact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function PlanCard({
  plan,
  assignedWorkspaces,
  isUpdating,
  isDeleting,
  onArchive,
  onRestore,
  onDelete,
}: {
  plan: SubscriptionPlan;
  assignedWorkspaces: number;
  isUpdating: boolean;
  isDeleting: boolean;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const canDelete = !plan.active && assignedWorkspaces === 0;
  const usageLabel = `${assignedWorkspaces} workspace${assignedWorkspaces === 1 ? '' : 's'}`;
  const deleteTitle = plan.active
    ? 'Archive this plan before deleting it'
    : assignedWorkspaces > 0
      ? 'Plans assigned to workspaces are kept for billing history'
      : 'Delete unused archived plan';

  return (
    <article className="flex min-h-[190px] flex-col rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-gray-900">{plan.name}</h4>
          <p className="mt-1 font-mono text-xs uppercase text-gray-500">{plan.code}</p>
        </div>
        <PlanStatusBadge active={plan.active} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <div>
          <p className="text-2xl font-bold text-gray-900">{money(plan.monthlyPrice, plan.currency)}</p>
          <p className="mt-1 text-xs text-gray-500">Monthly price</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">In use</p>
          <p className="mt-1 font-medium text-gray-900">{usageLabel}</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <PlanLimit label="Orders" value={plan.orderLimit} />
        <PlanLimit label="Team seats" value={plan.userLimit} />
      </dl>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        {plan.active ? (
          <button
            type="button"
            onClick={onArchive}
            disabled={isUpdating}
            className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            <Archive size={14} />
            {isUpdating ? 'Archiving' : 'Archive'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onRestore}
            disabled={isUpdating}
            className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            <RotateCcw size={14} />
            {isUpdating ? 'Restoring' : 'Restore'}
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={!canDelete || isDeleting}
          title={deleteTitle}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 size={14} />
          {isDeleting ? 'Deleting' : 'Delete'}
        </button>
        {!canDelete && (
          <p className="flex min-h-8 items-center text-xs text-gray-500">
            {plan.active ? 'Archive before deleting.' : 'Assigned plans stay for billing history.'}
          </p>
        )}
      </div>
    </article>
  );
}

function PlanStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${
      active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-600'
    }`}
    >
      {active ? 'Active' : 'Archived'}
    </span>
  );
}

function PlanLimit({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="mt-1 font-medium text-gray-900">{value ?? 'Unlimited'}</dd>
    </div>
  );
}

function ReceiptDocument({ receipt }: { receipt: TenantPaymentReceipt }) {
  return (
    <article className="receipt-document mx-auto max-w-3xl rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-900">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xl font-bold text-[#0F5B4A]">Wasilio</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">Manual payment receipt</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-medium uppercase text-gray-500">Receipt number</p>
          <p className="mt-1 text-lg font-semibold">{receipt.receiptNumber}</p>
          <p className="mt-1 text-xs text-gray-500">Issued {formatDateTime(receipt.createdAt)}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 border-b border-gray-200 py-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">Merchant</p>
          <p className="mt-1 text-base font-semibold">{receipt.tenantName}</p>
          <p className="mt-1 text-xs text-gray-500">Workspace status: {tenantStatusLabel(receipt.tenantStatus)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">Subscription</p>
          <p className="mt-1 text-base font-semibold">{receipt.plan?.name ?? 'No plan attached'}</p>
          <p className="mt-1 text-xs text-gray-500">
            {subscriptionStatusLabel(receipt.subscriptionStatus)}
            {receipt.plan ? ` · ${money(receipt.plan.monthlyPrice, receipt.plan.currency)} / month` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 py-5 md:grid-cols-3">
        <ReceiptField label="Amount paid" value={money(receipt.amount, receipt.currency)} emphasis />
        <ReceiptField label="Payment method" value={paymentMethodLabel(receipt.method)} />
        <ReceiptField label="Paid at" value={formatDateTime(receipt.paidAt)} />
        <ReceiptField label="Billing period" value={formatPeriod(receipt.periodStart, receipt.periodEnd)} />
        <ReceiptField label="Collected by" value={receipt.collectedBy} />
        <ReceiptField label="Payment ID" value={receipt.paymentId} />
      </div>

      {receipt.notes && (
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs font-medium uppercase text-gray-500">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-gray-700">{receipt.notes}</p>
        </div>
      )}

      <footer className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500">
        <p>This receipt confirms a manual payment recorded by Wasilio operations.</p>
      </footer>
    </article>
  );
}

function KpiCard({
  icon,
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'warning';
}) {
  const toneClass = tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-600';
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase">{label}</p>
        {icon}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}

function SummaryMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-gray-500">
        {icon}
        {label}
      </div>
      <p className="truncate font-medium text-gray-900">{value}</p>
    </div>
  );
}

function AdminInfoTile({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  const tones = {
    neutral: 'border-gray-200 bg-gray-50 text-gray-600',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-md border p-3 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-2 text-lg font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs">{detail}</p>
    </div>
  );
}

function WorkspaceAccessPanel({ status }: { status: TenantStatus }) {
  const copy = workspaceAccessCopy(status);

  return (
    <div className={`mt-4 rounded-md border p-3 text-sm ${copy.className}`}>
      <p className="font-semibold">{copy.summary}</p>
      <p className="mt-1 text-xs leading-5">{copy.detail}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: TenantStatus }) {
  const classes = isBlocked(status)
    ? 'border-red-200 bg-red-50 text-red-700'
    : status === 'TRIALING'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return <span className={`rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>{tenantStatusLabel(status)}</span>;
}

function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const classes = status === 'OVERDUE' || status === 'SUSPENDED'
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : status === 'CANCELED'
      ? 'border-gray-200 bg-gray-100 text-gray-600'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}>
      {subscriptionStatusLabel(status)}
    </span>
  );
}

function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  return (
    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700">
      {paymentMethodLabel(method)}
    </span>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
  formatOption = (option) => option,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  formatOption?: (option: string) => string;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium uppercase text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  maxLength,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium uppercase text-gray-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        maxLength={maxLength}
        required={required}
      />
    </label>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return <TextInput label={label} value={value} onChange={onChange} type="datetime-local" />;
}

function ReceiptField({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className={emphasis ? 'text-lg font-bold text-gray-900' : 'font-medium text-gray-900'}>{value}</p>
    </div>
  );
}
