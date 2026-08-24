import Hero from '@/components/sections/Hero';
import BenefitsSection from '@/components/sections/home/BenefitsSection';
import OurSolutionSection from '@/components/sections/home/OurSolutionSection';
import FeaturesSection from '@/components/sections/home/FeaturesSection';
import WhyChooseUs from '@/components/sections/home/WhyChooseUs';
import OurExpertise from '@/components/sections/home/OurExpertise';
import AboutSection from '@/components/sections/home/AboutSection';
import Benefits from '@/components/sections/home/Benefits';
import DigitalSolutions from '@/components/sections/home/DigitalSolutions';
import PricingPlan from '@/components/sections/home/PricingPlan';
import Process from '@/components/sections/home/Process';
import Projects from '@/components/sections/home/Projects';
import Values from '@/components/sections/home/Values';
import LetsWorkTogether from '@/components/sections/home/LetsWorkTogether';
import Faq from '@/components/sections/home/Faq';
import Testimonials from '@/components/sections/home/Testimonials';
import CallToAction from '@/components/sections/home/CallToAction';
import ContactUs from '@/components/sections/home/ContactUs';
import ProjectScreens from '@/components/ui/ProjectScreens';

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="pageShell">
        <BenefitsSection />
        <OurSolutionSection />
        <FeaturesSection />
        <WhyChooseUs />
        <OurExpertise />
        <AboutSection />
        <Benefits />
        <DigitalSolutions />
        <PricingPlan />
        <Process />
        <ProjectScreens>
          <Projects />
        </ProjectScreens>
        <Values />
        <LetsWorkTogether />
        <Faq />
        <Testimonials />
        <CallToAction />
        <ContactUs />
      </div>
    </>
  );
}
