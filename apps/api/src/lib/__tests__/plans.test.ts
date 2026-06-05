import { describe, expect, it } from 'vitest';
import { PLANS, PLAN_LIMITS, LIMITED_REQUEST_TYPES, monthlyLimitFor } from '../plans.js';

/**
 * Single-plan model: one plan, "premium", at $100/mo. Each limited request
 * type has its own monthly cap (PLAN_LIMITS); over-limit requests are $25
 * add-ons.
 */
describe('PLANS', () => {
  it('exposes exactly one plan: premium', () => {
    expect(Object.keys(PLANS)).toEqual(['premium']);
  });

  it('prices the Premium plan at $100/month', () => {
    expect(PLANS.premium.price).toBe(100);
    expect(PLANS.premium.currency).toBe('usd');
    expect(PLANS.premium.interval).toBe('month');
    expect(PLANS.premium.name).toBe('Premium');
  });

  it('lists the per-type limits in the feature copy', () => {
    expect(PLANS.premium.features).toEqual([
      '4 AI-generated creative assets (flyers, promos, graphics, social visuals)',
      '12 social media requests (posts, captions, scheduling, engagement)',
      '4 website update requests (edits, fixes, maintenance, calendar updates)',
      '1 monthly performance report (social growth, website traffic, insights)',
      'Unlimited direct messaging to your BDT team',
      'Additional requests available at $25 each',
    ]);
  });
});

describe('PLAN_LIMITS', () => {
  it('defines the monthly per-type caps and the add-on price', () => {
    expect(PLAN_LIMITS.premium).toEqual({
      ai_creative: 4,
      social_media: 12,
      website_update: 4,
      report_request: 1,
      addon_price_cents: 2500,
    });
  });

  it('lists the four limited request types', () => {
    expect([...LIMITED_REQUEST_TYPES]).toEqual([
      'ai_creative',
      'social_media',
      'website_update',
      'report_request',
    ]);
  });
});

describe('monthlyLimitFor', () => {
  it('returns the cap for each limited type', () => {
    expect(monthlyLimitFor('premium', 'ai_creative')).toBe(4);
    expect(monthlyLimitFor('premium', 'social_media')).toBe(12);
    expect(monthlyLimitFor('premium', 'website_update')).toBe(4);
    expect(monthlyLimitFor('premium', 'report_request')).toBe(1);
  });

  it('returns null for uncapped types', () => {
    expect(monthlyLimitFor('premium', 'general')).toBeNull();
    expect(monthlyLimitFor('premium', 'file_upload')).toBeNull();
  });
});
