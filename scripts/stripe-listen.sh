#!/usr/bin/env bash
# stripe-listen.sh — forward Stripe webhook events to the local API during dev.
#
# Runs the Stripe CLI webhook listener and forwards every event to the local
# API's Stripe webhook endpoint (apps/api, default port 4000). Use this while
# testing billing flows so Stripe events (checkout, subscription updates,
# invoice payments) reach your local server instead of the deployed one.
#
# Prereqs:
#   - Stripe CLI installed:  brew install stripe/stripe-cli/stripe
#   - Authenticated:         stripe login
#   - The printed `whsec_...` signing secret must be set as
#     STRIPE_WEBHOOK_SECRET in apps/api/.env for signature verification.
#
# Usage:  ./scripts/stripe-listen.sh
set -euo pipefail
stripe listen --forward-to localhost:4000/api/webhooks/stripe
