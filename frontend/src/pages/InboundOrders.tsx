import { type FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Inbox, Search, X } from 'lucide-react';
import {
  fetchInboundOrder,
  fetchInboundOrders,
  getErrorMessage,
  type InboundOrderDetail,
  type InboundOrderSummary,
  type InboundOrderStatus,
  type OrderSource,
} from '../api/client';

const STOREFRONT_SOURCE: OrderSource = 'WASILIO_STOREFRONT';

const SOURCE_OPTIONS: Array<{ value: OrderSource; label: string }> = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'WASILIO_STOREFRONT', label: 'Storefront / landing-engine' },
  { value: 'CUSTOM_API', label: 'Custom API' },
  { value: 'CSV_IMPORT', label: 'CSV import' },
  { value: 'YOUCAN', label: 'YouCan' },
  { value: 'SHOPIFY', label: 'Shopify' },
  { value: 'WOOCOMMERCE', label: 'WooCommerce' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'FACEBOOK_LEAD_FORM', label: 'Facebook lead form' },
];

const STATUS_OPTIONS: Array<{ value: InboundOrderStatus; label: string }> = [
  { value: 'RECEIVED', label: 'Received' },
  { value: 'NORMALIZED', label: 'Order created' },
  { value: 'REJECTED', label: 'Needs review' },
];

