import type { ComponentProps } from 'react';
import type { SocialAccessMethod, SocialAccountStatus, SocialPlatform } from '@bdt/shared-types';
import { Icon, type RNBadgeTone } from '@/components/ui';

type IconName = ComponentProps<typeof Icon>['name'];

/** Platforms offered in the UI — no `google_business` here (per decisions). */
export const UI_PLATFORMS: SocialPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'x_twitter',
  'youtube',
  'linkedin',
  'other',
];

export const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google_business: 'Google Business',
  x_twitter: 'X / Twitter',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  other: 'Other',
};

/** Feather glyphs — closest matches (Feather has no tiktok/x mark). */
export const PLATFORM_ICON: Record<SocialPlatform, IconName> = {
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'music',
  google_business: 'map-pin',
  x_twitter: 'twitter',
  youtube: 'youtube',
  linkedin: 'linkedin',
  other: 'at-sign',
};

export const STATUS_LABEL: Record<SocialAccountStatus, string> = {
  pending: 'Pending',
  access_granted: 'Access Granted',
  active: 'Active',
  revoked: 'Revoked',
  needs_attention: 'Needs Attention',
};

/** pending → amber, access_granted/active → green, revoked/needs_attention → rose-gold. */
export const STATUS_TONE: Record<SocialAccountStatus, RNBadgeTone> = {
  pending: 'refunded',
  access_granted: 'paid',
  active: 'paid',
  revoked: 'metal',
  needs_attention: 'metal',
};

export const METHOD_LABEL: Record<SocialAccessMethod, string> = {
  delegated: 'Granted access',
  credentials: 'Login shared',
  create_for_me: 'BDT to create',
};

/** Access-method picker copy (AddAccountScreen step 2). */
export const METHOD_PICKER: Record<
  SocialAccessMethod,
  { title: string; blurb: string; recommended?: boolean }
> = {
  delegated: {
    title: 'Grant BDT Access',
    blurb:
      "We manage it through the platform's own tools — you stay in control and can revoke access anytime.",
    recommended: true,
  },
  create_for_me: {
    title: 'BDT Creates It',
    blurb: "Don't have an account yet? We'll set one up for your business.",
  },
  credentials: {
    title: 'Share Login',
    blurb:
      'Give us your username and password (encrypted, BDT-staff only). Use this only if the options above are not possible.',
  },
};

/** The address clients add BDT to as a partner/admin. BDT can update later. */
export const BDT_PARTNER_EMAIL = 'partner@bdttalentgroup.com';
export const BDT_PARTNER_HANDLE = '@BDTTalent';

/** Platform-specific delegated-access instructions. Reasonable defaults — BDT
 *  can refine the exact wording per platform later. */
export const DELEGATED_INSTRUCTIONS: Record<SocialPlatform, string> = {
  instagram: `Open Meta Business Suite → Settings → People → and add ${BDT_PARTNER_EMAIL} as an Admin (Instagram is managed through Meta).`,
  facebook: `Open Meta Business Suite → Settings → People (or Partners) → and add ${BDT_PARTNER_EMAIL} as an Admin.`,
  tiktok: `Open TikTok Business Center → Members → invite ${BDT_PARTNER_EMAIL} as an Admin.`,
  google_business: `Open your Google Business Profile → Settings → Managers → add ${BDT_PARTNER_EMAIL} as a Manager.`,
  x_twitter: `In X → Settings → Delegate → Manage members → add ${BDT_PARTNER_HANDLE} as a contributor.`,
  youtube: `Open YouTube Studio → Settings → Permissions → invite ${BDT_PARTNER_EMAIL} as a Manager.`,
  linkedin: `On your LinkedIn Page → Admin tools → Manage admins → add BDT Talent Group as a Page admin.`,
  other: `Email ${BDT_PARTNER_EMAIL} and let us know how you'd like us to access this account.`,
};
