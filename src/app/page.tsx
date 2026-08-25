import type { Metadata } from "next";
import { getAccessInfo } from "@/lib/auth/session";
import { getHeroExamplePair } from "@/lib/landing/hero-example";
import { product } from "@/lib/config/product";
import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { MedleysSection } from "@/components/landing/medleys-section";
import { NovoCultoSection } from "@/components/landing/novo-culto-section";
import { AudienceSection } from "@/components/landing/audience-section";
import { DemoSection } from "@/components/landing/demo-section";
import { BenefitsSection } from "@/components/landing/benefits-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { FaqSection } from "@/components/landing/faq-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";

const TITLE = "Louvor Pronto — Monte repertórios e encontre medleys";
const DESCRIPTION =
  "Monte repertórios para o culto, encontre louvores que combinam e descubra medleys sugeridos com o Louvor Pronto.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    locale: "pt_BR",
  },
};

export default async function LandingPage() {
  const [{ userId, access }, example] = await Promise.all([getAccessInfo(), getHeroExamplePair()]);
  const ctaAccess = { loggedIn: Boolean(userId), granted: access.granted };

  return (
    <main className="flex flex-col items-center">
      <LandingHeader access={ctaAccess} />
      <Hero access={ctaAccess} example={example} />
      <ProblemSection />
      <HowItWorksSection />
      <MedleysSection example={example} />
      <NovoCultoSection />
      <AudienceSection />
      <DemoSection />
      <BenefitsSection />
      <TestimonialsSection />
      <PricingSection access={ctaAccess} />
      <FaqSection />
      <FinalCtaSection access={ctaAccess} />
      <footer className="w-full max-w-5xl px-4 pb-10 text-center text-xs text-base-400 sm:px-6">
        {product.name} — {new Date().getFullYear()}
      </footer>
    </main>
  );
}
