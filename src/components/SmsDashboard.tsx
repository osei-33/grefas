import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Phone, 
  Coins, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Send, 
  Server, 
  ShieldCheck,
  ShieldAlert,
  History,
  TrendingUp,
  Sliders,
  Sparkles,
  Plus,
  Trash2,
  Edit,
  Save,
  Layout,
  Users,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';

interface SmsLog {
  id: string;
  recipient: string;
  message: string;
  status: string;
  gateway: 'Arkesel' | 'Twilio';
  timestamp: string;
}

interface SmsStatus {
  status: string;
  arkesel: {
    status: string;
    hasKey: boolean;
    maskedKey: string;
    senderId: string;
    balance: any;
    balanceError: string | null;
  };
  twilio: {
    status: string;
    hasKey: boolean;
  };
}

interface SmsTemplate {
  id: string;
  name: string;
  title: string;
  content: string;
  type: 'booking' | 'casting' | 'announcement';
  updatedAt: string;
}

export default function SmsDashboard() {
  const [status, setStatus] = useState<SmsStatus | null>(null);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Test Send form state
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Firestore States (Threshold settings and templates)
  const [settings, setSettings] = useState<any>({
    smsThreshold: 50,
    adminAlertEmail: 'serwaahlinda1995@gmail.com, asantegrice@gmail.com'
  });
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  
  // New Template Form
  const [tplName, setTplName] = useState('');
  const [tplTitle, setTplTitle] = useState('');
  const [tplContent, setTplContent] = useState('');
  const [tplType, setTplType] = useState<'booking' | 'casting' | 'announcement'>('booking');

  // Broadcast Panel State
  const [broadcastNumbers, setBroadcastNumbers] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResults, setBroadcastResults] = useState<any[]>([]);

  // Placeholder interpolation values
  const [interpolateName, setInterpolateName] = useState('Client Name');
  const [interpolateService, setInterpolateService] = useState('Consulting Briefing');
  const [interpolateDate, setInterpolateDate] = useState(new Date().toLocaleDateString());
  const [interpolateTime, setInterpolateTime] = useState('10:00 AM');
  const [interpolateOrder, setInterpolateOrder] = useState('GRF-9821');
  const [interpolateMsg, setInterpolateMsg] = useState('Your review has started.');

  // Fetch API metrics
  const fetchSmsData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // Fetch status
      const statusRes = await fetch('/api/sms-status');
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      } else {
        console.error('Failed to fetch SMS configuration status');
      }

      // Fetch logs
      const logsRes = await fetch('/api/sms-logs');
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData.status === 'ok') {
          setLogs(logsData.logs || []);
        }
      } else {
        console.error('Failed to fetch SMS logs');
      }
    } catch (err) {
      console.error('Error fetching SMS dashboard data:', err);
      toast.error('Could not load real-time SMS metrics. Verify server connectivity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Listen to Settings from Firestore
  useEffect(() => {
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings((prev: any) => ({
          ...prev,
          smsThreshold: data.smsThreshold !== undefined ? data.smsThreshold : 50,
          adminAlertEmail: data.adminAlertEmail || 'serwaahlinda1995@gmail.com, asantegrice@gmail.com'
        }));
      }
    });

    return unsubscribeSettings;
  }, []);

  // Listen to Templates from Firestore & pre-populate if empty
  useEffect(() => {
    const unsubscribeTemplates = onSnapshot(collection(db, 'sms_templates'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SmsTemplate[];
      setTemplates(list);

      // Pre-populate if empty
      if (snapshot.empty) {
        const defaults = [
          {
            name: 'booking_confirmed',
            title: 'Booking Confirmed Notice',
            content: 'Hi {name}, your booking for {service} on {date} at {time} is CONFIRMED! Ref: {orderNumber}. - Grefas Consult',
            type: 'booking'
          },
          {
            name: 'booking_reminder',
            title: 'Booking Itinerary Reminder',
            content: 'Reminder: Hi {name}, you have a Grefas appointment for {service} on {date} at {time}. - Grefas Consult',
            type: 'booking'
          },
          {
            name: 'casting_received',
            title: 'Casting Application Received',
            content: 'Hello {name}, your Grefas Casting registration is received successfully! Status: Pending. We will review soon. - Grefas',
            type: 'casting'
          },
          {
            name: 'announcement_general',
            title: 'General Group Announcement',
            content: 'Special Notice: {message} - Grefas Consult',
            type: 'announcement'
          }
        ];
        defaults.forEach(async (tpl) => {
          try {
            await addDoc(collection(db, 'sms_templates'), {
              ...tpl,
              updatedAt: new Date().toISOString()
            });
          } catch (err) {
            console.error('Error creating default template:', err);
          }
        });
      }
    });

    return unsubscribeTemplates;
  }, []);

  // Trigger low credit warning & email notification if balance drops below threshold
  useEffect(() => {
    if (status?.arkesel?.balance && settings?.smsThreshold) {
      const balObj = status.arkesel.balance;
      // Get numeric balance value
      let currentBalNum = 0;
      if (typeof balObj === 'object') {
        currentBalNum = parseFloat(balObj.balance || balObj.sms_balance || "0");
      } else {
        currentBalNum = parseFloat(balObj || "0");
      }

      const thresholdNum = parseFloat(settings.smsThreshold || "0");
      
      // Only warn if the balance is a valid number and below threshold (ignore 0 if it failed/error shape)
      if (!isNaN(currentBalNum) && currentBalNum < thresholdNum && currentBalNum > 0) {
        toast.warning(`CRITICAL WARNING: Arkesel SMS balance is extremely low (${currentBalNum} < ${thresholdNum})!`, {
          description: "Please top up immediately. Your automated notification flows could break.",
          duration: 10000,
        });

        // Trigger server email alert
        const emails = settings.adminAlertEmail 
          ? settings.adminAlertEmail.split(',').map((e: string) => e.trim()).filter(Boolean) 
          : ['serwaahlinda1995@gmail.com', 'asantegrice@gmail.com'];

        fetch('/api/alert-low-credit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            balance: `${currentBalNum} ${balObj.currency || 'GHS'}`,
            threshold: `${thresholdNum} Units`,
            emails
          })
        }).then(res => res.json())
          .then(data => {
            if (data.status === 'sent') {
              console.log('Admins notified of low credit via email:', data.sentTo);
            }
          }).catch(err => {
            console.error('Error sending low-credit email alert:', err);
          });
      }
    }
  }, [status, settings]);

  useEffect(() => {
    fetchSmsData();
  }, []);

  const handleRefresh = () => {
    fetchSmsData(true);
    toast.success('SMS statistics and credit balance reloaded successfully.');
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone || !testMessage) {
      toast.error('Please fill in both the phone number and test message.');
      return;
    }

    setSendingTest(true);
    const toastId = toast.loading('Initiating dual-engine SMS dispatch...');

    try {
      const res = await fetch('/api/notify-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin-test@grefas.com',
          userName: 'Grefas Admin Tester',
          phone: testPhone,
          serviceTitle: 'Gateway Verification Alert',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString().slice(0, 5),
          orderNumber: `TST-${Date.now().toString().slice(-4)}`,
          notes: testMessage // Will be included in display notes
        })
      });

      toast.dismiss(toastId);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.sms && !data.results.sms.startsWith('failed') && data.results.sms !== 'skipped') {
          toast.success(`Verification SMS sent successfully via ${data.results.sms === 'sent' ? 'Arkesel Gateway' : 'Twilio Fallback'}!`);
          setTestMessage('');
          setTimeout(() => fetchSmsData(true), 1500);
        } else {
          toast.error(`SMS dispatch reported failure: ${data.results?.sms || 'API Key is missing or gateway is offline.'}`);
        }
      } else {
        toast.error('Server error during test message submission.');
      }
    } catch (err) {
      toast.dismiss(toastId);
      console.error('Test SMS trigger failed:', err);
      toast.error('An unexpected exception occurred when sending SMS.');
    } finally {
      setSendingTest(false);
    }
  };

  // Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        smsThreshold: parseFloat(settings.smsThreshold) || 0,
        adminAlertEmail: settings.adminAlertEmail
      }, { merge: true });
      toast.success('SMS Notification threshold and alert configuration saved!');
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Could not save threshold settings to Firestore.');
    }
  };

  // Template Manager Operations
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName || !tplTitle || !tplContent) {
      toast.error('All template fields are required.');
      return;
    }

    try {
      await addDoc(collection(db, 'sms_templates'), {
        name: tplName.trim().toLowerCase().replace(/\s+/g, '_'),
        title: tplTitle.trim(),
        content: tplContent.trim(),
        type: tplType,
        updatedAt: new Date().toISOString()
      });
      toast.success('New SMS Template registered successfully.');
      setIsCreatingTemplate(false);
      setTplName('');
      setTplTitle('');
      setTplContent('');
    } catch (err) {
      console.error('Template create error:', err);
      toast.error('Failed to save new SMS template.');
    }
  };

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;

    try {
      await updateDoc(doc(db, 'sms_templates', editingTemplate.id), {
        title: editingTemplate.title,
        content: editingTemplate.content,
        type: editingTemplate.type,
        updatedAt: new Date().toISOString()
      });
      toast.success('SMS template modified successfully.');
      setEditingTemplate(null);
    } catch (err) {
      console.error('Template update error:', err);
      toast.error('Could not modify template.');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this SMS template?')) return;
    try {
      await deleteDoc(doc(db, 'sms_templates', id));
      toast.success('SMS template deleted from archive.');
    } catch (err) {
      console.error('Delete template error:', err);
      toast.error('Failed to remove SMS template.');
    }
  };

  // Interpolate placeholders for selected template
  const applyInterpolation = (content: string) => {
    return content
      .replace(/{name}/g, interpolateName)
      .replace(/{service}/g, interpolateService)
      .replace(/{date}/g, interpolateDate)
      .replace(/{time}/g, interpolateTime)
      .replace(/{orderNumber}/g, interpolateOrder)
      .replace(/{message}/g, interpolateMsg);
  };

  const loadTemplateIntoTest = (tpl: SmsTemplate) => {
    const interpolated = applyInterpolation(tpl.content);
    setTestMessage(interpolated);
    toast.info(`Loaded interpolated template: "${tpl.title}"`);
  };

  const loadTemplateIntoBroadcast = (tpl: SmsTemplate) => {
    const interpolated = applyInterpolation(tpl.content);
    setBroadcastMessage(interpolated);
    toast.info(`Loaded interpolated broadcast: "${tpl.title}"`);
  };

  // Group Broadcast Function
  const handleExecuteBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastNumbers || !broadcastMessage) {
      toast.error('Please provide recipients and a message.');
      return;
    }

    const numberArray = broadcastNumbers
      .split(',')
      .map(num => num.trim())
      .filter(num => num.length > 5);

    if (numberArray.length === 0) {
      toast.error('No valid phone numbers detected.');
      return;
    }

    setBroadcasting(true);
    setBroadcastResults([]);
    toast.loading(`Broadcasting SMS to ${numberArray.length} recipients...`);

    const results: any[] = [];
    for (const phoneNum of numberArray) {
      try {
        const res = await fetch('/api/notify-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'broadcast-recipient@grefas.com',
            userName: 'Grefas Broadcast Recipient',
            phone: phoneNum,
            serviceTitle: 'Broadcast Announcement',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString().slice(0, 5),
            orderNumber: `BRD-${Date.now().toString().slice(-4)}`,
            notes: broadcastMessage
          })
        });

        if (res.ok) {
          const data = await res.json();
          const smsStatus = data.results?.sms || 'skipped';
          results.push({ phone: phoneNum, status: smsStatus, success: !smsStatus.startsWith('failed') && smsStatus !== 'skipped' });
        } else {
          results.push({ phone: phoneNum, status: 'HTTP Server Error', success: false });
        }
      } catch (err: any) {
        results.push({ phone: phoneNum, status: err.message, success: false });
      }
    }

    toast.dismiss();
    setBroadcastResults(results);
    setBroadcasting(false);

    const successfulDispatches = results.filter(r => r.success).length;
    toast.success(`Group broadcast complete! Successfully dispatched to ${successfulDispatches} of ${results.length} numbers.`);
    setBroadcastNumbers('');
    setBroadcastMessage('');
    setTimeout(() => fetchSmsData(true), 1500);
  };

  // Filter logs based on search query
  const filteredLogs = logs.filter(log => {
    const query = searchQuery.toLowerCase();
    return (
      log.recipient.toLowerCase().includes(query) ||
      log.message.toLowerCase().includes(query) ||
      log.gateway.toLowerCase().includes(query) ||
      log.status.toLowerCase().includes(query)
    );
  });

  // Calculate metrics
  const totalSent = logs.filter(l => l.status.includes('sent')).length;
  const totalAttempts = logs.length;
  const successRate = totalAttempts > 0 ? Math.round((totalSent / totalAttempts) * 100) : 100;

  const getBalanceDisplay = () => {
    if (!status?.arkesel?.hasKey) return 'Unconfigured';
    if (status.arkesel.balanceError) return 'Error Loading';
    
    const bal = status.arkesel.balance;
    if (bal === null || bal === undefined) return 'Checking...';
    
    if (typeof bal === 'object') {
      if (bal.balance !== undefined) {
        return `${bal.balance} ${bal.currency || 'GHS'}`;
      }
      if (bal.sms_balance !== undefined) {
        return `${bal.sms_balance} SMS Credits`;
      }
      return JSON.stringify(bal);
    }
    
    return `${bal} GHS`;
  };

  const currentBalNum = status?.arkesel?.balance 
    ? (typeof status.arkesel.balance === 'object' 
        ? parseFloat(status.arkesel.balance.balance || status.arkesel.balance.sms_balance || "0")
        : parseFloat(status.arkesel.balance || "0"))
    : 0;

  const isLowCredit = !isNaN(currentBalNum) && currentBalNum > 0 && currentBalNum < (parseFloat(settings?.smsThreshold) || 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-600" />
        <p className="text-sm font-semibold text-muted-foreground animate-pulse">CONNECTING TO GATEWAYS...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Banner for Low Credits */}
      {isLowCredit && (
        <div className="bg-red-500/10 border-2 border-red-500/20 text-red-700 dark:text-red-400 p-4 rounded-xl flex items-start gap-3 shadow-xs animate-pulse">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-red-600" />
          <div className="text-xs">
            <h4 className="font-bold uppercase tracking-wider text-red-800 dark:text-red-300">Warning: SMS Credit Balance Critical</h4>
            <p className="mt-0.5 font-medium leading-relaxed">
              Your remaining Arkesel balance of <strong>{getBalanceDisplay()}</strong> is below your low credit threshold limit of <strong>{settings.smsThreshold} Units</strong>. Automated notifications could fail. Please purchase more credits on Arkesel.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-2 tracking-tight">
            <MessageSquare className="h-8 w-8 text-orange-600" /> SMS Console
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Configure credit thresholds, manage templates, broadcast notices, and inspect delivery logs.
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleRefresh} 
          disabled={refreshing}
          className="text-xs font-semibold hover:border-orange-500 hover:text-orange-600 transition flex items-center gap-1.5 self-stretch md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-orange-600' : ''}`} />
          {refreshing ? 'Syncing...' : 'Sync Balance & Logs'}
        </Button>
      </div>

      {/* Gateway Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Arkesel Gateway Card */}
        <Card className="bg-card border-border shadow-xs hover:border-orange-500/30 transition-all">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Server className="h-4 w-4 text-orange-600" /> Arkesel Ghanaian Gateway
              </CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                Primary local SMS gateway provider for Ghana region (v2 API)
              </CardDescription>
            </div>
            {status?.arkesel?.hasKey ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-green-500/10 text-green-600 dark:bg-green-500/20">
                <ShieldCheck className="h-3 w-3" /> ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-500 dark:bg-red-500/20">
                <ShieldAlert className="h-3 w-3" /> MISSING
              </span>
            )}
          </CardHeader>
          <CardContent className="text-xs space-y-2 font-mono bg-muted/25 p-4 rounded-b-xl border-t border-border/40">
            <div className="flex justify-between">
              <span className="text-muted-foreground">API Key:</span>
              <span className="font-semibold text-foreground">{status?.arkesel?.maskedKey || 'Not configured'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sender ID:</span>
              <span className="font-semibold text-foreground">{status?.arkesel?.senderId || 'Grefas'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gateway Base:</span>
              <span className="font-semibold text-foreground text-[10px]">sms.arkesel.com/api/v2</span>
            </div>
          </CardContent>
        </Card>

        {/* Twilio Fallback Card */}
        <Card className="bg-card border-border shadow-xs hover:border-blue-500/30 transition-all">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-600" /> Twilio International Fallback
              </CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                Global fallback backup engine triggered automatically on Arkesel failure
              </CardDescription>
            </div>
            {status?.twilio?.hasKey ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:bg-blue-500/20">
                <ShieldCheck className="h-3 w-3" /> READY
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
                <AlertCircle className="h-3 w-3" /> UNCONFIGURED
              </span>
            )}
          </CardHeader>
          <CardContent className="text-xs space-y-2 font-mono bg-muted/25 p-4 rounded-b-xl border-t border-border/40">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Status:</span>
              <span className="font-semibold text-foreground">{status?.twilio?.status || 'Inactive'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Failover Mode:</span>
              <span className="font-semibold text-green-600">Automatic Hot Fallback</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Region:</span>
              <span className="font-semibold text-foreground">Global/Multi-region</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Credit balance KPI */}
        <Card className={`bg-card border-border shadow-xs transition-colors ${isLowCredit ? 'border-red-500/45 bg-red-500/5' : ''}`}>
          <CardHeader className="pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Coins className="h-3.5 w-3.5 text-orange-600" /> Remaining Balance
            </span>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black truncate ${isLowCredit ? 'text-red-600' : 'text-foreground'}`}>
              {getBalanceDisplay()}
            </div>
            {status?.arkesel?.balanceError && (
              <p className="text-[10px] text-red-500 mt-1 font-semibold flex items-center gap-0.5">
                <AlertCircle className="h-3 w-3" /> Check API configuration status
              </p>
            )}
          </CardContent>
        </Card>

        {/* Sessions Sent Count */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <History className="h-3.5 w-3.5 text-orange-600" /> Dispatch attempts
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{totalAttempts} Attempts</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">In-memory logging history</p>
          </CardContent>
        </Card>

        {/* Success rate percentage */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-600" /> Success Rate
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-600">{successRate}%</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">{totalSent} of {totalAttempts} delivered</p>
          </CardContent>
        </Card>

        {/* Configured Threshold */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Sliders className="h-3.5 w-3.5 text-orange-600" /> Alert Threshold
            </span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{settings.smsThreshold} Units</div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Triggers email warning when lower</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout for Templates, Broadcasting, Settings, and Logs */}
      <Tabs defaultValue="dispatcher" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-muted/50 p-1 rounded-xl border border-border/60">
          <TabsTrigger value="dispatcher" className="text-xs font-bold gap-1.5">
            <Send className="h-3.5 w-3.5" /> SMS Dispatcher
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs font-bold gap-1.5">
            <Layout className="h-3.5 w-3.5" /> SMS Templates
          </TabsTrigger>
          <TabsTrigger value="broadcast" className="text-xs font-bold gap-1.5">
            <Users className="h-3.5 w-3.5" /> Group Broadcast
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs font-bold gap-1.5">
            <Sliders className="h-3.5 w-3.5" /> Alert Config
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Dispatcher and Logs */}
        <TabsContent value="dispatcher" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Test Send Panel */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="border-border shadow-xs bg-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Send className="h-4 w-4 text-orange-600" /> Test SMS Dispatcher
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground">
                    Quickly trigger an SMS manually. You can click a template below to pre-populate and interpolate this test message.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleTestSend} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Recipient Phone Number</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="+233241234567" 
                          value={testPhone}
                          onChange={(e) => setTestPhone(e.target.value)}
                          className="pl-9 text-xs"
                          required
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground italic">Ghana region: use international prefix format (+233) or local (054...).</p>
                    </div>

                    {/* Placeholder interpolation card in dispatcher */}
                    {templates.length > 0 && (
                      <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground block">Select Saved SMS Template</label>
                        <select 
                          className="w-full bg-background border border-border rounded-md text-xs p-1.5"
                          onChange={(e) => {
                            const selected = templates.find(t => t.id === e.target.value);
                            if (selected) loadTemplateIntoTest(selected);
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>-- Choose template to load --</option>
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.title} ({t.type})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Test Message Body</label>
                      <Textarea 
                        placeholder="Enter test message content here. Keep within 160 characters for a single SMS unit."
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        className="min-h-[100px] text-xs resize-none font-mono"
                        maxLength={160}
                        required
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span>Sender ID: Grefas (Ghana limit)</span>
                        <span>{testMessage.length}/160 chars</span>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={sendingTest}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
                    >
                      {sendingTest ? (
                        <span className="flex items-center gap-1.5 justify-center">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Dispatching SMS...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 justify-center">
                          <Send className="h-3.5 w-3.5" /> Trigger Verification SMS
                        </span>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Live Variables Interpolation Tool */}
              <Card className="border-border shadow-xs bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-orange-600" /> Template Variables Helper
                  </CardTitle>
                  <CardDescription className="text-[11px] font-medium text-muted-foreground">
                    Define variables below. Any templates loaded will automatically interpolate these values.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-bold">{"{name}"}</span>
                      <Input value={interpolateName} onChange={e => setInterpolateName(e.target.value)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-bold">{"{service}"}</span>
                      <Input value={interpolateService} onChange={e => setInterpolateService(e.target.value)} className="h-7 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-bold">{"{date}"}</span>
                      <Input value={interpolateDate} onChange={e => setInterpolateDate(e.target.value)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-bold">{"{time}"}</span>
                      <Input value={interpolateTime} onChange={e => setInterpolateTime(e.target.value)} className="h-7 text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-bold">{"{orderNumber}"}</span>
                      <Input value={interpolateOrder} onChange={e => setInterpolateOrder(e.target.value)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground block font-bold">{"{message}"}</span>
                      <Input value={interpolateMsg} onChange={e => setInterpolateMsg(e.target.value)} className="h-7 text-xs" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Delivery Logs list */}
            <div className="lg:col-span-2">
              <Card className="border-border shadow-xs bg-card h-full">
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <History className="h-4 w-4 text-orange-600" /> Gateway Delivery Logs
                      </CardTitle>
                      <CardDescription className="text-xs font-medium text-muted-foreground">
                        Displaying chronological SMS attempts triggered during this container session.
                      </CardDescription>
                    </div>
                    <div className="relative w-full md:w-64">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input 
                        placeholder="Search logs..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 text-xs h-7.5"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/45 border-y border-border/80 text-muted-foreground font-extrabold text-[10px] uppercase tracking-wider">
                          <th className="py-3 px-4">Recipient</th>
                          <th className="py-3 px-4">Gateway</th>
                          <th className="py-3 px-4">Message</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-muted-foreground italic font-medium">
                              No matching SMS logs found in session history.
                            </td>
                          </tr>
                        ) : (
                          filteredLogs.map((log) => {
                            const isSent = log.status.startsWith('sent');
                            const isFailed = log.status.startsWith('failed');
                            
                            return (
                              <tr key={log.id} className="hover:bg-muted/20 transition-all font-mono">
                                <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                                  {log.recipient}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black ${
                                    log.gateway === 'Arkesel' 
                                      ? 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20' 
                                      : 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20'
                                  }`}>
                                    {log.gateway}
                                  </span>
                                </td>
                                <td className="py-3 px-4 max-w-xs md:max-w-sm font-sans leading-relaxed text-foreground/80 break-words">
                                  {log.message}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    isSent 
                                      ? 'bg-green-500/10 text-green-600 dark:bg-green-500/20' 
                                      : isFailed 
                                        ? 'bg-red-500/10 text-red-500 dark:bg-red-500/20' 
                                        : 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20'
                                  }`}>
                                    {isSent ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                    {log.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right text-muted-foreground text-[10px] whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: SMS Templates CRUD */}
        <TabsContent value="templates" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-foreground">SMS Template Repository</h3>
              <p className="text-xs text-muted-foreground font-medium">Create and reuse specific notification structures for bookings, castings and broadcasts.</p>
            </div>
            <Button 
              size="sm"
              onClick={() => setIsCreatingTemplate(!isCreatingTemplate)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              {isCreatingTemplate ? 'Collapse Form' : 'Register Template'}
            </Button>
          </div>

          {/* Create Template Form */}
          {isCreatingTemplate && (
            <Card className="border-orange-500/35 bg-orange-500/5 animate-fade-in">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">Register Custom SMS Template</CardTitle>
                <CardDescription className="text-xs">
                  Templates will be securely archived in Firestore and accessible across all admin portals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTemplate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Unique Template Key (Name)</label>
                      <Input 
                        placeholder="booking_confirmation_new"
                        value={tplName}
                        onChange={(e) => setTplName(e.target.value)}
                        className="text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Display Title</label>
                      <Input 
                        placeholder="New Booking Notification"
                        value={tplTitle}
                        onChange={(e) => setTplTitle(e.target.value)}
                        className="text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Category/Type</label>
                      <select 
                        value={tplType}
                        onChange={(e: any) => setTplType(e.target.value)}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-xs"
                      >
                        <option value="booking">Booking notifications</option>
                        <option value="casting">Casting application notices</option>
                        <option value="announcement">General broadcasts</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground flex justify-between">
                      <span>Message Body</span>
                      <span className="text-[10px] text-orange-600 lowercase">Use variables: {"{name}"}, {"{service}"}, {"{date}"}, {"{time}"}, {"{orderNumber}"}, {"{message}"}</span>
                    </label>
                    <Textarea 
                      placeholder="Hi {name}, your booking for {service} on {date} at {time} has been updated. - Grefas"
                      value={tplContent}
                      onChange={(e) => setTplContent(e.target.value)}
                      className="min-h-[80px] text-xs font-mono"
                      maxLength={160}
                      required
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreatingTemplate(false)} className="text-xs font-bold">Cancel</Button>
                    <Button type="submit" size="sm" className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1">
                      <Save className="h-3.5 w-3.5" /> Archive Template
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Edit Template Form modal/card */}
          {editingTemplate && (
            <Card className="border-blue-500/35 bg-blue-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">Edit Template: {editingTemplate.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateTemplate} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Display Title</label>
                      <Input 
                        value={editingTemplate.title}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                        className="text-xs font-bold"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Category/Type</label>
                      <select 
                        value={editingTemplate.type}
                        onChange={(e: any) => setEditingTemplate({ ...editingTemplate, type: e.target.value })}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-xs"
                      >
                        <option value="booking">Booking notifications</option>
                        <option value="casting">Casting application notices</option>
                        <option value="announcement">General broadcasts</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground flex justify-between">
                      <span>Message Body</span>
                      <span className="text-[10px] text-blue-600 lowercase">Use variables: {"{name}"}, {"{service}"}, {"{date}"}, {"{time}"}, {"{orderNumber}"}, {"{message}"}</span>
                    </label>
                    <Textarea 
                      value={editingTemplate.content}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                      className="min-h-[80px] text-xs font-mono"
                      maxLength={160}
                      required
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingTemplate(null)} className="text-xs font-bold">Cancel</Button>
                    <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Apply Edits
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* List of Templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="bg-card border-border shadow-xs hover:border-orange-500/10 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600">
                        {tpl.type}
                      </span>
                      <CardTitle className="text-sm font-bold text-foreground mt-2">{tpl.title}</CardTitle>
                      <CardDescription className="text-[10px] font-semibold text-muted-foreground mt-0.5">Key: {tpl.name}</CardDescription>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-500/10" onClick={() => setEditingTemplate(tpl)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:bg-red-500/10" onClick={() => handleDeleteTemplate(tpl.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted/30 border border-border/40 p-3 rounded-lg font-mono text-xs leading-relaxed text-foreground/80 break-words">
                    {tpl.content}
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                    <span>Last Updated: {new Date(tpl.updatedAt).toLocaleDateString()}</span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-6 text-[10px] py-0" onClick={() => loadTemplateIntoTest(tpl)}>Use in Test</Button>
                      <Button size="sm" variant="outline" className="h-6 text-[10px] py-0 border-orange-500/30 text-orange-600 hover:bg-orange-500/5" onClick={() => loadTemplateIntoBroadcast(tpl)}>Use in Broadcast</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 3: Group SMS Broadcast Notice */}
        <TabsContent value="broadcast" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card className="border-border shadow-xs bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-orange-600" /> Bulk Announcement Sender
                  </CardTitle>
                  <CardDescription className="text-xs font-medium text-muted-foreground">
                    Send a templated or custom notice to a list of client numbers instantly using the unified gateways.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleExecuteBroadcast} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Recipient Phone Numbers</label>
                      <Textarea 
                        placeholder="+233241234567, +233501112222, +233203334444" 
                        value={broadcastNumbers}
                        onChange={(e) => setBroadcastNumbers(e.target.value)}
                        className="min-h-[80px] text-xs font-mono"
                        required
                      />
                      <p className="text-[9px] text-muted-foreground italic">Separate multiple recipient numbers with a comma.</p>
                    </div>

                    {templates.length > 0 && (
                      <div className="p-3 bg-muted/40 rounded-xl border border-border/40 space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground block">Select Saved SMS Template</label>
                        <select 
                          className="w-full bg-background border border-border rounded-md text-xs p-1.5"
                          onChange={(e) => {
                            const selected = templates.find(t => t.id === e.target.value);
                            if (selected) loadTemplateIntoBroadcast(selected);
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>-- Choose template to load --</option>
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.title} ({t.type})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-muted-foreground">Broadcast Message Content</label>
                      <Textarea 
                        placeholder="Write announcement body. Use variables helper on previous tabs to pre-interpolate values."
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        className="min-h-[100px] text-xs font-mono"
                        maxLength={160}
                        required
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span>Characters used: {broadcastMessage.length}/160</span>
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={broadcasting}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
                    >
                      {broadcasting ? (
                        <span className="flex items-center gap-1.5 justify-center">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Executing Group Broadcast...
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 justify-center">
                          <Send className="h-3.5 w-3.5" /> Dispatch Bulk SMS Broadcast
                        </span>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="border-border shadow-xs bg-card h-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">Broadcast Status Tracker</CardTitle>
                  <CardDescription className="text-xs">
                    Real-time logging output of the last triggered group broadcast execution sequence.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {broadcastResults.length === 0 ? (
                      <div className="h-40 border border-dashed border-border rounded-xl flex flex-col items-center justify-center text-xs text-muted-foreground font-medium">
                        <span>No bulk broadcast executed during this session.</span>
                        <span className="text-[10px] mt-1 text-muted-foreground/60">Fill the broadcast form to begin.</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-border border rounded-xl overflow-hidden text-xs max-h-80 overflow-y-auto">
                        {broadcastResults.map((res, i) => (
                          <div key={i} className="p-3 flex justify-between items-center bg-card font-mono">
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-bold text-foreground">{res.phone}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {res.success ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-green-500/10 text-green-600 dark:bg-green-500/20">
                                  <Check className="h-3 w-3" /> SUCCESS
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/10 text-red-500 dark:bg-red-500/20">
                                  <XCircle className="h-3 w-3" /> FAILED ({res.status})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Low Credit Configuration Settings */}
        <TabsContent value="settings" className="space-y-6">
          <Card className="border-border shadow-xs bg-card max-w-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-orange-600" /> Low Credit Alert thresholds
              </CardTitle>
              <CardDescription className="text-xs">
                Configure automatic email and dashboard alerts. If remaining SMS credit units drop below your specified threshold, an email notice will be triggered to all specified administrators.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Alert Threshold (Units / GHS)</label>
                    <Input 
                      type="number"
                      placeholder="50"
                      value={settings.smsThreshold}
                      onChange={(e) => setSettings({ ...settings, smsThreshold: e.target.value })}
                      className="text-xs font-bold"
                      min={1}
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">Triggers notification once balance drops below this amount.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground">Notification Gateway Mode</label>
                    <Input 
                      value="Unified SMTP Resend Channels"
                      disabled
                      className="text-xs font-semibold bg-muted"
                    />
                    <p className="text-[10px] text-muted-foreground">Admin notification channel system delivery.</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">Admin Email Addresses for Low Credit Alerts</label>
                  <Input 
                    placeholder="admin@grefas.com, secretary@grefas.com"
                    value={settings.adminAlertEmail}
                    onChange={(e) => setSettings({ ...settings, adminAlertEmail: e.target.value })}
                    className="text-xs"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">Separate multiple admin email addresses with a comma.</p>
                </div>

                <div className="flex justify-end pt-2 border-t border-border/55">
                  <Button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1.5">
                    <Save className="h-3.5 w-3.5" /> Save Configuration Thresholds
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
