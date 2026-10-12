import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  UserPlus,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Edit,
  Printer,
  Download,
  ShieldCheck,
  Users,
  Briefcase,
  CreditCard,
  Send,
  X,
  Upload,
  Sliders,
  UserCheck,
  Loader2,
  IdCard,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { compressImage, blobToBase64 } from '@/lib/utils';
import { sendArkeselSms } from '@/lib/arkeselSms';
import { useTransactionFee, setLocalTransactionFeeConfig } from '@/lib/transactionFees';

export interface EmployeeRegistrationRecord {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  whatsappNumber?: string;
  role: string;
  department: string;
  employmentType: 'Full-Time' | 'Part-Time' | 'Contract' | 'Retainer / Cast';
  ghanaCardOrId?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  baseSalary: number;
  payFrequency: 'Monthly' | 'Weekly' | 'Hourly' | 'Project-based';
  bankName: string;
  accountNumber: string;
  joiningDate: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  passportPhoto?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

const DEPARTMENT_OPTIONS = [
  'Entertainment & Film Production',
  'Business & Strategy Consulting',
  'Technical, Audio & Camera Crew',
  'Post-Production, Editing & VFX',
  'Artiste & Talent Management',
  'Finance, Admin & Operations',
  'Marketing, PR & Client Relations',
];

const DEFAULT_ROLES = [
  'Actor / Actress',
  'Skit Performer',
  'Director / Producer',
  'Cameraman / Cinematographer',
  'Video Editor',
  'Sound & Lighting Engineer',
  'Creative Scriptwriter',
  'Business Strategy Consultant',
  'Finance & Payroll Officer',
  'Administrative Secretary',
  'Production Coordinator',
];

function generateEmployeeCode(): string {
  const yr = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `GRF-EMP-${yr}-${rand}`;
}

export default function EmployeeRegistration() {
  const { config: feeConfig } = useTransactionFee();
  const [employees, setEmployees] = useState<EmployeeRegistrationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>(DEFAULT_ROLES);

  // Official Registration & Processing Fee Quick Editor State
  const [showFeeEditor, setShowFeeEditor] = useState(false);
  const [officialRegFeeInput, setOfficialRegFeeInput] = useState<string>('50');
  const [processingFeeModeInput, setProcessingFeeModeInput] = useState<'percentage' | 'fixed' | 'waived'>('percentage');
  const [processingFeeRateInput, setProcessingFeeRateInput] = useState<string>('1');
  const [processingFeeFixedInput, setProcessingFeeFixedInput] = useState<string>('0');
  const [officialRegDiscountInput, setOfficialRegDiscountInput] = useState<string>('0');
  const [officialRegNegotiableInput, setOfficialRegNegotiableInput] = useState<boolean>(true);
  const [savingFeeConfig, setSavingFeeConfig] = useState(false);

  // Employee Form States
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    employeeCode: generateEmployeeCode(),
    fullName: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    role: 'Actor / Actress',
    department: DEPARTMENT_OPTIONS[0],
    employmentType: 'Full-Time' as EmployeeRegistrationRecord['employmentType'],
    ghanaCardOrId: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    baseSalary: 1500,
    payFrequency: 'Monthly' as EmployeeRegistrationRecord['payFrequency'],
    bankName: 'MTN Mobile Money / GCB Bank',
    accountNumber: '',
    joiningDate: new Date().toISOString().split('T')[0],
    status: 'Active' as EmployeeRegistrationRecord['status'],
    passportPhoto: '',
    notes: '',
  });

  // Filters & Modals
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRegistrationRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [idCardTarget, setIdCardTarget] = useState<EmployeeRegistrationRecord | null>(null);
  const [smsTarget, setSmsTarget] = useState<EmployeeRegistrationRecord | null>(null);
  const [smsMessage, setSmsMessage] = useState('');
  const [sendingSms, setSendingSms] = useState(false);

  // Listen to settings/global
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setGlobalSettings(data);
          if (Array.isArray(data.intakeRoles) && data.intakeRoles.length > 0) {
            setAvailableRoles(Array.from(new Set([...data.intakeRoles, ...DEFAULT_ROLES])));
          }
          const regPrice = data.intakePrice !== undefined ? Number(data.intakePrice) : 50;
          setOfficialRegFeeInput(String(regPrice));
          const mode =
            data.intakeProcessingFeeMode ||
            (data.transactionFeeEnabled === false ? 'waived' : 'percentage');
          setProcessingFeeModeInput(mode);
          setProcessingFeeRateInput(
            String(data.transactionFeeRate !== undefined ? data.transactionFeeRate : 1.0)
          );
          setProcessingFeeFixedInput(
            String(data.intakeProcessingFeeFixed !== undefined ? data.intakeProcessingFeeFixed : 0)
          );
          setOfficialRegDiscountInput(
            String(data.intakeDiscountPercent !== undefined ? data.intakeDiscountPercent : 0)
          );
          setOfficialRegNegotiableInput(
            data.intakeIsNegotiable !== undefined ? Boolean(data.intakeIsNegotiable) : true
          );
        }
      },
      (err) => {
        console.warn('Settings listener warning:', err);
      }
    );
    return () => unsub();
  }, []);

  // Listen to employees collection
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'employees'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as EmployeeRegistrationRecord[];
        list.sort((a, b) => {
          const tA = new Date(a.createdAt || a.joiningDate || 0).getTime();
          const tB = new Date(b.createdAt || b.joiningDate || 0).getTime();
          return tB - tA;
        });
        setEmployees(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'employees');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Compute current active Official Registration & Processing Fee
  const activeOfficialBaseFee = useMemo(() => {
    const raw =
      globalSettings?.intakePrice !== undefined ? Number(globalSettings.intakePrice) : 50;
    const disc =
      globalSettings?.intakeDiscountPercent !== undefined
        ? Math.min(100, Math.max(0, Number(globalSettings.intakeDiscountPercent) || 0))
        : 0;
    return Math.max(0, Math.round(raw * (1 - disc / 100) * 100) / 100);
  }, [globalSettings]);

  const activeOfficialProcessingFee = useMemo(() => {
    const mode =
      globalSettings?.intakeProcessingFeeMode ||
      (globalSettings?.transactionFeeEnabled === false ? 'waived' : 'percentage');
    if (mode === 'waived') return 0;
    if (mode === 'fixed') {
      return Math.max(
        0,
        Math.round((Number(globalSettings?.intakeProcessingFeeFixed) || 0) * 100) / 100
      );
    }
    const rate =
      globalSettings?.transactionFeeRate !== undefined
        ? Number(globalSettings.transactionFeeRate)
        : feeConfig.ratePercent;
    return Math.max(0, Math.round(((activeOfficialBaseFee * rate) / 100) * 100) / 100);
  }, [globalSettings, activeOfficialBaseFee, feeConfig.ratePercent]);

  const handleSaveOfficialFeeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFeeConfig(true);
    try {
      const cleanBaseFee = Math.max(0, Number(officialRegFeeInput) || 0);
      const cleanDiscount = Math.min(100, Math.max(0, Number(officialRegDiscountInput) || 0));
      const cleanRate = Math.max(0, Number(processingFeeRateInput) || 0);
      const cleanFixed = Math.max(0, Number(processingFeeFixedInput) || 0);
      const feeEnabled = processingFeeModeInput !== 'waived';

      await setDoc(
        doc(db, 'settings', 'global'),
        {
          intakePrice: cleanBaseFee,
          intakeDiscountPercent: cleanDiscount,
          intakeDiscountLabel: cleanDiscount > 0 ? `${cleanDiscount}% OFF` : '',
          intakeIsNegotiable: officialRegNegotiableInput,
          intakeProcessingFeeMode: processingFeeModeInput,
          intakeProcessingFeeFixed: cleanFixed,
          transactionFeeEnabled: feeEnabled,
          transactionFeeRate:
            processingFeeModeInput === 'percentage' ? cleanRate : feeConfig.ratePercent,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      try {
        await setDoc(
          doc(db, 'services', 'default-1'),
          {
            title: 'Audition Casting Form',
            slug: 'audition-casting-form',
            category: 'Entertainment',
            description:
              'Official actor & crew registration for upcoming Grefas feature films, comedy skits, and commercial casting calls across Ghana.',
            iconName: 'Clapperboard',
            color: 'bg-orange-100 text-orange-600',
            intakeOnly: true,
            price: cleanBaseFee,
            discountPercent: cleanDiscount,
            discountLabel: cleanDiscount > 0 ? `${cleanDiscount}% OFF` : '',
            isNegotiable: officialRegNegotiableInput,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {
        // non-blocking
      }

      setLocalTransactionFeeConfig({
        enabled: feeEnabled,
        ratePercent:
          processingFeeModeInput === 'percentage' ? cleanRate : feeConfig.ratePercent,
      });

      toast.success(
        `Official Registration & Processing Fee updated to GH₵ ${cleanBaseFee.toLocaleString()}!`
      );
      setShowFeeEditor(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    } finally {
      setSavingFeeConfig(false);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setFormData({
      employeeCode: generateEmployeeCode(),
      fullName: '',
      email: '',
      phone: '',
      whatsappNumber: '',
      role: availableRoles[0] || 'Actor / Actress',
      department: DEPARTMENT_OPTIONS[0],
      employmentType: 'Full-Time',
      ghanaCardOrId: '',
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      baseSalary: 1500,
      payFrequency: 'Monthly',
      bankName: 'MTN Mobile Money / GCB Bank',
      accountNumber: '',
      joiningDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      passportPhoto: '',
      notes: '',
    });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (emp: EmployeeRegistrationRecord) => {
    setEditingId(emp.id);
    setFormData({
      employeeCode: emp.employeeCode || generateEmployeeCode(),
      fullName: emp.fullName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      whatsappNumber: emp.whatsappNumber || emp.phone || '',
      role: emp.role || 'Actor / Actress',
      department: emp.department || DEPARTMENT_OPTIONS[0],
      employmentType: emp.employmentType || 'Full-Time',
      ghanaCardOrId: emp.ghanaCardOrId || '',
      address: emp.address || '',
      emergencyContactName: emp.emergencyContactName || '',
      emergencyContactPhone: emp.emergencyContactPhone || '',
      baseSalary: Number(emp.baseSalary) || 0,
      payFrequency: emp.payFrequency || 'Monthly',
      bankName: emp.bankName || '',
      accountNumber: emp.accountNumber || '',
      joiningDate: emp.joiningDate || new Date().toISOString().split('T')[0],
      status: emp.status || 'Active',
      passportPhoto: emp.passportPhoto || '',
      notes: emp.notes || '',
    });
    setIsFormOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      toast.error('Please enter the Employee Full Name.');
      return;
    }
    if (!formData.phone.trim() && !formData.email.trim()) {
      toast.error('Please provide at least a Phone Number or Email Address.');
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        employeeCode: formData.employeeCode.trim() || generateEmployeeCode(),
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        whatsappNumber: formData.whatsappNumber.trim() || formData.phone.trim(),
        role: formData.role.trim() || 'Staff Member',
        department: formData.department || DEPARTMENT_OPTIONS[0],
        employmentType: formData.employmentType || 'Full-Time',
        ghanaCardOrId: formData.ghanaCardOrId.trim(),
        address: formData.address.trim(),
        emergencyContactName: formData.emergencyContactName.trim(),
        emergencyContactPhone: formData.emergencyContactPhone.trim(),
        baseSalary: Math.max(0, Number(formData.baseSalary) || 0),
        payFrequency: formData.payFrequency || 'Monthly',
        bankName: formData.bankName.trim(),
        accountNumber: formData.accountNumber.trim(),
        joiningDate: formData.joiningDate || nowIso.split('T')[0],
        status: formData.status || 'Active',
        passportPhoto: formData.passportPhoto || '',
        notes: formData.notes.trim(),
        updatedAt: nowIso,
      };

      if (editingId) {
        await setDoc(doc(db, 'employees', editingId), payload, { merge: true });
        toast.success(`Employee "${payload.fullName}" updated successfully!`);
      } else {
        await addDoc(collection(db, 'employees'), {
          ...payload,
          createdAt: nowIso,
        });
        toast.success(`Employee "${payload.fullName}" registered in the Staff & Payroll directory!`);
      }

      setEditingId(null);
      setFormData({
        employeeCode: generateEmployeeCode(),
        fullName: '',
        email: '',
        phone: '',
        whatsappNumber: '',
        role: availableRoles[0] || 'Actor / Actress',
        department: DEPARTMENT_OPTIONS[0],
        employmentType: 'Full-Time',
        ghanaCardOrId: '',
        address: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        baseSalary: 1500,
        payFrequency: 'Monthly',
        bankName: 'MTN Mobile Money / GCB Bank',
        accountNumber: '',
        joiningDate: new Date().toISOString().split('T')[0],
        status: 'Active',
        passportPhoto: '',
        notes: '',
      });
    } catch (error) {
      handleFirestoreError(
        error,
        editingId ? OperationType.UPDATE : OperationType.CREATE,
        'employees'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusUpdate = async (
    emp: EmployeeRegistrationRecord,
    status: EmployeeRegistrationRecord['status']
  ) => {
    try {
      await setDoc(
        doc(db, 'employees', emp.id),
        { status, updatedAt: new Date().toISOString() },
        { merge: true }
      );
      toast.success(`Updated status for "${emp.fullName}" to ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `employees/${emp.id}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'employees', deleteTarget.id));
      toast.success(`Employee "${deleteTarget.fullName}" permanently deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `employees/${deleteTarget.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendEmployeeSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsTarget) return;
    const recipient = smsTarget.phone || smsTarget.whatsappNumber;
    if (!recipient) {
      toast.error('This employee does not have a phone number on file.');
      return;
    }
    if (!smsMessage.trim()) {
      toast.error('Please enter an SMS message.');
      return;
    }
    setSendingSms(true);
    try {
      await sendArkeselSms(recipient, smsMessage.trim());
      toast.success(`SMS sent to ${smsTarget.fullName} (${recipient})`);
      setSmsTarget(null);
      setSmsMessage('');
    } catch {
      toast.error('Failed to send SMS.');
    } finally {
      setSendingSms(false);
    }
  };

  const exportEmployeesToCSV = () => {
    if (employees.length === 0) {
      toast.error('No registered employees to export.');
      return;
    }
    const headers = [
      'Employee Code',
      'Full Name',
      'Designated Role',
      'Department',
      'Employment Type',
      'Phone',
      'WhatsApp',
      'Email',
      'Ghana Card / ID',
      'Base Salary (GHS)',
      'Pay Frequency',
      'Bank / MoMo Provider',
      'Account / MoMo Number',
      'Joining Date',
      'Status',
    ];
    const rows = employees.map((emp) => [
      emp.employeeCode || '',
      emp.fullName || '',
      emp.role || '',
      emp.department || '',
      emp.employmentType || 'Full-Time',
      emp.phone || '',
      emp.whatsappNumber || '',
      emp.email || '',
      emp.ghanaCardOrId || '',
      emp.baseSalary ?? 0,
      emp.payFrequency || 'Monthly',
      emp.bankName || '',
      emp.accountNumber || '',
      emp.joiningDate || '',
      emp.status || 'Active',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        headers.join(','),
        ...rows.map((r) =>
          r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute(
      'download',
      `grefas_employees_registry_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Employee Registry exported to CSV!');
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        (emp.fullName || '').toLowerCase().includes(q) ||
        (emp.employeeCode || '').toLowerCase().includes(q) ||
        (emp.role || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q) ||
        (emp.email || '').toLowerCase().includes(q) ||
        (emp.phone || '').toLowerCase().includes(q) ||
        (emp.ghanaCardOrId || '').toLowerCase().includes(q);
      const matchesDept =
        departmentFilter === 'ALL' || emp.department === departmentFilter;
      const matchesStatus = statusFilter === 'ALL' || emp.status === statusFilter;
      return matchesQuery && matchesDept && matchesStatus;
    });
  }, [employees, searchQuery, departmentFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === 'Active').length;
    const totalPayrollCommitment = employees
      .filter((e) => e.status === 'Active')
      .reduce((sum, e) => sum + (Number(e.baseSalary) || 0), 0);
    const departmentsCount = new Set(
      employees.map((e) => e.department).filter(Boolean)
    ).size;
    return { total, active, totalPayrollCommitment, departmentsCount };
  }, [employees]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 text-[10px] font-black uppercase tracking-wider mb-2 border border-orange-500/20">
            <UserPlus className="h-3 w-3" /> Official HR &amp; Staff Onboarding Desk
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <UserPlus className="h-7 w-7 text-orange-600 shrink-0" />
            <span>Employee Registration</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
            Register new employees, actors, production crew, and consulting staff. Manage staff biodata, banking/MoMo payout credentials, and print official Employee Registration Dossiers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link to="/admin/payroll">
            <Button
              type="button"
              variant="outline"
              className="h-10 text-xs font-bold cursor-pointer"
            >
              <CreditCard className="h-4 w-4 mr-1.5 text-orange-600" />
              Open Payroll &amp; Payslips
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={exportEmployeesToCSV}
            className="h-10 text-xs font-bold cursor-pointer"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (isFormOpen && !editingId) {
                setIsFormOpen(false);
              } else {
                handleOpenCreateForm();
              }
            }}
            className="h-10 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold px-4 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {isFormOpen && !editingId ? 'Hide Registration Form' : 'Register New Employee'}
          </Button>
        </div>
      </div>

      {/* Live Official Registration & Processing Fee Quick Control Bar */}
      <Card className="border-orange-500/30 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-emerald-500/5">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-orange-600 text-white shrink-0 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-foreground">
                    Official Registration &amp; Processing Fee Control
                  </h3>
                  <span className="text-xs font-black bg-orange-600 text-white px-2.5 py-0.5 rounded-full font-mono">
                    Base Fee: GH₵ {activeOfficialBaseFee.toFixed(2)}
                  </span>
                  <span className="text-xs font-black bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-mono">
                    Processing Fee: GH₵ {activeOfficialProcessingFee.toFixed(2)}
                  </span>
                  <span className="text-xs font-black bg-foreground text-background px-2.5 py-0.5 rounded-full font-mono">
                    Total: GH₵ {(activeOfficialBaseFee + activeOfficialProcessingFee).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Quick-adjust the Official Registration &amp; Processing Fee charged on public registration forms.
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => setShowFeeEditor(!showFeeEditor)}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5 mr-1.5" />
              {showFeeEditor ? 'Close Fee Editor' : 'Edit Official Registration & Processing Fee'}
            </Button>
          </div>

          {showFeeEditor && (
            <form
              onSubmit={handleSaveOfficialFeeSettings}
              className="border-t border-border/60 pt-4 mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-card/90 p-4 rounded-xl border"
            >
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                  Official Registration Fee (GH₵) *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={officialRegFeeInput}
                  onChange={(e) => setOfficialRegFeeInput(e.target.value)}
                  className="h-9 text-xs font-mono font-bold bg-background"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                  Processing Fee Mode
                </label>
                <select
                  value={processingFeeModeInput}
                  onChange={(e) =>
                    setProcessingFeeModeInput(
                      e.target.value as 'percentage' | 'fixed' | 'waived'
                    )
                  }
                  className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-xs font-bold text-foreground"
                >
                  <option value="percentage">Percentage Rate (%)</option>
                  <option value="fixed">Flat Fee Amount (GH₵)</option>
                  <option value="waived">Waived (GH₵ 0.00 / 0%)</option>
                </select>
              </div>

              {processingFeeModeInput === 'percentage' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                    Processing Fee Rate (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={processingFeeRateInput}
                    onChange={(e) => setProcessingFeeRateInput(e.target.value)}
                    className="h-9 text-xs font-mono font-bold bg-background"
                  />
                </div>
              )}

              {processingFeeModeInput === 'fixed' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                    Flat Processing Fee (GH₵)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={processingFeeFixedInput}
                    onChange={(e) => setProcessingFeeFixedInput(e.target.value)}
                    className="h-9 text-xs font-mono font-bold bg-background"
                  />
                </div>
              )}

              {processingFeeModeInput === 'waived' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                    Processing Fee Status
                  </label>
                  <div className="h-9 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 flex items-center text-xs font-bold text-emerald-600">
                    0% Waived (No Charge)
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                  Discount (%) &amp; Negotiable
                </label>
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={officialRegDiscountInput}
                    onChange={(e) => setOfficialRegDiscountInput(e.target.value)}
                    placeholder="0%"
                    className="h-9 text-xs font-mono w-20 bg-background"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setOfficialRegNegotiableInput(!officialRegNegotiableInput)
                    }
                    className={`h-9 px-2.5 rounded-md border text-[10px] font-black uppercase flex-1 cursor-pointer ${
                      officialRegNegotiableInput
                        ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600'
                        : 'border-border bg-muted text-muted-foreground'
                    }`}
                  >
                    {officialRegNegotiableInput ? 'Negotiable: ON' : 'Fixed Only'}
                  </button>
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={savingFeeConfig}
                  className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  {savingFeeConfig ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save Fee Price
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Registered Employees
              </p>
              <p className="text-2xl font-black text-foreground mt-1">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Onboarded Staff &amp; Crew
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Active Employees
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{stats.active}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Currently Active on Roster
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Active Departments
              </p>
              <p className="text-2xl font-black text-indigo-600 mt-1">
                {stats.departmentsCount || 1}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Operational Units
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Base Payroll Schedule
              </p>
              <p className="text-2xl font-black text-orange-600 font-mono mt-1">
                GH₵{' '}
                {stats.totalPayrollCommitment.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Combined Active Base Salaries
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Registration Form Card */}
      {isFormOpen && (
        <Card className="border-2 border-orange-500/40 bg-card shadow-xl">
          <CardHeader className="border-b border-border/60 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-orange-600" />
                {editingId
                  ? 'Edit Employee Registration Record'
                  : 'Official Employee Registration Form'}
              </CardTitle>
              <CardDescription className="text-xs">
                Fill in the employee&apos;s personal details, role assignment, salary structure, and bank/MoMo remittance details. Saved records sync automatically with the Staff &amp; Payroll portal.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsFormOpen(false);
                setEditingId(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSaveEmployee} className="space-y-6">
              {/* Section 1: Identity & Role Assignment */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Employee Staff ID *
                  </label>
                  <Input
                    value={formData.employeeCode}
                    onChange={(e) =>
                      setFormData({ ...formData, employeeCode: e.target.value })
                    }
                    className="font-mono font-bold text-xs bg-muted/40"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Employee Full Name *
                  </label>
                  <Input
                    placeholder="e.g. Samuel Osei Mensah"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Ghana Card / National ID No.
                  </label>
                  <Input
                    placeholder="e.g. GHA-123456789-0"
                    value={formData.ghanaCardOrId}
                    onChange={(e) =>
                      setFormData({ ...formData, ghanaCardOrId: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Designated Role / Job Title *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full h-10 rounded-md border border-border bg-muted/40 px-3 text-xs font-bold text-foreground"
                  >
                    {availableRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    className="w-full h-10 rounded-md border border-border bg-muted/40 px-3 text-xs font-semibold text-foreground"
                  >
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Employment Type
                  </label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        employmentType: e.target
                          .value as EmployeeRegistrationRecord['employmentType'],
                      })
                    }
                    className="w-full h-10 rounded-md border border-border bg-muted/40 px-3 text-xs font-bold text-foreground"
                  >
                    <option value="Full-Time">Full-Time Staff</option>
                    <option value="Part-Time">Part-Time Staff</option>
                    <option value="Contract">Project Contract</option>
                    <option value="Retainer / Cast">Retainer / Cast</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Joining / Start Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) =>
                      setFormData({ ...formData, joiningDate: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              {/* Section 2: Contact & Emergency Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Phone Number *
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. +233 24 123 4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    WhatsApp Number
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. +233 24 123 4567"
                    value={formData.whatsappNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, whatsappNumber: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Official Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="employee@grefas.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Residential Address
                  </label>
                  <Input
                    placeholder="e.g. Nyinahin-Ashanti / Kumasi, Ghana"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Emergency Contact Name
                  </label>
                  <Input
                    placeholder="Next of kin / guarantor name"
                    value={formData.emergencyContactName}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyContactName: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block mb-1">
                    Emergency Contact Phone
                  </label>
                  <Input
                    type="tel"
                    placeholder="+233 24 000 0000"
                    value={formData.emergencyContactPhone}
                    onChange={(e) =>
                      setFormData({ ...formData, emergencyContactPhone: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Section 3: Remuneration & Banking / MoMo Setup */}
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" /> Salary Structure &amp; Payment Account Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Base Salary / Stipend (GH₵) *
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={formData.baseSalary}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          baseSalary: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="h-9 text-xs font-mono font-bold bg-background"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Pay Frequency
                    </label>
                    <select
                      value={formData.payFrequency}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          payFrequency: e.target
                            .value as EmployeeRegistrationRecord['payFrequency'],
                        })
                      }
                      className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-xs font-bold text-foreground"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Hourly">Hourly</option>
                      <option value="Project-based">Project-based</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Bank Name / MoMo Network *
                    </label>
                    <Input
                      placeholder="e.g. GCB Bank / MTN MoMo"
                      value={formData.bankName}
                      onChange={(e) =>
                        setFormData({ ...formData, bankName: e.target.value })
                      }
                      className="h-9 text-xs bg-background"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Account / MoMo Number *
                    </label>
                    <Input
                      placeholder="e.g. 024XXXXXXX or Account No."
                      value={formData.accountNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, accountNumber: e.target.value })
                      }
                      className="h-9 text-xs font-mono bg-background"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                      Employment Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as EmployeeRegistrationRecord['status'],
                        })
                      }
                      className="w-full h-9 rounded-md border border-border bg-background px-2.5 text-xs font-bold text-foreground"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Passport Photo & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block">
                    Employee Passport Photo
                  </label>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border bg-muted/20">
                    {formData.passportPhoto ? (
                      <img
                        src={formData.passportPhoto}
                        alt="Employee Passport"
                        className="h-14 w-14 rounded-lg object-cover border border-orange-500"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        <Users className="h-6 w-6 opacity-50" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <input
                        type="file"
                        id="employee-photo-upload"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const compressed = await compressImage(file, 300, 300, 0.8);
                            const base64 = await blobToBase64(compressed);
                            setFormData((prev) => ({ ...prev, passportPhoto: base64 }));
                            toast.success('Employee passport photo attached!');
                          } catch {
                            toast.error('Could not process image.');
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          document.getElementById('employee-photo-upload')?.click()
                        }
                        className="h-8 text-xs font-bold cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" /> Upload Photo
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground block">
                    HR Onboarding Notes / Contract Summary
                  </label>
                  <Textarea
                    rows={3}
                    placeholder="Record contract terms, assigned equipment, KPIs, or special remarks..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  {editingId ? 'Save Employee Changes' : 'Complete Employee Registration'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee name, staff ID, role, phone, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground"
          >
            <option value="ALL">All Departments</option>
            {DEPARTMENT_OPTIONS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Registered Employees Directory */}
      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-border bg-card/40">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            <p className="text-xs font-semibold text-muted-foreground">
              Loading Registered Employees directory...
            </p>
          </div>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <Card className="border-dashed border-border bg-card/40">
          <CardContent className="p-10 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              No Registered Employees Found
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Use the Official Employee Registration Form above to onboard staff members, actors, crew, and consultants.
            </p>
            {!isFormOpen && (
              <Button
                type="button"
                onClick={handleOpenCreateForm}
                className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Register First Employee
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredEmployees.map((emp) => (
            <Card
              key={emp.id}
              className="border border-border/80 bg-card hover:border-orange-500/40 transition-all flex flex-col justify-between"
            >
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {emp.passportPhoto ? (
                      <img
                        src={emp.passportPhoto}
                        alt={emp.fullName}
                        className="h-12 w-12 rounded-xl object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center shrink-0 font-black text-sm">
                        {(emp.fullName || 'E').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-black text-foreground truncate">
                          {emp.fullName}
                        </CardTitle>
                        {emp.employeeCode && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {emp.employeeCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {emp.role} • {emp.department || 'General Operations'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                        emp.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : emp.status === 'Suspended'
                          ? 'bg-red-500/10 text-red-600 border-red-500/30'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                      }`}
                    >
                      {emp.status || 'Active'}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600">
                      GH₵ {Number(emp.baseSalary || 0).toLocaleString()} /{' '}
                      {emp.payFrequency || 'Monthly'}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                    <span className="truncate">{emp.phone || 'N/A'}</span>
                  </div>
                  {emp.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                      <span className="truncate">{emp.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                    <span className="truncate">
                      {emp.bankName || 'N/A'} ({emp.accountNumber || 'N/A'})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                    <span className="truncate">
                      {emp.employmentType || 'Full-Time'} • Joined{' '}
                      {emp.joiningDate || 'N/A'}
                    </span>
                  </div>
                  {emp.address && (
                    <div className="flex items-center gap-1.5 sm:col-span-2">
                      <MapPin className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                      <span className="truncate">{emp.address}</span>
                    </div>
                  )}
                </div>

                {emp.notes && (
                  <p className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50 line-clamp-2">
                    {emp.notes}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/50">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {emp.status !== 'Active' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleQuickStatusUpdate(emp, 'Active')}
                        className="h-7 px-2.5 text-[11px] font-bold border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Set Active
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setIdCardTarget(emp)}
                      className="h-7 px-2.5 text-[11px] font-bold cursor-pointer"
                    >
                      <IdCard className="h-3 w-3 mr-1" /> Registration Card
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSmsTarget(emp);
                        setSmsMessage(
                          `Hello ${emp.fullName}, your official employee registration (${emp.employeeCode || 'Staff'}) as ${emp.role} at Grefas Consult & Entertainment is confirmed. Welcome aboard!`
                        );
                      }}
                      className="h-7 px-2.5 text-[11px] font-bold cursor-pointer"
                    >
                      <Send className="h-3 w-3 mr-1" /> SMS
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEditForm(emp)}
                      className="h-7 px-2.5 text-[11px] font-bold text-orange-600 hover:bg-orange-500/10 cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget(emp)}
                      className="h-7 px-2.5 text-[11px] font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Printable Official Employee Registration Dossier / ID Modal */}
      {idCardTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-black rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 border-4 border-orange-600">
            <div className="flex items-center justify-between border-b-2 border-black pb-4 print:hidden">
              <h3 className="font-black text-sm uppercase tracking-wider text-orange-600">
                Official Employee Registration Dossier
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" /> Print Dossier
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setIdCardTarget(null)}
                  className="text-xs font-bold text-black border-gray-300"
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="border-2 border-black p-6 rounded-xl space-y-5">
              <div className="flex items-center justify-between border-b-2 border-black pb-4">
                <div>
                  <h1 className="text-xl font-black uppercase tracking-widest">
                    GREFAS CONSULT &amp; ENTERTAINMENT
                  </h1>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-700 mt-1">
                    Official Employee Registration &amp; Staff Onboarding Record
                  </p>
                  <p className="text-[11px] font-mono mt-1">
                    Staff ID: <strong>{idCardTarget.employeeCode || idCardTarget.id}</strong> • Status:{' '}
                    <strong>{idCardTarget.status}</strong>
                  </p>
                </div>
                {idCardTarget.passportPhoto && (
                  <img
                    src={idCardTarget.passportPhoto}
                    alt={idCardTarget.fullName}
                    className="h-20 w-20 rounded-xl object-cover border-2 border-black"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px]">
                    Employee Full Name
                  </p>
                  <p className="font-black text-sm">{idCardTarget.fullName}</p>
                </div>
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px]">
                    Designated Role &amp; Department
                  </p>
                  <p className="font-bold">
                    {idCardTarget.role} ({idCardTarget.department || 'Operations'})
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px]">
                    Employment Type &amp; Start Date
                  </p>
                  <p className="font-semibold">
                    {idCardTarget.employmentType || 'Full-Time'} • Joined{' '}
                    {idCardTarget.joiningDate}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px]">
                    National ID / Ghana Card
                  </p>
                  <p className="font-semibold">
                    {idCardTarget.ghanaCardOrId || 'On File'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px]">
                    Contact Channels
                  </p>
                  <p className="font-semibold">
                    {idCardTarget.phone} • {idCardTarget.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-bold uppercase text-[10px]">
                    Remuneration &amp; Payout Account
                  </p>
                  <p className="font-mono font-black text-emerald-700">
                    GH₵ {Number(idCardTarget.baseSalary || 0).toLocaleString()} (
                    {idCardTarget.payFrequency}) • {idCardTarget.bankName}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-300 pt-4 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold">Employee Signature:</p>
                  <p className="text-gray-500 mt-4">____________________________</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">
                    {globalSettings?.adminSignatureName ||
                      'Authorized HR / Executive Signatory'}
                  </p>
                  <p className="text-[10px] uppercase text-gray-600">
                    Grefas Consult &amp; Entertainment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMS Dispatch Modal */}
      {smsTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-card border-border shadow-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Send className="h-4 w-4 text-orange-600" />
                Send SMS to {smsTarget.fullName}
              </CardTitle>
              <CardDescription className="text-xs">
                Recipient: {smsTarget.phone || smsTarget.whatsappNumber}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendEmployeeSms} className="space-y-4">
                <Textarea
                  rows={4}
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  className="text-xs"
                  required
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSmsTarget(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sendingSms}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold"
                  >
                    {sendingSms ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Dispatch SMS
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-card border-border shadow-2xl">
            <CardHeader>
              <CardTitle className="text-base font-bold text-red-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" /> Delete Employee Record
              </CardTitle>
              <CardDescription className="text-xs">
                Are you sure you want to permanently delete{' '}
                <strong>{deleteTarget.fullName}</strong>? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Permanently Delete
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
