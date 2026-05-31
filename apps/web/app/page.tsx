import { Hero } from '@/components/landing/Hero';
import { ProblemSolution } from '@/components/landing/ProblemSolution';
import { ServicePreview } from '@/components/landing/ServicePreview';
import { Features } from '@/components/landing/Features';
import { Pricing } from '@/components/landing/Pricing';
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
        <Features />
        <Pricing />
        <Footer />
      </main>
      <MobileStickyCTA />
    </>
  );
}
