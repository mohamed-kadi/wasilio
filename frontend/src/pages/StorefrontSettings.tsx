import { type FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, ExternalLink, Globe2, Save, Store, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  fetchStorefrontSettings,
  getErrorMessage,
  upsertStorefrontSettings,
  type PublicStorefrontSettings,
  type PublicStorefrontSettingsPayload,
  type StorefrontStatus,
} from '../api/client';
import {
  landingEngineEnvSnippet,
  landingEngineProductPattern,
  publicOrderApiPattern,
  publicProductApiPattern,
} from '../lib/storefrontUrls';

interface StorefrontFormState {
  storeSlug: string;
  publicName: string;
  status: StorefrontStatus;
  supportChannelType: string;
  supportChannelValue: string;
  defaultCountryCode: string;
  defaultCurrency: string;
  phonePattern: string;
}

const DEFAULT_FORM: StorefrontFormState = {
  storeSlug: '',
  publicName: '',
  status: 'DISABLED',
  supportChannelType: 'whatsapp',
  supportChannelValue: '',
  defaultCountryCode: 'MA',
  defaultCurrency: 'MAD',
  phonePattern: '^(06|07)\\d{8}$',
};

const SUPPORT_TYPE_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'website', label: 'Website' },
  { value: 'none', label: 'None' },
];

export default function StorefrontSettings() {
  const {
    data: loadedSettings,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['storefront-settings'],
    queryFn: fetchStorefrontSettings,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Storefront</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Storefront Settings</h2>
          <p className="mt-1 text-sm text-gray-500">Loading storefront settings...</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <StorefrontSettingsEditor
      key={loadedSettings?.storeSlug ?? 'new-storefront'}
      initialSettings={loadedSettings}
      queryError={error}
      isFetching={isFetching}
    />
  );
}

