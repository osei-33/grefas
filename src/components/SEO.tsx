import * as React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/lib/LanguageContext';

export const CANONICAL_DOMAIN = 'https://grefasconsultandentertainment.com';

/**
 * Computes a clean, standardized canonical URL strictly under the official domain.
 * Strips tracking parameters and ephemeral cloud run/localhost hostnames.
 */
export function getCleanCanonicalUrl(explicitCanonical?: string): string {
  if (explicitCanonical) {
    if (explicitCanonical.startsWith('http')) {
      return explicitCanonical;
    }
    const cleanPath = explicitCanonical.startsWith('/') ? explicitCanonical : `/${explicitCanonical}`;
    return `${CANONICAL_DOMAIN}${cleanPath}`;
  }

  if (typeof window !== 'undefined') {
    let pathname = window.location.pathname || '/';
    // Remove trailing slash for non-root paths to prevent duplicate canonical representations
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${CANONICAL_DOMAIN}${pathname}`;
  }

  return CANONICAL_DOMAIN;
}

export interface SEOProps {
  title?: string; // Overrides or prefixes page title
  description?: string; // Specific page meta description
  keywords?: string; // Route-relevant search keywords
  ogImage?: string; // Opengraph / Twitter social share card image
  ogType?: 'website' | 'article';
  canonical?: string; // Explicit canonical path override (e.g., "/privacy-policy")
  noIndex?: boolean; // Set true for private/admin or 404 pages
}

export default function SEO({
  title,
  description,
  keywords,
  ogImage,
  ogType = 'website',
  canonical,
  noIndex = false,
}: SEOProps) {
  const { t, language } = useLanguage();

  // Primary Default Branded Meta Titles
  const brandName = 'Grefas Consult & Entertainment';
  const defaultTitle = `${brandName} | Nyinahin-Ashanti, Ghana`;
  const displayTitle = title 
    ? (title.includes(brandName) ? title : `${title} | ${brandName}`) 
    : defaultTitle;
  
  const defaultDescription = t('hero.description') || 
    'Grefas Consult & Entertainment is your premier partner for professional business consulting, corporate advisory, movie & skit production, event management, and talent recruitment in Nyinahin-Ashanti, Ghana.';
  const displayDescription = description || defaultDescription;

  // Rich list of default consulting and entertainment keywords
  const defaultKeywords = 
    'Grefas, Grefas Consult, Entertainment Nyinahin, Ashanti Region Consulting, Nyinahin-Ashanti entertainment agency, Ghana consulting services, event planners Ashanti, Grefas booking, professional corporate services';
  const displayKeywords = keywords ? `${keywords}, ${defaultKeywords}` : defaultKeywords;

  // Compute canonical URL strictly anchored to canonical production domain
  const canonicalUrl = getCleanCanonicalUrl(canonical);

  const defaultOgImage = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80';
  const displayOgImage = ogImage || defaultOgImage;

  return (
    <Helmet>
      {/* Primary General Page Titles and Meta Tags */}
      <title>{displayTitle}</title>
      <meta name="description" content={displayDescription} />
      <meta name="keywords" content={displayKeywords} />
      <meta name="author" content="Grefas Consult & Entertainment" />
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Language Alternates */}
      <html lang={language || 'en'} />

      {/* Open Graph / Facebook Social Integrations */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={displayTitle} />
      <meta property="og:description" content={displayDescription} />
      <meta property="og:image" content={displayOgImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={brandName} />

      {/* Twitter Cards Optimized Previews */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={displayTitle} />
      <meta name="twitter:description" content={displayDescription} />
      <meta name="twitter:image" content={displayOgImage} />

      {/* Additional Geo-locational tags for Nyinahin-Ashanti Region */}
      <meta name="geo.region" content="GH-AH" />
      <meta name="geo.placename" content="Nyinahin" />
      <meta name="geo.position" content="6.6178;-2.0944" />
      <meta name="ICBM" content="6.6178, -2.0944" />

      {/* JSON-LD Structured Data Schema for Google Rich Search & Local Business SEO */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": ["LocalBusiness", "EntertainmentBusiness", "ProfessionalService"],
          "name": brandName,
          "alternateName": "Grefas Consult",
          "url": canonicalUrl,
          "logo": displayOgImage,
          "image": displayOgImage,
          "description": displayDescription,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "GPS Address AI-0008-9223",
            "addressLocality": "Nyinahin",
            "addressRegion": "Ashanti Region",
            "addressCountry": "GH"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": 6.6178,
            "longitude": -2.0944
          },
          "telephone": "+233541234567",
          "email": "info@grefasconsultandentertainment.com",
          "priceRange": "$$",
          "sameAs": [
            "https://facebook.com",
            "https://instagram.com",
            "https://youtube.com"
          ]
        })}
      </script>
    </Helmet>
  );
}
