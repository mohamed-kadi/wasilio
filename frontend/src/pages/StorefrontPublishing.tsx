import { type ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Globe2,
  Package,
  Send,
  Settings,
  ToggleLeft,
  X,
  XCircle,
} from 'lucide-react';
import {
  fetchPublicStorefrontProductPage,
  fetchProductStorefrontProfile,
  fetchProducts,
  fetchStorefrontSettings,
  getErrorMessage,
  upsertProductStorefrontProfile,
  type Product,
  type ProductStatus,
  type PublicProductReadiness,
  type PublicStorefrontSettings,
  type StorefrontProductProfile,
  type StorefrontProductProfilePayload,
  type StorefrontProductProfileStatus,
} from '../api/client';
import ProductImageFrame from '../components/ProductImageFrame';
import StorefrontProfileEditor from '../components/StorefrontProfileEditor';
import {
  landingEngineProductUrl,
  publicProductApiPattern,
  publicProductApiUrl,
} from '../lib/storefrontUrls';

export default function StorefrontPublishing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProductId = searchParams.get('productId');

  const {
    data: productsPage,
    error: productsError,
    isLoading: productsLoading,
    isFetching: productsFetching,
  } = useQuery({
    queryKey: ['storefront-publishing-products'],
    queryFn: () => fetchProducts({ page: 0, size: 100 }),
  });

  const {
    data: settings,
    error: settingsError,
    isLoading: settingsLoading,
  } = useQuery({
    queryKey: ['storefront-settings'],
    queryFn: fetchStorefrontSettings,
  });

  const products = productsPage?.content ?? [];
  const selectedProduct = selectedProductId
    ? products.find((product) => product.id === selectedProductId) ?? null
    : null;

  function selectProduct(productId: string) {
    setSearchParams({ productId });
  }

  function clearSelectedProduct() {
    setSearchParams({});
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Storefront</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Product Publishing</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Move a catalog product into the public storefront workflow: confirm the product is ACTIVE, edit landing
            content, publish the profile, preview the public page, and keep storefront orders flowing into Wasilio.
            {productsFetching && !productsLoading ? ' Refreshing' : ''}
          </p>
        </div>
        <Link
          to="/app/storefront/settings"
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Settings size={18} />
          Storefront settings
        </Link>
      </div>

      {(productsError || settingsError) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(productsError ?? settingsError)}
        </div>
      )}

      {!settingsLoading && !settings && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Configure storefront settings before previewing public product URLs. Products can still have draft landing
          content prepared here.
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <WorkflowStep
          icon={<Package size={18} />}
          title="Catalog"
          detail="Only ACTIVE catalog products can appear on public storefront endpoints."
        />
        <WorkflowStep
          icon={<FileText size={18} />}
          title="Landing Profile"
          detail="The storefront profile owns headline, benefits, FAQ, trust badges, gallery, and SEO overrides."
        />
        <WorkflowStep
          icon={<ToggleLeft size={18} />}
          title="Draft vs Published"
          detail="Published profile content is included in the public product API; draft content stays hidden."
        />
        <WorkflowStep
          icon={<Globe2 size={18} />}
          title="Public URL"
          detail="Store slug identifies the store. Product slug identifies the product inside that store."
        />
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold uppercase text-gray-500">Publishing table</h3>
          <p className="mt-1 text-sm text-gray-600">
            Orders from a landing-engine product page continue through the existing Wasilio public order API and arrive
            as storefront inbound orders.
          </p>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">Catalog status</th>
                <th className="p-4 font-medium">Profile status</th>
                <th className="p-4 font-medium">Readiness</th>
                <th className="p-4 font-medium">Price</th>
                <th className="p-4 font-medium">Missing items</th>
                <th className="p-4 font-medium">Public URLs</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <PublishingProductRow
                  key={product.id}
                  product={product}
                  settings={settings ?? null}
                  isSelected={selectedProductId === product.id}
                  onSelect={() => selectProduct(product.id)}
                />
              ))}
              {!productsLoading && products.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    No products found. Create catalog products before publishing storefront pages.
                  </td>
                </tr>
              )}
              {productsLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Loading products...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedProduct && (
        <StorefrontEditorPanel product={selectedProduct} onClose={clearSelectedProduct} />
      )}

      {selectedProductId && !selectedProduct && !productsLoading && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          The selected product is not visible in this publishing page. Return from the Products page again or increase
          the publishing list size in a later workflow iteration.
        </div>
      )}

      {!selectedProductId && (
        <section className="rounded-lg border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-500">
          Select Edit Landing Content from the publishing table to open the storefront profile editor.
        </section>
      )}
    </div>
  );
}