export default function InboundOrders() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [source, setSource] = useState<OrderSource | ''>(() => parseSource(searchParams.get('source')));
  const [status, setStatus] = useState<InboundOrderStatus | ''>(() => parseStatus(searchParams.get('status')));
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search')?.trim() ?? '');
  const [search, setSearch] = useState(() => searchParams.get('search')?.trim() ?? '');
  const [selectedInboundOrderId, setSelectedInboundOrderId] = useState<string | null>(null);

  const {
    data: inboundOrdersPage,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['inbound-orders', { page, size, source, status, search }],
    queryFn: () => fetchInboundOrders({ page, size, source, status, search }),
  });

  const {
    data: selectedInboundOrder,
    error: detailError,
    isLoading: detailLoading,
  } = useQuery({
    queryKey: ['inbound-order', selectedInboundOrderId],
    queryFn: () => fetchInboundOrder(selectedInboundOrderId!),
    enabled: Boolean(selectedInboundOrderId),
  });

  const inboundOrders = inboundOrdersPage?.content ?? [];
  const totalPages = inboundOrdersPage?.totalPages ?? 0;
  const totalElements = inboundOrdersPage?.totalElements ?? 0;
  const canGoBack = page > 0;
  const canGoForward = totalPages > 0 && page + 1 < totalPages;
  const pageRejectedCount = inboundOrders.filter((inboundOrder) => inboundOrder.status === 'REJECTED').length;
  const pageNormalizedCount = inboundOrders.filter((inboundOrder) => inboundOrder.status === 'NORMALIZED').length;
  const pageReceivedCount = inboundOrders.filter((inboundOrder) => inboundOrder.status === 'RECEIVED').length;
  const pageStorefrontCount = inboundOrders.filter((inboundOrder) => inboundOrder.source === STOREFRONT_SOURCE).length;
  const pageStorefrontReadyCount = inboundOrders.filter(isReadyForConfirmation).length;

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setPage(0);
    setSource('');
    setStatus('');
    setSearch('');
    setSearchInput('');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Operations</p>
          <h2 className="mt-1 text-2xl font-bold text-gray-900">Inbound orders</h2>
          <p className="mt-1 text-sm text-gray-500">
            {totalElements} inbound records across storefront, API, imports, and review queues
            {isFetching && !isLoading ? ' - Refreshing' : ''}
          </p>
        </div>
        <Link
          to="/app/orders/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create manual order
          <ExternalLink size={16} />
        </Link>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <InboundMetric title="Visible records" value={inboundOrders.length} detail="Current filtered page" tone="blue" />
        <InboundMetric
          title="Storefront intake"
          value={pageStorefrontCount}
          detail={`${pageStorefrontReadyCount} ready for confirmation`}
          tone="indigo"
        />
        <InboundMetric title="Orders created" value={pageNormalizedCount} detail="Ready in Wasilio workflow" tone="green" />
        <InboundMetric title="Needs review" value={pageRejectedCount} detail="Need source or payload review" tone="red" />
        <InboundMetric title="Received" value={pageReceivedCount} detail="Not normalized yet" tone="amber" />
      </section>

      {(error || detailError) && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error ?? detailError)}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_220px_1fr_auto]">
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Source</span>
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value as OrderSource | '');
                setPage(0);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All sources</option>
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">Status</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as InboundOrderStatus | '');
                setPage(0);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <form onSubmit={applySearch}>
            <span className="mb-1 block text-xs font-medium uppercase text-gray-500">External ID or idempotency key</span>
            <div className="flex gap-2">
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search inbound records"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100"
                aria-label="Search inbound orders"
                title="Search inbound orders"
              >
                <Search size={18} />
              </button>
            </div>
          </form>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center justify-center gap-2 self-end rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <X size={16} />
            Clear
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
                <th className="p-4 font-medium">Intake record</th>
                <th className="p-4 font-medium">Source</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Wasilio order</th>
                <th className="p-4 font-medium">Received</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inboundOrders.map((inboundOrder) => {
                const handoff = getInboundHandoff(inboundOrder);

                return (
                  <tr
                    key={inboundOrder.inboundOrderId}
                    className={selectedInboundOrderId === inboundOrder.inboundOrderId ? 'bg-blue-50/60' : 'hover:bg-gray-50'}
                  >
                    <td className="p-4 align-top">
                      <p className="font-mono text-xs text-gray-500">{shortId(inboundOrder.inboundOrderId)}</p>
                      <p className="mt-1 font-medium text-gray-900">{inboundOrder.externalOrderId ?? 'No external order ID'}</p>
                      <p className="mt-1 break-all text-xs text-gray-500">Key: {inboundOrder.idempotencyKey}</p>
                    </td>
                    <td className="p-4 align-top">
                      <p className="font-medium text-gray-900">{sourceLabel(inboundOrder.source)}</p>
                      {inboundOrder.source === STOREFRONT_SOURCE && (
                        <p className="mt-1 text-xs text-gray-500">Public product order intent</p>
                      )}
                    </td>
                    <td className="p-4 align-top">
                      <StatusBadge status={inboundOrder.status} />
                      <p className={`mt-2 max-w-xs text-xs ${handoff.tone}`}>{handoff.detail}</p>
                      {inboundOrder.status === 'REJECTED' && inboundOrder.rejectionReason && (
                        <p className="mt-2 line-clamp-2 max-w-xs text-xs text-red-700">{inboundOrder.rejectionReason}</p>
                      )}
                    </td>
                    <td className="p-4 align-top">
                      {inboundOrder.normalizedOrderId ? (
                        <div className="space-y-2">
                          <Link to={`/app/orders/${inboundOrder.normalizedOrderId}`} className="block font-medium text-blue-600 hover:underline">
                            Order detail {shortId(inboundOrder.normalizedOrderId)}
                          </Link>
                          <Link
                            to="/app/confirmations"
                            state={{ createdOrderId: inboundOrder.normalizedOrderId }}
                            className="block text-sm font-medium text-emerald-700 hover:underline"
                          >
                            Open confirmation
                          </Link>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not created</span>
                      )}
                    </td>
                    <td className="p-4 align-top text-gray-500">{formatDateTime(inboundOrder.receivedAt)}</td>
                    <td className="p-4 align-top">
                      <button
                        type="button"
                        onClick={() => setSelectedInboundOrderId(inboundOrder.inboundOrderId)}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && inboundOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    No inbound orders match these filters.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Loading inbound orders...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <aside className="rounded-lg border border-gray-200 bg-white p-4">
          {!selectedInboundOrderId && (
            <div className="flex min-h-80 flex-col items-center justify-center text-center text-gray-500">
              <Inbox size={32} />
              <p className="mt-3 text-sm font-medium text-gray-900">Select an inbound record</p>
              <p className="mt-1 text-sm">Inspect rejection reasons, linked order IDs, and source payloads here.</p>
            </div>
          )}

          {selectedInboundOrderId && detailLoading && (
            <div className="p-8 text-center text-sm text-gray-500">Loading inbound order detail...</div>
          )}

          {selectedInboundOrder && <InboundOrderDetailPanel inboundOrder={selectedInboundOrder} />}
        </aside>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">
            Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
          </p>
          <select
            value={size}
            onChange={(event) => {
              setSize(Number(event.target.value));
              setPage(0);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Inbound orders page size"
          >
            {[10, 20, 50, 100].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize} per page
              </option>
            ))}
          </select>
        </div>
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

function InboundOrderDetailPanel({ inboundOrder }: { inboundOrder: InboundOrderDetail }) {
  const isStorefrontOrder = inboundOrder.source === STOREFRONT_SOURCE;
  const handoff = getInboundHandoff(inboundOrder);
  const payloadSummary = parseInboundPayload(inboundOrder.rawPayload);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Inbound detail</p>
          <h3 className="mt-1 break-all text-lg font-semibold text-gray-900">
            {inboundOrder.externalOrderId ?? shortId(inboundOrder.inboundOrderId)}
          </h3>
        </div>
        <StatusBadge status={inboundOrder.status} />
      </div>

      {inboundOrder.status === 'REJECTED' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 shrink-0" size={16} />
            <div>
              <p className="font-medium">Inbound order needs review</p>
              <p className="mt-1">{inboundOrder.rejectionReason ?? 'No rejection reason recorded.'}</p>
            </div>
          </div>
        </div>
      )}

      {isStorefrontOrder && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
          <p className="text-xs font-semibold uppercase text-indigo-700">Storefront handoff</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{handoff.label}</p>
          <p className="mt-1 text-sm text-indigo-900">{handoff.detail}</p>
        </div>
      )}

      {isStorefrontOrder && <PayloadSummaryCard summary={payloadSummary} />}

      <div className="grid grid-cols-1 gap-3 text-sm">
        <DetailRow label="Intake ID" value={inboundOrder.inboundOrderId} mono />
        <DetailRow label="Source" value={sourceLabel(inboundOrder.source)} />
        <DetailRow label="External order ID" value={inboundOrder.externalOrderId ?? '-'} />
        <DetailRow label="Idempotency key" value={inboundOrder.idempotencyKey} mono />
        <DetailRow label="Received" value={formatDateTime(inboundOrder.receivedAt)} />
        <DetailRow label="Order created at" value={inboundOrder.normalizedAt ? formatDateTime(inboundOrder.normalizedAt) : '-'} />
      </div>

      {inboundOrder.normalizedOrderId && (
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/confirmations"
            state={{ createdOrderId: inboundOrder.normalizedOrderId }}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Open confirmation
            <ExternalLink size={16} />
          </Link>
          <Link
            to={`/app/orders/${inboundOrder.normalizedOrderId}`}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open order detail
            <ExternalLink size={16} />
          </Link>
        </div>
      )}

      <details className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase text-gray-600">
          Developer payload
        </summary>
        <p className="mt-2 text-xs text-gray-500">
          Source JSON used for integration debugging and rejected-payload review.
        </p>
        <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-gray-950 p-3 text-xs leading-5 text-gray-100">
          {formatPayload(inboundOrder.rawPayload)}
        </pre>
      </details>
    </div>
  );
}

