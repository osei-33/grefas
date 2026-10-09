import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { CANONICAL_DOMAIN } from '@/components/SEO';

export interface BreadcrumbItem {
  name: string;
  path?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  customLabels?: Record<string, string>;
  className?: string;
  showOnHome?: boolean;
}

export default function Breadcrumbs({ 
  items, 
  customLabels = {}, 
  className = "",
  showOnHome = false 
}: BreadcrumbsProps) {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(Boolean);
  const isHome = location.pathname === '/';

  // Comprehensive label overrides for all public & portal routes
  const defaultLabels: Record<string, string> = {
    services: 'Our Services',
    portfolio: 'Agency Portfolio',
    gallery: 'Media Gallery',
    booking: 'Elite Scheduling',
    admin: 'Command Panel',
    team: 'Expert Consultants',
    about: 'About Us',
    'about-us': 'About Us',
    contact: 'Contact Us',
    'contact-us': 'Contact Us',
    sponsorship: 'Sponsor Us & Donate',
    sponsor: 'Sponsor Us & Donate',
    donate: 'Sponsor Us & Donate',
    'work-with-us': 'Careers & Auditions',
    workwithus: 'Careers & Auditions',
    careers: 'Careers & Auditions',
    auditions: 'Careers & Auditions',
    'my-applications': 'My Applications',
    applications: 'My Applications',
    'privacy-policy': 'Legal & Policies',
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    'terms-of-service': 'Terms of Service',
    refund: 'Refund Policy',
    'refund-policy': 'Refund Policy',
    legal: 'Legal & Policies',
    assets: 'Company Assets',
    payroll: 'Payroll & Staff',
    letters: 'Official Letters',
    sms: 'SMS Dashboard',
    sitemap: 'Sitemap & Indexing',
    negotiations: 'Negotiated Prices & Budgets',
    'negotiated-prices': 'Negotiated Prices & Budgets',
    'agreed-budgets': 'Negotiated Prices & Budgets',
    ...customLabels,
  };

  // Build breadcrumb items list
  const breadcrumbList: BreadcrumbItem[] = items || [
    { name: 'Home', path: '/' },
    ...pathnames.map((segment, index) => {
      const path = `/${pathnames.slice(0, index + 1).join('/')}`;
      const raw = segment.replace(/[-_]+/g, ' ');
      const label = defaultLabels[segment.toLowerCase()] || 
        raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { name: label, path };
    })
  ];

  // Generate Google-compliant Schema.org BreadcrumbList JSON-LD
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbList.map((crumb, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: crumb.name,
      item: crumb.path 
        ? (crumb.path.startsWith('http') ? crumb.path : `${CANONICAL_DOMAIN}${crumb.path === '/' ? '' : crumb.path}`)
        : `${CANONICAL_DOMAIN}${location.pathname}`
    }))
  };

  // If on homepage and visual display isn't requested, render JSON-LD only
  if (isHome && !showOnHome) {
    return (
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
      </Helmet>
    );
  }

  return (
    <>
      {/* Schema.org BreadcrumbList JSON-LD for Google & Search Engine Indexing */}
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
      </Helmet>

      {/* Visual Semantic Breadcrumb Navigation with HTML Microdata */}
      <nav 
        aria-label="Breadcrumb" 
        className={`flex items-center space-x-1.5 text-xs font-medium text-muted-foreground mb-6 select-none ${className}`}
        id="navigation-breadcrumbs"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          {breadcrumbList.map((crumb, index) => {
            const isLast = index === breadcrumbList.length - 1;
            const absoluteUrl = crumb.path 
              ? (crumb.path.startsWith('http') ? crumb.path : `${CANONICAL_DOMAIN}${crumb.path === '/' ? '' : crumb.path}`)
              : `${CANONICAL_DOMAIN}${location.pathname}`;

            return (
              <li 
                key={`${crumb.name}-${index}`}
                className="flex items-center space-x-1.5"
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
              >
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" aria-hidden="true" />
                )}

                {isLast ? (
                  <span 
                    className="font-semibold text-foreground truncate max-w-[180px] sm:max-w-[320px]"
                    itemProp="name"
                    aria-current="page"
                  >
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    to={crumb.path || '/'}
                    className="flex items-center gap-1 hover:text-orange-600 transition-colors duration-200 truncate max-w-[140px] sm:max-w-[220px]"
                    title={`Navigate to ${crumb.name}`}
                    itemProp="item"
                  >
                    {index === 0 && <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    <span itemProp="name">{crumb.name}</span>
                  </Link>
                )}

                <meta itemProp="position" content={String(index + 1)} />
                <link itemProp="item" href={absoluteUrl} />
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
