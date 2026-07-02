import * as React from 'react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '@/firebase';
import { collection, query, where, onSnapshot, getDocs, doc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, Clock, CheckCircle2, AlertTriangle, Play, MessageCircle, MapPin, 
  Phone, Mail, Calendar, Sparkles, LogIn, ArrowRight, Loader2, LogOut, Printer, X
} from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';
import AuthDialog from '@/components/AuthDialog';

export default function MyApplications() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  
  // Controls print preview modal
  const [previewApp, setPreviewApp] = useState<any | null>(null);
  const [appAuthOpen, setAppAuthOpen] = useState(false);
  const [appAuthDefaultMode, setAppAuthDefaultMode] = useState<'signin' | 'signup'>('signin');

  // Track Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch applications when logged in
  useEffect(() => {
    if (!user) {
      setApplications([]);
      return;
    }

    setLoadingApps(true);
    // Query submissions under the applicant's UID OR their Google email address
    const q1 = query(
      collection(db, 'service_intakes'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q1, async (snapshot) => {
      const uidsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Also fetch by email as an active fallback for sync
      try {
        const q2 = query(
          collection(db, 'service_intakes'), 
          where('emailAddress', '==', user.email)
        );
        const emailSnap = await getDocs(q2);
        const emailList = emailSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Merge list based on unique ID to avoid duplicates
        const mergedMap = new Map();
        [...uidsList, ...emailList].forEach(item => {
          mergedMap.set(item.id, item);
        });
        
        // Sort merged list descending by createdAt
        const sortedList = Array.from(mergedMap.values()).sort((a, b) => {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        setApplications(sortedList);
      } catch (err) {
        console.warn('Fallback email query warning:', err);
        setApplications(uidsList);
      } finally {
        setLoadingApps(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'service_intakes');
      setLoadingApps(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast.success('Signed in successfully with Google!');
    } catch (error) {
      console.error('Google Sign In failed:', error);
      toast.error('Could not authenticate. Please try again.');
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    toast.success('Signed out. See you soon!');
  };

  const triggerPrintDraft = (app: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocker active. Please allow popups to print your receipt!');
      return;
    }

    const docBirth = app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString() : 'N/A';
    const regDate = app.createdAt ? new Date(app.createdAt).toLocaleString() : 'N/A';

    printWindow.document.write(`
      <html>
        <head>
          <title>Grefas Casting Intake Receipt - ${app.fullName}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 40px; color: #111; max-width: 800px; margin: 0 auto; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
            .header p { margin: 5px 0 0 0; font-size: 12px; text-transform: uppercase; }
            .title { text-align: center; font-size: 18px; font-weight: bold; text-decoration: underline; margin-bottom: 30px; }
            .grid { display: grid; grid-template-cols: 150px 1fr; row-gap: 15px; margin-bottom: 30px; font-size: 14px; }
            .label { font-weight: bold; text-transform: uppercase; }
            .value { border-bottom: 1px dashed #666; padding-bottom: 2px; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #ccc; padding-top: 20px; font-size: 11px; color: #555; }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>GREFAS ENTERTAINMENT</h1>
            <p>Theatre, Film Casting & Skit Making Auditions</p>
            <p style="font-size: 10px; margin-top: 5px;">Reference ID: ${app.id || 'N/A'}</p>
          </div>
          
          <div class="title font-bold">FILM CASTING INTERACTIVE INTRACTABLE FORM</div>
          
          <div class="grid">
            <div class="label">Full Name:</div>
            <div class="value">${app.fullName || '__________________________________'}</div>
            
            <div class="label">Birth Date:</div>
            <div class="value">${docBirth}</div>
            
            <div class="label">Age:</div>
            <div class="value">${app.age || '___'} Years Old</div>
            
            <div class="label">Phone Contact:</div>
            <div class="value">${app.contact || '__________________________________'}</div>
            
            <div class="label">WhatsApp:</div>
            <div class="value">${app.whatsappNumber || '__________________________________'}</div>
            
            <div class="label">Email Address:</div>
            <div class="value">${app.emailAddress || '__________________________________'}</div>
            
            <div class="label">Address Info:</div>
            <div class="value">${app.address || '____________________________________________________'}</div>

            <div class="label">Status:</div>
            <div class="value" style="font-weight: bold;">${app.status || 'Pending'}</div>

            <div class="label">Logged At:</div>
            <div class="value">${regDate}</div>
          </div>

          <div style="margin-top: 40px; font-size: 12px; border: 1px solid #111; padding: 15px; background: #fafafa;">
            <strong>MEMBER SIGN OFF & VERIFICATION METRIC:</strong>
            <p style="margin: 8px 0 0 0; font-size: 11px; line-height: 1.6;">
              By presenting this copy of the Grefas Casting Form, the applicant acknowledges that all demo tapes,
              audition reels, and physical casting metrics furnished are proprietary to Grefas Consult Division.
            </p>
            <div style="margin-top: 30px; display: flex; justify-content: space-between;">
              <div>
                <p style="margin: 0; border-top: 1px solid #000; width: 200px; margin-top: 30px;"></p>
                <p style="margin: 5px 0 0 0; font-size: 10px; text-align: center;">Applicant Signature</p>
              </div>
              <div>
                <p style="margin: 0; border-top: 1px solid #000; width: 200px; margin-top: 30px;"></p>
                <p style="margin: 5px 0 0 0; font-size: 10px; text-align: center;">Grefas Director Signature</p>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Official Transmission Copy. Printed on ${new Date().toLocaleString()}</p>
            <p>Grefas Consult & Entertainment &bull; Ghana</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-muted/20 dark:bg-background/95 py-12 px-4 sm:px-6 lg:px-8">
      <SEO 
        title="My Casting Applications | Grefas Entertainment" 
        description="Check your real-time audition, casting, and skit making registration status in Ghana."
      />

      <div className="max-w-4xl mx-auto">
        {/* Banner Section */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/20 text-xs font-bold uppercase tracking-wider mb-3 spin-on-hover"
          >
            <Sparkles className="h-4 w-4 text-orange-600" />
            <span>Audition & Casting Tracking Suite</span>
          </motion.div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            My Applications
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            Log in to securely track your Movie and Skit registration forms, read coordinator memos, and view casting responses.
          </p>
        </div>

        {authLoading ? (
          <div className="flex justify-center items-center h-64 border rounded-2xl bg-card">
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-orange-600 mx-auto" />
              <p className="text-sm text-semibold text-muted-foreground">Authenticating connection...</p>
            </div>
          </div>
        ) : !user ? (
          /* Locked State - Requires Google Login */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/80 p-8 rounded-2xl text-center shadow-xl max-w-lg mx-auto"
          >
            <div className="h-16 w-16 mx-auto rounded-2xl bg-orange-500/10 dark:bg-orange-500/5 flex items-center justify-center border border-orange-500/20 text-orange-600 mb-6 animate-pulse">
              <LogIn className="h-8 w-8 text-orange-600" />
            </div>
            
            <h2 className="text-xl font-bold tracking-tight text-foreground mb-2">Secure Area Account Authentication</h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto mb-6">
              To protect your private data like contact numbers, birthdates, and residences, please sign in. You can register/login with any active email address, or use Google. Any applications matching your email will appear automatically!
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <Button 
                onClick={() => {
                  setAppAuthDefaultMode('signin');
                  setAppAuthOpen(true);
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white font-extrabold rounded-xl px-5 h-12 flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer flex-1 text-xs"
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span>Email Portal</span>
              </Button>
              <Button 
                onClick={handleGoogleLogin} 
                className="bg-zinc-950 dark:bg-zinc-900 border border-zinc-900 dark:border-zinc-800 text-white hover:bg-zinc-800 font-bold rounded-xl px-4 h-12 flex items-center justify-center gap-2 transition-all cursor-pointer flex-1 text-xs"
              >
                <svg className="h-4 w-4 fill-white shrink-0" viewBox="0 0 24 24">
                  <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.71 0 3.27.61 4.5 1.635L19.16 3.21C17.21 1.485 14.82 1 12.24 1 6.58 1 2 5.58 2 11.24s4.58 10.24 10.24 10.24c5.79 0 10.24-4.07 10.24-10.24 0-.695-.08-1.355-.22-1.955H12.24z"/>
                </svg>
                <span>Google</span>
              </Button>
            </div>
          </motion.div>
        ) : (
          /* Logged In Content */
          <div className="space-y-6">
            {/* User Profile Info Card */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-orange-500/5 dark:bg-orange-950/10 border border-orange-500/20 p-4 sm:p-5 rounded-2xl">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName} className="h-10 w-10 rounded-full border border-orange-500/30 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-orange-500/20 flex items-center justify-center font-bold text-orange-600 shrink-0">
                    {user.displayName?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">{user.displayName || 'Authorized Talent'}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground border-border hover:text-red-500 hover:bg-red-500/5 rounded-xl text-xs font-semibold gap-1.5 self-stretch sm:self-auto"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>

            {loadingApps ? (
              <div className="text-center py-20 bg-card border rounded-2xl">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
                <p className="text-xs text-muted-foreground mt-2">Retrieving applications history...</p>
              </div>
            ) : applications.length === 0 ? (
              /* No Submissions found */
              <div className="bg-card border border-dashed border-border p-12 rounded-2xl text-center">
                <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">No Casting Forms Filed</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-6">
                  You haven't submitted a Movie & Skit making Form yet! When you file a casting registration underneath the Services page, your records will populate here.
                </p>
                <Button asChild className="bg-orange-600 hover:bg-orange-700 text-white rounded-xl">
                  <Link to="/services">Go to Movie and Skit Form</Link>
                </Button>
              </div>
            ) : (
              /* Submissions Grid */
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    My Submissions ({applications.length})
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Matches: {user.email}
                  </p>
                </div>

                {applications.map((app) => (
                  <motion.div
                    key={app.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border/80 hover:border-orange-500/30 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      {/* Left: Applicant & Status Info */}
                      <div className="space-y-3.5 flex-1">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">{app.fullName}</h3>
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted py-0.5 px-2 rounded-full border border-border/50">
                              Ref: {app.id.substring(0, 8)}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1.5">
                            <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
                              {app.age} Years Old
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-orange-600" />
                              Registered: {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Contacts Summary */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/40">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-orange-600/70" />
                            <span>Phone: {app.contact}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                            <span>WhatsApp: {app.whatsappNumber}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <Mail className="h-3.5 w-3.5 text-orange-600/70" />
                            <span className="truncate">Email: {app.emailAddress}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <MapPin className="h-3.5 w-3.5 text-orange-600/70" />
                            <span className="truncate">Residence: {app.address}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Assessment Status Indicators */}
                      <div className="flex flex-row md:flex-col justify-between md:justify-start items-center md:items-end gap-3 md:w-56 shrink-0 md:border-l md:border-border/40 md:pl-5">
                        <div className="text-center md:text-right w-full">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden md:block mb-1.5">
                            Director Stage
                          </p>
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 font-extrabold uppercase rounded-full text-[10px] ${
                            app.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                            app.status === 'In Review' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                            app.status === 'Rejected' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                            'bg-violet-500/10 text-violet-600 border border-violet-500/20'
                          }`}>
                            {app.status === 'Approved' ? <CheckCircle2 className="h-3.5 w-3.5" /> : 
                             app.status === 'In Review' ? <Clock className="h-3.5 w-3.5 animate-pulse" /> :
                             app.status === 'Rejected' ? <X className="h-3.5 w-3.5" /> :
                             <Clock className="h-3.5 w-3.5" />}
                            <span>{app.status || 'Pending'}</span>
                          </div>
                        </div>

                        {/* Status Message Guidance */}
                        <div className="text-[11px] leading-relaxed text-muted-foreground font-medium md:text-right hidden sm:block">
                          {app.status === 'Approved' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              Approval Confirmed! Casting division will WhatsApp you directly to schedule auditions.
                            </span>
                          ) : app.status === 'In Review' ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              Coordinator review active. Screenings are currently comparing local roles.
                            </span>
                          ) : app.status === 'Rejected' ? (
                            <span className="text-muted-foreground/80">
                              Casting limits reached. We will keep your portfolio in Grefas archives for sequels.
                            </span>
                          ) : (
                            <span className="opacity-90">
                              Initial queue reception confirmed. Logged for standard directory processing.
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto w-full pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => triggerPrintDraft(app)}
                            className="text-xs h-9 w-full flex items-center justify-center gap-1.5 border-border rounded-xl hover:bg-muted font-semibold text-muted-foreground hover:text-foreground"
                          >
                            <Printer className="h-3.5 w-3.5 text-orange-600" />
                            <span>Print Duplicate</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AuthDialog 
        isOpen={appAuthOpen} 
        onClose={() => setAppAuthOpen(false)} 
        defaultMode={appAuthDefaultMode} 
      />
    </div>
  );
}
