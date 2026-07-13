import type { OrderLineSnapshot } from '../api/client';

export function hasOrderLines(orderLines?: OrderLineSnapshot[]) {
  return Boolean(orderLines?.length);
}

export function orderLineSummary(orderLines?: OrderLineSnapshot[]) {
  if (!hasOrderLines(orderLines)) {
    return undefined;
  }

  const lines = orderLines ?? [];
  const firstProductName = lines[0]?.productName || 'Product';
  const totalQuantity = lines.reduce((total, line) => total + line.quantity, 0);
  const itemCount = totalQuantity > 0 ? totalQuantity : lines.length;
  return `${firstProductName} (${itemCount} ${itemCount === 1 ? 'item' : 'items'})`;
}
