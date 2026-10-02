import * as React from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  label?: string;
  minHeight?: string;
}

export default function PageLoader({ 
  label = 'Loading experience...', 
  minHeight = 'min-h-[60vh]' 
}: PageLoaderProps) {
  return (
    <div 
      className={`w-full ${minHeight} flex flex-col items-center justify-center p-8 transition-opacity duration-300 animate-in fade-in`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="relative flex items-center justify-center">
        {/* Ambient glow pulse */}
        <div className="absolute h-16 w-16 rounded-full bg-orange-500/20 blur-xl animate-pulse" />
        
        {/* Outer ring */}
        <div className="h-12 w-12 rounded-full border-2 border-orange-500/20 border-t-orange-600 animate-spin" />
        
        {/* Center dot/icon */}
        <div className="absolute">
          <div className="h-3 w-3 rounded-full bg-orange-600 animate-ping opacity-75" />
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center gap-1.5 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-foreground/80">
          Grefas Consult & Entertainment
        </span>
        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin text-orange-600" />
          {label}
        </span>
      </div>
    </div>
  );
}
