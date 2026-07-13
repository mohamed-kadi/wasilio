import { type FormEvent, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Globe2,
  ImageIcon,
  Package,
  PackagePlus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  archiveProduct,
  createProduct,
  fetchProductStorefrontProfile,
  fetchProducts,
  fetchStorefrontSettings,
  getErrorMessage,
  updateProduct,
  uploadProductMedia,
  type Product,
  type ProductPayload,
  type ProductStatus,
  type StorefrontProductProfile,
} from '../api/client';
import { landingEngineProductUrl } from '../lib/storefrontUrls';

const STATUS_OPTIONS: Array<{ value: ProductStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

type ProductStatusFilter = ProductStatus | '';

interface ProductFormState {
  name: string;
  slug: string;
  description: string;
  priceAmount: string;
  currency: string;
  sku: string;
  imageUrl: string;
  status: ProductStatus;
}

interface ProductReadiness {
  catalogReady: boolean;
  storefrontReady: boolean;
  published: boolean;
}

const EMPTY_FORM: ProductFormState = {
  name: '',
  slug: '',
  description: '',
  priceAmount: '',
  currency: 'MAD',
  sku: '',
  imageUrl: '',
  status: 'DRAFT',
};

export default function Products() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [currencyOverrideEnabled, setCurrencyOverrideEnabled] = useState(false);

  const {
    data: productsPage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['products', { page, size, status: statusFilter || undefined }],
    queryFn: () => fetchProducts({ page, size, status: statusFilter || undefined }),
  });

  const { data: summaryProductsPage } = useQuery({
    queryKey: ['products-summary-page'],
    queryFn: () => fetchProducts({ page: 0, size: 100 }),
  });

  const { data: storefrontSettings } = useQuery({
    queryKey: ['storefront-settings'],
    queryFn: fetchStorefrontSettings,
  });

  const products = productsPage?.content ?? [];
  const summaryProducts = summaryProductsPage?.content ?? products;
  const profileQueries = useQueries({
    queries: products.map((product) => ({
      queryKey: ['product-storefront-profile', product.id],
      queryFn: () => fetchProductStorefrontProfile(product.id),
    })),
  });
  const profilesByProductId = new Map<string, StorefrontProductProfile | null>();
  products.forEach((product, index) => {
    profilesByProductId.set(
      product.id,
      (profileQueries[index]?.data as StorefrontProductProfile | null | undefined) ?? null,
    );
  });

  const filteredProducts = products.filter((product) => productMatchesSearch(product, searchTerm));
  const totalPages = productsPage?.totalPages ?? 0;
  const totalElements = productsPage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const activeCount = summaryProducts.filter((product) => product.status === 'ACTIVE').length;
  const draftCount = summaryProducts.filter((product) => product.status === 'DRAFT').length;
  const archivedCount = summaryProducts.filter((product) => product.status === 'ARCHIVED').length;
  const storefrontReadyCount = products.filter((product) => (
    evaluateProductReadiness(product, profilesByProductId.get(product.id) ?? null).storefrontReady
  )).length;
  const defaultCurrency = storefrontSettings?.defaultCurrency ?? 'MAD';

  const createMutation = useMutation({
    mutationFn: (payload: ProductPayload) => createProduct(payload),
    onSuccess: async () => {
      closeEditor();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: ProductPayload }) => updateProduct(productId, payload),
    onSuccess: async () => {
      closeEditor();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => archiveProduct(productId),
    onSuccess: async (product) => {
      if (editingProduct?.id === product.id) {
        closeEditor();
      }
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
  const mediaUploadMutation = useMutation({
    mutationFn: ({ productId, file }: { productId: string; file: File }) => uploadProductMedia(productId, file),
    onSuccess: async (media) => {
      setForm((current) => ({ ...current, imageUrl: media.publicUrl }));
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = payloadFromForm(form);
    if (editingProduct) {
      updateMutation.mutate({ productId: editingProduct.id, payload });
      return;
    }
    createMutation.mutate(payload);
  }

  function openNewProduct() {
    mediaUploadMutation.reset();
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM, currency: defaultCurrency });
    setSlugManuallyEdited(false);
    setCurrencyOverrideEnabled(false);
    setEditorOpen(true);
  }

  function openEditProduct(product: Product) {
    mediaUploadMutation.reset();
    setEditingProduct(product);
    setForm(formFromProduct(product));
    setSlugManuallyEdited(true);
    setCurrencyOverrideEnabled(Boolean(storefrontSettings?.defaultCurrency && product.currency !== storefrontSettings.defaultCurrency));
    setEditorOpen(true);
  }

  function closeEditor() {
    mediaUploadMutation.reset();
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM, currency: defaultCurrency });
    setSlugManuallyEdited(false);
    setCurrencyOverrideEnabled(false);
    setEditorOpen(false);
  }

  function updateName(name: string) {
    setForm((current) => ({
      ...current,
      name,
      slug: slugManuallyEdited ? current.slug : slugPreview(name),
    }));
  }

  function updateSlug(slug: string) {
    setSlugManuallyEdited(true);
    setForm((current) => ({ ...current, slug }));
  }

  function toggleCurrencyOverride(enabled: boolean) {
    setCurrencyOverrideEnabled(enabled);
    if (!enabled) {
      setForm((current) => ({ ...current, currency: defaultCurrency }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Catalog</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Products</h2>
          <p className="mt-1 text-sm text-gray-500">
            Browse, search, edit, and publish tenant-owned products.
            {isFetching && !isLoading ? ' Refreshing catalog.' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={openNewProduct}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PackagePlus size={18} />
          New Product
        </button>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <ProductMetric title="Active" value={activeCount} detail="Catalog products available for selling" tone="green" />
        <ProductMetric title="Draft" value={draftCount} detail="Products still being prepared" tone="amber" />
        <ProductMetric title="Archived" value={archivedCount} detail="Hidden from selling workflows" tone="gray" />
        <ProductMetric title="Storefront Ready" value={storefrontReadyCount} detail="Current page with catalog and landing content ready" tone="blue" />
      </section>

      {(error || createMutation.error || updateMutation.error || archiveMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error ?? createMutation.error ?? updateMutation.error ?? archiveMutation.error)}
        </div>
      )}

      <section className="space-y-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1">
            <span className="mb-1 block text-sm font-medium text-gray-700">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, slug, or SKU"
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </span>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Status Filter</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as ProductStatusFilter);
                setPage(0);
              }}
              className="min-w-44 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-gray-700">Page size</span>
            <select
              value={size}
              onChange={(event) => {
                setSize(Number(event.target.value));
                setPage(0);
              }}
              className="min-w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[10, 20, 50, 100].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredProducts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                  <th className="p-4 font-medium">Product</th>
                  <th className="p-4 font-medium">Price</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Readiness</th>
                  <th className="p-4 font-medium">Storefront Profile</th>
                  <th className="p-4 font-medium">Updated</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => {
                  const profileQuery = profileQueries[products.indexOf(product)];
                  return (
                    <ProductRow
                      key={product.id}
                      product={product}
                      profile={(profileQuery?.data as StorefrontProductProfile | null | undefined) ?? null}
                      profileLoading={Boolean(profileQuery?.isLoading)}
                      profileError={profileQuery?.error}
                      storefrontConfigured={Boolean(storefrontSettings?.storeSlug)}
                      onEdit={() => openEditProduct(product)}
                      onArchive={() => archiveMutation.mutate(product.id)}
                      archivePending={archiveMutation.isPending}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filteredProducts.length === 0 && (
          <EmptyProductsState
            hasProducts={products.length > 0}
            onNewProduct={openNewProduct}
          />
        )}

        {isLoading && (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            Loading products...
          </div>
        )}
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
          {totalElements > 0 ? ` - ${totalElements} products` : ''}
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

      {editorOpen && (
        <ProductEditorPanel
          editingProduct={editingProduct}
          form={form}
          defaultCurrency={defaultCurrency}
          hasStorefrontCurrency={Boolean(storefrontSettings?.defaultCurrency)}
          currencyOverrideEnabled={currencyOverrideEnabled}
          isSubmitting={isSubmitting}
          archivePending={archiveMutation.isPending}
          imageUploadPending={mediaUploadMutation.isPending}
          imageUploadError={mediaUploadMutation.error}
          onClose={closeEditor}
          onSubmit={handleSubmit}
          onNameChange={updateName}
          onSlugChange={updateSlug}
          onFormChange={setForm}
          onCurrencyOverrideChange={toggleCurrencyOverride}
          onArchive={() => editingProduct && archiveMutation.mutate(editingProduct.id)}
          onImageUpload={(file) => editingProduct && mediaUploadMutation.mutate({ productId: editingProduct.id, file })}
        />
      )}
    </div>
  );
}

