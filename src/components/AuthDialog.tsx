import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { auth, db } from '@/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, User, Phone } from 'lucide-react';

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
        let msg = `Could not register your profile: ${error.message || error}`;
        if (error.code === 'auth/email-already-in-use') {
          msg = "This email is already registered. Try logging in instead!";
        } else if (error.code === 'auth/invalid-email') {
          msg = "The email address is invalid.";
        } else if (error.code === 'auth/weak-password') {
          msg = "The password is too weak. Must be at least 6 characters.";
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
        let msg = `Sign-in failed: ${error.message || error}`;
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
