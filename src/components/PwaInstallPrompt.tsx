import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already running standalone
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-20 right-4 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] bg-card/95 border border-orange-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-md"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 text-orange-600">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground truncate">
                Install Grefas App
              </h4>
              <button
                onClick={dismissPrompt}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Install Grefas Consult & Entertainment on your home screen for fast offline access and quick booking.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                onClick={handleInstallClick}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl h-8 px-3.5 flex items-center gap-1.5 shadow-sm"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Install Now</span>
              </Button>
              <Button
                onClick={dismissPrompt}
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2.5 rounded-xl"
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
