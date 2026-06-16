import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import * as LucideIcons from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import SEO from '@/components/SEO';

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'All' | 'Consulting' | 'Entertainment'>('All');

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    });
    return () => unsubscribe();
  }, []);

  const getServiceCategory = (service: any): 'Consulting' | 'Entertainment' => {
    if (service.category === 'Consulting' || service.category === 'Entertainment') {
      return service.category;
    }
    // High-fidelity fallback heuristic based on keywords
    const title = (service.title || '').toLowerCase();
    const desc = (service.description || '').toLowerCase();
    
    const isConsulting = 
      title.includes('consult') || title.includes('strategy') || title.includes('business') || title.includes('advisory') || title.includes('finance') || title.includes('tax') || title.includes('legal') || title.includes('management') || title.includes('corporate') ||
      desc.includes('consult') || desc.includes('strategy') || desc.includes('business') || desc.includes('advisory') || desc.includes('finance') || desc.includes('tax') || desc.includes('legal') || desc.includes('management') || desc.includes('corporate');
      
    const isEntertainment = 
      title.includes('event') || title.includes('music') || title.includes('entertain') || title.includes('artist') || title.includes('show') || title.includes('production') || title.includes('dj') || title.includes('audio') || title.includes('video') || title.includes('stage') || title.includes('sound') ||
      desc.includes('event') || desc.includes('music') || desc.includes('entertain') || desc.includes('artist') || desc.includes('show') || desc.includes('production') || desc.includes('dj') || desc.includes('audio') || desc.includes('video') || desc.includes('stage') || desc.includes('sound');
      
    if (isEntertainment && !isConsulting) return 'Entertainment';
    return 'Consulting'; // Default fallback
  };

  const getIcon = (name: string) => {
    const Icon = (LucideIcons as any)[name] || LucideIcons.Briefcase;
    return <Icon className="h-6 w-6" />;
  };

  const filteredServices = services.filter(service => {
    if (activeTab === 'All') return true;
    return getServiceCategory(service) === activeTab;
  });

  return (
    <div className="bg-background py-20">
      <SEO 
        title="Our Services"
        description="Explore the services of Grefas Consult & Entertainment, including strategic business consulting, live entertainment events, artist management, production, and audio-video solutions in Ashanti Region, Ghana."
        keywords="Grefas services, business consulting Ghana, talent agency Nyinahin, event organization, artist manager Ghana"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Our Services
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Comprehensive solutions designed to help you succeed in business and celebrate in style.
          </motion.p>
        </div>

        {/* Tabbed Filter UI */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex rounded-xl bg-muted/60 p-1 backdrop-blur-sm border border-border/30">
            {(['All', 'Consulting', 'Entertainment'] as const).map((tab) => {
              const isActive = activeTab === tab;
              const TabIcon = tab === 'All' 
                ? (LucideIcons.Layers || LucideIcons.Grid)
                : tab === 'Consulting' 
                  ? LucideIcons.Briefcase 
                  : (LucideIcons.Music2 || LucideIcons.Music);
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer ${
                    isActive 
                      ? 'bg-orange-600 text-white shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  id={`tab-filter-${tab.toLowerCase()}`}
                >
                  <TabIcon className="h-4 w-4" />
                  <span>{tab === 'All' ? 'All Services' : tab}</span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <LucideIcons.Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        ) : (
          <div className="mt-12 min-h-[30vh]">
            <AnimatePresence mode="popLayout">
              {filteredServices.length > 0 ? (
                <motion.div 
                  layout
                  className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {filteredServices.map((service, index) => (
                    <motion.div
                      key={service.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      <Card className="flex h-full flex-col border border-border/50 bg-card shadow-sm transition-all hover:shadow-md">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${service.color || 'bg-orange-100 text-orange-600'} dark:bg-orange-900/30 dark:text-orange-500`}>
                              {getIcon(service.iconName)}
                            </div>
                            <span className="text-[10px] uppercase font-bold bg-muted text-muted-foreground px-2 py-0.5 rounded tracking-widest leading-none">
                              {getServiceCategory(service)}
                            </span>
                          </div>
                          <CardTitle className="mt-4 text-foreground">{service.title}</CardTitle>
                          <CardDescription className="line-clamp-2 text-muted-foreground">{service.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <p className="text-sm text-muted-foreground/80">
                            Tailored approaches to meet your specific requirements and exceed expectations.
                          </p>
                        </CardContent>
                        <CardFooter className="pt-0">
                          <Link to={`/services/${service.id}`} className="w-full">
                            <Button variant="outline" className="w-full border-orange-600/20 text-orange-600 hover:bg-orange-600 hover:text-white cursor-pointer">
                              Learn More
                            </Button>
                          </Link>
                        </CardFooter>
                      </Card>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-20 text-center text-muted-foreground"
                >
                  No services listed in this category yet. Check back soon!
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