function StorefrontSettingsEditor({
  initialSettings,
  queryError,
  isFetching,
}: {
  initialSettings: PublicStorefrontSettings | null | undefined;
  queryError: Error | null;
  isFetching: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StorefrontFormState>(() => (
    initialSettings ? formFromSettings(initialSettings) : DEFAULT_FORM
  ));
  const [savedSettings, setSavedSettings] = useState<PublicStorefrontSettings | null>(initialSettings ?? null);

  const saveMutation = useMutation({
    mutationFn: (payload: PublicStorefrontSettingsPayload) => upsertStorefrontSettings(payload),
    onSuccess: async (settings) => {
      setSavedSettings(settings);
      setForm(formFromSettings(settings));
      await queryClient.invalidateQueries({ queryKey: ['storefront-settings'] });
    },
  });

  const settings = savedSettings;
  const hasStorefront = Boolean(settings);
  const slugForDisplay = settings?.storeSlug ?? slugPreview(form.storeSlug);
  const publicProductUrl = publicProductApiPattern(slugForDisplay);
  const publicOrderUrl = publicOrderApiPattern(slugForDisplay);
  const landingEnginePattern = landingEngineProductPattern();
  const envSnippet = useMemo(() => landingEngineEnvSnippet(slugForDisplay), [slugForDisplay]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate(payloadFromForm(form));
  }

  function setStatus(status: StorefrontStatus) {
    setForm((current) => ({ ...current, status }));
  }

  function setSupportType(supportChannelType: string) {
    setForm((current) => ({
      ...current,
      supportChannelType,
      supportChannelValue: supportChannelType === 'none' ? '' : current.supportChannelValue,
    }));
  }

  const supportValueConfig = supportValueFieldConfig(form.supportChannelType);
  const knownSupportType = SUPPORT_TYPE_OPTIONS.some((option) => option.value === form.supportChannelType);
  const identityReady = Boolean(form.publicName.trim() && slugPreview(form.storeSlug));
  const supportReady = form.supportChannelType === 'none' || Boolean(form.supportChannelValue.trim());
  const checkoutReady = Boolean(
    form.defaultCountryCode.trim() && form.defaultCurrency.trim() && form.phonePattern.trim(),
  );
  const setupCards = [
    {
      title: 'Store status',
      value: form.status === 'ACTIVE' ? 'Active' : 'Disabled',
      detail: form.status === 'ACTIVE' ? 'Public product pages can be served' : 'Public pages stay hidden',
      ready: form.status === 'ACTIVE',
    },
    {
      title: 'Store identity',
      value: identityReady ? 'Ready' : 'Missing',
      detail: slugForDisplay ? `Slug: ${slugForDisplay}` : 'Add public name and slug',
      ready: identityReady,
    },
    {
      title: 'Support contact',
      value: supportReady ? supportTypeLabel(form.supportChannelType) : 'Needs value',
      detail: supportReady ? supportContactDetail(form) : 'Add a contact value or choose None',
      ready: supportReady,
    },
    {
      title: 'Checkout defaults',
      value: checkoutReady ? 'Ready' : 'Missing',
      detail: `${form.defaultCountryCode || 'Country'} / ${form.defaultCurrency || 'Currency'}`,
      ready: checkoutReady,
    },
  ];
  const submitLabel = saveMutation.isPending
    ? 'Saving'
    : hasStorefront
      ? 'Save settings'
      : 'Create storefront';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Storefront</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Storefront Settings</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure the public store identity used by Wasilio public product and order endpoints. Store slug identifies
            the public store; product slug identifies a product inside it.
            {isFetching ? ' Refreshing' : ''}
          </p>
        </div>
        <StatusPill status={form.status} />
      </div>

      {(queryError || saveMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(queryError ?? saveMutation.error)}
        </div>
      )}

      {saveMutation.isSuccess && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Storefront settings saved.
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {setupCards.map((card) => (
          <StorefrontSetupCard
            key={card.title}
            title={card.title}
            value={card.value}
            detail={card.detail}
            ready={card.ready}
          />
        ))}
      </section>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500">
              {hasStorefront ? 'Manage storefront' : 'Create storefront'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Store slug is global and becomes part of public product and order URLs. Only ACTIVE products are publicly
              visible and orderable.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatus('ACTIVE')}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                form.status === 'ACTIVE'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ToggleRight size={18} />
              Enable
            </button>
            <button
              type="button"
              onClick={() => setStatus('DISABLED')}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                form.status === 'DISABLED'
                  ? 'border-gray-300 bg-gray-100 text-gray-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ToggleLeft size={18} />
              Disable
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Public name</span>
            <input
              value={form.publicName}
              onChange={(event) => setForm((current) => ({ ...current, publicName: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={255}
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Store slug</span>
            <input
              value={form.storeSlug}
              onChange={(event) => setForm((current) => ({ ...current, storeSlug: event.target.value }))}
              onBlur={() => setForm((current) => ({ ...current, storeSlug: slugPreview(current.storeSlug) }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={160}
              required
            />
            <span className="mt-1 block text-xs text-gray-500">Public store identifier used before product slugs.</span>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Status</span>
            <select
              value={form.status}
              onChange={(event) => setStatus(event.target.value as StorefrontStatus)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="DISABLED">Disabled</option>
              <option value="ACTIVE">Active</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Support type</span>
            <select
              value={form.supportChannelType}
              onChange={(event) => setSupportType(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {!knownSupportType && form.supportChannelType && (
                <option value={form.supportChannelType}>Current: {form.supportChannelType}</option>
              )}
              {SUPPORT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Support value</span>
            <input
              type={supportValueConfig.type}
              inputMode={supportValueConfig.inputMode}
              value={form.supportChannelValue}
              onChange={(event) => setForm((current) => ({ ...current, supportChannelValue: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={255}
              placeholder={supportValueConfig.placeholder}
              disabled={form.supportChannelType === 'none'}
            />
            <span className="mt-1 block text-xs text-gray-500">{supportValueConfig.hint}</span>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Country</span>
            <input
              value={form.defaultCountryCode}
              onChange={(event) => setForm((current) => ({ ...current, defaultCountryCode: event.target.value.toUpperCase() }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={2}
              required
            />
            <span className="mt-1 block text-xs text-gray-500">Default: Morocco (MA). Controls phone validation defaults at checkout.</span>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Currency</span>
            <input
              value={form.defaultCurrency}
              onChange={(event) => setForm((current) => ({ ...current, defaultCurrency: event.target.value.toUpperCase() }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={3}
              required
            />
            <span className="mt-1 block text-xs text-gray-500">Default: MAD. Keep editable for non-MAD storefronts.</span>
          </label>
        </div>

        <details className="mt-4 border-t border-gray-200 pt-4">
          <summary className="cursor-pointer text-sm font-semibold uppercase text-gray-600">
            Advanced
          </summary>
          <div className="mt-4 max-w-2xl">
            <label>
              <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Phone pattern</span>
              <input
                value={form.phonePattern}
                onChange={(event) => setForm((current) => ({ ...current, phonePattern: event.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={255}
                required
              />
              <span className="mt-1 block text-xs text-gray-500">
                Used to validate customer phone numbers at checkout.
              </span>
            </label>
          </div>
        </details>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save size={18} />
            {submitLabel}
          </button>
          {slugForDisplay && (
            <p className="text-sm text-gray-600">
              Public slug: <span className="font-mono font-medium text-gray-900">{slugForDisplay}</span>
            </p>
          )}
        </div>
      </form>

      <details className="rounded-lg border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold uppercase text-gray-500">
          Developer setup
        </summary>
        <p className="mt-3 text-sm text-gray-600">
          Technical URLs and landing-engine local configuration for development and integration testing.
        </p>
        <section className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-2">
              <Globe2 size={18} className="text-blue-700" />
              <h3 className="text-sm font-semibold uppercase text-gray-500">Testing URLs</h3>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-600">
                Replace <span className="font-mono text-gray-900">&lt;productSlug&gt;</span> with an ACTIVE product slug.
              </p>
              <UrlRow label="Public product GET" value={publicProductUrl} />
              <UrlRow label="Public order POST" value={publicOrderUrl} />
              <UrlRow label="Landing-engine pattern" value={landingEnginePattern} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <Store size={18} className="text-blue-700" />
              <div>
                <h3 className="text-sm font-semibold uppercase text-gray-500">landing-engine .env.local</h3>
                <p className="mt-1 text-sm text-gray-600">Values for local landing-engine integration work.</p>
              </div>
            </div>
            <pre className="mt-4 overflow-auto rounded-md bg-gray-950 p-4 text-xs leading-6 text-gray-100">
              {envSnippet}
            </pre>
          </div>
        </section>
      </details>
    </div>
  );
}

function StatusPill({ status }: { status: StorefrontStatus }) {
  const enabled = status === 'ACTIVE';

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
      enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
    }`}>
      {enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

function StorefrontSetupCard({
  title,
  value,
  detail,
  ready,
}: {
  title: string;
  value: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-gray-500">{title}</p>
          <p className="mt-1 truncate text-lg font-semibold text-gray-900">{value}</p>
        </div>
        {ready ? (
          <CheckCircle2 size={18} className="shrink-0 text-emerald-700" />
        ) : (
          <Circle size={18} className="shrink-0 text-gray-300" />
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-gray-600">{detail}</p>
    </div>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <div className="mt-1 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
        <ExternalLink size={16} className="mt-0.5 shrink-0 text-gray-500" />
        <p className="break-all font-mono text-xs text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function supportTypeLabel(value: string) {
  return SUPPORT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function supportContactDetail(form: StorefrontFormState) {
  if (form.supportChannelType === 'none') {
    return 'No public support channel shown';
  }
  return form.supportChannelValue || 'Support contact saved after update';
}

function payloadFromForm(form: StorefrontFormState): PublicStorefrontSettingsPayload {
  const supportDisabled = form.supportChannelType === 'none';

  return {
    storeSlug: form.storeSlug.trim(),
    publicName: form.publicName.trim(),
    status: form.status,
    supportChannelType: supportDisabled ? undefined : optionalValue(form.supportChannelType),
    supportChannelValue: supportDisabled ? undefined : optionalValue(form.supportChannelValue),
    defaultCountryCode: form.defaultCountryCode.trim().toUpperCase(),
    defaultCurrency: form.defaultCurrency.trim().toUpperCase(),
    phonePattern: form.phonePattern.trim(),
  };
}

function formFromSettings(settings: PublicStorefrontSettings): StorefrontFormState {
  return {
    storeSlug: settings.storeSlug,
    publicName: settings.publicName,
    status: settings.status,
    supportChannelType: normalizeSupportType(settings.supportChannelType),
    supportChannelValue: settings.supportChannelValue ?? '',
    defaultCountryCode: settings.defaultCountryCode,
    defaultCurrency: settings.defaultCurrency,
    phonePattern: settings.phonePattern,
  };
}

function normalizeSupportType(value: string | undefined): string {
  if (!value?.trim()) {
    return 'none';
  }

  const normalized = value.trim().toLowerCase();
  return SUPPORT_TYPE_OPTIONS.some((option) => option.value === normalized) ? normalized : value.trim();
}

function supportValueFieldConfig(supportChannelType: string): {
  type: 'email' | 'tel' | 'text' | 'url';
  inputMode?: 'email' | 'tel' | 'text' | 'url';
  placeholder: string;
  hint: string;
} {
  switch (supportChannelType) {
    case 'whatsapp':
      return {
        type: 'tel',
        inputMode: 'tel',
        placeholder: '+212600000000',
        hint: 'WhatsApp number shown to customers for product questions and order support.',
      };
    case 'phone':
      return {
        type: 'tel',
        inputMode: 'tel',
        placeholder: '+212600000000',
        hint: 'Phone number shown to customers for support.',
      };
    case 'email':
      return {
        type: 'email',
        inputMode: 'email',
        placeholder: 'support@example.com',
        hint: 'Email address shown to customers for support.',
      };
    case 'website':
      return {
        type: 'url',
        inputMode: 'url',
        placeholder: 'https://example.com/support',
        hint: 'Website URL shown to customers for support.',
      };
    case 'none':
      return {
        type: 'text',
        inputMode: 'text',
        placeholder: 'No support channel',
        hint: 'No support channel will be shown on public product pages.',
      };
    default:
      return {
        type: 'text',
        inputMode: 'text',
        placeholder: 'Support contact',
        hint: 'Current saved support type is preserved. Choose a listed type to standardize it.',
      };
  }
}

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function slugPreview(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