function StatusBadge({ status }: { status: InboundOrderStatus }) {
  const styles = {
    RECEIVED: 'bg-amber-100 text-amber-800',
    NORMALIZED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {statusLabel(status)}
    </span>
  );
}

function InboundMetric({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: number;
  detail: string;
  tone: 'blue' | 'green' | 'red' | 'amber' | 'indigo';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}

function PayloadSummaryCard({ summary }: { summary: InboundPayloadSummary }) {
  const attribution = [summary.landingSource, summary.medium, summary.campaign].filter(Boolean).join(' / ');
  const rows = [
    { label: 'Intent type', value: summary.intentType },
    { label: 'Customer', value: summary.customerName },
    { label: 'Phone', value: summary.customerPhone },
    { label: 'City', value: summary.city },
    { label: 'Product', value: summary.productName },
    { label: 'Product slug', value: summary.productSlug },
    { label: 'Quantity', value: summary.quantity === undefined ? undefined : String(summary.quantity) },
    { label: 'Attribution', value: attribution || undefined },
  ].filter((row) => row.value);

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase text-gray-500">Order intent summary</p>
      {rows.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 gap-2">
          {rows.map((row) => (
            <div key={row.label}>
              <p className="text-xs font-medium uppercase text-gray-500">{row.label}</p>
              <p className="break-words text-sm font-medium text-gray-900">{row.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-500">No customer or product fields could be extracted from this payload.</p>
      )}
      {summary.landingPageUrl && (
        <a
          href={summary.landingPageUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
        >
          Open landing page
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className={`mt-1 break-all text-gray-900 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</p>
    </div>
  );
}

function isReadyForConfirmation(inboundOrder: InboundOrderSummary) {
  return inboundOrder.source === STOREFRONT_SOURCE && inboundOrder.status === 'NORMALIZED' && Boolean(inboundOrder.normalizedOrderId);
}

function getInboundHandoff(inboundOrder: InboundOrderSummary) {
  if (inboundOrder.status === 'REJECTED') {
    return {
      label: 'Needs payload review',
      detail: 'No Wasilio order was created from this intake record.',
      tone: 'text-red-700',
    };
  }

  if (inboundOrder.normalizedOrderId) {
    return {
      label: 'Ready for confirmation',
      detail: 'A Wasilio order exists and can continue in the confirmation queue.',
      tone: 'text-emerald-700',
    };
  }

  return {
    label: 'Waiting for order creation',
    detail: 'The intake record was received, but no Wasilio order ID is linked yet.',
    tone: 'text-amber-700',
  };
}

function sourceLabel(source: OrderSource) {
  return SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? source;
}

function statusLabel(status: InboundOrderStatus) {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function parseSource(value: string | null): OrderSource | '' {
  return SOURCE_OPTIONS.some((option) => option.value === value) ? value as OrderSource : '';
}

function parseStatus(value: string | null): InboundOrderStatus | '' {
  return STATUS_OPTIONS.some((option) => option.value === value) ? value as InboundOrderStatus : '';
}

function shortId(id: string) {
  return `${id.slice(0, 8)}...`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatPayload(payload: unknown) {
  if (typeof payload !== 'string') {
    return JSON.stringify(payload, null, 2);
  }

  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

interface InboundPayloadSummary {
  intentType?: string;
  customerName?: string;
  customerPhone?: string;
  city?: string;
  productName?: string;
  productSlug?: string;
  quantity?: number;
  landingSource?: string;
  medium?: string;
  campaign?: string;
  landingPageUrl?: string;
}

type JsonRecord = Record<string, unknown>;

function parseInboundPayload(rawPayload: string): InboundPayloadSummary {
  const root = parseJsonRecord(rawPayload);

  if (!root) {
    return {};
  }

  const payload = readRecord(root.payload) ?? root;
  const customer = readRecord(payload.customer);
  const delivery = readRecord(payload.delivery);
  const selection = readRecord(payload.selection);
  const selectedProduct = readRecord(selection?.product);
  const payloadProduct = readRecord(payload.product);
  const product = selectedProduct ?? payloadProduct;
  const attribution = readRecord(payload.attribution);
  const serverProductSnapshot = readRecord(root.serverProductSnapshot);

  return {
    intentType: readString(root.type) ?? readString(payload.type),
    customerName: readString(customer?.name) ?? readString(payload.customerName),
    customerPhone: readString(customer?.phone) ?? readString(payload.customerPhone) ?? readString(payload.phone),
    city: readString(delivery?.city) ?? readString(payload.city),
    productName:
      readString(serverProductSnapshot?.productName) ??
      readString(product?.productName) ??
      readString(product?.name),
    productSlug: readString(product?.productSlug) ?? readString(payload.productSlug),
    quantity: readNumber(selection?.quantity) ?? readNumber(payload.quantity),
    landingSource: readString(attribution?.source),
    medium: readString(attribution?.medium),
    campaign: readString(attribution?.campaign),
    landingPageUrl: readString(attribution?.landingPageUrl),
  };
}

function parseJsonRecord(value: string): JsonRecord | null {
  try {
    return readRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function readRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}
