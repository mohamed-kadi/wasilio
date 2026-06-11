import { type FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileText,
  PlusCircle,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  createSubscriptionPlan,
  fetchAdminTenant,
  fetchAdminTenants,
  fetchMarketingLeads,
  fetchSubscriptionPlans,
  fetchTenantPaymentReceipt,
  getErrorMessage,
  recordTenantPayment,
  updateMarketingLeadFollowUp,
  updateAdminTenantStatus,
  upsertTenantSubscription,
  type AdminTenantDetail,
  type AdminTenantSummary,
  type MarketingLead,
  type MarketingLeadStatus,
  type PaymentMethod,
  type SubscriptionStatus,
  type TenantPayment,
  type TenantPaymentReceipt,
  type TenantStatus,
} from '../api/client';

const tenantStatuses: TenantStatus[] = ['ACTIVE', 'TRIALING', 'OVERDUE', 'SUSPENDED', 'DISABLED'];
const subscriptionStatuses: SubscriptionStatus[] = ['TRIALING', 'ACTIVE', 'OVERDUE', 'SUSPENDED', 'CANCELED'];
const paymentMethods: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHECK', 'OTHER'];
const marketingLeadStatuses: MarketingLeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'REJECTED', 'ONBOARDED'];
const blockedStatuses: TenantStatus[] = ['OVERDUE', 'SUSPENDED', 'DISABLED'];
type WorkspaceTab = 'tenants' | 'billing' | 'payments' | 'plans' | 'leads';

const workspaceTabs: Array<{ id: WorkspaceTab; label: string; icon: ReactNode }> = [
  { id: 'tenants', label: 'Tenants', icon: <Building2 size={16} /> },
  { id: 'billing', label: 'Billing', icon: <CreditCard size={16} /> },
  { id: 'payments', label: 'Payments', icon: <Banknote size={16} /> },
  { id: 'plans', label: 'Plans', icon: <FileText size={16} /> },
  { id: 'leads', label: 'Leads', icon: <ClipboardList size={16} /> },
];

