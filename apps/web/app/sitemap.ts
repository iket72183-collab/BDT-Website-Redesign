import type { MetadataRoute } from 'next';

const SITE = 'https://bdttalentgroup.com/connect';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`,        lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE}/terms`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
