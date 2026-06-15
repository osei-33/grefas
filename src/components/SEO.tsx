import * as React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLanguage } from '@/lib/LanguageContext';

interface SEOProps {
  title?: string; // Overrides default title
  description?: string; // Overrides default description
  keywords?: string; // Extra search terms
  ogImage?: string; // Opengraph image preview
  ogType?: 'website' | 'article';
}

export default function SEO({
  title,
  description,
  keywords,
  ogImage,
  ogType = 'website',
}: SEOProps) {
  const { t, language } = useLanguage();

  // Primary Default Meta Tags
  const defaultTitle = t('hero.title') || 'Grefas Consult & Entertainment';
  const displayTitle = title ? `${title} | ${defaultTitle}` : `${defaultTitle} - Nyinahin-Ashanti, Ashanti Region`;
  
  const defaultDescription = t('hero.description') || 'Our Nyinahin-Ashanti, Ashanti Region based agency is your premier partner for professional consulting and world-class entertainment services.';
  const displayDescription = description || defaultDescription;

  // Rich list of default consulting and entertainment keywords
  const defaultKeywords = 'Grefas, Grefas Consult, Entertainment Nyinahin, Ashanti Region Consulting, Nyinahin-Ashanti entertainment agency, Ghana consulting services, event planners Ashanti, Grefas booking, professional corporate services';
  const displayKeywords = keywords ? `${keywords}, ${defaultKeywords}` : defaultKeywords;

  // Canonical URLs and current page metadata
  const canonicalUrl = typeof window !== 'undefined' ? window.location.href : 'https://grefas.com';
  const defaultOgImage = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80';
  const displayOgImage = ogImage || defaultOgImage;

  return (
    <Helmet>
      {/* Primary General Page Titles and Meta Tags */}
      <title>{displayTitle}</title>
      <meta name="description" content={displayDescription} />
      <meta name="keywords" content={displayKeywords} />
      <meta name="author" content="Grefas Consult & Entertainment" />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={canonicalUrl} />

      {/* Language Alternates (Very crucial for multi-language sites) */}
      <html lang={language} />

      {/* Open Graph / Facebook Social Integrations */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={displayTitle} />
      <meta property="og:description" content={displayDescription} />
      <meta property="og:image" content={displayOgImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Grefas Consult" />

      {/* Twitter Cards Optimized Previews */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={displayTitle} />
      <meta name="twitter:description" content={displayDescription} />
      <meta name="twitter:image" content={displayOgImage} />

      {/* Additional Geo-locational tags since we're focused on Nyinahin-Ashanti Region */}
      <meta name="geo.region" content="GH-AH" />
      <meta name="geo.placename" content="Nyinahin" />
      <meta name="geo.position" content="6.6178;-2.0944" />
      <meta name="ICBM" content="6.6178, -2.0944" />
    </Helmet>
  );
}