function StorefrontEditorPanel({ product, onClose }: { product: Product; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-5xl flex-col bg-gray-50 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Storefront publishing</p>
            <h3 className="mt-1 text-xl font-bold text-gray-900">{product.name}</h3>
            <p className="mt-1 font-mono text-xs text-gray-500">{product.slug}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
            aria-label="Close landing content editor"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <StorefrontProfileEditor product={product} />
        </div>
      </aside>
    </div>
  );
}

function PublishingProductRow({
  product,
  settings,
  isSelected,
  onSelect,
}: {
  product: Product;
  settings: PublicStorefrontSettings | null;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    data: profile,
    error: profileError,
    isLoading,
  } = useQuery({
    queryKey: ['product-storefront-profile', product.id],
    queryFn: () => fetchProductStorefrontProfile(product.id),
  });
  const publicReadinessEnabled = Boolean(
    settings?.storeSlug && settings.status === 'ACTIVE' && product.status === 'ACTIVE',
  );
  const publicReadinessQuery = useQuery({
    queryKey: ['public-storefront-product-page', settings?.storeSlug, product.slug],
    queryFn: () => fetchPublicStorefrontProductPage(settings?.storeSlug ?? '', product.slug),
    enabled: publicReadinessEnabled,
    retry: false,
  });

  const profileToggleMutation = useMutation({
    mutationFn: (status: StorefrontProductProfileStatus) => {
      if (!profile) {
        throw new Error('Create landing content before publishing this profile.');
      }
      return upsertProductStorefrontProfile(product.id, profilePayloadWithStatus(profile, status));
    },
    onSuccess: (savedProfile) => {
      queryClient.setQueryData(['product-storefront-profile', product.id], savedProfile);
    },
  });

  const landingContentExists = hasLandingContent(profile);
  const publicState = publicAvailability(product, settings);
  const readiness = evaluateReadiness(product, profile ?? null);
  const publicReady = readiness.status === 'READY' && publicState.tone === 'green';
  const canToggleProfile = Boolean(profile && (profile.status === 'PUBLISHED' || landingContentExists));
  const nextStatus: StorefrontProductProfileStatus = profile?.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
  const toggleLabel = profile?.status === 'PUBLISHED' ? 'Unpublish' : 'Publish';
  const apiUrl = settings?.storeSlug
    ? publicProductApiUrl(settings.storeSlug, product.slug)
    : publicProductApiPattern();
  const previewUrl = settings?.storeSlug ? landingEngineProductUrl(product.slug) : null;

  function toggleProfileStatus() {
    profileToggleMutation.mutate(nextStatus);
  }

  return (
    <tr className={isSelected ? 'bg-blue-50/70' : 'hover:bg-gray-50'}>
      <td className="p-4 align-top">
        <div className="flex items-start gap-3">
          <ProductImageFrame imageUrl={product.imageUrl} alt={product.name} />
          <div className="min-w-0">
            <p className="font-medium text-gray-900">{product.name}</p>
            <p className="mt-1 break-all font-mono text-xs text-gray-500">{product.slug}</p>
          </div>
        </div>
      </td>
      <td className="p-4 align-top">
        <CatalogStatusBadge status={product.status} />
      </td>
      <td className="p-4 align-top">
        {isLoading ? <SmallMuted>Loading</SmallMuted> : <ProfileStatusBadge profile={profile ?? null} />}
        {profileError && <p className="mt-2 text-xs text-red-700">{getErrorMessage(profileError)}</p>}
      </td>
      <td className="p-4 align-top">
        <ReadinessBadge status={readiness.status} />
        <p className="mt-2 text-xs font-medium text-gray-700">
          {readiness.requiredComplete}/{readiness.requiredTotal} required items complete
        </p>
        <PublicReadinessSummary
          enabled={publicReadinessEnabled}
          isLoading={publicReadinessQuery.isLoading}
          readiness={publicReadinessQuery.data?.readiness}
          error={publicReadinessQuery.error}
        />
        <p className="mt-2 max-w-44 text-xs text-gray-500">{publicState.detail}</p>
      </td>
      <td className="p-4 align-top font-medium text-gray-900">{formatMoney(product.priceAmount, product.currency)}</td>
      <td className="p-4 align-top">
        <MissingItemsList readiness={readiness} />
      </td>
      <td className="p-4 align-top">
        <div className="space-y-3">
          <UrlLine label="Public API" value={apiUrl} />
          {previewUrl ? (
            <UrlLine label="Landing preview" value={previewUrl} />
          ) : (
            <SmallMuted>Configure a store slug to preview landing-engine URLs.</SmallMuted>
          )}
        </div>
      </td>
      <td className="p-4 align-top">
        <div className="flex min-w-48 flex-col gap-2">
          <button
            type="button"
            onClick={onSelect}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <Edit3 size={16} />
            Edit Landing Content
          </button>
          {previewUrl && publicReady ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink size={16} />
              Preview Public Page
            </a>
          ) : previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
            >
              <ExternalLink size={16} />
              Incomplete Preview
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-400"
            >
              <ExternalLink size={16} />
              Preview Public Page
            </button>
          )}
          <button
            type="button"
            onClick={toggleProfileStatus}
            disabled={!canToggleProfile || profileToggleMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:text-gray-400 disabled:opacity-70"
            title={canToggleProfile ? `${toggleLabel} profile` : 'Create landing content before publishing'}
          >
            <Send size={16} />
            {profileToggleMutation.isPending ? 'Saving' : toggleLabel}
          </button>
          {profileToggleMutation.error && (
            <p className="text-xs text-red-700">{getErrorMessage(profileToggleMutation.error)}</p>
          )}
        </div>
      </td>
    </tr>
  );
}

