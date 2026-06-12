import type { ReactNode } from 'react';

type StripeProviderProps = {
  children?: ReactNode;
  publishableKey?: string;
};

const webStripeError = {
  code: 'UnsupportedPlatform',
  message: 'Stripe PaymentSheet is not available in the web export.',
};

export function StripeProvider({ children }: StripeProviderProps) {
  return <>{children}</>;
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: webStripeError }),
    presentPaymentSheet: async () => ({ error: webStripeError }),
    retrieveSetupIntent: async () => ({ error: webStripeError, setupIntent: null }),
  };
}
