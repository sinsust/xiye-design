import Hero from './Hero';
import Expertise from './Expertise';
import ServicesOverview from './ServicesOverview';
import Services from './Services';
import PricingPlan from './PricingPlan';
import Comparison from './Comparison';
import KeyFeatures from './KeyFeatures';
import Payment from './Payment';
import Benefits from './Benefits';
import Faq from './Faq';
import Process from './Process';

export default function ServicesSections() {
  return (
    <>
      <Hero />
      <div className="pageShell pageShellFlush">
        <Expertise />
        <ServicesOverview />
        <Services />
        <PricingPlan />
        <Comparison />
        <KeyFeatures />
        <Payment />
        <Benefits />
        <Faq />
        <Process />
      </div>
    </>
  );
}
