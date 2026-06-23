import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, PhoneCall, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface WhatsAppButtonProps {
  phone?: string;
  defaultMessage?: string;
}

export default function WhatsAppButton({ phone, defaultMessage }: WhatsAppButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Show a helpful welcome tooltip after 4 seconds to catch attention, then auto-hide after 8 seconds
    const timer = setTimeout(() => {
      setShowTooltip(true);
    }, 4000);

    const hideTimer = setTimeout(() => {
      setShowTooltip(false);
    }, 12000);

    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Format clean digits-only phone string
  const rawGroup = phone || '+233 24 163 1184'; // Fallback to Grefas main contact hub if offline/empty
  const numericPhone = rawGroup.replace(/\D/g, '');
  const presetText = encodeURIComponent(
    defaultMessage || "Hello Grefas Consult! I would like to quickly message your consultancy team about services."
  );
  
  const whatsappUrl = `https://wa.me/${numericPhone}?text=${presetText}`;

  return (
    <div className="fixed bottom-6 right-24 z-50 flex items-center">
      {/* Dynamic Popover Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 10 }}
            className="absolute right-[68px] hidden sm:flex items-center"
          >
            <div className="bg-card text-card-foreground border border-border shadow-xl rounded-xl px-4 py-2.5 w-60 relative">
              {/* Arrow */}
              <div className="absolute right-[-6px] top-[14px] w-3 h-3 bg-card border-t border-r border-border rotate-45" />
              
              <div className="flex items-start space-x-2.5">
                <div className="h-2 w-2 rounded-full bg-[#25D366] animate-ping mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-foreground leading-tight">Need Quick Consulting?</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                    Chat directly with our specialists on WhatsApp. Setup is instant!
                  </p>
                </div>
                <button 
                  onClick={() => setShowTooltip(false)}
                  className="text-muted-foreground/65 hover:text-foreground p-0.5"
                  title="Close hint"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Pulse Ring Anchor Link Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowTooltip(true)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-all hover:scale-110 hover:shadow-emerald-500/20 active:scale-95 group cursor-pointer"
        id="whatsapp-floating-button"
        title="Direct Consultation via WhatsApp"
      >
        {/* Dual outer ambient pulse rings */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-25 animate-ping [animation-duration:1.8s]" />
        <span className="absolute inset-[-4px] rounded-full bg-[#25D366] opacity-10 animate-ping [animation-duration:2.4s]" />

        {/* Brand Icon & Phone indicator on hover transition */}
        <div className="relative">
          <MessageCircle className="h-7 w-7 text-white transition-all transform group-hover:rotate-12 group-hover:scale-105" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 border border-white text-[8px] font-black scale-0 group-hover:scale-100 transition-all duration-300">
            <PhoneCall className="h-2 w-2 text-white" />
          </span>
        </div>
      </a>
    </div>
  );
}
