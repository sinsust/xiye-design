import Hero from './Hero';
import Support from './Support';
import DigitalPresence from './DigitalPresence';
import Faq from './Faq';

export default function ContactSections() {
  return (
    <>
      <Hero />
      <div className="pageShell pageShellFlush">
        <Support />
        <DigitalPresence />
        <Faq />
      </div>
    </>
  );
}
