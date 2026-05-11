import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import * as LucideIcons from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Calendar } from 'lucide-react';

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [service, setService] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchService() {
      if (!id) return;
      try {
        const docRef = doc(db, 'services', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setService({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `services/${id}`);
      } finally {
        setLoading(false);
      }
    }
    fetchService();
  }, [id]);

  const getIcon = (name: string) => {
    const Icon = (LucideIcons as any)[name] || LucideIcons.Briefcase;
    return <Icon className="h-10 w-10 text-white" />;
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Service not found</h2>
        <Link to="/services" className="mt-4 inline-flex items-center text-orange-600 hover:underline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to services
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen pb-20">
      {/* Hero Section */}
      <div className={`relative h-[40vh] min-h-[300px] w-full overflow-hidden ${service.color || 'bg-orange-600'}`}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 flex justify-center"
            >
              <div className="rounded-2xl bg-white/20 p-4 backdrop-blur-md">
                {getIcon(service.iconName)}
              </div>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-extrabold text-white sm:text-5xl md:text-6xl"
            >
              {service.title}
            </motion.h1>
          </div>
        </div>
        <div className="absolute left-4 top-4 z-10 sm:left-8 sm:top-8">
          <Link to="/services">
            <Button variant="ghost" className="text-white hover:bg-white/20">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Services
            </Button>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-3xl font-bold text-foreground">Overview</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                {service.description}
              </p>
              
              <div className="mt-12">
                <h3 className="text-2xl font-semibold text-foreground">Why choose this service?</h3>
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {[
                    "Personalized approach tailored to your unique needs",
                    "Expert consultation from industry professionals",
                    "Seamless project execution and management",
                    "Commitment to excellence and customer satisfaction"
                  ].map((benefit, i) => (
                    <Card key={i} className="border-border/50 bg-muted/30">
                      <CardContent className="p-4 pt-6">
                        <div className="flex gap-4">
                          <CheckCircle className="h-6 w-6 shrink-0 text-orange-600" />
                          <p className="text-sm font-medium text-foreground">{benefit}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </motion.section>
          </div>

          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky top-24"
            >
              <Card className="border-2 border-orange-600/20 bg-orange-50/50 dark:bg-orange-900/10">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-foreground">Ready to start?</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Book a consultation for {service.title} today and let's work together to make your vision a reality.
                  </p>
                  <Link to="/booking">
                    <Button className="mt-6 w-full bg-orange-600 text-white hover:bg-orange-700">
                      <Calendar className="mr-2 h-4 w-4" /> Book Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <div className="mt-8 space-y-4">
                <h4 className="font-semibold text-foreground">Contact for more info</h4>
                <Link to="/contact">
                  <Button variant="outline" className="w-full">
                    Contact Us
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
