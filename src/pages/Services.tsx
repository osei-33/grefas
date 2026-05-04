import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import * as LucideIcons from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const getIcon = (name: string) => {
    const Icon = (LucideIcons as any)[name] || LucideIcons.Briefcase;
    return <Icon className="h-6 w-6" />;
  };

  return (
    <div className="bg-background py-20">
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

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <LucideIcons.Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        ) : (
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full border border-border/50 bg-card shadow-sm transition-all hover:shadow-md">
                  <CardHeader>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${service.color || 'bg-orange-100 text-orange-600'} dark:bg-orange-900/30 dark:text-orange-500`}>
                      {getIcon(service.iconName)}
                    </div>
                    <CardTitle className="mt-4 text-foreground">{service.title}</CardTitle>
                    <CardDescription className="text-muted-foreground">{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground/80">
                      Tailored approaches to meet your specific requirements and exceed expectations.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {services.length === 0 && (
              <div className="col-span-full py-20 text-center text-muted-foreground">
                No services listed yet. Check back soon!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
