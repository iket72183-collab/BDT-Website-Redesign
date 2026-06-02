import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/landing/SiteNav';
import { Footer } from '@/components/landing/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — BDT Connect',
  description:
    'How BDT Talent Group collects, uses, and protects information through BDT Connect and our agency services.',
  alternates: {
    canonical: '/privacy/',
  },
};

const SECTION = 'mt-10 first:mt-0';
const H2 = 'font-display text-display-md text-ink-primary';
const H3 = 'mt-6 font-display text-2xl text-ink-primary';
const P = 'mt-4 font-body text-body-md text-ink-muted leading-relaxed';
const UL = 'mt-3 ml-5 list-disc space-y-2 font-body text-body-md text-ink-muted';

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-28 sm:px-10 sm:pt-32">
        <div className="font-body text-caption uppercase tracking-label text-metal-rose">
          Legal
        </div>
        <h1 className="mt-3 font-display text-display-xl text-ink-primary">Privacy Policy</h1>
        <p className="mt-3 font-body text-caption uppercase tracking-label text-ink-subtle">
          Effective May 27, 2026
        </p>

        <section className={SECTION}>
          <p className={P}>
            This policy explains what information BDT Talent Group (&quot;BDT,&quot; &quot;we,&quot;
            &quot;us&quot;) collects through the BDT Connect mobile app, the BDT Connect website
            (this site), and the agency services we deliver — and how we use, share, and protect it.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>What we collect</h2>
          <h3 className={H3}>Account information</h3>
          <p className={P}>
            When you create an account we collect your name, email address, business name, and a
            URL slug. You may add a phone number, website, and social media URLs.
          </p>

          <h3 className={H3}>Messages and support</h3>
          <p className={P}>
            We collect the content of messages you send to us through the app so we can respond and
            keep a service history. Messages are stored on our servers and forwarded to our team by
            email.
          </p>

          <h3 className={H3}>Billing</h3>
          <p className={P}>
            Payment card details are collected and stored by Stripe, not by us. We retain only the
            Stripe customer and subscription identifiers, your current plan, and billing status.
          </p>

          <h3 className={H3}>Device and usage</h3>
          <p className={P}>
            With your permission we register a push-notification token so we can deliver replies
            and account alerts. We log standard request metadata (IP, user-agent, timestamp) for
            security, debugging, and abuse prevention.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>How we use it</h2>
          <ul className={UL}>
            <li>To deliver the services in your plan (website work, social, messaging).</li>
            <li>To communicate with you about your account, billing, and the work in progress.</li>
            <li>To send push notifications you have opted in to.</li>
            <li>To prevent fraud, abuse, and unauthorized access.</li>
            <li>To comply with legal obligations.</li>
          </ul>
          <p className={P}>We do not sell your information. We do not use it for advertising.</p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Who we share it with</h2>
          <ul className={UL}>
            <li>
              <strong className="text-ink-primary">Stripe</strong> — payment processing and
              subscription management.
            </li>
            <li>
              <strong className="text-ink-primary">Resend</strong> — transactional email delivery.
            </li>
            <li>
              <strong className="text-ink-primary">Apple Push / Firebase Cloud Messaging</strong> —
              push notification delivery to your device.
            </li>
            <li>
              <strong className="text-ink-primary">Our hosting providers</strong> — to operate the
              service.
            </li>
            <li>
              When legally required (subpoena, court order), or to protect rights, property, or
              safety.
            </li>
          </ul>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>How long we keep it</h2>
          <p className={P}>
            Account, business, and message data are retained for the life of your account. When you
            cancel, we keep records for up to 12 months in case you return, then delete them.
            Billing records are retained for 7 years for tax purposes. You can ask us to delete
            sooner — see below.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Your choices</h2>
          <ul className={UL}>
            <li>Access, correct, or download a copy of your data — email us.</li>
            <li>Delete your account — from the app&apos;s Settings, or email us.</li>
            <li>Opt out of marketing email at any time from your notification preferences.</li>
            <li>Turn off push notifications in your device settings.</li>
          </ul>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Children</h2>
          <p className={P}>
            BDT Connect is not directed to anyone under 18 and we do not knowingly collect data from
            them. If you believe we have, contact us and we will delete it.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Changes</h2>
          <p className={P}>
            We may update this policy. Material changes will be announced in the app. Continued use
            after a change means you accept the updated policy.
          </p>
        </section>

        <section className={SECTION}>
          <h2 className={H2}>Contact</h2>
          <p className={P}>
            Email{' '}
            <a className="text-metal-rose" href="mailto:BDTTalentGroup@yahoo.com">
              BDTTalentGroup@yahoo.com
            </a>{' '}
            with the subject line &quot;Privacy.&quot; We respond within 30 days.
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
