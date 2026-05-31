import Stripe from 'stripe';
import { config } from '../config/env.js';

// Constructor needs a non-empty string. When billing isn't configured we still
// instantiate with a sentinel so imports work; callers must gate on
// `config.billingEnabled` before invoking anything that hits the network.
export const stripe = new Stripe(config.stripe.secretKey || 'sk_billing_disabled', {
  apiVersion: '2024-06-20',
  typescript: true,
});
