import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';

interface BreadcrumbsProps {
  customLabels?: Record<string, string>;
  className?: string;
}

export default function Breadcrumbs({ customLabels = {}, className = "" }: BreadcrumbsProps) {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Common label overrides
  const defaultLabels: Record<string, string> = {
    services: 'Our Services',
    portfolio: 'Agency Portfolio',
    gallery: 'Media Gallery',
    booking: 'Elite Scheduling',
    admin: 'Command Panel',
    team: 'Expert Consultants',
    about: 'Corporate Bio',
    contact: 'Contact Desk',
    apps: 'My Applications',
    ...customLabels,
  };

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={`flex items-center space-x-1.5 text-xs font-medium text-muted-foreground mb-8 select-none ${className}`}
      id="navigation-breadcrumbs"
    >
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-orange-600 transition-colors duration-200"
        title="Go view home desk"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Home</span>
      </Link>

      {pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const rawLabel = value.replace(/[-_]+/g, ' ');
        const overrideLabel = defaultLabels[value.toLowerCase()];
        
        // Capitalize words if no custom override
        const displayLabel = overrideLabel || rawLabel.split(' ').map(
          word => word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');

        return (
          <div key={to} className="flex items-center space-x-1.5">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/45 shrink-0" />
            {last ? (
              <span className="font-semibold text-foreground/90 truncate max-w-[160px] sm:max-w-[240px]">
                {displayLabel}
              </span>
            ) : (
              <Link
                to={to}
                className="hover:text-orange-600 transition-colors duration-200 truncate max-w-[120px] sm:max-w-[200px]"
                title={`Back to ${displayLabel}`}
              >
                {displayLabel}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