function ProductRow({
  product,
  profile,
  profileLoading,
  profileError,
  storefrontConfigured,
  onEdit,
  onArchive,
  archivePending,
}: {
  product: Product;
  profile: StorefrontProductProfile | null;
  profileLoading: boolean;
  profileError: unknown;
  storefrontConfigured: boolean;
  onEdit: () => void;
  onArchive: () => void;
  archivePending: boolean;
}) {
  const readiness = evaluateProductReadiness(product, profile);
  const previewUrl = storefrontConfigured ? landingEngineProductUrl(product.slug) : null;

  return (
    <tr className="hover:bg-gray-50">
      <td className="p-4 align-top">
        <div className="flex items-start gap-3">
          <ProductImage product={product} />
          <div>
            <p className="font-medium text-gray-900">{product.name}</p>
            <p className="mt-1 font-mono text-xs text-gray-500">{product.slug}</p>
            <p className="mt-1 text-xs text-gray-500">SKU: {product.sku ?? 'Auto-generated on save'}</p>
          </div>
        </div>
      </td>
      <td className="p-4 align-top font-medium text-gray-900">{formatMoney(product.priceAmount, product.currency)}</td>
      <td className="p-4 align-top">
        <StatusBadge status={product.status} />
      </td>
      <td className="p-4 align-top">
        <div className="flex flex-wrap gap-2">
          <ReadinessPill label="Catalog" ready={readiness.catalogReady} />
          <ReadinessPill label="Storefront" ready={readiness.storefrontReady} />
          <ReadinessPill label="Published" ready={readiness.published} />
        </div>
      </td>
      <td className="p-4 align-top">
        {profileLoading ? (
          <span className="text-xs font-medium text-gray-500">Loading</span>
        ) : profileError ? (
          <span className="text-xs font-medium text-red-700">Profile unavailable</span>
        ) : (
          <ProfileStatusBadge profile={profile} />
        )}
      </td>
      <td className="p-4 align-top text-gray-500">{formatDate(product.updatedAt)}</td>
      <td className="p-4 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Edit3 size={16} />
            Edit Product
          </button>
          <Link
            to={`/app/storefront/publishing?productId=${product.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <Globe2 size={16} />
            Edit Storefront Page
          </Link>
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink size={16} />
              Preview
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-400"
              title="Configure storefront settings before previewing public pages"
            >
              <ExternalLink size={16} />
              Preview
            </button>
          )}
          <button
            type="button"
            onClick={onArchive}
            disabled={product.status === 'ARCHIVED' || archivePending}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Archive size={16} />
            Archive
          </button>
        </div>
      </td>
    </tr>
  );
}

function ProductEditorPanel({
  editingProduct,
  form,
  defaultCurrency,
  hasStorefrontCurrency,
  currencyOverrideEnabled,
  isSubmitting,
  archivePending,
  imageUploadPending,
  imageUploadError,
  onClose,
  onSubmit,
  onNameChange,
  onSlugChange,
  onFormChange,
  onCurrencyOverrideChange,
  onArchive,
  onImageUpload,
}: {
  editingProduct: Product | null;
  form: ProductFormState;
  defaultCurrency: string;
  hasStorefrontCurrency: boolean;
  currencyOverrideEnabled: boolean;
  isSubmitting: boolean;
  archivePending: boolean;
  imageUploadPending: boolean;
  imageUploadError: unknown;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNameChange: (name: string) => void;
  onSlugChange: (slug: string) => void;
  onFormChange: (nextForm: ProductFormState | ((current: ProductFormState) => ProductFormState)) => void;
  onCurrencyOverrideChange: (enabled: boolean) => void;
  onArchive: () => void;
  onImageUpload: (file: File) => void;
}) {
  const currencyLocked = hasStorefrontCurrency && !currencyOverrideEnabled;
  const canUploadImage = Boolean(editingProduct);

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-gray-900/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Catalog product</p>
            <h3 className="mt-1 text-xl font-bold text-gray-900">
              {editingProduct ? 'Edit Product' : 'New Product'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Catalog fields identify the product. Marketing copy belongs in Storefront Publishing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
            aria-label="Close product editor"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {Boolean(imageUploadError) && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {getErrorMessage(imageUploadError)}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-gray-700">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => onNameChange(event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={255}
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium text-gray-700">Slug</span>
                <input
                  value={form.slug}
                  onChange={(event) => onSlugChange(event.target.value)}
                  onBlur={() => onFormChange((current) => ({ ...current, slug: slugPreview(current.slug) }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={160}
                  placeholder="portable-neck-fan"
                  required
                />
                <span className="mt-1 block text-xs text-gray-500">Auto-generated from product name. You may edit it.</span>
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium text-gray-700">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => onFormChange((current) => ({ ...current, status: event.target.value as ProductStatus }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium text-gray-700">Price</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.priceAmount}
                  onChange={(event) => onFormChange((current) => ({ ...current, priceAmount: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </label>
              <div>
                <label>
                  <span className="mb-1 block text-sm font-medium text-gray-700">Currency</span>
                  <input
                    value={form.currency}
                    onChange={(event) => onFormChange((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase disabled:bg-gray-50 disabled:text-gray-500"
                    maxLength={3}
                    minLength={3}
                    placeholder={defaultCurrency}
                    disabled={currencyLocked}
                    required
                  />
                </label>
                {hasStorefrontCurrency && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-500">
                      {defaultCurrency} inherited from Storefront Settings.
                    </p>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={currencyOverrideEnabled}
                        onChange={(event) => onCurrencyOverrideChange(event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      Override currency for this product
                    </label>
                  </div>
                )}
              </div>
              <label>
                <span className="mb-1 block text-sm font-medium text-gray-700">SKU (optional)</span>
                <input
                  value={form.sku}
                  onChange={(event) => onFormChange((current) => ({ ...current, sku: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={100}
                />
                <span className="mt-1 block text-xs text-gray-500">Leave empty to generate automatically.</span>
              </label>
              <div className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-gray-700">Primary Product Image</span>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[96px_1fr]">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                    {form.imageUrl ? (
                      <img
                        src={form.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="block h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon size={24} className="text-gray-400" />
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <label
                        className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                          canUploadImage && !imageUploadPending
                            ? 'cursor-pointer border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                        }`}
                      >
                        <Upload size={16} />
                        {imageUploadPending ? 'Uploading' : 'Upload image'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="sr-only"
                          disabled={!canUploadImage || imageUploadPending}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (file) {
                              onImageUpload(file);
                            }
                          }}
                        />
                      </label>
                      {!canUploadImage && (
                        <span className="self-center text-xs text-gray-500">Save the product before uploading media.</span>
                      )}
                    </div>
                    <input
                      value={form.imageUrl}
                      onChange={(event) => onFormChange((current) => ({ ...current, imageUrl: event.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      maxLength={1000}
                      placeholder="Image URL"
                    />
                    <span className="block text-xs text-gray-500">JPEG, PNG, or WebP up to 5 MB.</span>
                  </div>
                </div>
              </div>
              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => onFormChange((current) => ({ ...current, description: event.target.value }))}
                  className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={2000}
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Short catalog description. Used for product identification and SEO fallback. Marketing copy belongs in Storefront Publishing.
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
            <div>
              {editingProduct && editingProduct.status !== 'ARCHIVED' && (
                <button
                  type="button"
                  onClick={onArchive}
                  disabled={archivePending}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Archive size={18} />
                  Archive
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <PackagePlus size={18} />
                {isSubmitting ? 'Saving' : editingProduct ? 'Save Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </form>
      </aside>
    </div>
  );
}

function ProductImage({ product }: { product: Product }) {
  const frameClassName = 'flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-gray-50';

  if (product.imageUrl) {
    return (
      <span className={`${frameClassName} border-gray-200`} data-testid="product-thumbnail">
        <img
          src={product.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <div className={`${frameClassName} border-dashed border-gray-300 text-gray-400`} data-testid="product-thumbnail">
      <ImageIcon size={22} />
    </div>
  );
}

function EmptyProductsState({ hasProducts, onNewProduct }: { hasProducts: boolean; onNewProduct: () => void }) {
  return (
    <div className="px-4 py-14 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-700">
        <Package size={28} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-gray-900">
        {hasProducts ? 'No products match this view' : 'No products yet'}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
        {hasProducts
          ? 'Adjust search or status filters to find catalog items.'
          : 'Create the first catalog product, then publish its storefront page when landing content is ready.'}
      </p>
      {!hasProducts && (
        <button
          type="button"
          onClick={onNewProduct}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <PackagePlus size={18} />
          New Product
        </button>
      )}
    </div>
  );
}

function payloadFromForm(form: ProductFormState): ProductPayload {
  return {
    name: form.name.trim(),
    slug: slugPreview(form.slug || form.name),
    description: optionalValue(form.description),
    priceAmount: Number(form.priceAmount),
    currency: form.currency.trim().toUpperCase(),
    sku: optionalValue(form.sku),
    imageUrl: optionalValue(form.imageUrl),
    status: form.status,
  };
}

function formFromProduct(product: Product): ProductFormState {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? '',
    priceAmount: String(product.priceAmount),
    currency: product.currency,
    sku: product.sku ?? '',
    imageUrl: product.imageUrl ?? '',
    status: product.status,
  };
}

function evaluateProductReadiness(product: Product, profile: StorefrontProductProfile | null): ProductReadiness {
  const catalogReady = product.status === 'ACTIVE' && hasText(product.description) && hasText(product.imageUrl);
  const storefrontReady = catalogReady
    && Boolean(profile)
    && hasText(profile?.headline)
    && Boolean(profile?.benefits.length)
    && Boolean(profile?.features.length);
  const published = storefrontReady && profile?.status === 'PUBLISHED';

  return {
    catalogReady,
    storefrontReady,
    published,
  };
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function productMatchesSearch(product: Product, searchTerm: string): boolean {
  const query = searchTerm.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return [
    product.name,
    product.slug,
    product.sku ?? '',
  ].some((value) => value.toLowerCase().includes(query));
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

function ProductMetric({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  tone: 'green' | 'amber' | 'gray' | 'blue';
}) {
  const tones = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    gray: 'border-gray-200 bg-gray-50 text-gray-600',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ProductStatus }) {
  const classes = {
    DRAFT: 'bg-amber-100 text-amber-800',
    ACTIVE: 'bg-green-100 text-green-800',
    ARCHIVED: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

function ProfileStatusBadge({ profile }: { profile: StorefrontProductProfile | null }) {
  if (!profile) {
    return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">No profile</span>;
  }

  const published = profile.status === 'PUBLISHED';
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
      published ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
    }`}>
      {published ? 'Published' : 'Draft profile'}
    </span>
  );
}

function ReadinessPill({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
      ready ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
    }`}>
      {label} {ready ? '✓' : '-'}
    </span>
  );
}

function statusLabel(status: ProductStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
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

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}