function toDateTimeLocal(value?: string) {
  return value ? value.slice(0, 16) : '';
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : undefined;
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

function isBlocked(status: TenantStatus) {
  return blockedStatuses.includes(status);
}

export default function AdminBilling() {
  const queryClient = useQueryClient();
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
  const [planCode, setPlanCode] = useState('');
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planCurrency, setPlanCurrency] = useState('MAD');
  const [planOrderLimit, setPlanOrderLimit] = useState('');
  const [planUserLimit, setPlanUserLimit] = useState('');
  const [receiptPaymentId, setReceiptPaymentId] = useState('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('tenants');

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
  const effectiveTenantStatus = tenantStatus || detail?.status || selectedTenant?.status || 'ACTIVE';
  const effectivePlanId = planId || detail?.subscription?.planId || selectedTenant?.subscription?.planId || plans[0]?.planId || '';
  const effectiveSubscriptionStatus = subscriptionStatus || detail?.subscription?.status || selectedTenant?.subscription?.status || 'TRIALING';
  const effectiveCurrentPeriodStart = currentPeriodStart || toDateTimeLocal(detail?.subscription?.currentPeriodStart);
  const effectiveCurrentPeriodEnd = currentPeriodEnd || toDateTimeLocal(detail?.subscription?.currentPeriodEnd);
  const effectiveTrialEndsAt = trialEndsAt || toDateTimeLocal(detail?.subscription?.trialEndsAt);

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

  const receiptQuery = useQuery({
    queryKey: ['tenant-payment-receipt', effectiveTenantId, receiptPaymentId],
    queryFn: () => fetchTenantPaymentReceipt(effectiveTenantId, receiptPaymentId),
    enabled: Boolean(effectiveTenantId && receiptPaymentId),
  });

  const latestPayment = detail?.payments[0];
  const error =
    tenantsQuery.error ??
    plansQuery.error ??
    leadsQuery.error ??
    detailQuery.error ??
    statusMutation.error ??
    subscriptionMutation.error ??
    paymentMutation.error ??
    planMutation.error ??
    leadFollowUpMutation.error ??
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Super Admin</h2>
          <p className="text-sm text-gray-500">Tenant health, billing status, manual payments, and receipt control</p>
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
        <KpiCard icon={<Building2 size={18} />} label="Tenants" value={String(kpis.totalTenants)} detail={`${kpis.activeTenants} active or trialing`} />
        <KpiCard icon={<ShieldAlert size={18} />} label="Needs action" value={String(kpis.blockedTenants)} detail="Overdue, suspended, or disabled" tone={kpis.blockedTenants ? 'warning' : 'neutral'} />
        <KpiCard icon={<TrendingUp size={18} />} label="Projected MRR" value={money(kpis.mrr, kpis.currency)} detail={`${kpis.subscribedTenants} subscribed tenants`} />
        <KpiCard icon={<CreditCard size={18} />} label="Orders under management" value={String(kpis.totalOrders)} detail="Across all tenants" />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-gray-200 p-3">
          {workspaceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr]">
          <aside className="border-b border-gray-200 xl:border-b-0 xl:border-r">
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

          <main className="min-h-[580px] p-5">
            <TenantSummaryCard detail={detail} selectedTenant={selectedTenant} latestPayment={latestPayment} />

            {activeTab === 'tenants' && (
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <form onSubmit={handleTenantStatus} className="rounded-lg border border-gray-200 bg-white p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase text-gray-500">Tenant Control</h3>
                  <label>
                    <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Operational status</span>
                    <select
                      value={effectiveTenantStatus}
                      onChange={(event) => setTenantStatus(event.target.value as TenantStatus)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {tenantStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="mt-3 text-xs text-gray-500">ACTIVE and TRIALING tenants can use merchant workflows. OVERDUE, SUSPENDED, and DISABLED tenants are blocked.</p>
                  <button
                    type="submit"
                    disabled={!effectiveTenantId || statusMutation.isPending}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save size={16} />
                    Save status
                  </button>
                </form>

                <section className="rounded-lg border border-gray-200 bg-white p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase text-gray-500">Tenant Snapshot</h3>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <ReceiptField label="Users" value={String(detail?.usersCount ?? selectedTenant?.usersCount ?? 0)} />
                    <ReceiptField label="Orders" value={String(detail?.ordersCount ?? selectedTenant?.ordersCount ?? 0)} />
                    <ReceiptField label="Plan" value={detail?.plan?.name ?? selectedTenant?.plan?.name ?? 'No plan'} />
                    <ReceiptField label="Subscription" value={detail?.subscription?.status ?? selectedTenant?.subscription?.status ?? 'None'} />
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'billing' && (
              <form onSubmit={handleSubscription} className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold uppercase text-gray-500">Subscription</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label>
                    <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Plan</span>
                    <select
                      value={effectivePlanId}
                      onChange={(event) => setPlanId(event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select plan</option>
                      {plans.map((plan) => (
                        <option key={plan.planId} value={plan.planId}>
                          {plan.name} · {money(plan.monthlyPrice, plan.currency)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SelectInput label="Status" value={effectiveSubscriptionStatus} onChange={(value) => setSubscriptionStatus(value as SubscriptionStatus)} options={subscriptionStatuses} />
                  <DateInput label="Period start" value={effectiveCurrentPeriodStart} onChange={setCurrentPeriodStart} />
                  <DateInput label="Period end" value={effectiveCurrentPeriodEnd} onChange={setCurrentPeriodEnd} />
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
            )}

            {activeTab === 'payments' && (
              <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-[420px_1fr]">
                <form onSubmit={handlePayment} className="rounded-lg border border-gray-200 bg-white p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase text-gray-500">
                    <Banknote size={16} />
                    Record Manual Payment
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <SelectInput label="Method" value={paymentMethod} onChange={(value) => setPaymentMethod(value as PaymentMethod)} options={paymentMethods} />
                    <TextInput label="Amount" value={paymentAmount} onChange={setPaymentAmount} type="number" required />
                    <TextInput label="Currency" value={paymentCurrency} onChange={setPaymentCurrency} maxLength={3} required />
                    <DateInput label="Paid at" value={paymentPaidAt} onChange={setPaymentPaidAt} />
                    <DateInput label="Period start" value={paymentPeriodStart} onChange={setPaymentPeriodStart} />
                    <DateInput label="Period end" value={paymentPeriodEnd} onChange={setPaymentPeriodEnd} />
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
                  payments={detail?.payments ?? []}
                  isLoading={detailQuery.isLoading}
                  latestPayment={latestPayment}
                  onReceipt={(paymentId) => setReceiptPaymentId(paymentId)}
                />

                {receiptQuery.data && (
                  <section className="receipt-shell rounded-lg border border-gray-200 bg-white p-5 2xl:col-span-2">
                    <div className="receipt-actions mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase text-gray-500">
                        <FileText size={16} />
                        Receipt
                      </h3>
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
              </div>
            )}

            {activeTab === 'plans' && (
              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
                <form onSubmit={handlePlan} className="rounded-lg border border-gray-200 bg-white p-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase text-gray-500">Create Plan</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <TextInput label="Code" value={planCode} onChange={setPlanCode} required />
                    <TextInput label="Name" value={planName} onChange={setPlanName} required />
                    <TextInput label="Price" value={planPrice} onChange={setPlanPrice} type="number" required />
                    <TextInput label="Currency" value={planCurrency} onChange={setPlanCurrency} maxLength={3} required />
                    <TextInput label="Order limit" value={planOrderLimit} onChange={setPlanOrderLimit} type="number" />
                    <TextInput label="User limit" value={planUserLimit} onChange={setPlanUserLimit} type="number" />
                  </div>
                  <button
                    type="submit"
                    disabled={!planCode || !planName || !planPrice || planMutation.isPending}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <PlusCircle size={16} />
                    Create plan
                  </button>
                </form>

                <section className="rounded-lg border border-gray-200 bg-white">
                  <div className="border-b border-gray-200 p-4">
                    <h3 className="text-sm font-semibold uppercase text-gray-500">Plans</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                        <tr>
                          <th className="p-3">Plan</th>
                          <th className="p-3">Code</th>
                          <th className="p-3">Price</th>
                          <th className="p-3">Limits</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {plans.map((plan) => (
                          <tr key={plan.planId}>
                            <td className="p-3 font-medium text-gray-900">{plan.name}</td>
                            <td className="p-3">{plan.code}</td>
                            <td className="p-3">{money(plan.monthlyPrice, plan.currency)}</td>
                            <td className="p-3">{plan.orderLimit ?? 'Unlimited'} orders · {plan.userLimit ?? 'Unlimited'} users</td>
                            <td className="p-3">{plan.active ? 'Active' : 'Inactive'}</td>
                          </tr>
                        ))}
                        {!plansQuery.isLoading && !plans.length && (
                          <tr>
                            <td className="p-4 text-sm text-gray-500" colSpan={5}>
                              No plans created.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'leads' && (
              <LeadList
                leads={leads}
                isLoading={leadsQuery.isLoading}
                updatingLeadId={leadFollowUpMutation.variables?.leadId}
                onUpdate={(payload) => leadFollowUpMutation.mutate(payload)}
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
  onUpdate,
}: {
  leads: MarketingLead[];
  isLoading: boolean;
  updatingLeadId?: string;
  onUpdate: (payload: { leadId: string; status: MarketingLeadStatus; nextFollowUpAt?: string; internalNotes?: string }) => void;
}) {
  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-5">
        <h3 className="text-sm font-semibold uppercase text-gray-500">Demo Requests</h3>
        <p className="mt-1 text-sm text-gray-600">{leads.length} captured leads for pilot follow-up.</p>
      </div>
      <div className="divide-y divide-gray-100">
        {leads.map((lead) => (
          <LeadCard key={lead.leadId} lead={lead} isUpdating={updatingLeadId === lead.leadId} onUpdate={onUpdate} />
        ))}
        {isLoading && <p className="p-5 text-sm text-gray-500">Loading leads...</p>}
        {!isLoading && !leads.length && <p className="p-5 text-sm text-gray-500">No demo requests captured yet.</p>}
      </div>
    </section>
  );
}

function LeadCard({
  lead,
  isUpdating,
  onUpdate,
}: {
  lead: MarketingLead;
  isUpdating: boolean;
  onUpdate: (payload: { leadId: string; status: MarketingLeadStatus; nextFollowUpAt?: string; internalNotes?: string }) => void;
}) {
  const [status, setStatus] = useState<MarketingLeadStatus>(lead.status);
  const [nextFollowUpAt, setNextFollowUpAt] = useState(toDateTimeLocal(lead.nextFollowUpAt));
  const [internalNotes, setInternalNotes] = useState(lead.internalNotes ?? '');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onUpdate({
      leadId: lead.leadId,
      status,
      nextFollowUpAt: fromDateTimeLocal(nextFollowUpAt),
      internalNotes: internalNotes || undefined,
    });
  }

  return (
    <article className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1fr_360px]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-gray-900">{lead.storeName}</h4>
          <LeadStatusBadge status={lead.status} />
          {lead.city && <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{lead.city}</span>}
          {lead.monthlyOrderVolume && <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{lead.monthlyOrderVolume}</span>}
        </div>
        <p className="mt-2 text-sm text-gray-700">{lead.contactName} · {lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
        {lead.message && <p className="mt-2 text-sm leading-6 text-gray-600">{lead.message}</p>}
        <div className="mt-3 grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
          <p>Captured: <span className="font-medium text-gray-700">{formatDateTime(lead.createdAt)}</span></p>
          <p>Next follow-up: <span className="font-medium text-gray-700">{formatDateTime(lead.nextFollowUpAt)}</span></p>
          {lead.campaignSource && <p className="sm:col-span-2">Source: <span className="font-medium text-gray-700">{lead.campaignSource}</span></p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-md border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3">
          <label>
            <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">Lead status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as MarketingLeadStatus)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {marketingLeadStatuses.map((leadStatus) => (
                <option key={leadStatus} value={leadStatus}>{leadStatus}</option>
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
          <a href={`tel:${lead.phone}`} className="inline-flex rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Call lead
          </a>
        </div>
      </form>
    </article>
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

  return <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tones[status]}`}>{status}</span>;
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
      <div className="space-y-3 border-b border-gray-200 p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase text-gray-500">Tenants</h3>
          <p className="mt-1 text-xs text-gray-500">{filteredTenants.length} shown</p>
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              value={tenantSearch}
              onChange={(event) => onSearch(event.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search tenants"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilter(event.target.value as TenantStatus | 'ALL')}
            className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All</option>
            {tenantStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-h-[620px] divide-y divide-gray-100 overflow-auto">
        {filteredTenants.map((tenant) => (
          <button
            key={tenant.tenantId}
            type="button"
            onClick={() => onSelect(tenant.tenantId)}
            className={`block w-full px-4 py-3 text-left hover:bg-gray-50 ${
              tenant.tenantId === selectedTenantId ? 'bg-blue-50' : ''
            }`}
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block text-sm font-medium text-gray-900">{tenant.name}</span>
                <span className="mt-1 block text-xs text-gray-500">{tenant.plan?.name ?? 'No plan'} · {tenant.ordersCount} orders</span>
              </span>
              <StatusBadge status={tenant.status} />
            </span>
          </button>
        ))}
        {isLoading && <p className="p-4 text-sm text-gray-500">Loading tenants...</p>}
        {!isLoading && !filteredTenants.length && (
          <p className="p-4 text-sm text-gray-500">No tenants match the current filters.</p>
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
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold text-gray-900">{detail?.name ?? selectedTenant?.name ?? 'Tenant'}</h3>
            <StatusBadge status={currentStatus} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {detail?.usersCount ?? selectedTenant?.usersCount ?? 0} users · {detail?.ordersCount ?? selectedTenant?.ordersCount ?? 0} orders
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <SummaryMetric icon={<CreditCard size={16} />} label="Plan" value={detail?.plan?.name ?? selectedTenant?.plan?.name ?? 'No plan'} />
          <SummaryMetric icon={<CalendarClock size={16} />} label="Subscription" value={detail?.subscription?.status ?? selectedTenant?.subscription?.status ?? 'None'} />
          <SummaryMetric icon={<Banknote size={16} />} label="Last payment" value={latestPayment ? money(latestPayment.amount, latestPayment.currency) : 'None'} />
        </div>
      </div>
      {isBlocked(currentStatus) && (
        <div className="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 shrink-0" size={16} />
          <p>Merchant APIs are blocked for this tenant until its status is changed to ACTIVE or TRIALING.</p>
        </div>
      )}
    </section>
  );
}

function PaymentHistory({
  payments,
  isLoading,
  latestPayment,
  onReceipt,
}: {
  payments: TenantPayment[];
  isLoading: boolean;
  latestPayment?: TenantPayment;
  onReceipt: (paymentId: string) => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-4">
        <h3 className="text-sm font-semibold uppercase text-gray-500">Payment History</h3>
        {latestPayment && <p className="text-xs text-gray-500">Latest receipt: {latestPayment.receiptNumber}</p>}
      </div>
      <div className="max-h-[520px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-3">Receipt</th>
              <th className="p-3">Method</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Paid</th>
              <th className="p-3">Collected by</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {payments.map((payment) => (
              <tr key={payment.paymentId}>
                <td className="p-3 font-medium text-gray-900">{payment.receiptNumber}</td>
                <td className="p-3">{payment.method}</td>
                <td className="p-3">{money(payment.amount, payment.currency)}</td>
                <td className="p-3">{formatDateTime(payment.paidAt)}</td>
                <td className="p-3">{payment.collectedBy}</td>
                <td className="p-3 text-right">
                  <button
                    type="button"
                    onClick={() => onReceipt(payment.paymentId)}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <FileText size={14} />
                    Receipt
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && !payments.length && (
              <tr>
                <td className="p-4 text-sm text-gray-500" colSpan={6}>
                  No payments recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
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
          <p className="mt-1 text-xs text-gray-500">Tenant status: {receipt.tenantStatus}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-gray-500">Subscription</p>
          <p className="mt-1 text-base font-semibold">{receipt.plan?.name ?? 'No plan attached'}</p>
          <p className="mt-1 text-xs text-gray-500">
            {receipt.subscriptionStatus ?? 'No subscription status'}
            {receipt.plan ? ` · ${money(receipt.plan.monthlyPrice, receipt.plan.currency)} / month` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 py-5 md:grid-cols-3">
        <ReceiptField label="Amount paid" value={money(receipt.amount, receipt.currency)} emphasis />
        <ReceiptField label="Payment method" value={receipt.method} />
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
    <div className="min-w-36 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-gray-500">
        {icon}
        {label}
      </div>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: TenantStatus }) {
  const classes = isBlocked(status)
    ? 'border-red-200 bg-red-50 text-red-700'
    : status === 'TRIALING'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return <span className={`rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>{status}</span>;
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
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
            {option}
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
