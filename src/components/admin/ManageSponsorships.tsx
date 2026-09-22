import React, { useState, useEffect } from 'react';
import { 
  HeartHandshake, 
  Search, 
  Filter, 
  Send, 
  Mail, 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Building2, 
  User, 
  Plus, 
  Printer, 
  Trash2, 
  ExternalLink, 
  Loader2, 
  Eye, 
  Sparkles, 
  Check, 
  DollarSign, 
  FileText,
  X,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { toast } from 'sonner';
import { Sponsorship } from '@/types/sponsorship';

export default function ManageSponsorships() {
  const [sponsorships, setSponsorships] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'individual' | 'organization'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [filterThankYou, setFilterThankYou] = useState<'all' | 'sent' | 'pending'>('all');

  // Thank You Modal State
  const [selectedSponsorship, setSelectedSponsorship] = useState<Sponsorship | null>(null);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [thankYouSubject, setThankYouSubject] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [isSendingThankYou, setIsSendingThankYou] = useState(false);

  // View Details Modal State
  const [detailItem, setDetailItem] = useState<Sponsorship | null>(null);

  // Add Manual/Offline Sponsorship Modal
  const [showAddManualModal, setShowAddManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState<'individual' | 'organization'>('individual');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Real-time Firestore sync
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'sponsorships'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Sponsorship[] = [];
      snapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Sponsorship);
      });
      setSponsorships(items);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching sponsorships:', error);
      toast.error('Could not load sponsorships list');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute metrics
  const totalRaised = sponsorships
    .filter(s => s.paymentStatus === 'completed')
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const completedCount = sponsorships.filter(s => s.paymentStatus === 'completed').length;
  const pendingCount = sponsorships.filter(s => s.paymentStatus === 'pending').length;
  const thankYouPendingCount = sponsorships.filter(s => s.paymentStatus === 'completed' && !s.thankYouSent).length;
  const orgCount = sponsorships.filter(s => s.sponsorType === 'organization').length;

  // Filtered sponsorships
  const filteredSponsorships = sponsorships.filter((item) => {
    // Search query
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      item.sponsorName?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.phone?.toLowerCase().includes(q) ||
      item.contactPerson?.toLowerCase().includes(q) ||
      item.paymentReference?.toLowerCase().includes(q);

    // Type filter
    const matchesType = filterType === 'all' || item.sponsorType === filterType;

    // Status filter
    const matchesStatus = filterStatus === 'all' || item.paymentStatus === filterStatus;

    // Thank you filter
    const matchesThankYou = filterThankYou === 'all' || 
      (filterThankYou === 'sent' && item.thankYouSent) ||
      (filterThankYou === 'pending' && !item.thankYouSent);

    return matchesSearch && matchesType && matchesStatus && matchesThankYou;
  });

  const openThankYouDialog = (item: Sponsorship) => {
    setSelectedSponsorship(item);
    setThankYouSubject(`Official Certificate of Appreciation & Thank You — Grefas Consult & Entertainment`);
    
    const formattedAmount = Number(item.amount || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 });
    const isOrg = item.sponsorType === 'organization';

    setThankYouMessage(
      `On behalf of the board of directors, management team, and creative talent at Grefas Consult & Entertainment, we write to express our deepest gratitude for ${isOrg ? `${item.sponsorName}'s corporate partnership` : 'your personal sponsorship'} of GHS ${formattedAmount}.\n\nYour contribution directly enables our grassroots actors, youth scriptwriters, and media production crews to produce impactful films and community skits in Ghana. Your trust and generosity are profoundly appreciated.\n\nWe look forward to honoring your contribution in our upcoming productions.`
    );

    setSendEmail(!!item.email);
    setSendSms(!!item.phone);
    setShowThankYouModal(true);
  };

  const handleSendThankYou = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSponsorship || !selectedSponsorship.id) return;

    setIsSendingThankYou(true);
    try {
      // 1. Call server API to send email and/or SMS
      const res = await fetch('/api/sponsorship/send-thank-you', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorName: selectedSponsorship.sponsorName,
          sponsorEmail: selectedSponsorship.email,
          sponsorPhone: selectedSponsorship.phone,
          sponsorType: selectedSponsorship.sponsorType,
          amount: selectedSponsorship.amount,
          currency: selectedSponsorship.currency || 'GHS',
          subject: thankYouSubject,
          thankYouMessage: thankYouMessage,
          sendEmail,
          sendSms,
          signedBy: 'Board of Directors & Management'
        })
      });

      const data = await res.json().catch(() => null);

      // 2. Update Firestore record
      const sponsorRef = doc(db, 'sponsorships', selectedSponsorship.id);
      await updateDoc(sponsorRef, {
        thankYouSent: true,
        thankYouSentAt: new Date().toISOString(),
        thankYouMessage: thankYouMessage,
        updatedAt: new Date().toISOString()
      });

      toast.success('Thank You Sent & Recorded!', {
        description: `Official appreciation delivered to ${selectedSponsorship.sponsorName}.`,
        duration: 5000
      });

      setShowThankYouModal(false);
      setSelectedSponsorship(null);
    } catch (err: any) {
      console.error('Failed to send thank you acknowledgement:', err);
      toast.error('Failed to process thank you dispatch. Please try again.');
    } finally {
      setIsSendingThankYou(false);
    }
  };

  const handleMarkCompleted = async (item: Sponsorship) => {
    if (!item.id) return;
    try {
      await updateDoc(doc(db, 'sponsorships', item.id), {
        paymentStatus: 'completed',
        updatedAt: new Date().toISOString()
      });
      toast.success('Sponsorship marked as completed!');
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status.');
    }
  };

  const handleDeleteSponsorship = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this sponsorship record? This cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'sponsorships', id));
      toast.success('Sponsorship record deleted.');
    } catch (err) {
      console.error('Error deleting sponsorship:', err);
      toast.error('Failed to delete sponsorship record.');
    }
  };

  const handleAddManualSponsorship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim() || !manualAmount) {
      toast.error('Name and Amount are required.');
      return;
    }

    setIsSavingManual(true);
    try {
      const amt = Number(manualAmount);
      const tier = amt >= 2500 ? 'Executive Partner' : amt >= 1000 ? 'Platinum' : amt >= 500 ? 'Gold' : amt >= 250 ? 'Silver' : amt >= 100 ? 'Bronze' : 'Supporter';

      await addDoc(collection(db, 'sponsorships'), {
        sponsorType: manualType,
        sponsorName: manualName.trim(),
        email: manualEmail.trim().toLowerCase() || 'offline@grefas.com',
        phone: manualPhone.trim() || null,
        amount: amt,
        currency: 'GHS',
        tier,
        message: manualNotes.trim() || null,
        isAnonymous: false,
        paymentMethod: 'Offline / Physical Office Cash/Check',
        paymentStatus: 'completed',
        paymentReference: `MANUAL-${Date.now().toString(36).toUpperCase()}`,
        thankYouSent: false,
        thankYouSentAt: null,
        createdAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
      });

      toast.success('Offline Sponsorship Recorded Successfully!');
      setShowAddManualModal(false);
      setManualName('');
      setManualEmail('');
      setManualPhone('');
      setManualAmount('');
      setManualNotes('');
    } catch (err) {
      console.error('Failed to save manual sponsorship:', err);
      toast.error('Failed to save offline sponsorship.');
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HeartHandshake className="h-6 w-6 text-orange-600" />
            <span>Sponsorships & Donations</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Monitor incoming donor contributions, track funds, and dispatch official thank-you letters to benefactors & partner organizations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => window.open('/sponsorship', '_blank')}
            className="text-xs font-semibold h-9 flex items-center gap-1.5"
          >
            <span>Public Donation Page</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>

          <Button
            onClick={() => setShowAddManualModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-9 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Record Offline Donation</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Funds Raised</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            GH₵ {totalRaised.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-muted-foreground">
            From {completedCount} verified contributions
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Thank Yous</span>
            <Mail className="h-4 w-4 text-orange-600" />
          </div>
          <div className="text-2xl font-black text-orange-600">
            {thankYouPendingCount}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Benefactors awaiting official letter
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Organizations</span>
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-foreground">
            {orgCount}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Corporate & foundation partners
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Pledges</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">
            {pendingCount}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Awaiting bank wire verification
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sponsor name, email, phone, reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e: any) => setFilterType(e.target.value)}
              className="h-9 text-xs rounded-lg border border-border bg-background px-3 text-foreground focus:ring-1 focus:ring-orange-500"
            >
              <option value="all">All Contributor Types</option>
              <option value="individual">Individuals Only</option>
              <option value="organization">Organizations Only</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e: any) => setFilterStatus(e.target.value)}
              className="h-9 text-xs rounded-lg border border-border bg-background px-3 text-foreground focus:ring-1 focus:ring-orange-500"
            >
              <option value="all">All Payment Statuses</option>
              <option value="completed">Completed / Verified</option>
              <option value="pending">Pending Wire/Transfer</option>
            </select>

            {/* Thank You Filter */}
            <select
              value={filterThankYou}
              onChange={(e: any) => setFilterThankYou(e.target.value)}
              className="h-9 text-xs rounded-lg border border-border bg-background px-3 text-foreground focus:ring-1 focus:ring-orange-500"
            >
              <option value="all">All Thank You Statuses</option>
              <option value="pending">Needs Thank You</option>
              <option value="sent">Thank You Sent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sponsorship Records Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-600" />
            <p>Loading sponsorship records from cloud database...</p>
          </div>
        ) : filteredSponsorships.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground space-y-3">
            <HeartHandshake className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="font-semibold text-foreground text-sm">No sponsorships match your criteria</p>
            <p className="text-muted-foreground">Share the sponsorship page or add an offline donation to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Contributor</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Info</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Thank You Letter</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSponsorships.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    {/* Contributor */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        {item.sponsorType === 'organization' ? (
                          <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <User className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                        )}
                        <span className="truncate max-w-[180px]">{item.sponsorName}</span>
                        {item.isAnonymous && (
                          <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            Anon
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {item.email}
                      </div>
                      {item.phone && (
                        <div className="text-[10px] text-muted-foreground/80 font-mono">
                          {item.phone}
                        </div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.sponsorType === 'organization'
                          ? 'bg-blue-500/10 text-blue-600'
                          : 'bg-orange-500/10 text-orange-600'
                      }`}>
                        {item.sponsorType === 'organization' ? 'Organization' : 'Individual'}
                      </span>
                      {item.tier && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                          Tier: {item.tier}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4">
                      <div className="font-black text-sm text-foreground font-mono">
                        {item.currency || 'GHS'} {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB') : 'N/A'}
                      </div>
                    </td>

                    {/* Payment Info */}
                    <td className="py-3 px-4">
                      <div className="text-[11px] text-foreground font-medium">
                        {item.paymentMethod || 'Paystack'}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[140px]">
                        {item.paymentReference || 'N/A'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.paymentStatus === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}>
                        {item.paymentStatus === 'completed' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        <span>{item.paymentStatus === 'completed' ? 'Verified' : 'Pending'}</span>
                      </span>

                      {item.paymentStatus === 'pending' && (
                        <button
                          onClick={() => handleMarkCompleted(item)}
                          className="block text-[10px] text-orange-600 hover:underline mt-1 font-semibold"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>

                    {/* Thank You Status */}
                    <td className="py-3 px-4">
                      {item.thankYouSent ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <Check className="h-3 w-3" />
                            <span>Acknowledged</span>
                          </span>
                          {item.thankYouSentAt && (
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(item.thankYouSentAt).toLocaleDateString('en-GB')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          <Clock className="h-3 w-3" />
                          <span>Not Yet Sent</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => openThankYouDialog(item)}
                          className="bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold h-7 px-2.5 rounded-lg flex items-center gap-1"
                          title="Compose and send an official thank you letter"
                        >
                          <Send className="h-3 w-3" />
                          <span>Thank You</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetailItem(item)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="View Full Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSponsorship(item.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                          title="Delete Record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SEND THANK YOU MODAL */}
      {showThankYouModal && selectedSponsorship && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-5 w-5 text-orange-600" />
                <h3 className="text-base font-bold text-foreground">
                  Send Thank You & Certificate of Appreciation
                </h3>
              </div>
              <button 
                onClick={() => setShowThankYouModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Recipient summary banner */}
            <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipient / Organization:</span>
                <span className="font-bold text-foreground">{selectedSponsorship.sponsorName} ({selectedSponsorship.sponsorType})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contribution:</span>
                <span className="font-bold text-orange-600 font-mono">
                  {selectedSponsorship.currency || 'GHS'} {Number(selectedSponsorship.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="text-foreground">{selectedSponsorship.email || 'None provided'}</span>
              </div>
              {selectedSponsorship.phone && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone / WhatsApp:</span>
                  <span className="text-foreground font-mono">{selectedSponsorship.phone}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSendThankYou} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">
                  Official Letterhead Subject
                </label>
                <Input
                  required
                  value={thankYouSubject}
                  onChange={(e) => setThankYouSubject(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground block">
                    Personalized Letter Body
                  </label>
                  <span className="text-[10px] text-muted-foreground">Includes official Grefas executive branding</span>
                </div>
                <Textarea
                  required
                  rows={6}
                  value={thankYouMessage}
                  onChange={(e) => setThankYouMessage(e.target.value)}
                  className="text-xs leading-relaxed"
                />
              </div>

              {/* Delivery Channels */}
              <div className="space-y-2 pt-1 border-t border-border">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Delivery Channels
                </label>

                <div className="flex flex-col sm:flex-row gap-4">
                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      disabled={!selectedSponsorship.email}
                      onChange={(e) => setSendEmail(e.target.checked)}
                      className="rounded border-border text-orange-600 focus:ring-orange-500 h-4 w-4"
                    />
                    <Mail className="h-3.5 w-3.5 text-orange-600" />
                    <span>Send Official Email (Resend)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendSms}
                      disabled={!selectedSponsorship.phone}
                      onChange={(e) => setSendSms(e.target.checked)}
                      className="rounded border-border text-orange-600 focus:ring-orange-500 h-4 w-4"
                    />
                    <Smartphone className="h-3.5 w-3.5 text-orange-600" />
                    <span>Send Express SMS (Arkesel)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowThankYouModal(false)}
                  disabled={isSendingThankYou}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSendingThankYou}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-9 flex items-center gap-1.5"
                >
                  {isSendingThankYou ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending Letter...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Dispatch Thank You Letter</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-600" />
                <span>Sponsorship Record Overview</span>
              </h3>
              <button onClick={() => setDetailItem(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Contributor</div>
                  <div className="font-bold text-foreground mt-0.5">{detailItem.sponsorName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Category</div>
                  <div className="font-bold text-foreground mt-0.5 uppercase">{detailItem.sponsorType}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Amount Contributed</div>
                  <div className="font-bold text-orange-600 text-sm mt-0.5 font-mono">
                    {detailItem.currency || 'GHS'} {Number(detailItem.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Sponsorship Tier</div>
                  <div className="font-bold text-foreground mt-0.5">{detailItem.tier || 'Supporter'}</div>
                </div>
              </div>

              {detailItem.contactPerson && (
                <div>
                  <span className="text-muted-foreground">Authorized Representative: </span>
                  <span className="font-semibold text-foreground">{detailItem.contactPerson}</span>
                </div>
              )}

              <div>
                <span className="text-muted-foreground">Email: </span>
                <span className="text-foreground">{detailItem.email}</span>
              </div>

              {detailItem.phone && (
                <div>
                  <span className="text-muted-foreground">Phone: </span>
                  <span className="text-foreground font-mono">{detailItem.phone}</span>
                </div>
              )}

              <div>
                <span className="text-muted-foreground">Payment Reference: </span>
                <span className="font-mono text-foreground">{detailItem.paymentReference || 'N/A'}</span>
              </div>

              <div>
                <span className="text-muted-foreground">Payment Channel: </span>
                <span className="text-foreground">{detailItem.paymentMethod}</span>
              </div>

              {detailItem.message && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                    Dedication / Message from Benefactor:
                  </div>
                  <p className="italic text-foreground">"{detailItem.message}"</p>
                </div>
              )}

              {detailItem.thankYouSent && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Official Thank You Dispatched</span>
                  </div>
                  <div className="text-[11px] mt-1">
                    Sent on: {detailItem.thankYouSentAt ? new Date(detailItem.thankYouSentAt).toLocaleString() : 'Yes'}
                  </div>
                  {detailItem.thankYouMessage && (
                    <div className="mt-2 text-[11px] border-t border-emerald-500/20 pt-1.5 text-foreground italic">
                      "{detailItem.thankYouMessage}"
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="text-xs h-9 flex items-center gap-1"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Official Slip</span>
              </Button>
              <Button
                onClick={() => setDetailItem(null)}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-9"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD OFFLINE DONATION MODAL */}
      {showAddManualModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-orange-600" />
                <span>Record Offline / Direct Sponsorship</span>
              </h3>
              <button onClick={() => setShowAddManualModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualSponsorship} className="space-y-4 text-xs">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="manualType"
                    checked={manualType === 'individual'}
                    onChange={() => setManualType('individual')}
                    className="text-orange-600"
                  />
                  <span>Individual Benefactor</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="manualType"
                    checked={manualType === 'organization'}
                    onChange={() => setManualType('organization')}
                    className="text-orange-600"
                  />
                  <span>Organization / Corporate</span>
                </label>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  {manualType === 'organization' ? 'Organization Name *' : 'Donor Full Name *'}
                </label>
                <Input
                  required
                  placeholder="Name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Amount (GH₵) *</label>
                  <Input
                    required
                    type="number"
                    min="1"
                    placeholder="e.g. 500"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Phone Number</label>
                  <Input
                    placeholder="054 123 4567"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Email Address</label>
                <Input
                  type="email"
                  placeholder="sponsor@example.com"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Notes / Cash Receipt Memo</label>
                <Textarea
                  placeholder="e.g. Received cash donation at Nyinahin head office during youth film auditions."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddManualModal(false)}
                  disabled={isSavingManual}
                  className="text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingManual}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold h-9"
                >
                  {isSavingManual ? 'Saving...' : 'Save Contribution'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
