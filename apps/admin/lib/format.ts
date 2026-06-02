/** Format a whole-dollar number as `$1,000`. Plan prices are already in
 *  whole dollars (PLANS.premium.price === 150), so no conversion needed. */
export function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

/** "May 23, 2026" style — matches the rest of the BDT surfaces. */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/** "3 days ago", "in 5 hours". Negative → past, positive → future. */
export function relative(iso: string | Date): string {
  const ms = (typeof iso === 'string' ? new Date(iso) : iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const future = ms > 0;
  const { value, unit } =
    abs < 60_000              ? { value: Math.round(abs / 1_000),       unit: 'second' as const } :
    abs < 3_600_000           ? { value: Math.round(abs / 60_000),      unit: 'minute' as const } :
    abs < 86_400_000          ? { value: Math.round(abs / 3_600_000),   unit: 'hour' as const   } :
    abs < 2_592_000_000       ? { value: Math.round(abs / 86_400_000),  unit: 'day' as const    } :
                                { value: Math.round(abs / 2_592_000_000), unit: 'month' as const };
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(future ? value : -value, unit);
}