function WorkflowStep({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-blue-700">
        {icon}
        <p className="text-xs font-semibold uppercase">{title}</p>
      </div>
      <p className="mt-2 text-sm leading-6 text-gray-600">{detail}</p>
    </div>
  );
}

function CatalogStatusBadge({ status }: { status: ProductStatus }) {
  const classes = {
    DRAFT: 'bg-amber-100 text-amber-800',
    ACTIVE: 'bg-green-100 text-green-800',
    ARCHIVED: 'bg-gray-100 text-gray-700',
  };

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes[status]}`}>{status}</span>;
}

function ProfileStatusBadge({ profile }: { profile: StorefrontProductProfile | null }) {
  if (!profile) {
    return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">NO PROFILE</span>;
  }

  const published = profile.status === 'PUBLISHED';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
      published ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
    }`}>
      {profile.status}
    </span>
  );
}

function ReadinessBadge({ status }: { status: ReadinessStatus }) {
  const classes = {
    READY: 'bg-green-100 text-green-800',
    NEEDS_WORK: 'bg-amber-100 text-amber-800',
    NOT_PUBLIC: 'bg-gray-100 text-gray-700',
  };
  const labels = {
    READY: 'Ready',
    NEEDS_WORK: 'Needs work',
    NOT_PUBLIC: 'Not public',
  };
  const Icon = status === 'READY' ? CheckCircle2 : status === 'NEEDS_WORK' ? AlertTriangle : XCircle;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${classes[status]}`}>
      <Icon size={14} />
      {labels[status]}
    </span>
  );
}

function PublicReadinessSummary({
  enabled,
  isLoading,
  readiness,
  error,
}: {
  enabled: boolean;
  isLoading: boolean;
  readiness?: PublicProductReadiness;
  error: unknown;
}) {
  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return <p className="mt-2 text-xs text-gray-500">Checking public API readiness</p>;
  }

  if (readiness) {
    const requiredMissing = readiness.items.filter((item) => item.required && !item.complete).length;
    const complete = requiredMissing === 0 && readiness.orderable;
    return (
      <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-2">
        <p className="text-xs font-semibold uppercase text-gray-500">Public API readiness</p>
        <p className={`mt-1 text-xs font-medium ${complete ? 'text-emerald-700' : 'text-amber-800'}`}>
          {readiness.requiredComplete}/{readiness.requiredTotal} required items complete
        </p>
      </div>
    );
  }

  if (error) {
    return <p className="mt-2 text-xs text-amber-700">Public API readiness unavailable</p>;
  }

  return null;
}

function MissingItemsList({ readiness }: { readiness: ProductReadiness }) {
  const requiredMissing = readiness.requiredItems.filter((item) => !item.complete);
  const recommendedMissing = readiness.recommendedItems.filter((item) => !item.complete);

  if (requiredMissing.length === 0 && recommendedMissing.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-green-700">
        <Check size={14} />
        Required and recommended content complete.
      </div>
    );
  }

  return (
    <div className="max-w-64 space-y-2">
      {requiredMissing.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Required</p>
          <ul className="mt-1 space-y-1 text-xs text-gray-700">
            {requiredMissing.map((item) => (
              <li key={item.label} className="flex gap-1.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {recommendedMissing.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Recommended</p>
          <ul className="mt-1 space-y-1 text-xs text-gray-500">
            {recommendedMissing.map((item) => (
              <li key={item.label} className="flex gap-1.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UrlLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <div className="mt-1 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-2">
        <p className="min-w-0 flex-1 break-all font-mono text-xs text-gray-800">{value}</p>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function copyValue() {
    if (!navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
      aria-label="Copy URL"
      title={copied ? 'Copied' : 'Copy URL'}
    >
      <Copy size={14} />
    </button>
  );
}

function SmallMuted({ children }: { children: ReactNode }) {
  return <p className="max-w-48 text-xs text-gray-500">{children}</p>;
}

type ReadinessStatus = 'READY' | 'NEEDS_WORK' | 'NOT_PUBLIC';

interface ReadinessItem {
  label: string;
  complete: boolean;
}

interface ProductReadiness {
  status: ReadinessStatus;
  requiredComplete: number;
  requiredTotal: number;
  requiredItems: ReadinessItem[];
  recommendedItems: ReadinessItem[];
}

function evaluateReadiness(
  product: Product,
  profile: StorefrontProductProfile | null,
): ProductReadiness {
  const requiredItems: ReadinessItem[] = [
    {
      label: 'Set product status to ACTIVE',
      complete: product.status === 'ACTIVE',
    },
    {
      label: 'Add product description',
      complete: hasText(product.description),
    },
    {
      label: 'Add primary product image',
      complete: hasText(product.imageUrl),
    },
    {
      label: 'Create storefront profile',
      complete: Boolean(profile),
    },
    {
      label: 'Publish the storefront profile',
      complete: profile?.status === 'PUBLISHED',
    },
    {
      label: 'Add a landing headline',
      complete: hasText(profile?.headline),
    },
    {
      label: 'Add at least one benefit',
      complete: Boolean(profile?.benefits.length),
    },
    {
      label: 'Add at least one feature',
      complete: Boolean(profile?.features.length),
    },
  ];

  const recommendedItems: ReadinessItem[] = [
    {
      label: 'Add FAQ',
      complete: Boolean(profile?.faq.length),
    },
    {
      label: 'Add trust badges',
      complete: Boolean(profile?.trustBadges.length),
    },
    {
      label: 'Add SEO title',
      complete: hasText(profile?.seoTitle),
    },
    {
      label: 'Add SEO description',
      complete: hasText(profile?.seoDescription),
    },
    {
      label: 'Add gallery media',
      complete: Boolean(profile?.galleryImageUrls.length),
    },
    {
      label: 'Add SEO image',
      complete: hasText(profile?.seoImageUrl),
    },
  ];

  const requiredComplete = requiredItems.filter((item) => item.complete).length;
  const hardPublicBlocker = product.status !== 'ACTIVE' || !profile || profile.status !== 'PUBLISHED';
  const status = requiredComplete === requiredItems.length
    ? 'READY'
    : hardPublicBlocker
      ? 'NOT_PUBLIC'
      : 'NEEDS_WORK';

  return {
    status,
    requiredComplete,
    requiredTotal: requiredItems.length,
    requiredItems,
    recommendedItems,
  };
}

function publicAvailability(product: Product, settings: PublicStorefrontSettings | null) {
  if (!settings) {
    return {
      label: 'Store not configured',
      detail: 'Create storefront settings before public URLs resolve.',
      tone: 'gray' as const,
    };
  }
  if (settings.status !== 'ACTIVE') {
    return {
      label: 'Store disabled',
      detail: 'Enable storefront settings before public products are available.',
      tone: 'amber' as const,
    };
  }
  if (product.status !== 'ACTIVE') {
    return {
      label: 'Catalog hidden',
      detail: 'Set the catalog product to ACTIVE before it appears publicly.',
      tone: 'amber' as const,
    };
  }
  return {
    label: 'Public product live',
    detail: 'The public product API can resolve this product slug.',
    tone: 'green' as const,
  };
}

function hasLandingContent(profile: StorefrontProductProfile | null | undefined): boolean {
  if (!profile) {
    return false;
  }

  return Boolean(
    profile.headline
      || profile.subheadline
      || profile.seoTitle
      || profile.seoDescription
      || profile.seoImageUrl
      || profile.benefits.length
      || profile.features.length
      || profile.faq.length
      || profile.trustBadges.length
      || profile.galleryImageUrls.length
  );
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function profilePayloadWithStatus(
  profile: StorefrontProductProfile,
  status: StorefrontProductProfileStatus,
): StorefrontProductProfilePayload {
  return {
    headline: profile.headline,
    subheadline: profile.subheadline,
    benefits: profile.benefits,
    features: profile.features,
    faq: profile.faq,
    trustBadges: profile.trustBadges,
    galleryImageUrls: profile.galleryImageUrls,
    seoTitle: profile.seoTitle,
    seoDescription: profile.seoDescription,
    seoImageUrl: profile.seoImageUrl,
    status,
  };
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
