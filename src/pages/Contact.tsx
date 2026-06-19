import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MapPin, Send, MessageCircle, Navigation, ExternalLink, Loader2, Mic, MicOff, Square, Play, Pause, Trash2, Volume2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { doc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { showBrowserNotification } from '@/lib/utils';
import SEO from '@/components/SEO';

export default function Contact() {
  const [settings, setSettings] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Microphone and audio consultation recording hooks/states
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [voiceBase64, setVoiceBase64] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<any>(null);
  const recognitionRef = React.useRef<any>(null);

  // Playback helper
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  useEffect(() => {
    // Check Speech Recognition capability
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setMessage((prev) => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + finalTranscript);
        }
      };

      rec.onerror = (err: any) => {
        if (err.error !== 'no-speech') {
          console.warn('Speech recognition interface event warning:', err);
          setIsDictating(false);
        }
      };

      rec.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const toggleDictation = () => {
    if (!recognitionRef.current) {
      toast.error("Voice dictation speech recognition is not supported on this browser version.");
      return;
    }

    if (isDictating) {
      recognitionRef.current.stop();
      setIsDictating(false);
      toast.info("Voice dictation paused.");
    } else {
      try {
        if (isRecording) {
          stopAudioRecording();
        }
        recognitionRef.current.start();
        setIsDictating(true);
        toast.success("Mic Listening: Dictate your Consultation Inquiry!", {
          description: "Speak into your microphone. Words are transcribed in real-time.",
          duration: 4000
        });
      } catch (e) {
        console.warn("Failed speech recognition init", e);
        recognitionRef.current.stop();
        setIsDictating(false);
      }
    }
  };

  const startAudioRecording = async () => {
    if (isDictating) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsDictating(false);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const options = { mimeType: 'audio/webm' };
      
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch (e) {
        // Fallback for browser standard
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setVoiceBlob(audioBlob);
        
        const localUrl = URL.createObjectURL(audioBlob);
        setVoiceUrl(localUrl);

        try {
          const base64 = await blobToBase64(audioBlob);
          setVoiceBase64(base64);
        } catch (err) {
          console.warn("Speech base64 serialization error:", err);
        }

        stream.getTracks().forEach(track => track.stop());
        toast.success("Voice Consultation Briefing recorded successfully!", {
          description: "You now have a playable voice message saved locally for submission.",
          duration: 4000
        });
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      toast.success("Voice Recording Live! Detail your consultation needs...");
    } catch (err: any) {
      console.error("Microphone device acquisition rejected:", err);
      toast.error("Could not obtain microphone audio permissions. Please check computer permissions.");
    }
  };

  const stopAudioRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const clearVoiceRecording = () => {
    stopAudioRecording();
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setVoiceBlob(null);
    setVoiceUrl(null);
    setVoiceBase64(null);
    setRecordingSeconds(0);
    toast.info("Voice message attachment cleared from active form buffer.");
  };

  const togglePlayback = () => {
    if (!voiceUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(voiceUrl);
      audioRef.current.onended = () => {
        setIsPlaying(false);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatSeconds = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${String(rem).padStart(2, '0')}`;
  };

  useEffect(() => {
    const errorPath = 'settings/global';
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      }
    }, (error) => {
      console.debug("Contact settings fetch issue (handled):", error);
      handleFirestoreError(error, OperationType.GET, errorPath);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const target = e.target as HTMLFormElement;
    const firstName = (target.querySelector('#first-name') as HTMLInputElement)?.value || '';
    const lastName = (target.querySelector('#last-name') as HTMLInputElement)?.value || '';
    const email = (target.querySelector('#email') as HTMLInputElement)?.value || '';
    const subject = (target.querySelector('#subject') as HTMLInputElement)?.value || 'General Inquiry';
    
    // Fallback to state or selector
    const rawMsg = message || (target.querySelector('#message') as HTMLTextAreaElement)?.value || '';
    
    const finalMessage = voiceBase64 
      ? `${rawMsg}\n\n[VOICE CONSULTATION BRIEFING ATTACHED - Playback Duration: ${formatSeconds(recordingSeconds)}]`
      : rawMsg;

    setIsSubmitting(true);

    const siteEmail = settings?.email || 'info@grefasconsultandentertainment.com';
    const siteName = 'Grefas Consult & Entertainment';

    try {
      // 1. Log and persist the message in the Firestore 'messages' collection
      await addDoc(collection(db, 'messages'), {
        senderName: `${firstName} ${lastName}`,
        senderEmail: email,
        subject: subject,
        message: finalMessage,
        recipientId: 'general',
        recipientName: siteName,
        recipientEmail: siteEmail,
        voiceAttachment: voiceBase64 || null,
        voiceDuration: voiceBase64 ? recordingSeconds : null,
        createdAt: serverTimestamp()
      });

      // 2. Dispatch the message directly to Grefas's site email address using the Resend API server route
      let emailSentStatus = false;
      try {
        const response = await fetch('/api/send-direct-message', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipientEmail: siteEmail,
            recipientName: siteName,
            senderName: `${firstName} ${lastName}`,
            senderEmail: email,
            subject: subject,
            message: finalMessage,
            voiceAttachment: voiceBase64 || null
          }),
        });

        if (response.ok) {
          const resJson = await response.json();
          if (resJson?.results?.email === 'sent') {
            emailSentStatus = true;
          }
        }
      } catch (err) {
        console.warn("Direct Resend email transmission skipped on server, triggering mailto fallback:", err);
      }

      if (emailSentStatus) {
        toast.success(`Message sent directly to Grefas!`, {
          description: `Thank you, ${firstName}. We will respond soon about "${subject}".`,
          duration: 6000,
        });
      } else {
        // Fallback option: Directly activate browser-based mail client pre-filled configuration
        toast.success(`Message recorded! Opening your mail application...`, {
          description: `Sending directly to our dynamic address: ${siteEmail}`,
          duration: 6000,
        });

        const mailtoUrl = `mailto:${siteEmail}?subject=${encodeURIComponent(subject)}&reply-to=${encodeURIComponent(email)}&body=${encodeURIComponent(
          `Sender: ${firstName} ${lastName}\nSender Email: ${email}\n\nMessage:\n${finalMessage}`
        )}`;
        window.location.href = mailtoUrl;
      }

      // 3. Emit browser desktop popup notification
      showBrowserNotification(
        'Message Received - Grefas Consult',
        `Thank you, ${firstName}! We've received your message and will respond shortly.`,
        '/favicon.ico'
      );

      target.reset();
      setMessage('');
      setVoiceBlob(null);
      setVoiceUrl(null);
      setVoiceBase64(null);
      setRecordingSeconds(0);
    } catch (firebaseErr: any) {
      console.error("Firestore submission failure:", firebaseErr);
      try {
        handleFirestoreError(firebaseErr, OperationType.CREATE, 'messages');
      } catch (e) {
        // Absolute fallback to direct mailto launcher
        toast.info(`Opening default mail app to send...`);
        const mailtoUrl = `mailto:${siteEmail}?subject=${encodeURIComponent(subject)}&reply-to=${encodeURIComponent(email)}&body=${encodeURIComponent(
          `Sender: ${firstName} ${lastName}\nSender Email: ${email}\n\nMessage:\n${finalMessage}`
        )}`;
        window.location.href = mailtoUrl;
      }
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="bg-background py-20">
      <SEO 
        title="Contact Us"
        description="Get in touch with Grefas Consult & Entertainment in Nyinahin-Ashanti, Ashanti Region. Contact us for strategic advising, concert events, and general organization management."
        keywords="Contact Grefas, Nyinahin office, phone Grefas, Grefas address"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
          >
            Get in Touch <span className="text-orange-600">—</span> Nyinahin-Ashanti, Ashanti Region
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            Have an inquiry or want to collaborate with our team in Nyinahin-Ashanti, Ashanti Region? Send us a message and we'll reply promptly.
          </motion.p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-2xl font-bold text-foreground">Contact Information</h3>
              <p className="mt-4 text-muted-foreground">
                Our team is ready to assist you with your consulting and entertainment needs.
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Email</p>
                  <p className="text-muted-foreground">{settings?.email || 'info@grefasconsultandentertainment.com'}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Phone</p>
                  <p className="text-muted-foreground">{settings?.phone || '+233 123 456 789'}</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30 text-[#25D366] dark:text-[#25D366]">
                  <MessageCircle className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">WhatsApp Chat</p>
                  <p className="text-muted-foreground">
                    <a
                      href={`https://wa.me/${(settings?.phone || '+233123456789').replace(/\D/g, '')}?text=${encodeURIComponent("Hello Grefas! I'm reaching out to make an inquiry.")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 dark:text-green-400 font-bold hover:underline flex items-center gap-1"
                    >
                      Chat with us live on WhatsApp
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-500">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Address</p>
                  <p className="text-muted-foreground">{settings?.address || '123 Business Avenue, Nyinahin-Ashanti, Ashanti Region, Ghana'}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-sm font-semibold text-orange-600 dark:text-orange-500 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded inline-block">
                      GPS Address: AI-0008-9223
                    </span>
                    <a
                      href="https://www.google.com/maps/dir/?api=1&destination=AI-0008-9223,+Nyinahin-Ashanti,+Ashanti+Region,+Ghana"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white bg-orange-600 hover:bg-orange-700 transition-colors px-3 py-1 rounded-md shadow-sm"
                    >
                      <Navigation className="h-3 w-3 fill-white/20 animate-bounce" />
                      Get Directions
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Google Map */}
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-muted border border-border/50 shadow-sm relative group h-[320px]">
              <iframe
                title="Grefas Location Map"
                width="100%"
                height="100%"
                className="border-0 w-full h-full grayscale-[15%] group-hover:grayscale-0 transition-all duration-500"
                loading="lazy"
                allowFullScreen
                src="https://maps.google.com/maps?q=AI-0008-9223,+Nyinahin-Ashanti,+Ghana&t=&z=16&ie=UTF8&iwloc=&output=embed"
              ></iframe>
              <div className="absolute bottom-4 left-4 right-4 z-10 flex justify-center">
                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=AI-0008-9223,+Nyinahin-Ashanti,+Ashanti+Region,+Ghana"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-black/80 hover:bg-black text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all duration-300 border border-white/10 hover:border-orange-500 hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  <Navigation className="h-3.5 w-3.5 text-orange-500 fill-orange-500/20" />
                  <span>Navigate To GPS Address</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-3xl bg-card p-8 shadow-sm border border-border/50"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="first-name" className="text-sm font-medium text-foreground">First Name</label>
                  <Input id="first-name" placeholder="John" required className="bg-muted/50 border-border" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="last-name" className="text-sm font-medium text-foreground">Last Name</label>
                  <Input id="last-name" placeholder="Doe" required className="bg-muted/50 border-border" />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
                <Input id="email" type="email" placeholder="john@example.com" required className="bg-muted/50 border-border" />
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-medium text-foreground">Subject</label>
                <Input id="subject" placeholder="How can we help?" required className="bg-muted/50 border-border" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="message" className="text-sm font-medium text-foreground">Message</label>
                  
                  {/* Speech Dictation Assist option */}
                  {isSpeechSupported && (
                    <button
                      type="button"
                      onClick={toggleDictation}
                      className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors px-2.5 py-1 rounded-lg ${
                        isDictating
                          ? 'bg-orange-600/10 text-orange-600 dark:text-orange-400 animate-pulse border border-orange-500/20'
                          : 'text-muted-foreground hover:text-foreground bg-muted/40'
                      }`}
                      title="Speak into your microphone to type into the message area automatically"
                    >
                      <Sparkles className={`h-3.5 w-3.5 ${isDictating ? 'text-orange-500 animate-spin' : ''}`} />
                      <span>{isDictating ? 'Listening...' : 'Voice Type'}</span>
                    </button>
                  )}
                </div>

                <div className="relative">
                  <Textarea 
                    id="message" 
                    placeholder="Tell us about your project/consultation needs. You can type here, or use the interactive voice assistants below to record/dictate your message!" 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="min-h-[150px] bg-muted/50 border-border pr-10 resize-y" 
                    required 
                  />
                  
                  <div className="absolute right-3.5 bottom-3.5 flex items-center gap-1.5">
                    {/* Tiny mic indicator status when dictating */}
                    {isDictating && (
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                      </span>
                    )}
                  </div>
                </div>

                {/* --- Interactive Voice Consultation Console --- */}
                <div className="mt-3.5 p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-3.5 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5 text-orange-600" />
                      Voice Consultation Briefing Assistant
                    </span>

                    <div className="flex items-center gap-2">
                      {!isRecording && !voiceUrl ? (
                        <button
                          type="button"
                          onClick={startAudioRecording}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600/15 hover:bg-orange-600 text-orange-600 dark:text-orange-400 hover:text-white transition-all text-xs font-bold cursor-pointer"
                        >
                          <Mic className="h-3.5 w-3.5 animate-bounce" />
                          <span>Record Voice Memo</span>
                        </button>
                      ) : isRecording ? (
                        <button
                          type="button"
                          onClick={stopAudioRecording}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all text-xs font-bold animate-pulse cursor-pointer"
                        >
                          <Square className="h-3 w-3 fill-current" />
                          <span>Stop Recording</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Active Recording UI View */}
                  {isRecording && (
                    <div className="flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded-xl p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full bg-red-600 animate-ping" />
                        <span className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-widest">
                          Recording Consultation Audio...
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold text-foreground px-2 py-0.5 bg-background rounded border border-border">
                          {formatSeconds(recordingSeconds)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Playback & Attachment State View */}
                  {voiceUrl && (
                    <div className="bg-background border border-border/60 rounded-xl p-3.5 space-y-3.5">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                        <span className="text-[11px] font-bold text-foreground inline-flex items-center gap-1">
                          <Volume2 className="h-3.5 w-3.5 text-orange-500" />
                          Consultation Voice Memo Attachment (Ready for submission)
                        </span>

                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded font-black">
                          {formatSeconds(recordingSeconds)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4 flex-wrap font-sans">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            onClick={togglePlayback}
                            className="bg-zinc-950 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-background dark:text-foreground inline-flex items-center gap-1 rounded-lg h-8 cursor-pointer"
                          >
                            {isPlaying ? (
                              <>
                                <Pause className="h-3.5 w-3.5 fill-current" />
                                <span>Pause</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5 fill-current" />
                                <span>Play Preview</span>
                              </>
                            )}
                          </Button>

                          <button
                            type="button"
                            onClick={clearVoiceRecording}
                            className="text-muted-foreground hover:text-red-500 hover:bg-red-500/5 p-2 rounded-lg transition-colors cursor-pointer"
                            title="Remove audio message"
                          >
                            <Trash2 className="h-4.5 w-4.5" />
                          </button>
                        </div>

                        <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                          Will save transcription & attach voice memo on submit.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Speech Dictation Prompt Guide */}
                  {!isRecording && !voiceUrl && (
                    <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5 pt-1.5 border-t border-border/30">
                      <Sparkles className="h-3 w-3 text-orange-500 animate-pulse shrink-0" />
                      <span>Prefer dictation instead? Use <strong>Voice Type</strong> at the top right of the Message box to transcribe speech in real-time as you speak!</span>
                    </div>
                  )}
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Message...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Send Message
                  </>
                )}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
