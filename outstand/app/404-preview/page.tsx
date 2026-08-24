import type { Metadata } from 'next';

import Content from '@/components/sections/not-found/Content';

export const metadata: Metadata = {
  title: '404 - Page Missing',
  description:
    'It looks like this page is missing. You can return to our homepage to explore other sections.',
  alternates: { canonical: '/404-preview' },
  openGraph: {
    title: '404 - Page Missing',
    description:
      'It looks like this page is missing. You can return to our homepage to explore other sections.',
    url: '/404-preview',
  },
};

export default function NotFoundPreviewPage() {
  return (
    <>
      <Content />
    </>
  );
}
