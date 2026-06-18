import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, Calendar, AlertCircle, Hourglass } from 'lucide-react';

interface AppointmentCountdownProps {
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM
  title?: string;
  theme?: 'dark' | 'light' | 'orange';
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  totalMs: number;
}

export default function AppointmentCountdown({ 
  dateStr, 
  timeStr, 
  title = "Time Remaining Until Appointment",
  theme = "orange"
}: AppointmentCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeRemaining | null>(null);

  useEffect(() => {
    const parseAppointmentDateTime = (): Date | null => {
      try {
        if (!dateStr || !timeStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
          return null;
        }
        
        // Return browser localized date representing the appointment hour
        return new Date(year, month - 1, day, hours, minutes, 0, 0);
      } catch (e) {
        return null;
      }
    };

    const targetDate = parseAppointmentDateTime();
    if (!targetDate) return;

    const calculateTime = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();
      
      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPast: true,
          totalMs: difference
        });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 65)) % 24);
      // Real clock minutes calculate accurately:
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({
        days,
        hours,
        minutes,
        seconds,
        isPast: false,
        totalMs: difference
      });
    };

    // Calculate immediately and establish a high-precision interval
    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [dateStr, timeStr]);

  if (!timeLeft) return null;

  // Let's configure custom styles based on the theme prop
  const cardThemes = {
    dark: 'bg-zinc-950 border-zinc-800 text-white',
    light: 'bg-white border-zinc-200 text-zinc-900 shadow-md',
    orange: 'bg-gradient-to-br from-orange-500/10 via-amber-500/[0.04] to-transparent border-orange-500/20 text-foreground'
  };

  const badgeThemes = {
    dark: 'bg-zinc-900 border-zinc-800 text-zinc-300',
    light: 'bg-zinc-100 border-zinc-200 text-zinc-700',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400'
  };

  const numberThemes = {
    dark: 'text-white bg-zinc-900 border-zinc-800',
    light: 'text-orange-600 bg-orange-600/5 border-orange-200',
    orange: 'text-orange-600 dark:text-orange-500 bg-orange-600/10 dark:bg-orange-600/5 border-orange-500/10'
  };

  // If the appointment date/time is past
  if (timeLeft.isPast) {
    const isRecentlyPast = Math.abs(timeLeft.totalMs) < 2 * 60 * 60 * 1000; // within 2 hours

    return (
      <div className={`p-5 rounded-2xl border ${cardThemes[theme]} flex items-center justify-between gap-4 transition-all duration-300 w-full`}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl">
            <Clock className="h-6 w-6 text-orange-600 dark:text-orange-500 animate-pulse" />
          </div>
          <div className="text-left">
            <h5 className="text-xs font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
              {isRecentlyPast ? "Live Appointment" : "Appointment Concluded"}
            </h5>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed font-bold">
              {isRecentlyPast 
                ? "Your reserved window is currently ongoing. Please proceed to check-in or join."
                : `This scheduled slot was set on ${dateStr} at ${timeStr}.`}
            </p>
          </div>
        </div>
        <div className={`shrink-0 px-3 py-1.5 rounded-lg border text-[11px] font-extrabold uppercase tracking-widest ${badgeThemes[theme]}`}>
          {isRecentlyPast ? "Happening Now" : "Archived Slot"}
        </div>
      </div>
    );
  }

  // Format single numeric metrics with a padded leading zero
  const padUrlValue = (num: number) => String(num).padStart(2, '0');

  return (
    <div className={`p-6 rounded-2xl border ${cardThemes[theme]} transition-all duration-300 w-full relative overflow-hidden`}>
      <div className="absolute top-0 right-0 h-24 w-24 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Hourglass className="h-4.5 w-4.5 text-orange-500 animate-spin animate-duration-[4000ms]" />
          <h5 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
            {title}
          </h5>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${badgeThemes[theme]}`}>
          <Calendar className="h-3 w-3" />
          {dateStr} @ {timeStr}
        </div>
      </div>

      {/* Grid containing Days, Hours, Minutes, Seconds */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 my-2 text-center">
        {/* Days Box */}
        <div className="flex flex-col">
          <div className={`py-3 px-1 sm:px-2 rounded-xl border text-xl sm:text-2xl font-black font-mono tracking-tight transition-all relative ${numberThemes[theme]}`}>
            {padUrlValue(timeLeft.days)}
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground/75 font-semibold mt-1 uppercase tracking-wider">Days</span>
        </div>

        {/* Hours Box */}
        <div className="flex flex-col">
          <div className={`py-3 px-1 sm:px-2 rounded-xl border text-xl sm:text-2xl font-black font-mono tracking-tight transition-all relative ${numberThemes[theme]}`}>
            {padUrlValue(timeLeft.hours)}
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground/75 font-semibold mt-1 uppercase tracking-wider">Hours</span>
        </div>

        {/* Minutes Box */}
        <div className="flex flex-col">
          <div className={`py-3 px-1 sm:px-2 rounded-xl border text-xl sm:text-2xl font-black font-mono tracking-tight transition-all relative ${numberThemes[theme]}`}>
            {padUrlValue(timeLeft.minutes)}
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground/75 font-semibold mt-1 uppercase tracking-wider">Mins</span>
        </div>

        {/* Seconds Box */}
        <div className="flex flex-col">
          <div className={`py-3 px-1 sm:px-2 rounded-xl border text-xl sm:text-2xl font-black font-mono tracking-tight transition-all text-orange-600 dark:text-orange-500 relative ${numberThemes[theme]}`}>
            <motion.span
              key={timeLeft.seconds}
              initial={{ opacity: 0.3, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25 }}
            >
              {padUrlValue(timeLeft.seconds)}
            </motion.span>
          </div>
          <span className="text-[10px] sm:text-xs text-orange-600 dark:text-orange-500 font-bold mt-1 uppercase tracking-wider">Secs</span>
        </div>
      </div>
    </div>
  );
}
