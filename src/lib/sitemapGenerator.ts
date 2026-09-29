import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import fs from 'fs';
import path from 'path';

export interface SitemapResult {
  xml: string;
  serviceCount: number;
  blogCount: number;
  portfolioCount: number;
  totalUrls: number;
  lastGeneratedAt: string;
}

export const DEFAULT_CANONICAL_DOMAIN = 'https://grefasconsultandentertainment.com';

export async function generateDynamicSitemap(overrideBaseUrl?: string): Promise<SitemapResult> {
  // Determine clean base URL
  let baseUrl = (overrideBaseUrl || '').trim();
  
  // If no base URL or if base URL is an internal AI Studio dev URL or localhost, use canonical production domain
  if (!baseUrl || baseUrl.includes('ais-dev-') || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    baseUrl = process.env.CANONICAL_DOMAIN || DEFAULT_CANONICAL_DOMAIN;
  }
  
  // Strip trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, '');
  const today = new Date().toISOString().split('T')[0];
  const lastGeneratedAt = new Date().toISOString();

  // Core static pages
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/about', priority: '0.8', changefreq: 'weekly' },
    { url: '/services', priority: '0.9', changefreq: 'daily' },
    { url: '/portfolio', priority: '0.8', changefreq: 'weekly' },
    { url: '/gallery', priority: '0.7', changefreq: 'weekly' },
    { url: '/team', priority: '0.7', changefreq: 'monthly' },
    { url: '/booking', priority: '0.9', changefreq: 'daily' },
    { url: '/work-with-us', priority: '0.7', changefreq: 'weekly' },
    { url: '/contact', priority: '0.8', changefreq: 'monthly' },
    { url: '/privacy-policy', priority: '0.3', changefreq: 'monthly' },
  ];

  let dynamicEntries: { url: string; lastmod: string; priority: string; changefreq: string }[] = [];
  let serviceCount = 0;
  let blogCount = 0;
  let portfolioCount = 0;

  // 1. Fetch active service IDs & pages from Firestore
  try {
    const servicesSnap = await getDocs(collection(db, 'services'));
    servicesSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      // Skip explicitly inactive services
      if (data.status === 'inactive' || data.status === 'draft' || data.active === false) {
        return;
      }
      serviceCount++;
      let lastmod = today;
      if (data.updatedAt?.seconds) {
        lastmod = new Date(data.updatedAt.seconds * 1000).toISOString().split('T')[0];
      } else if (data.createdAt?.seconds) {
        lastmod = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
      }

      dynamicEntries.push({
        url: `/services/${docSnap.id}`,
        lastmod,
        priority: '0.8',
        changefreq: 'weekly',
      });
    });
  } catch (err) {
    console.error('Sitemap Generator - Error fetching services from Firestore:', err);
  }

  // 2. Fetch active blogs from Firestore
  try {
    const blogsSnap = await getDocs(collection(db, 'blogs'));
    blogsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === 'draft' || data.published === false) {
        return;
      }
      blogCount++;
      let lastmod = today;
      if (data.updatedAt?.seconds) {
        lastmod = new Date(data.updatedAt.seconds * 1000).toISOString().split('T')[0];
      } else if (data.createdAt?.seconds) {
        lastmod = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
      }

      const slug = data.slug || docSnap.id;
      dynamicEntries.push({
        url: `/blog/${slug}`,
        lastmod,
        priority: '0.7',
        changefreq: 'weekly',
      });
    });
  } catch (err) {
    // collection might not exist yet
  }

  // 3. Fetch portfolio items if available
  try {
    const portfolioSnap = await getDocs(collection(db, 'portfolio'));
    portfolioSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === 'draft' || data.hidden === true) {
        return;
      }
      portfolioCount++;
      let lastmod = today;
      if (data.updatedAt?.seconds) {
        lastmod = new Date(data.updatedAt.seconds * 1000).toISOString().split('T')[0];
      } else if (data.createdAt?.seconds) {
        lastmod = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
      }

      dynamicEntries.push({
        url: `/portfolio#${docSnap.id}`,
        lastmod,
        priority: '0.6',
        changefreq: 'monthly',
      });
    });
  } catch (err) {
    // portfolio collection optional
  }

  // Combine static and dynamic
  const allEntries = [
    ...staticPages.map((p) => ({
      url: p.url,
      lastmod: today,
      priority: p.priority,
      changefreq: p.changefreq,
    })),
    ...dynamicEntries,
  ];

  const urlNodes = allEntries
    .map((entry) => {
      const fullUrl = entry.url.startsWith('http') ? entry.url : `${baseUrl}${entry.url}`;
      return `  <url>
    <loc>${fullUrl}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlNodes}
</urlset>`;

  // Update physical sitemap.xml on disk
  try {
    // For static disk fallback files, ensure we NEVER write an ephemeral ais-dev- or localhost URL.
    const diskXml = baseUrl.includes('ais-dev-') || baseUrl.includes('localhost')
      ? xml.split(baseUrl).join(DEFAULT_CANONICAL_DOMAIN)
      : xml;

    const publicSitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
    fs.writeFileSync(publicSitemapPath, diskXml, 'utf-8');

    const distPath = path.resolve(process.cwd(), 'dist');
    const distSitemapPath = path.resolve(distPath, 'sitemap.xml');
    if (fs.existsSync(distPath)) {
      fs.writeFileSync(distSitemapPath, diskXml, 'utf-8');
    }
    console.log(
      `[Sitemap Generator] Successfully updated sitemap.xml (${allEntries.length} total URLs, ${serviceCount} services, ${blogCount} blogs)`
    );
  } catch (writeErr) {
    console.warn('[Sitemap Generator] Could not write sitemap.xml to disk:', writeErr);
  }

  return {
    xml,
    serviceCount,
    blogCount,
    portfolioCount,
    totalUrls: allEntries.length,
    lastGeneratedAt,
  };
}
