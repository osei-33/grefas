import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { auth, db } from '@/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  GoogleAuthProvider, 
  signInWithPopup, 
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, User, Phone, CheckCircle, AlertCircle } from 'lucide-react';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'signin' | 'signup';
}

export default function AuthDialog({ isOpen, onClose, defaultMode = 'signin' }: AuthDialogProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      // Reset fields
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setPhone('');
    }
  }, [isOpen, defaultMode]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        const user = result.user;
        const isAdminEmail = ["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"].includes(user.email || "");
        
        // Save user profile to Firestore database
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          fullName: user.displayName || 'Grefas Client',
          phone: user.phoneNumber || '',
          role: isAdminEmail ? 'admin' : 'guest',
          updatedAt: serverTimestamp()
        }, { merge: true });

        toast.success(`Welcome to Grefas, ${user.displayName || 'Client'}!`);
        onClose();
      }
    } catch (error: any) {
      console.error("Google login failure:", error);
      toast.error(error.message || "Failed to authenticate via Google. Try registering with email instead!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email address.");
      return;
    }

    if (mode === 'forgot') {
      setIsLoading(true);
      try {
        await sendPasswordResetEmail(auth, email.trim());
        toast.success("Password reset email sent successfully! Please check your spam or inbox.");
        setMode('signin');
      } catch (error: any) {
        console.error("Password reset error:", error);
        toast.error(error.message || "Failed to dispatch password reset link.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!password) {
      toast.error("Please enter your account password.");
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        toast.error("Please enter your full name.");
        return;
      }
      if (!phone.trim()) {
        toast.error("Please enter your phone number.");
        return;
      }
      if (password.length < 6) {
        toast.error("Security warning: Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Validation error: Passwords do not match.");
        return;
      }

      setIsLoading(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (cred.user) {
          await updateProfile(cred.user, {
            displayName: fullName.trim()
          });

          const isAdminEmail = ["serwaahlinda1995@gmail.com", "asantegrice@gmail.com", "asantegrifice@gmail.com", "oseikwameemmanuel33@gmail.com"].includes(email.trim().toLowerCase());

          // Save user details securely inside Firestore
          await setDoc(doc(db, 'users', cred.user.uid), {
            email: email.trim().toLowerCase(),
            fullName: fullName.trim(),
            phone: phone.trim(),
            role: isAdminEmail ? 'admin' : 'guest',
            createdAt: serverTimestamp()
          }, { merge: true });

          toast.success("Account registered successfully! Welcome to Grefas.");
          onClose();
        }
      } catch (error: any) {
        console.error("Sign up failure:", error);
        let msg = error.message || "Could not register your profile. Please try again.";
        if (error.code === 'auth/email-already-in-use') {
          msg = "This email is already registered. Try logging in instead!";
        } else if (error.code === 'auth/invalid-email') {
          msg = "The email address is invalid.";
        }
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    } else {
      // Sign In Flow
      setIsLoading(true);
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        toast.success("Successfully logged in! Access granted.");
        onClose();
      } catch (error: any) {
        console.error("Sign in failure:", error);
        let msg = "Invalid email or password. Please try again.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          msg = "Incorrect email address or password.";
        }
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl p-0 overflow-hidden rounded-2xl animate-in fade-in duration-200">
        <DialogHeader className="p-6 pb-4 bg-orange-600 text-white relative">
          <DialogTitle className="text-2xl font-black tracking-tight uppercase">
            {mode === 'signin' && "Client Portal Sign In"}
            {mode === 'signup' && "Create Client Account"}
            {mode === 'forgot' && "Reset Security Password"}
          </DialogTitle>
          <DialogDescription className="text-orange-100 mt-1 text-xs font-semibold leading-normal">
            {mode === 'signin' && "Access your career applications, check scheduled appointments, and manage consultations."}
            {mode === 'signup' && "Register once using any active email account to sync contracts, schedules, and career portfolios."}
            {mode === 'forgot' && "Provide your email address to receive a secure password restoration link."}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-5 bg-card">
          <form onSubmit={handleAuthAction} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pl-9 h-11 rounded-xl bg-muted/40 border-border/80 focus:ring-orange-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      type="tel"
                      placeholder="+233 123 456 789"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pl-9 h-11 rounded-xl bg-muted/40 border-border/80 focus:ring-orange-500/20"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                <Input
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  className="pl-9 h-11 rounded-xl bg-muted/40 border-border/80 focus:ring-orange-500/20"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Password</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[10px] font-black text-orange-600 hover:underline tracking-normal uppercase cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="pl-9 h-11 rounded-xl bg-muted/40 border-border/80 focus:ring-orange-500/20"
                  />
                </div>
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="pl-9 h-11 rounded-xl bg-muted/40 border-border/80 focus:ring-orange-500/20"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-extrabold h-11 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-orange-650/10 cursor-pointer mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Auth Request...</span>
                </>
              ) : (
                <>
                  <span>
                    {mode === 'signin' && "Sign In with Email"}
                    {mode === 'signup' && "Create Account & Sign In"}
                    {mode === 'forgot' && "Send Reset Link"}
                  </span>
                </>
              )}
            </Button>
          </form>

          {mode !== 'forgot' && (
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-border/50"></div>
              <span className="flex-shrink mx-4 text-[9px] font-black text-muted-foreground uppercase tracking-widest">or continue with</span>
              <div className="flex-grow border-t border-border/50"></div>
            </div>
          )}

          {mode !== 'forgot' && (
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full border-border/80 hover:bg-muted font-extrabold h-11 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer text-foreground"
            >
              <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              <span>Authenticate with Google</span>
            </Button>
          )}

          <div className="pt-2 text-center text-xs font-bold text-muted-foreground border-t border-border/40">
            {mode === 'signin' && (
              <p>
                New client to Grefas?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="text-orange-600 hover:underline cursor-pointer font-extrabold"
                >
                  Register Here
                </button>
              </p>
            )}
            {mode === 'signup' && (
              <p>
                Already have an email account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-orange-600 hover:underline cursor-pointer font-extrabold"
                >
                  Sign In
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-orange-600 hover:underline cursor-pointer font-extrabold"
              >
                Back to Sign In
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
