/** Shared display helpers for screens (re-exported from stores to avoid duplication). */
export { formatBytes, formatDuration, formatDate } from '../history';
import { QUALITY_PRESETS } from '../settings';

export function qualityLabelSafe(value: string): string {
  return QUALITY_PRESETS.find(q => q.value === value)?.label ?? `Format #${value}`;
}
