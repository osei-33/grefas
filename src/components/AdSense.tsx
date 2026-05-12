import * as React from 'react';
import { useEffect } from 'react';

interface AdSenseProps {
  client: string;
  slot: string;
  format?: string;
  responsive?: string;
  style?: React.CSSProperties;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const AdSense: React.FC<AdSenseProps> = ({ 
  client, 
  slot, 
  format = 'auto', 
  responsive = 'true', 
  style = { display: 'block' },
  className = ''
}) => {
  useEffect(() => {
    // Small delay to ensure DOM is ready and avoid race conditions in SPAs
    const timer = setTimeout(() => {
      try {
        if (window.adsbygoogle) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
      } catch (e) {
        // Silently handle "already filled" errors which are common in SPAs during rapid navigation
        if (e instanceof Error && e.message.includes('already have ads')) {
          return;
        }
        console.error('AdSense error:', e);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [slot]); // Re-run if slot changes, but slot is usually stable per component instance

  return (
    <div className={`adsense-container my-8 overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
    </div>
  );
};
