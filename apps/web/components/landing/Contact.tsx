'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

const formspreeEndpoint = 'https://formspree.io/f/mojykkbw';

const textareaClassName =
  'mt-2 block min-h-32 w-full resize-y rounded-lg border border-metal-border/40 ' +
  'bg-bg-inset px-4 py-3 font-body text-body-md text-ink-primary ' +
  'placeholder:text-ink-subtle transition-[box-shadow,border-color] duration-200 ' +
  'focus:outline-none focus:border-metal-rose/70 focus:shadow-glow';

type SubmitStatus = {
  message: string;
  tone: 'success' | 'error';
};

export function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<SubmitStatus | null>(null);

  useEffect(() => {
    if (!status) return;

    const timer = window.setTimeout(
      () => setStatus(null),
      status.tone === 'error' ? 5000 : 3500,
    );

    return () => window.clearTimeout(timer);
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        form.reset();
        setStatus({ message: "Message sent - we'll be in touch.", tone: 'success' });
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        errors?: Array<{ message?: string }>;
      };
      const message = data.errors
        ?.map((error) => error.message)
        .filter((error): error is string => Boolean(error))
        .join(', ');

      setStatus({
        message: message || 'Something went wrong. Please try again.',
        tone: 'error',
      });
    } catch {
      setStatus({
        message: 'Network error - please check your connection.',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      id="connect-contact"
      className="relative mx-auto w-full max-w-7xl px-5 py-14 sm:px-10 sm:py-32"
    >
      <Card framed className="grid gap-8 sm:p-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
        <div>
          <div className="font-body text-caption uppercase tracking-label text-metal-rose">
            Get started
          </div>
          <h2 className="mt-4 font-display text-[1.9rem] leading-[1.1] text-ink-primary sm:text-display-xl">
            Tell us about your business.
          </h2>
          <p className="mt-4 max-w-xl font-body text-body-sm leading-relaxed text-ink-muted sm:mt-5 sm:text-body-lg">
            Send us a quick note and the BDT Talent Group team will follow up about
            Premium service and onboarding.
          </p>

          <div className="mt-7 rounded-xl border border-metal-border/30 bg-bg-inset/70 p-4 sm:p-5">
            <div className="font-body text-caption uppercase tracking-label text-metal-rose">
              BDT Connect app
            </div>
            <p className="mt-2 font-body text-body-sm leading-relaxed text-ink-muted sm:text-body-md">
              Coming soon to the Apple App Store and Google Play Store.
            </p>
          </div>
        </div>

        <form
          action={formspreeEndpoint}
          method="POST"
          className="grid gap-4"
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="_subject" value="BDT Connect Premium inquiry" />
          <input type="hidden" name="inquiryType" value="bdt-connect-premium" />
          <label className="hidden">
            Company Name
            <input type="text" name="_gotcha" tabIndex={-1} autoComplete="off" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              name="fullName"
              type="text"
              autoComplete="name"
              placeholder="Your full name"
              required
            />
            <Input
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              required
            />
          </div>

          <Input
            label="Business name"
            name="businessName"
            type="text"
            autoComplete="organization"
            placeholder="Your business name"
            required
          />

          <Input
            label="Website or social link"
            name="website"
            type="url"
            autoComplete="url"
            placeholder="https://"
          />

          <label className="block w-full" htmlFor="connect-message">
            <span className="font-body text-caption uppercase tracking-label text-ink-muted">
              How can we help?
            </span>
            <textarea
              id="connect-message"
              name="message"
              rows={5}
              placeholder="Tell us what you want BDT Connect to handle."
              className={textareaClassName}
              required
            />
          </label>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="mt-2 w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Inquiry'}
          </Button>
        </form>
      </Card>

      {status && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={[
            'fixed inset-x-5 bottom-7 z-[90] mx-auto w-fit max-w-[calc(100vw-2.5rem)]',
            'rounded-full border px-5 py-3 text-center font-body text-caption font-bold',
            'uppercase tracking-label backdrop-blur-md shadow-card animate-fade-up',
            status.tone === 'error'
              ? 'border-[color:var(--bdt-status-danger)]/60 bg-bg-surface/95 text-[color:var(--bdt-status-danger)]'
              : 'border-metal-border/55 bg-bg-surface/95 text-metal-rose shadow-glow',
          ].join(' ')}
        >
          {status.message}
        </div>
      )}
    </section>
  );
}
