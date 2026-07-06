import { type FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Globe2, Save, Store, ToggleLeft, ToggleRight } from 'lucide-react';
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
  const landingEnginePattern = landingEngineProductPattern();
  const envSnippet = useMemo(() => landingEngineEnvSnippet(slugForDisplay), [slugForDisplay]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveMutation.mutate(payloadFromForm(form));
  }

  function setStatus(status: StorefrontStatus) {
    setForm((current) => ({ ...current, status }));
  }

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
            <input
              value={form.supportChannelType}
              onChange={(event) => setForm((current) => ({ ...current, supportChannelType: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={50}
            />
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Support value</span>
            <input
              value={form.supportChannelValue}
              onChange={(event) => setForm((current) => ({ ...current, supportChannelValue: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={255}
              placeholder="+212600000000"
            />
            <span className="mt-1 block text-xs text-gray-500">Displayed on public product pages for customer support.</span>
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
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Phone pattern</span>
            <input
              value={form.phonePattern}
              onChange={(event) => setForm((current) => ({ ...current, phonePattern: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={255}
              required
            />
          </label>
        </div>

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

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Globe2 size={18} className="text-blue-700" />
            <h3 className="text-sm font-semibold uppercase text-gray-500">Testing URLs</h3>
          </div>
          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600">
              Replace <span className="font-mono text-gray-900">&lt;productSlug&gt;</span> with an ACTIVE product slug.
            </p>
            <UrlRow label="Public product GET" value={publicProductUrl} />
            <UrlRow label="Landing-engine pattern" value={landingEnginePattern} />
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Store size={18} className="text-blue-700" />
            <div>
              <h3 className="text-sm font-semibold uppercase text-gray-500">Developer setup</h3>
              <p className="mt-1 text-sm text-gray-600">landing-engine .env.local values for local integration work.</p>
            </div>
          </div>
          <pre className="mt-4 overflow-auto rounded-md bg-gray-950 p-4 text-xs leading-6 text-gray-100">
            {envSnippet}
          </pre>
        </div>
      </section>
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

function payloadFromForm(form: StorefrontFormState): PublicStorefrontSettingsPayload {
  return {
    storeSlug: form.storeSlug.trim(),
    publicName: form.publicName.trim(),
    status: form.status,
    supportChannelType: optionalValue(form.supportChannelType),
    supportChannelValue: optionalValue(form.supportChannelValue),
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
    supportChannelType: settings.supportChannelType ?? '',
    supportChannelValue: settings.supportChannelValue ?? '',
    defaultCountryCode: settings.defaultCountryCode,
    defaultCurrency: settings.defaultCurrency,
    phonePattern: settings.phonePattern,
  };
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
