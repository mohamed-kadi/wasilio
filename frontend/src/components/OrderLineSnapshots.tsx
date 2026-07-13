import type { OrderLineSnapshot } from '../api/client';

interface OrderLineSnapshotsProps {
  orderLines?: OrderLineSnapshot[];
  compact?: boolean;
  className?: string;
}

export function OrderLineSnapshots({ orderLines, compact = false, className = '' }: OrderLineSnapshotsProps) {
  const lines = orderLines ?? [];

  if (lines.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className={`space-y-3 ${className}`}>
        {lines.map((line, index) => (
          <div key={`${line.productName}-${line.sku ?? 'sku'}-${index}`} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-gray-900">{line.productName}</p>
                <p className="mt-1 text-xs text-gray-500">SKU: {line.sku?.trim() || '-'}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-gray-500">Line total</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{formatAmount(line.lineTotal)}</p>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-gray-500">Unit price</dt>
                <dd className="mt-1 font-medium text-gray-900">{formatAmount(line.unitPrice)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Quantity</dt>
                <dd className="mt-1 font-medium text-gray-900">{line.quantity}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Currency</dt>
                <dd className="mt-1 font-medium text-gray-900">{line.currency}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
            <th className="py-2 pr-4 font-medium">Product</th>
            <th className="py-2 pr-4 font-medium">SKU</th>
            <th className="py-2 pr-4 font-medium">Unit price</th>
            <th className="py-2 pr-4 font-medium">Quantity</th>
            <th className="py-2 pr-4 font-medium">Line total</th>
            <th className="py-2 font-medium">Currency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lines.map((line, index) => (
            <tr key={`${line.productName}-${line.sku ?? 'sku'}-${index}`}>
              <td className="py-3 pr-4 font-medium text-gray-900">{line.productName}</td>
              <td className="py-3 pr-4 text-gray-600">{line.sku?.trim() || '-'}</td>
              <td className="py-3 pr-4 text-gray-700">{formatAmount(line.unitPrice)}</td>
              <td className="py-3 pr-4 text-gray-700">{line.quantity}</td>
              <td className="py-3 pr-4 font-semibold text-gray-900">{formatAmount(line.lineTotal)}</td>
              <td className="py-3 text-gray-700">{line.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAmount(value: number) {
  return Number(value).toFixed(2);
}
