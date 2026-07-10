import { Hero } from '@/components/landing/Hero';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { ServicePreview } from '@/components/landing/ServicePreview';
import { Pricing } from '@/components/landing/Pricing';
import { FAQ } from '@/components/landing/FAQ';
import { Contact } from '@/components/landing/Contact';
import { Footer } from '@/components/landing/Footer';
import { SiteNav } from '@/components/landing/SiteNav';
import { MobileStickyCTA } from '@/components/landing/MobileStickyCTA';

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main id="top">
        <Hero />
        <ProblemSolution />
        <ServicePreview />
        <Pricing />
        <FAQ />
        <Contact />
        <Footer />
      </main>
      <MobileStickyCTA />
    </>
  );
}
