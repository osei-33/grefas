import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  User, 
  Calendar, 
  Video, 
  Sparkles,
  ArrowRight,
  ClipboardCheck,
  Smartphone,
  Info,
  ChevronRight,
  Printer,
  MousePointer
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type Tab = 'registration' | 'booking';

interface Chapter {
  id: number;
  title: string;
  startTime: number;
  endTime: number;
}

export default function InteractiveGuide() {
  const [activeTab, setActiveTab] = useState<Tab>('registration');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1);
  const [touchState, setTouchState] = useState<string>(''); // For logs / details

  // Interval timer for the "video animation"
  const maxTime = 20; // 20 second tutorial
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Chapters definition
  const registrationChapters: Chapter[] = [
    { id: 1, title: 'Personal Biodata', startTime: 0, endTime: 7.5 },
    { id: 2, title: 'Casting & Roles', startTime: 7.5, endTime: 15.5 },
    { id: 3, title: 'Receipt & Success', startTime: 15.5, endTime: 20 },
  ];

  const bookingChapters: Chapter[] = [
    { id: 1, title: 'Date & Time Selection', startTime: 0, endTime: 6.5 },
    { id: 2, title: 'Professional Details', startTime: 6.5, endTime: 13.5 },
    { id: 3, title: 'Confirmation Invoice', startTime: 13.5, endTime: 20 },
  ];

  const chapters = activeTab === 'registration' ? registrationChapters : bookingChapters;

  // Track the current active chapter based on time
  const currentChapter = chapters.find(
    ch => currentTime >= ch.startTime && currentTime <= ch.endTime
  ) || chapters[0];

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = 100 / speed; // step every 100ms
      timerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= maxTime) {
            return 0; // Loop or stop
          }
          return Math.min(maxTime, Math.round((prev + 0.1) * 10) / 10);
        });
      }, intervalMs);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isPlaying, speed, activeTab]);

  // Restart the animation simulation
  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Skip code to direct timestamp
  const seekTo = (seconds: number) => {
    setCurrentTime(seconds);
  };

  // Helper function to animate text typing based on timeline offset
  const getTypedText = (fullText: string, elapsed: number, duration: number) => {
    if (elapsed <= 0) return '';
    if (elapsed >= duration) return fullText;
    const ratio = elapsed / duration;
    const len = Math.floor(fullText.length * ratio);
    return fullText.substring(0, len);
  };

  // Derived state calculations for simulated inputs (Registration)
  const regState = {
    // Phase 1: Biodata (0s - 7.5s)
    name: getTypedText('Abena Mensah', currentTime - 1.5, 2.0), // Starts at 1.5s, types for 2s
    whatsapp: getTypedText('0244123456', currentTime - 3.8, 1.8), // Starts at 3.8s, types for 1.8s
    location: getTypedText('Kumasi, Ashanti', currentTime - 5.8, 1.2), // Starts at 5.8s, types for 1.2s
    step1Done: currentTime >= 7.5,

    // Phase 2: Casting details (7.5s - 15.5s)
    role: currentTime >= 9.5 ? 'Lead Actor / Actress' : '',
    experience: currentTime >= 10.5 ? 'Intermediate' : 'Beginner', 
    bio: getTypedText(
      'Passionate storyteller ready for movies, theatrical plays & corporate entertainment projects.',
      currentTime - 11.2,
      3.2
    ), // Starts at 11.2s, types for 3.2s
    genresSelected: currentTime >= 14.8,
    submitted: currentTime >= 15.5,
  };

  // Derived state calculations for simulated inputs (Booking)
  const bookState = {
    // Phase 1: Calendar Select (0s - 6.5s)
    dateSelected: currentTime >= 2.2,
    timeSelected: currentTime >= 4.0,
    step1Done: currentTime >= 6.5,

    // Phase 2: User details (6.5s - 13.5s)
    name: getTypedText('Abena Mensah', currentTime - 7.2, 1.8), // types for 1.8s
    email: getTypedText('abena@grefas.com', currentTime - 9.2, 2.2), // types for 2.2s
    specialist: currentTime >= 11.8 ? 'Richmond Grefas (Chief Executive)' : '',
    step2Done: currentTime >= 13.5,

    // Phase 3: Final submission
    confirmed: currentTime >= 16.5,
  };

  // Floating Virtual Cursor coordinates mapping depending on timeline
  const getCursorCoordinates = () => {
    if (activeTab === 'registration') {
      // 0s - 1.5s: Hovering "Start Demo Learn Guide"
      if (currentTime < 1.5) {
        return { x: '50%', y: '85%', clicked: false };
      }
      // 1.5s - 3.5s: Typing Name Input
      if (currentTime >= 1.5 && currentTime < 3.5) {
        return { x: '35%', y: '28%', clicked: true };
      }
      // 3.5s - 5.5s: Typing WhatsApp input
      if (currentTime >= 3.5 && currentTime < 5.5) {
        return { x: '35%', y: '48%', clicked: true };
      }
      // 5.5s - 7.0s: Typing Residential Address
      if (currentTime >= 5.5 && currentTime < 7.0) {
        return { x: '35%', y: '68%', clicked: true };
      }
      // 7.0s - 7.5s: Moving to "Continue to Casting" button and clicking
      if (currentTime >= 7.0 && currentTime < 7.5) {
        return { x: '78%', y: '88%', clicked: currentTime >= 7.3 };
      }
      // 7.5s - 9.5s: Rest in Step 2, moving to Role dropdown
      if (currentTime >= 7.5 && currentTime < 9.5) {
        return { x: '35%', y: '24%', clicked: false };
      }
      // 9.5s - 10.5s: Selecting Role dropdown
      if (currentTime >= 9.5 && currentTime < 10.5) {
        return { x: '35%', y: '26%', clicked: true };
      }
      // 10.5s - 11.2s: Selecting Experience level
      if (currentTime >= 10.5 && currentTime < 11.2) {
        return { x: '75%', y: '26%', clicked: true };
      }
      // 11.2s - 14.5s: Typing Bio/Pitch
      if (currentTime >= 11.2 && currentTime < 14.5) {
        return { x: '45%', y: '50%', clicked: true };
      }
      // 14.5s - 15.5s: Clicking genres / Submit button
      if (currentTime >= 14.5 && currentTime < 15.5) {
        return { x: '82%', y: '88%', clicked: currentTime >= 15.2 };
      }
      // 15.5s - 20s: Fulfilling & Hovering over "Print Registry Card"
      return { x: '50%', y: '78%', clicked: false };
    } else {
      // BOOKING TAB CURSORS
      // 0s - 2.2s: Clicking Date 24 on Calendar
      if (currentTime < 2.2) {
        return { x: '68%', y: '32%', clicked: currentTime >= 1.8 };
      }
      // 2.2s - 4.0s: Select 10:00 AM Time Slot
      if (currentTime >= 2.2 && currentTime < 4.0) {
        return { x: '58%', y: '58%', clicked: currentTime >= 3.6 };
      }
      // 4.0s - 6.5s: Clicking "Continue" button
      if (currentTime >= 4.0 && currentTime < 6.5) {
        return { x: '72%', y: '86%', clicked: currentTime >= 6.0 };
      }
      // 6.5s - 9.0s: Typing booking name
      if (currentTime >= 6.5 && currentTime < 9.0) {
        return { x: '35%', y: '26%', clicked: true };
      }
      // 9.0s - 11.5s: Typing booking email
      if (currentTime >= 9.0 && currentTime < 11.5) {
        return { x: '35%', y: '46%', clicked: true };
      }
      // 11.5s - 13.5s: Click specialist & Continue to Step 3
      if (currentTime >= 11.5 && currentTime < 13.5) {
        return { x: '78%', y: '88%', clicked: currentTime >= 13.0 };
      }
      // 13.5s - 16.5s: Hovering over "Confirm Booking" on summary page
      if (currentTime >= 13.5 && currentTime < 16.5) {
        return { x: '50%', y: '75%', clicked: currentTime >= 16.0 };
      }
      // 16.5s - 20s: Hovering over Completed success modal / Print receipt
      return { x: '50%', y: '82%', clicked: false };
    }
  };

  const cursor = getCursorCoordinates();

  return (
    <div id="interactive-guide" className="w-full bg-zinc-950 text-white rounded-3xl p-6 md:p-10 border border-zinc-800 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-zinc-800">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-600/20 text-orange-500 rounded-full text-xs font-bold tracking-wider uppercase mb-3">
            <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Interactive Visual Walkthrough
          </span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase">
            Learn How Grefas Works <span className="text-orange-600">Instantly</span>
          </h2>
          <p className="text-zinc-400 mt-2 text-sm max-w-2xl">
            Watch our automated simulator explain step-by-step how to fill and submit our casting hub registration and book counseling sessions seamlessly.
          </p>
        </div>

        {/* Tab Toggle Control */}
        <div className="flex p-1 bg-zinc-900 rounded-xl border border-zinc-800 self-start md:self-center">
          <button
            onClick={() => {
              setActiveTab('registration');
              setCurrentTime(0);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold tracking-wider transition-all duration-300 ${
              activeTab === 'registration'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ClipboardCheck className="h-4 w-4" /> Production Registry Hub
          </button>
          <button
            onClick={() => {
              setActiveTab('booking');
              setCurrentTime(0);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs md:text-sm font-semibold tracking-wider transition-all duration-300 ${
              activeTab === 'booking'
                ? 'bg-orange-600 text-white shadow-lg'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4" /> Consulting Booking
          </button>
        </div>
      </div>

      {/* Grid: Simulator Player Box + Sidebar Step Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        
        {/* Left Column: Interactive Screen Video Simulator */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Mockup Browser Window Wrapper */}
          <div className="w-full aspect-[16/10] bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden flex flex-col shadow-inner relative select-none">
            
            {/* Top Bar (Browser styling) */}
            <div className="bg-zinc-950 px-4 py-3 flex items-center justify-between border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 block" />
                <span className="w-3 h-3 rounded-full bg-green-500/80 block" />
              </div>
              
              {/* Domain bar */}
              <div className="bg-zinc-900 border border-zinc-800 px-6 py-1 rounded-md text-[10px] md:text-xs font-mono text-zinc-500 truncate w-1/2 text-center select-all">
                grefas.com/{activeTab === 'registration' ? 'services#production-hub' : 'booking'}
              </div>

              {/* Live Signal Indicator */}
              <div className="flex items-center gap-1.5 bg-orange-600/15 py-0.5 px-2 rounded-full border border-orange-500/30">
                <span className="w-2 h-2 rounded-full bg-orange-600 animate-ping" />
                <span className="text-[9px] font-mono uppercase font-bold text-orange-400 tracking-wider">LIVE DEMO</span>
              </div>
            </div>

            {/* Inner Dashboard screen (Simulated Web App) */}
            <div className="flex-1 bg-zinc-900 relative p-4 overflow-hidden flex flex-col justify-between text-zinc-200">
              
              {/* Virtual Cursor Mouse */}
              <motion.div 
                className="absolute z-50 pointer-events-none drop-shadow-lg"
                animate={{
                  left: cursor.x,
                  top: cursor.y,
                  scale: cursor.clicked ? 0.85 : 1
                }}
                transition={{
                  type: 'spring',
                  stiffness: 120,
                  damping: 18,
                  mass: 0.6
                }}
              >
                <div className="relative">
                  {/* cursor arrow */}
                  <MousePointer className="h-6 w-6 text-orange-500 fill-orange-500 drop-shadow-md" />
                  
                  {/* Click Ripple Indicator */}
                  {cursor.clicked && (
                    <span className="absolute top-0 left-0 w-8 h-8 -translate-x-2 -translate-y-2 rounded-full bg-orange-500/40 border border-orange-500 animate-ping block" style={{ animationDuration: '0.6s' }} />
                  )}
                </div>
              </motion.div>

              {/* Interactive Screens depend on Active Tab */}
              <AnimatePresence mode="wait">
                {activeTab === 'registration' ? (
                  // REGISTRATION FLOW
                  <div className="flex-1 flex flex-col h-full pr-1">
                    
                    {/* Scene 1: Step 1 (Time 0s to 7.5s) */}
                    {currentTime < 7.5 && (
                      <motion.div 
                        key="reg-step1"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex-1 flex flex-col gap-3 justify-center max-w-lg mx-auto w-full my-auto"
                      >
                        <div className="border-b border-zinc-800 pb-2">
                          <h4 className="text-xs font-mono text-orange-500 font-bold uppercase">Step 1 of 2: Candidate Demographics</h4>
                          <p className="text-[10px] text-zinc-400">Fill in your basic communication channels & credentials</p>
                        </div>

                        {/* Input 1 */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Legal / Screen Name</label>
                          <div className={`h-8 rounded-lg bg-zinc-950 flex items-center px-3 border border-zinc-800 text-xs font-mono relative overflow-hidden ${currentTime >= 1.5 && currentTime < 3.5 ? 'ring-2 ring-orange-600/50 border-orange-600' : ''}`}>
                            <span>{regState.name}</span>
                            {currentTime >= 1.5 && currentTime < 3.5 && (
                              <span className="w-1.5 h-4 bg-orange-500 ml-1 animate-pulse" />
                            )}
                          </div>
                        </div>

                        {/* Input 2 */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">WhatsApp Dial Number</label>
                          <div className={`h-8 rounded-lg bg-zinc-950 flex items-center px-3 border border-zinc-800 text-xs font-mono relative overflow-hidden ${currentTime >= 3.5 && currentTime < 5.5 ? 'ring-2 ring-orange-600/50 border-orange-600' : ''}`}>
                            <span className="text-zinc-500">+233 </span>
                            <span className="ml-1">{regState.whatsapp}</span>
                            {currentTime >= 3.5 && currentTime < 5.5 && (
                              <span className="w-1.5 h-4 bg-orange-500 ml-1 animate-pulse" />
                            )}
                          </div>
                        </div>

                        {/* Input 3 */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Residential Location (Ghana)</label>
                          <div className={`h-8 rounded-lg bg-zinc-950 flex items-center px-3 border border-zinc-800 text-xs font-mono relative overflow-hidden ${currentTime >= 5.5 && currentTime < 7.0 ? 'ring-2 ring-orange-600/50 border-orange-600' : ''}`}>
                            <span>{regState.location}</span>
                            {currentTime >= 5.5 && currentTime < 7.0 && (
                              <span className="w-1.5 h-4 bg-orange-500 ml-1 animate-pulse" />
                            )}
                          </div>
                        </div>

                        {/* Step action buttons */}
                        <div className="flex justify-end pt-2">
                          <Button 
                            size="sm" 
                            className={`h-8 bg-zinc-800 text-white hover:bg-zinc-700 pointer-events-none text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${currentTime >= 7.0 && currentTime < 7.5 ? 'bg-orange-600 text-white scale-105' : ''}`}
                          >
                            Continue to Casting <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Scene 2: Step 2 (Time 7.5s to 15.5s) */}
                    {currentTime >= 7.5 && currentTime < 15.5 && (
                      <motion.div 
                        key="reg-step2"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex-1 flex flex-col gap-3 justify-center max-w-lg mx-auto w-full my-auto"
                      >
                        <div className="border-b border-zinc-800 pb-2">
                          <h4 className="text-xs font-mono text-orange-500 font-bold uppercase">Step 2 of 2: Casting & Crew Selection</h4>
                          <p className="text-[10px] text-zinc-400">Specify your artistic role, bio details & film genres</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Prescribed Film Role</label>
                            <div className={`h-8 rounded-lg bg-zinc-950 flex items-center px-3 border border-zinc-800 text-[11px] font-mono relative overflow-hidden ${currentTime >= 7.5 && currentTime < 10.5 ? 'ring-2 ring-orange-600/50 border-orange-600' : ''}`}>
                              <span className={regState.role ? 'text-white' : 'text-zinc-500'}>
                                {regState.role || 'Select Role...'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Experience Level</label>
                            <div className={`h-8 rounded-lg bg-zinc-950 flex items-center px-3 border border-zinc-800 text-[11px] font-mono relative overflow-hidden ${currentTime >= 10.5 && currentTime < 11.2 ? 'ring-2 ring-orange-600/50 border-orange-600' : ''}`}>
                              <span className="text-white">{regState.experience}</span>
                            </div>
                          </div>
                        </div>

                        {/* Bio Field */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Short Talent Pitch (Bio)</label>
                          <div className={`h-14 rounded-lg bg-zinc-950 p-2 border border-zinc-800 text-[10px] font-mono leading-tight flex flex-col relative overflow-hidden ${currentTime >= 11.2 && currentTime < 14.5 ? 'ring-2 ring-orange-600/50 border-orange-600' : ''}`}>
                            <span className="flex-1">{regState.bio}</span>
                            {currentTime >= 11.2 && currentTime < 14.5 && (
                              <span className="w-1.5 h-3 bg-orange-500 inline-block animate-pulse shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Preferred Genres checkboxes */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Selected Skit & Movie Genres</label>
                          <div className="grid grid-cols-3 gap-2 py-1">
                            {['Comedy', 'Drama', 'Action'].map((g, i) => {
                              const checked = regState.genresSelected || (i === 0 && currentTime >= 13.0) || (i === 1 && currentTime >= 14.0);
                              return (
                                <div key={g} className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-all duration-300 ${checked ? 'border-orange-500 bg-orange-600/10 text-orange-400' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>
                                  <input type="checkbox" checked={checked} readOnly className="h-3 w-3 accent-orange-600 pointer-events-none" />
                                  <span>{g}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Submit Action Block */}
                        <div className="flex justify-between items-center pt-1">
                          <button className="text-[10px] text-zinc-500 underline pointer-events-none">Back</button>
                          <Button 
                            size="sm" 
                            className={`h-8 bg-zinc-800 text-white hover:bg-zinc-700 pointer-events-none text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 ${currentTime >= 14.8 ? 'bg-orange-600 text-white scale-105' : ''}`}
                          >
                            Submit Registration Profile <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Scene 3: Success Recipent (Time 15.5s to 20s) */}
                    {currentTime >= 15.5 && (
                      <motion.div 
                        key="reg-step3"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center text-center my-auto px-4"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500 flex items-center justify-center mb-2">
                          <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">Casting Intake Complete!</h4>
                        <p className="text-[10px] text-emerald-500 font-mono">Registration Record ID: #GREF-CAST-098</p>

                        {/* Render miniature filled card */}
                        <div className="w-full max-w-sm mt-3 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-left font-mono relative text-[9px] shadow-lg leading-tight">
                          <div className="border-b border-zinc-800 pb-1.5 mb-1.5 flex justify-between items-center">
                            <span className="font-bold text-orange-500 text-[10px]">GREFAS ENTERTAINMENT</span>
                            <span className="text-zinc-600">Ashanti, GH</span>
                          </div>
                          <p className="font-bold uppercase text-[10px] pb-1 text-white border-b border-zinc-900 mb-1.5">INTAKE REGISTRY CARD</p>
                          <p><span className="text-zinc-500 uppercase">Candidate:</span> Abena Mensah</p>
                          <p><span className="text-zinc-500 uppercase">Contact:</span> +233 24 123 4567</p>
                          <p><span className="text-zinc-500 uppercase">Prescribed Role:</span> Lead Actor / Actress</p>
                          <p><span className="text-zinc-500 uppercase">Availability:</span> Contract / Series Call</p>
                          <div className="mt-2 text-center text-[7px] border-t border-zinc-800 pt-1 text-zinc-500">
                            Authorized Stamp Logged
                          </div>
                        </div>

                        {/* Print triggering highlight button */}
                        <div className="mt-4 flex gap-2">
                          <Button 
                            size="sm" 
                            className={`h-8 pointer-events-none text-[9px] font-bold uppercase flex items-center bg-orange-600 hover:bg-orange-700 text-white ${currentTime >= 17.5 ? 'ring-4 ring-orange-500/40 scale-105' : ''}`}
                          >
                            <Printer className="h-3.5 w-3.5 mr-1" /> Print Signed PDF Card
                          </Button>
                          <Button 
                            variant="outline"
                            size="sm" 
                            className="h-8 pointer-events-none text-[9px] border-zinc-800 text-zinc-300 uppercase"
                          >
                            Log Out
                          </Button>
                        </div>
                      </motion.div>
                    )}

                  </div>
                ) : (
                  // BOOKING FLOW
                  <div className="flex-1 flex flex-col h-full pr-1">
                    
                    {/* Scene 1: Step 1 (Calendar Select (0s to 6.5s) */}
                    {currentTime < 6.5 && (
                      <motion.div 
                        key="book-step1"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex-1 flex flex-col gap-2 justify-center max-w-lg mx-auto w-full my-auto"
                      >
                        <div className="border-b border-zinc-800 pb-1 flex justify-between items-center">
                          <div>
                            <h4 className="text-xs font-mono text-orange-500 font-bold uppercase">Step 1 of 3: Consultation Date</h4>
                            <p className="text-[10px] text-zinc-400">Select consultation date & daily premium hour</p>
                          </div>
                          <span className="text-[9px] font-mono bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">CALENDAR</span>
                        </div>

                        {/* Miniature Calendar grid */}
                        <div className="grid grid-cols-7 gap-1 bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 text-center font-mono text-[9px]">
                          <span className="text-zinc-500 text-[8px] uppercase">Mo</span>
                          <span className="text-zinc-500 text-[8px] uppercase">Tu</span>
                          <span className="text-zinc-500 text-[8px] uppercase">We</span>
                          <span className="text-zinc-500 text-[8px] uppercase">Th</span>
                          <span className="text-zinc-500 text-[8px] uppercase">Fr</span>
                          <span className="text-zinc-500 text-[8px] uppercase">Sa</span>
                          <span className="text-zinc-500 text-[8px] uppercase">Su</span>
                          {/* Fill 1-14 blank / dummy */}
                          {Array.from({ length: 15 }).map((_, idx) => (
                            <span key={`blank-${idx}`} className="text-zinc-700 py-0.5">{(idx + 9)}</span>
                          ))}
                          {/* Target Date selection: Day 24 */}
                          <span className={`py-0.5 rounded cursor-pointer font-bold transition-all ${bookState.dateSelected ? 'bg-orange-600 text-white ring-2 ring-orange-500 scale-110' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}`}>24</span>
                          {Array.from({ length: 6 }).map((_, idx) => (
                            <span key={`after-${idx}`} className="text-zinc-500 py-0.5">{(idx + 25)}</span>
                          ))}
                        </div>

                        {/* Miniature Time selection block */}
                        {bookState.dateSelected && (
                          <motion.div 
                            initial={{ opacity: 0, y: 5 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className="space-y-1"
                          >
                            <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Available Hourly Slots</label>
                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                              <span className={`py-1 rounded text-center border transition-all ${bookState.timeSelected ? 'bg-orange-600/25 border-orange-500 text-orange-400 font-bold' : 'border-zinc-800 bg-zinc-950 text-zinc-400'}`}>10:00 AM - 11:00 AM</span>
                              <span className="py-1 rounded text-center border border-zinc-800 bg-zinc-950 text-zinc-600 line-through">02:00 PM - 03:00 PM</span>
                            </div>
                          </motion.div>
                        )}

                        <div className="flex justify-end pt-1">
                          <Button 
                            disabled={!bookState.timeSelected}
                            size="sm" 
                            className={`h-7 pointer-events-none text-[9px] font-bold tracking-wider uppercase flex items-center gap-1 ${currentTime >= 4.0 ? 'bg-orange-600 text-white scale-105' : 'bg-zinc-800 text-zinc-500'}`}
                          >
                            Continue <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Scene 2: Step 2 Contact Details (6.5s to 13.5s) */}
                    {currentTime >= 6.5 && currentTime < 13.5 && (
                      <motion.div 
                        key="book-step2"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex-1 flex flex-col gap-2.5 justify-center max-w-lg mx-auto w-full my-auto"
                      >
                        <div className="border-b border-zinc-800 pb-1.5">
                          <h4 className="text-xs font-mono text-orange-500 font-bold uppercase">Step 2 of 3: Professional Particulars</h4>
                          <p className="text-[10px] text-zinc-400">Introduce your details and choice of consultancy</p>
                        </div>

                        {/* User Booking inputs */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Your Name</label>
                          <div className={`h-8 rounded-lg bg-zinc-950 flex items-center px-3 border border-zinc-800 text-xs font-mono relative overflow-hidden ${currentTime >= 6.5 && currentTime < 9.0 ? 'ring-2 ring-orange-600/50 border-orange-600' : ''}`}>
                            <span>{bookState.name}</span>
                            {currentTime >= 6.5 && currentTime < 9.0 && (
                              <span className="w-1.5 h-4 bg-orange-500 ml-1 animate-pulse" />
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Email Address</label>
                          <div className={`h-8 rounded-lg bg-zinc-950 flex items-center px-3 border border-zinc-800 text-xs font-mono relative overflow-hidden ${currentTime >= 9.0 && currentTime < 11.5 ? 'ring-2 ring-orange-600/50 border-orange-600' : ''}`}>
                            <span>{bookState.email}</span>
                            {currentTime >= 9.0 && currentTime < 11.5 && (
                              <span className="w-1.5 h-4 bg-orange-500 ml-1 animate-pulse" />
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Consulting Partner Assigned</label>
                          <div className={`h-8 rounded-lg bg-zinc-950 flex items-center px-3 border border-zinc-800 text-[10px] font-mono relative overflow-hidden ${currentTime >= 11.5 ? 'ring-2 ring-orange-600/50 border-orange-600' : ''}`}>
                            <span className={bookState.specialist ? 'text-white' : 'text-zinc-500'}>
                              {bookState.specialist || 'Select Specialist (Optional)...'}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <button className="text-[10px] text-zinc-500 underline pointer-events-none">Back</button>
                          <Button 
                            disabled={!bookState.name}
                            size="sm" 
                            className={`h-7 pointer-events-none text-[9px] font-bold tracking-wider uppercase flex items-center gap-1 ${currentTime >= 11.8 ? 'bg-orange-600 text-white scale-105' : 'bg-zinc-800 text-zinc-500'}`}
                          >
                            Next Step <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Scene 3: Verification Panel (13.5s to 20s) */}
                    {currentTime >= 13.5 && (
                      <motion.div 
                        key="book-step3"
                        initial={{ opacity: 0, scale: 0.94 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center text-center my-auto px-4"
                      >
                        {!bookState.confirmed ? (
                          // Verification Summary
                          <div className="w-full max-w-sm flex flex-col gap-2.5">
                            <div className="border-b border-zinc-800 pb-1.5">
                              <h4 className="text-xs font-mono text-orange-500 font-bold uppercase">Step 3 of 3: Verification Summary</h4>
                              <p className="text-[9px] text-zinc-400">Check options before reserving appointment</p>
                            </div>

                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-left font-mono text-[10px] space-y-1 leading-snug">
                              <p><span className="text-zinc-500 uppercase">Consulting Area:</span> Theater & Casting Auditions</p>
                              <p><span className="text-zinc-500 uppercase">Selected Date:</span> Friday, November 24, 2026</p>
                              <p><span className="text-zinc-500 uppercase">Time Slot:</span> 10:00 AM - 11:00 AM (UTC)</p>
                              <p><span className="text-zinc-500 uppercase">Representative:</span> Richmond Grefas</p>
                              <p className="border-t border-zinc-850 pt-1 text-[9px] text-zinc-400 italic">No reservation fee is required upfront. Confirmation email will be dispatched.</p>
                            </div>

                            <Button 
                              size="sm" 
                              className={`h-8 font-bold uppercase tracking-wider mt-1 text-[10px] pointer-events-none bg-orange-600 hover:bg-orange-700 text-white ${currentTime >= 15.0 ? 'scale-105 ring-4 ring-orange-500/30' : ''}`}
                            >
                              Confirm and Book Consultation
                            </Button>
                          </div>
                        ) : (
                          // Final Success Receipt Ticket
                          <div className="flex flex-col items-center animate-bounce-slow">
                            <div className="w-10 h-10 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500 flex items-center justify-center mb-2">
                              <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <h4 className="text-sm font-black text-white uppercase tracking-wider">Casting Consultation Booked!</h4>
                            <p className="text-[10px] text-emerald-500 font-mono">Receipt Token: #GREF-BOOK-24098</p>

                            <div className="w-full max-w-xs mt-3 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-left font-mono relative text-[9px] shadow-lg leading-tight">
                              <div className="border-b border-dashed border-zinc-800 pb-1.5 mb-1.5 flex justify-between items-center bg-zinc-900 -mx-3 px-3">
                                <span className="font-bold text-orange-500">TICKET PASS</span>
                                <span className="text-zinc-500">GREF-24098</span>
                              </div>
                              <p><span className="text-zinc-500 uppercase">Holder:</span> Abena Mensah</p>
                              <p><span className="text-zinc-500 uppercase">Topic:</span> Movie Screen Audition</p>
                              <p><span className="text-zinc-500 uppercase">Schedule:</span> Nov 24 @ 10:00 AM</p>
                              <p><span className="text-zinc-500 uppercase">Adviser:</span> Richmond Grefas</p>
                              <div className="mt-2 text-center text-[7px] border-t border-dashed border-zinc-800 pt-1.5 text-orange-400 uppercase font-black tracking-wider">
                                PRESENT AT KUMASI HQ OFFICE
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                  </div>
                )}
              </AnimatePresence>

            </div>

            {/* Video Timeline Scrubber Bar */}
            <div className="bg-zinc-950 px-4 py-3 border-t border-zinc-800 flex items-center gap-4 text-xs">
              
              {/* Play / pause icon */}
              <button 
                onClick={() => setIsPlaying(!isPlaying)} 
                className="hover:text-orange-500 transition-colors p-1"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 text-orange-500" />}
              </button>

              <button 
                onClick={handleReset} 
                className="hover:text-zinc-300 text-zinc-500 transition-colors p-1"
                title="Restart"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {/* Timestamp text */}
              <span className="font-mono text-[10px] text-zinc-400 w-12 text-right select-none">
                {currentTime.toFixed(1)}s
              </span>

              {/* Scrubber slider line */}
              <div className="flex-1 relative group py-1">
                <input 
                  type="range" 
                  min="0" 
                  max={maxTime} 
                  step="0.1" 
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 accent-orange-600 rounded-lg appearance-none cursor-pointer focus:outline-none"
                />
                
                {/* Chapter segment ticks */}
                <div className="absolute top-[3px] left-0 right-0 h-1 flex justify-between pointer-events-none">
                  {chapters.map((ch, index) => (
                    <div 
                      key={ch.id} 
                      className="h-1 bg-zinc-900 border-r border-zinc-950" 
                      style={{ 
                        width: `${((ch.endTime - ch.startTime) / maxTime) * 100}%`,
                        opacity: index === chapters.length - 1 ? 0 : 1 
                      }} 
                    />
                  ))}
                </div>
              </div>

              <span className="font-mono text-[10px] text-zinc-500 select-none">
                {maxTime}s
              </span>

              {/* Speed Multipliers button */}
              <div className="flex bg-zinc-900 rounded border border-zinc-800 p-0.5">
                {[1, 1.5, 2].map(sp => (
                  <button
                    key={sp}
                    onClick={() => setSpeed(sp)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono leading-none transition-colors ${
                      speed === sp ? 'bg-orange-600/20 text-orange-400 font-bold' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Quick Informational Banner underneath */}
          <div className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-800/80 flex items-center gap-3 text-xs text-zinc-400 leading-normal">
            <Info className="h-5 w-5 text-orange-500 shrink-0" />
            <p>
              Looking for a real submission? Head over to the top right portal to register your official audition file or schedule a local counseling board time slot. This tutorial features live automatic simulated typing mimicking true candidate records!
            </p>
          </div>
        </div>

        {/* Right Column: Step Checklist Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 flex flex-col justify-between h-full">
            <div>
              <h3 className="text-lg font-black tracking-wider uppercase border-b border-zinc-800 pb-3 mb-4">
                Tutorial Chapters
              </h3>

              <div className="space-y-4">
                {chapters.map((ch) => {
                  const isActive = currentChapter.id === ch.id;
                  const isCompleted = currentTime > ch.endTime;
                  const progressRatio = isCompleted 
                    ? 1 
                    : isActive 
                      ? (currentTime - ch.startTime) / (ch.endTime - ch.startTime) 
                      : 0;

                  return (
                    <div 
                      key={ch.id} 
                      onClick={() => seekTo(ch.startTime)}
                      className={`group p-3 rounded-xl border transition-all duration-300 cursor-pointer ${
                        isActive 
                          ? 'bg-zinc-800/80 border-orange-500/60 shadow-md ring-1 ring-orange-500/20' 
                          : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-bold tracking-widest uppercase ${isActive ? 'text-orange-500' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                          0{ch.id} — {ch.startTime.toFixed(0)}s to {ch.endTime.toFixed(0)}s
                        </span>
                        {isCompleted && (
                          <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500 flex items-center justify-center text-[10px]">✓</span>
                        )}
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                        )}
                      </div>

                      <h4 className={`text-sm font-bold mt-1 uppercase ${isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                        {ch.title}
                      </h4>

                      {/* Micro Progress Line inside active chapter */}
                      <div className="w-full h-1 bg-zinc-950 rounded-full mt-2.5 overflow-hidden">
                        <motion.div 
                          className="h-full bg-orange-600 rounded-full" 
                          style={{ width: `${progressRatio * 100}%` }}
                          transition={{ ease: 'linear' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Simulated Log Feedback to add realism */}
              <div className="mt-6 border-t border-zinc-850 pt-5">
                <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 tracking-wider">Device System Log</span>
                <div className="bg-zinc-950 px-3 py-2.5 rounded-lg border border-zinc-850 text-[9px] font-mono text-zinc-500 mt-2 space-y-1 block">
                  <p className="text-zinc-400">⚡ Initialized virtual-render engine successfully.</p>
                  <p>✓ Loaded {chapters.length} tutorial scenes.</p>
                  {currentTime >= 6.5 ? (
                    <p className="text-emerald-500">✓ Detected virtual candidate submission sequence.</p>
                  ) : (
                    <p className="text-zinc-600">⌛ Simulating keystrokes on canvas inputs...</p>
                  )}
                  {currentTime >= 16.5 && (
                    <p className="text-orange-400">➜ Dispatching formatted printable PDF generation file.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick action buttons directing user can fill it instantly */}
            <div className="pt-6 border-t border-zinc-800 mt-6 gap-3 flex flex-col">
              <span className="text-[11px] text-zinc-400 text-center font-medium">Ready to submit your live application?</span>
              <Button 
                asChild
                className="w-full bg-orange-600 hover:bg-orange-700 text-white uppercase text-xs font-black tracking-wider py-5"
              >
                <a href={activeTab === 'registration' ? '/services' : '/booking'}>
                  {activeTab === 'registration' ? 'Go to Registration Hub' : 'Go to Booking Scheduler'} <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
