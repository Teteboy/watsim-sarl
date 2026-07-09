import LandingNav from './components/LandingNav';
import HeroSection from './components/HeroSection';
import FeaturesSection from './components/FeaturesSection';
import HowItWorksSection from './components/HowItWorksSection';
import TestimonialsSection from './components/TestimonialsSection';
import PartnerSection from './components/PartnerSection';
import FaqSection from './components/FaqSection';
import CtaSection from './components/CtaSection';
import PartnerFormSection from './components/PartnerFormSection';
import LandingFooter from './components/LandingFooter';

export default function HomePage() {
  return (
    <div style={{ background: '#FAFEF9' }}>
      <LandingNav />
      <HeroSection />
      <PartnerSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <FaqSection />
      <PartnerFormSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
