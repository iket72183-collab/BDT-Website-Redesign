import { describe, expect, it } from 'vitest';
import { PLANS } from '../plans.js';

/**
 * Single-plan model: there is exactly one plan, "premium", at $150/mo with
 * effectively unlimited requests.
 */
describe('PLANS', () => {
  it('exposes exactly one plan: premium', () => {
    expect(Object.keys(PLANS)).toEqual(['premium']);
  });

  it('prices the Premium plan at $150/month', () => {
    expect(PLANS.premium.price).toBe(150);
    expect(PLANS.premium.currency).toBe('usd');
    expect(PLANS.premium.interval).toBe('month');
    expect(PLANS.premium.name).toBe('Premium');
  });

  it('allows effectively unlimited requests', () => {
    expect(PLANS.premium.requestsPerMonth).toBe(999);
  });

  it('lists the full Premium feature set', () => {
    expect(PLANS.premium.features).toContain('Social media management');
    expect(PLANS.premium.features).toContain('AI-generated flyers & promo assets');
    expect(PLANS.premium.features).toContain('Monthly performance reports');
  });
});
