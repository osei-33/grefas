import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '@/firebase';
import { collection, addDoc, getDocs, query, where, doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Briefcase, 
  Sparkles, 
  Smartphone, 
  Mail, 
  MapPin, 
  Calendar, 
  FileText, 
  Link as LinkIcon, 
  CheckCircle2, 
  Award, 
  ShieldCheck, 
  User, 
  TrendingUp, 
  Camera,
  LogOut,
  ChevronRight,
  Send,
  Loader2,
  LogIn
} from 'lucide-react';
import { toast } from 'sonner';
import SEO from '@/components/SEO';

export default function WorkWithUs() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Portal Sign In / Sign Up states
  const [portalMode, setPortalMode] = useState<'signin' | 'signup' | 'forgot_password' | 'verify_otp'>('signin');
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [portalFullName, setPortalFullName] = useState('');
  const [portalConfirmPassword, setPortalConfirmPassword] = useState('');
  const [portalPhone, setPortalPhone] = useState('');
  const [isPortalActionLoading, setIsPortalActionLoading] = useState(false);

  // OTP SMS verification states
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [userEnteredOtp, setUserEnteredOtp] = useState('');
  const [tempUserData, setTempUserData] = useState<any>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [roleType, setRoleType] = useState('Actor / Actress');
  const [roleTypes, setRoleTypes] = useState<string[]>(['Actor / Actress']);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState('Intermediate');
  const [availability, setAvailability] = useState('Full-time');
  const [portfolioLink, setPortfolioLink] = useState('');
  const [bio, setBio] = useState('');
  const [signature, setSignature] = useState('');

  // Track Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (authUser) {
        setFullName(authUser.displayName || '');
        setEmailAddress(authUser.email || '');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch dynamic roles from settings/global
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().intakeRoles && docSnap.data().intakeRoles.length > 0) {
        setAvailableRoles(docSnap.data().intakeRoles);
      } else {
        setAvailableRoles([
          "Actor / Actress",
          "Skit Performer",
          "Creative Writer",
          "Crew / Technical",
          "Video Editor",
          "Cameraman",
          "Sound Engineer",
          "Director",
          "Finance Officer",
          "Admin Support"
        ]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Pre-fill profile details if they have submitted an application before
  useEffect(() => {
    if (!user) return;
    
    // Set basic auth-derived states first as fallback
    setFullName(prev => prev || user.displayName || '');
    setEmailAddress(prev => prev || user.email || '');

    const fetchLatestProfile = async () => {
      try {
        const q = query(
          collection(db, 'service_intakes'),
          where('userId', '==', user.uid)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          // Sort manually by createdAt descending to get the newest
          const sorted = snap.docs
            .map(d => d.data())
            .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          
          const latest = sorted[0];
          if (latest) {
            setFullName(latest.fullName || user.displayName || '');
            setDateOfBirth(latest.dateOfBirth || '');
            setContact(latest.contact || '');
            setAddress(latest.address || '');
            setWhatsappNumber(latest.whatsappNumber || '');
            setEmailAddress(latest.emailAddress || user.email || '');
            setRoleType(latest.roleType || 'Actor / Actress');
            if (latest.roleTypes && Array.isArray(latest.roleTypes)) {
              setRoleTypes(latest.roleTypes);
            } else if (latest.roleType) {
              setRoleTypes(latest.roleType.split(', ').map((s: string) => s.trim()));
            } else {
              setRoleTypes(['Actor / Actress']);
            }
            setExperienceLevel(latest.experienceLevel || 'Intermediate');
            setAvailability(latest.availability || 'Full-time');
            setPortfolioLink(latest.portfolioLink || '');
            setBio(latest.bio || '');
            setSignature(latest.signature || '');
            toast.success('Welcome back! Your previous application profile has been auto-filled.');
          }
        } else {
          // If no service intakes found, check if there is a users doc with phone number
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc && userDoc.exists()) {
            const uData = userDoc.data();
            if (uData.phone) {
              setContact(prev => prev || uData.phone || '');
              setWhatsappNumber(prev => prev || uData.phone || '');
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching latest application for auto-fill:', err);
      }
    };
    fetchLatestProfile();
  }, [user]);

  const handlePortalSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalEmail.trim() || !portalPassword) {
      toast.error('Please enter email and password.');
      return;
    }
    setIsPortalActionLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, portalEmail.trim(), portalPassword);
      
      // Log login activity
      if (userCredential.user) {
        try {
          await addDoc(collection(db, 'activity_logs'), {
            userId: userCredential.user.uid,
            userEmail: userCredential.user.email,
            userName: userCredential.user.displayName || 'Grefas Client',
            type: 'login',
            description: `Client logged in securely via email and password.`,
            createdAt: new Date().toISOString()
          });
        } catch (logErr) {
          console.warn('Login activity logging failed:', logErr);
        }
      }

      toast.success('Signed in successfully!');
    } catch (error: any) {
      console.error('Portal sign in error:', error);
      let errorMsg = `Failed to sign in: ${error.message || error}`;
      if (error?.code === 'auth/operation-not-allowed') {
        errorMsg = 'Email/Password sign-in is currently disabled. Please enable the "Email/Password" provider in your Firebase Console under Authentication > Sign-in method.';
      } else if (error?.code === 'auth/user-not-found' || error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential') {
        errorMsg = 'Incorrect email or password.';
      }
      toast.error(errorMsg);
    } finally {
      setIsPortalActionLoading(false);
    }
  };

  const handlePortalSignUpInit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalFullName.trim()) {
      toast.error('Please enter your full name.');
      return;
    }
    if (!portalEmail.trim()) {
      toast.error('Please enter your email.');
      return;
    }
    if (!portalPhone.trim()) {
      toast.error('Please enter your phone number.');
      return;
    }
    if (portalPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    if (portalPassword !== portalConfirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsPortalActionLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, portalEmail.trim(), portalPassword);
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: portalFullName.trim()
        });

        // Save phone to user profile in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: portalEmail.trim(),
          fullName: portalFullName.trim(),
          phone: portalPhone.trim(),
          role: 'guest',
          createdAt: serverTimestamp()
        }, { merge: true });

        // Update local user state
        setUser({ ...userCredential.user, displayName: portalFullName.trim() });

        // Record registration activity log
        try {
          await addDoc(collection(db, 'activity_logs'), {
            userId: userCredential.user.uid,
            userEmail: portalEmail.trim(),
            userName: portalFullName.trim(),
            type: 'login',
            description: `Client portal account registered successfully (direct sign up without SMS verification). Phone: ${portalPhone.trim()}.`,
            createdAt: new Date().toISOString()
          });
        } catch (logErr) {
          console.warn('Failed to log registration activity:', logErr);
        }
      }
      toast.success('Registration completed! Welcome to Grefas.');
    } catch (error: any) {
      console.error('Registration completion error:', error);
      let errorMsg = `Failed to complete registration: ${error.message || error}`;
      if (error?.code === 'auth/operation-not-allowed') {
        errorMsg = 'Email/Password registration is currently disabled. Please enable the "Email/Password" provider in your Firebase Console under Authentication > Sign-in method.';
      } else if (error?.code === 'auth/email-already-in-use') {
        errorMsg = 'An account already exists with this email address.';
      } else if (error?.code === 'auth/invalid-email') {
        errorMsg = 'The email address is invalid.';
      }
      toast.error(errorMsg);
    } finally {
      setIsPortalActionLoading(false);
    }
  };

  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.info('SMS OTP Verification is currently bypassed.');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalEmail.trim()) {
      toast.error('Please enter your email address first.');
      return;
    }
    setIsPortalActionLoading(true);
    try {
      await sendPasswordResetEmail(auth, portalEmail.trim());
      
      // Track password reset activity
      try {
        await addDoc(collection(db, 'activity_logs'), {
          userId: null,
          userEmail: portalEmail.trim(),
          userName: 'Anonymous Client',
          type: 'password_reset',
          description: `Requested a password reset link for ${portalEmail.trim()}.`,
          createdAt: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn('Failed to log password reset activity:', logErr);
      }

      toast.success('Password reset email sent! Check your inbox.');
      setPortalMode('signin');
    } catch (error: any) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'Failed to send password reset email.');
    } finally {
      setIsPortalActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setFullName('');
      setEmailAddress('');
      toast.success('Logged out successfully.');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out.');
    }
  };

  // Calculate age based on Date of Birth
  const calculateAge = (dobString: string): number => {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(0, age);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!fullName.trim()) return toast.error('Full Name is required.');
    if (!dateOfBirth) return toast.error('Date of Birth is required.');
    if (!contact.trim()) return toast.error('Phone contact is required.');
    if (!address.trim()) return toast.error('Address is required.');
    if (!whatsappNumber.trim()) return toast.error('WhatsApp Number is required.');
    if (!emailAddress.trim()) return toast.error('Email Address is required.');
    if (!signature.trim()) return toast.error('Signature confirmation is required.');

    if (!roleTypes || roleTypes.length === 0) {
      return toast.error('Please select at least one role applied for.');
    }

    const age = calculateAge(dateOfBirth);
    if (age < 12) {
      return toast.error('Applicants must be at least 12 years of age to participate.');
    }

    setSubmitting(true);

    const joinedRoleType = roleTypes.join(', ');

    const intakeData = {
      fullName: fullName.trim(),
      dateOfBirth,
      age,
      contact: contact.trim(),
      address: address.trim(),
      whatsappNumber: whatsappNumber.trim(),
      emailAddress: emailAddress.trim().toLowerCase(),
      roleType: joinedRoleType,
      roleTypes,
      experienceLevel,
      availability,
      portfolioLink: portfolioLink.trim(),
      bio: bio.trim(),
      signature: signature.trim(),
      preferredGenres: ['General', 'Commercial'],
      passportPhoto: '',
      userId: user?.uid || null,
      userEmail: user?.email || null,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Save application to 'service_intakes'
      await addDoc(collection(db, 'service_intakes'), intakeData);

                      // 2. Dispatch a notification to admin
                      await addDoc(collection(db, 'notifications'), {
                        userId: 'admin',
                        userEmail: 'admin',
                        title: 'New Candidate Career Application',
                        message: `A new application to work with Grefas has been submitted by ${fullName.trim()} for the role of ${joinedRoleType}. Check the service intakes desk to review and issue an official contract letter.`,
                        type: 'service_intake_alert',
                        read: false,
                        createdAt: new Date().toISOString()
                      });

      // 3. Try to notify via backend if proxy exists
      try {
        await fetch('/api/notify-intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(intakeData)
        });
      } catch (err) {
        console.warn('API notify intake skipped or failed:', err);
      }

            // 4. Record application submission activity log
            if (user) {
              try {
                await addDoc(collection(db, 'activity_logs'), {
                  userId: user.uid,
                  userEmail: user.email,
                  userName: fullName.trim(),
                  type: 'application_submission',
                  description: `Submitted a casting career application for the roles: ${joinedRoleType}.`,
                  createdAt: new Date().toISOString()
                });
              } catch (logErr) {
                console.warn('Failed to log application submission:', logErr);
              }
            }

      toast.success('Your application was submitted successfully!');
      setShowSuccess(true);
    } catch (error) {
      console.error('Error submitting application:', error);
      handleFirestoreError(error, OperationType.WRITE, 'service_intakes');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <SEO 
        title="Apply to Work With Us - Grefas Consult & Entertainment" 
        description="Join Grefas Consult & Entertainment. Apply for Actor, Skit Creator, Video Editor, or Production Crew positions." 
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        
        {/* Page Banner Header */}
        <div className="text-center space-y-4 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" /> Grefas Careers Desk
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground">
            Apply to <span className="text-orange-600">Work With Us</span>
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            Grefas is always looking for brilliant actors, passionate crew members, video editors, scriptwriters, and consulting staff. Fill in your professional details below to join our talent database.
          </p>
        </div>

        {authLoading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          </div>
        ) : !user ? (
          <div className="max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border shadow-xl rounded-2xl overflow-hidden"
            >
              {/* Header Tab Switches */}
              {portalMode !== 'verify_otp' && portalMode !== 'forgot_password' && (
                <div className="flex border-b">
                  <button
                    type="button"
                    onClick={() => setPortalMode('signin')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      portalMode === 'signin' 
                        ? 'border-b-2 border-orange-600 text-orange-600 bg-orange-600/5' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Portal Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortalMode('signup')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                      portalMode === 'signup' 
                        ? 'border-b-2 border-orange-600 text-orange-600 bg-orange-600/5' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Create Client Account
                  </button>
                </div>
              )}

              <div className="p-6 space-y-6">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
                    {portalMode === 'signin' ? 'Welcome Back Applicant' : 
                     portalMode === 'signup' ? 'Start Your Grefas Journey' :
                     portalMode === 'forgot_password' ? 'Reset Secret Password' :
                     'SMS Code Verification'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {portalMode === 'signin' ? 'Access the secure talent registry to apply and track your status' : 
                     portalMode === 'signup' ? 'Sign up to submit your career application and manage details' :
                     portalMode === 'forgot_password' ? 'Enter your registered email to receive a secure reset link' :
                     `Enter the 6-digit code dispatched to ${portalPhone}`}
                  </p>
                </div>

                {portalMode === 'signin' && (
                  <form onSubmit={handlePortalSignIn} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Email Address</label>
                      <Input
                        type="email"
                        value={portalEmail}
                        onChange={(e) => setPortalEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="h-10 text-xs rounded-lg bg-muted/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Secret Password</label>
                        <button
                          type="button"
                          onClick={() => setPortalMode('forgot_password')}
                          className="text-[10px] font-bold text-orange-600 hover:underline"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <Input
                        type="password"
                        value={portalPassword}
                        onChange={(e) => setPortalPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="h-10 text-xs rounded-lg bg-muted/20"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isPortalActionLoading}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold uppercase tracking-wider h-10 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isPortalActionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Verifying Account...
                        </>
                      ) : (
                        'Secure Sign In'
                      )}
                    </Button>
                  </form>
                )}

                {portalMode === 'signup' && (
                  <form onSubmit={handlePortalSignUpInit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Full Legal Name</label>
                      <Input
                        type="text"
                        value={portalFullName}
                        onChange={(e) => setPortalFullName(e.target.value)}
                        placeholder="Linda Serwaah"
                        required
                        className="h-10 text-xs rounded-lg bg-muted/20"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Email Address</label>
                        <Input
                          type="email"
                          value={portalEmail}
                          onChange={(e) => setPortalEmail(e.target.value)}
                          placeholder="linda@gmail.com"
                          required
                          className="h-10 text-xs rounded-lg bg-muted/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Phone Number (SMS)</label>
                        <Input
                          type="tel"
                          value={portalPhone}
                          onChange={(e) => setPortalPhone(e.target.value)}
                          placeholder="+233244123456"
                          required
                          className="h-10 text-xs rounded-lg bg-muted/20"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Password</label>
                        <Input
                          type="password"
                          value={portalPassword}
                          onChange={(e) => setPortalPassword(e.target.value)}
                          placeholder="Min 6"
                          required
                          className="h-10 text-xs rounded-lg bg-muted/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Confirm</label>
                        <Input
                          type="password"
                          value={portalConfirmPassword}
                          onChange={(e) => setPortalConfirmPassword(e.target.value)}
                          placeholder="Repeat"
                          required
                          className="h-10 text-xs rounded-lg bg-muted/20"
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={isPortalActionLoading}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold uppercase tracking-wider h-10 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isPortalActionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Registering Account...
                        </>
                      ) : (
                        'Register Client Account'
                      )}
                    </Button>
                  </form>
                )}

                {portalMode === 'forgot_password' && (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Email Address</label>
                      <Input
                        type="email"
                        value={portalEmail}
                        onChange={(e) => setPortalEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        className="h-10 text-xs rounded-lg bg-muted/20"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isPortalActionLoading}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold uppercase tracking-wider h-10 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isPortalActionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending Reset Email...
                        </>
                      ) : (
                        'Send Reset Link'
                      )}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setPortalMode('signin')}
                      className="text-[11px] font-black text-muted-foreground uppercase tracking-wider hover:text-foreground block text-center w-full pt-2"
                    >
                      Back to Sign In
                    </button>
                  </form>
                )}

                {portalMode === 'verify_otp' && (
                  <form onSubmit={handleVerifyOtpAndRegister} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">6-Digit Verification Code</label>
                      <Input
                        type="text"
                        maxLength={6}
                        value={userEnteredOtp}
                        onChange={(e) => setUserEnteredOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        required
                        className="h-12 text-center text-lg font-black tracking-widest rounded-lg bg-muted/20"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isPortalActionLoading}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold uppercase tracking-wider h-10 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isPortalActionLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Completing Registration...
                        </>
                      ) : (
                        'Verify & Complete Registration'
                      )}
                    </Button>
                    <div className="flex justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => setPortalMode('signup')}
                        className="text-[10px] font-black text-muted-foreground uppercase tracking-wider hover:text-foreground animate-pulse"
                      >
                        Change Details
                      </button>
                      <button
                        type="button"
                        onClick={handlePortalSignUpInit}
                        className="text-[10px] font-black text-orange-600 uppercase tracking-wider hover:underline animate-pulse"
                      >
                        Resend OTP SMS
                      </button>
                    </div>
                  </form>
                )}

                {portalMode !== 'verify_otp' && portalMode !== 'forgot_password' && (
                  <div className="pt-2"></div>
                )}
              </div>
            </motion.div>
          </div>
        ) : showSuccess ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 px-6 bg-card border rounded-2xl shadow-xl space-y-6 max-w-2xl mx-auto"
          >
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-black text-foreground">Application Received!</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Thank you, <strong>{fullName}</strong>. Your talent application has been successfully logged into Grefas's central production system under status: <strong>Pending Review</strong>.
            </p>
            <div className="p-4 bg-muted/50 rounded-xl text-left text-xs max-w-sm mx-auto space-y-2.5 border">
              <p className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">What happens next?</p>
              <div className="flex gap-2.5">
                <span className="font-black text-orange-600">1.</span>
                <p className="text-muted-foreground">Our director & casting team will review your profile, experience level, and portfolio reel.</p>
              </div>
              <div className="flex gap-2.5">
                <span className="font-black text-orange-600">2.</span>
                <p className="text-muted-foreground">An official contract or invitation letter will be generated by Grefas management.</p>
              </div>
              <div className="flex gap-2.5">
                <span className="font-black text-orange-600">3.</span>
                <p className="text-muted-foreground">You will be notified in-app under "My Applications" and contacted via WhatsApp or phone call.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <Button 
                onClick={() => {
                  window.location.href = '/my-applications';
                }}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-10 px-6 rounded-xl"
              >
                Track In My Applications
              </Button>
              <Button 
                onClick={() => setShowSuccess(false)}
                variant="outline"
                className="text-xs font-bold h-10 px-6 rounded-xl text-foreground"
              >
                Submit Another Response
              </Button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Requirements & Info */}
            <div className="space-y-6 lg:col-span-1">
              <Card className="border/70 shadow-xs bg-muted/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="h-4.5 w-4.5 text-orange-600" /> Why Join Grefas?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <h4 className="font-bold text-foreground">Competitive Compensation</h4>
                    <p className="text-muted-foreground leading-relaxed">We respect professional value. Admin registers all hired staff and coordinates competitive payroll stubs with transparent allowances.</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-foreground">Official Contracts</h4>
                    <p className="text-muted-foreground leading-relaxed">Receive formal, printed or printable engagement agreements with clear milestones directly through the app.</p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-foreground">In-App Notification Desk</h4>
                    <p className="text-muted-foreground leading-relaxed">Stay updated with instant alert systems for call-times, schedule changes, and processed salary remittance vouchers.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border/70 shadow-xs bg-orange-600/5 border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-black text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-4.5 w-4.5" /> Authentication
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-3">
                    <p className="text-muted-foreground">You are authenticated as:</p>
                    <div className="p-3 bg-card border rounded-lg">
                      <p className="font-bold text-foreground truncate">{user.displayName || 'Grefas Applicant'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Your submissions will automatically link to your personal account.</p>
                    <Button
                      onClick={handleLogout}
                      variant="outline"
                      className="w-full text-xs font-bold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-9 rounded-lg"
                    >
                      <LogOut className="h-4 w-4 mr-1.5" /> Disconnect / Log Out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Application Form */}
            <div className="lg:col-span-2">
              <Card className="border/70 shadow-md">
                <CardHeader className="border-b bg-muted/10 pb-4">
                  <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-orange-600" /> Professional Application Form
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Please provide accurate professional, contact, and bank details for swift screening.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    
                    {/* Basic Info */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-black text-orange-600 uppercase tracking-wider border-b pb-1">1. Contact & Identity Credentials</h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Full Legal Name</label>
                          <Input 
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="e.g. Linda Serwaah"
                            required
                            className="h-9 text-xs rounded-lg"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Date of Birth</label>
                          <Input 
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            required
                            className="h-9 text-xs rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Primary Contact Phone</label>
                          <Input 
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                            placeholder="e.g. +233 24 123 4567"
                            required
                            className="h-9 text-xs rounded-lg"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">WhatsApp Number</label>
                          <Input 
                            value={whatsappNumber}
                            onChange={(e) => setWhatsappNumber(e.target.value)}
                            placeholder="e.g. +233 24 123 4567"
                            required
                            className="h-9 text-xs rounded-lg"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Email Address</label>
                          <Input 
                            type="email"
                            value={emailAddress}
                            onChange={(e) => setEmailAddress(e.target.value)}
                            placeholder="e.g. user@domain.com"
                            required
                            className="h-9 text-xs rounded-lg animate-fade"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Residential / Mailing Address</label>
                          <Input 
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="e.g. Nyinahin Close, Kumasi"
                            required
                            className="h-9 text-xs rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Work / Creative Specs */}
                    <div className="space-y-4 pt-2">
                      <h3 className="text-xs font-black text-orange-600 uppercase tracking-wider border-b pb-1">2. Role Profile & Portfolio</h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1.5 col-span-1 sm:col-span-3">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Role(s) Applied For (Select all that apply)</label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-1">
                            {availableRoles.map((role) => {
                              const isChecked = roleTypes.includes(role);
                              return (
                                <label 
                                  key={role} 
                                  className={`flex items-center space-x-2 p-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all ${
                                    isChecked 
                                      ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:bg-orange-950/20' 
                                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setRoleTypes(roleTypes.filter(r => r !== role));
                                      } else {
                                        setRoleTypes([...roleTypes, role]);
                                      }
                                    }}
                                    className="accent-orange-600 h-3.5 w-3.5 rounded shrink-0 cursor-pointer"
                                  />
                                  <span className="truncate">{role}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Experience Level</label>
                          <select
                            value={experienceLevel}
                            onChange={(e) => setExperienceLevel(e.target.value)}
                            className="w-full bg-background border border-border text-xs rounded-lg h-9 px-3 font-semibold focus:border-orange-500 text-foreground"
                          >
                            <option value="Beginner">Beginner (1-2 Projects)</option>
                            <option value="Intermediate">Intermediate (3-5 Projects)</option>
                            <option value="Professional">Professional (5+ Projects)</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Availability Status</label>
                          <select
                            value={availability}
                            onChange={(e) => setAvailability(e.target.value)}
                            className="w-full bg-background border border-border text-xs rounded-lg h-9 px-3 font-semibold focus:border-orange-500 text-foreground"
                          >
                            <option value="Full-time">Full-time Production</option>
                            <option value="Part-time">Part-time Production</option>
                            <option value="Weekend-only">Weekend-only Production</option>
                            <option value="Contract-based">Contract-based</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block flex items-center gap-1">
                          <LinkIcon className="h-3 w-3" /> Portfolio Website / Video Reel URL
                        </label>
                        <Input 
                          value={portfolioLink}
                          onChange={(e) => setPortfolioLink(e.target.value)}
                          placeholder="e.g. https://youtube.com/my-portfolio or Google Drive link"
                          className="h-9 text-xs rounded-lg"
                        />
                        <p className="text-[9px] text-muted-foreground italic">💡 Link to your auditions, clips, script files, or video reels.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Short Bio & Achievements</label>
                        <Textarea 
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Describe your skills, previous shoots, acting credentials, or technical capabilities..."
                          className="text-xs rounded-lg h-24 resize-none"
                        />
                      </div>
                    </div>

                    {/* Legal Declaration */}
                    <div className="space-y-4 pt-2">
                      <h3 className="text-xs font-black text-orange-600 uppercase tracking-wider border-b pb-1">3. Declaration & Acceptance</h3>
                      
                      <div className="p-3 bg-muted/30 border border-muted-foreground/10 rounded-xl space-y-2 text-[11px] text-muted-foreground leading-relaxed">
                        <p>I hereby certify that all statements made in this professional profile are true, complete, and correct to the best of my knowledge. I understand that any false declarations or misrepresentations will lead to immediate cancellation of my candidacy or engagement stubs with Grefas Consult & Entertainment.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Digital Signature (Type Full Name to Confirm)</label>
                        <Input 
                          value={signature}
                          onChange={(e) => setSignature(e.target.value)}
                          placeholder="e.g. Linda Serwaah"
                          required
                          className="h-9 text-xs rounded-lg font-serif italic font-bold"
                        />
                      </div>
                    </div>

                    <div className="border-t pt-4 flex justify-end">
                      <Button
                        id="btn-submit-career-application"
                        type="submit"
                        disabled={submitting}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-10 px-8 rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Registering Application...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" /> Submit Career Profile
                          </>
                        )}
                      </Button>
                    </div>

                  </form>
                </CardContent>
              </Card>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
