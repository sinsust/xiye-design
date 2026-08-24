import type { MetadataRoute } from 'next';

import { site } from '@/config/site';

/**
 * Sitemap. Add an entry here whenever you add a route.
 * The 404 preview is deliberately excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/about', '/services', '/works', '/contact', '/privacy-policy'];
  const now = new Date();

  return routes.map((route) => ({
    url: `${site.url}${route}`,
    lastModified: now,
    changeFrequency: route === '' ? 'weekly' : 'monthly',
    priority: route === '' ? 1 : 0.8,
  }));
}
