import type { ComponentProps } from 'react';
import type { RequestStatus, RequestType } from '@bdt/shared-types';
import { Icon, type RNBadgeTone } from '@/components/ui';

type IconName = ComponentProps<typeof Icon>['name'];

/** Feather glyphs (the app's icon set is Feather, not Lucide). */
export const TYPE_ICON: Record<RequestType, IconName> = {
  website_update: 'globe',
  social_media: 'share-2',
  general: 'file-text',
  file_upload: 'paperclip',
};

export const TYPE_LABEL: Record<RequestType, string> = {
  website_update: 'Website Update',
  social_media: 'Social Media',
  general: 'General Request',
  file_upload: 'File Upload',
};

export const TYPE_BLURB: Record<RequestType, string> = {
  website_update: 'Update text, images, or info on your site',
  social_media: 'New post, caption, or content request',
  general: 'Anything else you need from BDT',
  file_upload: 'Send logos, photos, or documents',
};

/**
 * Status → RNBadge tone. The brand palette has no blue, so `in_progress`
 * uses the rose-gold `confirmed` tone rather than the spec's literal blue.
 */
export const STATUS_TONE: Record<RequestStatus, RNBadgeTone> = {
  pending: 'refunded', // amber
  in_progress: 'confirmed', // rose-gold (no blue token exists)
  completed: 'paid', // green
  cancelled: 'muted', // gray
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** "2 days ago" style relative time. No dayjs in the app — keep it tiny. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "May 29, 2026 at 3:42 PM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
}

/** "Resets June 1" from an ISO date. */
export function formatResetDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}
