import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/landing/SiteNav';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service — BDT Connect',
  description:
    'The agreement between BDT Talent Group and clients who subscribe to BDT Connect.',
  alternates: {
    canonical: '/terms/',
  },
};

const SECTION = 'mt-10 first:mt-0';
const H2 = 'font-display text-display-md text-ink-primary';
const P = 'mt-4 font-body text-body-md text-ink-muted leading-relaxed';
const UL = 'mt-3 ml-5 list-disc space-y-2 font-body text-body-md text-ink-muted';

export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-28 sm:px-10 sm:pt-32">
        <div className="font-body text-caption uppercase tracking-label text-metal-rose">
          Legal
        </div>
        <h1 className="mt-3 font-display text-display-xl text-ink-primary">Terms of Service</h1>
        <p className="mt-3 font-body text-caption uppercase tracking-label text-ink-subtle">
          Effective May 27, 2026
        </p>

        <section className={SECTION}>
          <p className={P}>
            These terms govern your subscription to BDT Connect, the agency-on-retainer service
            from BDT Talent Group (&quot;BDT,&quot; &quot;we,&quot; &quot;us&quot;). By creating an
            account you agree to them.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>1. What you get</h2>
          <p className={P}>
            Depending on your plan, BDT delivers a combination of website design, ongoing website
            maintenance, social media management, monthly performance reporting, and direct
            messaging with our team — all accessible from the BDT Connect mobile app. Current plans
            and what they include are listed at{' '}
            <Link href="/#plans" className="text-metal-rose">
              bdttalentgroup.com/connect
            </Link>
            .
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>2. Subscription, trial, and billing</h2>
          <ul className={UL}>
            <li>Each new account gets a 14-day free trial. No payment is taken during the trial.</li>
            <li>
              After the trial, the monthly subscription fee for your plan is billed automatically
              to the payment method on file via Stripe.
            </li>
            <li>
              You can cancel at any time from the in-app billing portal. Cancellation takes effect
              at the end of the current billing period; we do not pro-rate.
            </li>
            <li>
              Prices may change. We will give at least 30 days&apos; notice before any increase
              applies to your account.
            </li>
            <li>Past-due accounts may be suspended after a reasonable cure period.</li>
          </ul>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>3. Your responsibilities</h2>
          <ul className={UL}>
            <li>Provide accurate account and business information and keep it current.</li>
            <li>
              Provide the content, brand assets, and access we reasonably need to deliver the work
              (e.g., domain access, social account credentials).
            </li>
            <li>
              Don&apos;t use BDT Connect to send spam, harass, infringe others&apos; rights, or do
              anything illegal.
            </li>
            <li>Keep your login credentials private; you&apos;re responsible for activity on your account.</li>
          </ul>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>4. Intellectual property</h2>
          <p className={P}>
            You retain ownership of your business name, logos, brand assets, written content, and
            anything else you provide. Final website deliverables produced for you under your
            subscription are licensed to you to use indefinitely, even if you cancel; underlying
            tooling, templates, and BDT processes remain ours. Social media accounts and the
            content posted on them are yours.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>5. Termination</h2>
          <p className={P}>
            You may cancel anytime. We may suspend or terminate accounts that materially breach
            these terms, are past due, or pose a legal or security risk. On termination we will
            stop active work, hand over access to your accounts, and delete data per our{' '}
            <Link href="/privacy" className="text-metal-rose">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>6. Warranties and limits</h2>
          <p className={P}>
            BDT Connect is provided &quot;as is.&quot; We do not warrant that the service will be
            uninterrupted or error-free. To the maximum extent allowed by law, our total liability
            arising from these terms in any 12-month period is limited to the fees you paid us in
            that period. We are not liable for indirect, incidental, or consequential damages.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>7. Changes</h2>
          <p className={P}>
            We may update these terms. Material changes will be announced in the app. Continued use
            after a change means you accept the updated terms.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>8. Contact</h2>
          <p className={P}>
            Email{' '}
            <a className="text-metal-rose" href="mailto:BDTTalentGroup@yahoo.com">
              BDTTalentGroup@yahoo.com
            </a>{' '}
            with questions about these terms.
          </p>
        </section>

        <div className="mt-16 border-t border-metal-border/15 pt-8">
          <Link href="/" className="font-body text-body-sm text-metal-rose">
            ← Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
