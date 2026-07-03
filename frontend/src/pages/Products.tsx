import { type FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ChevronLeft, ChevronRight, Edit3, Globe2, PackagePlus, X } from 'lucide-react';
import {
  archiveProduct,
  createProduct,
  fetchProducts,
  getErrorMessage,
  updateProduct,
  type Product,
  type ProductPayload,
  type ProductStatus,
} from '../api/client';

const STATUS_OPTIONS: Array<{ value: ProductStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

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
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);

  const {
    data: productsPage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['products', { page, size }],
    queryFn: () => fetchProducts({ page, size }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: ProductPayload) => createProduct(payload),
    onSuccess: async () => {
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: ProductPayload }) => updateProduct(productId, payload),
    onSuccess: async (product) => {
      setEditingProduct(product);
      setForm(formFromProduct(product));
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => archiveProduct(productId),
    onSuccess: async (product) => {
      if (editingProduct?.id === product.id) {
        setEditingProduct(product);
        setForm(formFromProduct(product));
      }
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const products = productsPage?.content ?? [];
  const totalPages = productsPage?.totalPages ?? 0;
  const totalElements = productsPage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const activeCount = products.filter((product) => product.status === 'ACTIVE').length;
  const draftCount = products.filter((product) => product.status === 'DRAFT').length;
  const archivedCount = products.filter((product) => product.status === 'ARCHIVED').length;
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

  function startEditing(product: Product) {
    setEditingProduct(product);
    setForm(formFromProduct(product));
  }

  function resetForm() {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Catalog</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Products</h2>
          <p className="mt-1 text-sm text-gray-500">
            {totalElements} tenant-owned products. Only ACTIVE products appear on public storefront endpoints
            {isFetching && !isLoading ? ' - Refreshing' : ''}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <ProductMetric title="Active" value={activeCount} detail="Eligible for public storefronts" tone="green" />
        <ProductMetric title="Draft" value={draftCount} detail="Not ready for use yet" tone="amber" />
        <ProductMetric title="Archived" value={archivedCount} detail="Hidden from public endpoints" tone="gray" />
        <ProductMetric title="Visible on page" value={products.length} detail="Current page of product records" tone="blue" />
      </section>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase text-gray-500">
              {editingProduct ? 'Edit product' : 'Create product'}
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Public storefronts can read product slug, media, description, and pricing only when status is ACTIVE.
            </p>
          </div>
          {editingProduct && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
              aria-label="Cancel editing"
              title="Cancel editing"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={255}
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Slug</span>
            <input
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={160}
              placeholder="Generated from name"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ProductStatus }))}
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
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Price</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.priceAmount}
              onChange={(event) => setForm((current) => ({ ...current, priceAmount: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Currency</span>
            <input
              value={form.currency}
              onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={3}
              placeholder="MAD"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">SKU</span>
            <input
              value={form.sku}
              onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={100}
            />
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Image URL</span>
            <input
              value={form.imageUrl}
              onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={1000}
            />
          </label>
          <label className="lg:col-span-4">
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={2000}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <PackagePlus size={18} />
            {editingProduct ? 'Save product' : 'Create product'}
          </button>
          {editingProduct && editingProduct.status !== 'ARCHIVED' && (
            <button
              type="button"
              onClick={() => archiveMutation.mutate(editingProduct.id)}
              disabled={archiveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Archive size={18} />
              Archive product
            </button>
          )}
        </div>
      </form>

      {(error || createMutation.error || updateMutation.error || archiveMutation.error) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error ?? createMutation.error ?? updateMutation.error ?? archiveMutation.error)}
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700" htmlFor="product-page-size">
          Page size
        </label>
        <select
          id="product-page-size"
          value={size}
          onChange={(event) => {
            setSize(Number(event.target.value));
            setPage(0);
          }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[10, 20, 50, 100].map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              {pageSize}
            </option>
          ))}
        </select>
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <th className="p-4 font-medium">Product</th>
              <th className="p-4 font-medium">Price</th>
              <th className="p-4 font-medium">SKU</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Public</th>
              <th className="p-4 font-medium">Updated</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((product) => (
              <tr key={product.id} className={editingProduct?.id === product.id ? 'bg-blue-50/60' : 'hover:bg-gray-50'}>
                <td className="p-4">
                  <p className="font-medium text-gray-900">{product.name}</p>
                  <p className="mt-1 font-mono text-xs text-gray-500">{product.slug}</p>
                  {product.description && <p className="mt-2 max-w-xl text-xs text-gray-500">{product.description}</p>}
                </td>
                <td className="p-4 font-medium text-gray-900">{formatMoney(product.priceAmount, product.currency)}</td>
                <td className="p-4 text-gray-600">{product.sku ?? 'No SKU'}</td>
                <td className="p-4">
                  <StatusBadge status={product.status} />
                </td>
                <td className="p-4">
                  <PublicAvailabilityBadge status={product.status} />
                </td>
                <td className="p-4 text-gray-500">{formatDate(product.updatedAt)}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEditing(product)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                      aria-label={`Edit ${product.name}`}
                      title="Edit product"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => archiveMutation.mutate(product.id)}
                      disabled={product.status === 'ARCHIVED' || archiveMutation.isPending}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                      aria-label={`Archive ${product.name}`}
                      title={product.status === 'ARCHIVED' ? 'Already archived' : 'Archive product'}
                    >
                      <Archive size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && products.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No products found.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  Loading products...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
          {isFetching && !isLoading ? ' - Refreshing' : ''}
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

function payloadFromForm(form: ProductFormState): ProductPayload {
  return {
    name: form.name.trim(),
    slug: optionalValue(form.slug),
    description: optionalValue(form.description),
    priceAmount: Number(form.priceAmount),
    currency: optionalValue(form.currency.toUpperCase()),
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

function optionalValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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

function PublicAvailabilityBadge({ status }: { status: ProductStatus }) {
  const available = status === 'ACTIVE';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
      available ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
    }`}>
      <Globe2 size={14} />
      {available ? 'Public' : 'Hidden'}
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
