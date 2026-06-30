import * as React from 'react';
import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot,
  where,
  getDocs
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  CreditCard, 
  Plus, 
  Edit2, 
  Trash2, 
  Bell, 
  Send, 
  DollarSign, 
  Calendar, 
  ChevronRight, 
  Check, 
  Loader2, 
  X, 
  Printer, 
  Search,
  CheckCircle,
  AlertCircle,
  Smartphone,
  Mail,
  Building2,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Award
} from 'lucide-react';
import { toast } from 'sonner';

// Type definitions
interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  baseSalary: number;
  payFrequency: 'Monthly' | 'Weekly' | 'Hourly' | 'Project-based';
  bankName: string;
  accountNumber: string;
  joiningDate: string;
  status: 'Active' | 'Inactive' | 'Suspended';
  userId?: string; // Optional matched user UID
}

interface SalaryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole: string;
  payPeriod: string; // e.g. "June 2026"
  baseAmount: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  paymentMethod: 'Bank Transfer' | 'Mobile Money' | 'Cash' | 'Cheque';
  status: 'Draft' | 'Approved' | 'Paid' | 'Processing';
  paymentRef: string;
  paidDate: string;
  notes: string;
  createdAt: string;
}

export default function ManageEmployeesPayroll() {
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingSalaries, setLoadingSalaries] = useState(true);

  // Saving states
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [isSavingPayroll, setIsSavingPayroll] = useState(false);

  // Custom delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    id: string;
    name: string;
    type: 'employee' | 'payroll';
  } | null>(null);

  // Search & Filter
  const [empSearch, setEmpSearch] = useState('');
  const [empRoleFilter, setEmpRoleFilter] = useState('all');
  const [payrollSearch, setPayrollSearch] = useState('');

  // Modals / Form Triggers
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [isPayrollFormOpen, setIsPayrollFormOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<SalaryRecord | null>(null);
  
  const [isNotificationFormOpen, setIsNotificationFormOpen] = useState(false);
  const [notificationRecipient, setNotificationRecipient] = useState<Employee | null>(null);

  const [selectedPayslip, setSelectedPayslip] = useState<SalaryRecord | null>(null);

  // Form Fields - Employee
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empRole, setEmpRole] = useState('Actor / Actress');
  const [empBaseSalary, setEmpBaseSalary] = useState('');
  const [empPayFrequency, setEmpPayFrequency] = useState<'Monthly' | 'Weekly' | 'Hourly' | 'Project-based'>('Monthly');
  const [empBankName, setEmpBankName] = useState('');
  const [empAccountNumber, setEmpAccountNumber] = useState('');
  const [empJoiningDate, setEmpJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [empStatus, setEmpStatus] = useState<'Active' | 'Inactive' | 'Suspended'>('Active');

  // Form Fields - Salary Preparation
  const [salEmployeeId, setSalEmployeeId] = useState('');
  const [salPayPeriod, setSalPayPeriod] = useState(`${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`);
  const [salBaseAmount, setSalBaseAmount] = useState('');
  const [salAllowances, setSalAllowances] = useState('0');
  const [salDeductions, setSalDeductions] = useState('0');
  const [salPaymentMethod, setSalPaymentMethod] = useState<'Bank Transfer' | 'Mobile Money' | 'Cash' | 'Cheque'>('Bank Transfer');
  const [salStatus, setSalStatus] = useState<'Draft' | 'Approved' | 'Paid' | 'Processing'>('Paid');
  const [salPaymentRef, setSalPaymentRef] = useState('');
  const [salPaidDate, setSalPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [salNotes, setSalNotes] = useState('');

  // Form Fields - Notification
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');

  // Fetch Employees
  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('fullName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Employee);
      });
      setEmployees(list);
      setLoadingEmployees(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'employees');
      setLoadingEmployees(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Salaries
  useEffect(() => {
    const q = query(collection(db, 'salaries'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SalaryRecord[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as SalaryRecord);
      });
      setSalaries(list);
      setLoadingSalaries(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'salaries');
      setLoadingSalaries(false);
    });

    return () => unsubscribe();
  }, []);

  // On selecting an employee in payroll form, auto-fill base salary
  useEffect(() => {
    if (salEmployeeId && !editingPayroll) {
      const selectedEmp = employees.find(e => e.id === salEmployeeId);
      if (selectedEmp) {
        setSalBaseAmount(selectedEmp.baseSalary.toString());
        setSalNotes(`Salary payment for ${selectedEmp.fullName} (${selectedEmp.role})`);
      }
    }
  }, [salEmployeeId, employees, editingPayroll]);

  // Handle Employee Form Reset/Close
  const handleCloseEmployeeForm = () => {
    setIsEmployeeFormOpen(false);
    setEditingEmployee(null);
    setEmpName('');
    setEmpEmail('');
    setEmpPhone('');
    setEmpRole('Actor / Actress');
    setEmpBaseSalary('');
    setEmpPayFrequency('Monthly');
    setEmpBankName('');
    setEmpAccountNumber('');
    setEmpJoiningDate(new Date().toISOString().split('T')[0]);
    setEmpStatus('Active');
  };

  // Handle Payroll Form Reset/Close
  const handleClosePayrollForm = () => {
    setIsPayrollFormOpen(false);
    setEditingPayroll(null);
    setSalEmployeeId('');
    setSalPayPeriod(`${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`);
    setSalBaseAmount('');
    setSalAllowances('0');
    setSalDeductions('0');
    setSalPaymentMethod('Bank Transfer');
    setSalStatus('Paid');
    setSalPaymentRef('');
    setSalPaidDate(new Date().toISOString().split('T')[0]);
    setSalNotes('');
  };

  // Handle Notification Form Reset/Close
  const handleCloseNotificationForm = () => {
    setIsNotificationFormOpen(false);
    setNotificationRecipient(null);
    setNotifTitle('');
    setNotifMessage('');
  };

  // Save/Update Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empEmail.trim() || !empPhone.trim()) {
      toast.error('Please fill in Name, Email and Phone details.');
      return;
    }

    const payload = {
      fullName: empName.trim(),
      email: empEmail.trim().toLowerCase(),
      phone: empPhone.trim(),
      role: empRole,
      baseSalary: parseFloat(empBaseSalary) || 0,
      payFrequency: empPayFrequency,
      bankName: empBankName.trim(),
      accountNumber: empAccountNumber.trim(),
      joiningDate: empJoiningDate,
      status: empStatus,
      updatedAt: new Date().toISOString()
    };

    setIsSavingEmployee(true);
    try {
      if (editingEmployee) {
        await updateDoc(doc(db, 'employees', editingEmployee.id), payload);
        toast.success(`Employee ${empName} updated successfully!`);
      } else {
        // Find if this employee is registered as a user in our system by matching email
        let matchedUserId = '';
        try {
          const uq = query(collection(db, 'users'), where('email', '==', payload.email));
          const snap = await getDocs(uq);
          if (!snap.empty) {
            matchedUserId = snap.docs[0].id;
          }
        } catch (e) {
          console.warn("Failed to lookup matched user ID by email:", e);
        }

        const newDoc = {
          ...payload,
          userId: matchedUserId || null,
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'employees'), newDoc);
        toast.success(`Employee ${empName} registered successfully!`);
      }
      handleCloseEmployeeForm();
    } catch (error) {
      console.error("Error saving employee:", error);
      toast.error("Failed to register employee details.");
    } finally {
      setIsSavingEmployee(false);
    }
  };

  // Delete Employee - triggers custom modal
  const handleDeleteEmployee = async (id: string, name: string) => {
    setDeleteConfirmation({
      id,
      name,
      type: 'employee'
    });
  };

  // Edit Employee Loader
  const handleStartEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setEmpName(emp.fullName);
    setEmpEmail(emp.email);
    setEmpPhone(emp.phone);
    setEmpRole(emp.role);
    setEmpBaseSalary(emp.baseSalary.toString());
    setEmpPayFrequency(emp.payFrequency);
    setEmpBankName(emp.bankName || '');
    setEmpAccountNumber(emp.accountNumber || '');
    setEmpJoiningDate(emp.joiningDate || new Date().toISOString().split('T')[0]);
    setEmpStatus(emp.status);
    setIsEmployeeFormOpen(true);
  };

  // Save/Update Payroll Salary
  const handleSavePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salEmployeeId) {
      toast.error('Please select an employee.');
      return;
    }

    const employeeObj = employees.find(emp => emp.id === salEmployeeId);
    if (!employeeObj) {
      toast.error('Selected employee not found.');
      return;
    }

    const baseNum = parseFloat(salBaseAmount) || 0;
    const allowancesNum = parseFloat(salAllowances) || 0;
    const deductionsNum = parseFloat(salDeductions) || 0;
    const netCalculated = baseNum + allowancesNum - deductionsNum;

    const payload = {
      employeeId: salEmployeeId,
      employeeName: employeeObj.fullName,
      employeeEmail: employeeObj.email,
      employeeRole: employeeObj.role,
      payPeriod: salPayPeriod.trim(),
      baseAmount: baseNum,
      allowances: allowancesNum,
      deductions: deductionsNum,
      netSalary: netCalculated,
      paymentMethod: salPaymentMethod,
      status: salStatus,
      paymentRef: salPaymentRef.trim(),
      paidDate: salPaidDate,
      notes: salNotes.trim(),
      updatedAt: new Date().toISOString()
    };

    setIsSavingPayroll(true);
    try {
      if (editingPayroll) {
        await updateDoc(doc(db, 'salaries', editingPayroll.id), payload);
        toast.success(`Payslip for ${employeeObj.fullName} updated successfully!`);
      } else {
        const newRecord = {
          ...payload,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'salaries'), newRecord);

        // Notify employee of payment if status is "Paid" or "Processing"
        if (salStatus === 'Paid' || salStatus === 'Processing') {
          // Attempt to find user UID
          let employeeUid = employeeObj.userId || '';
          if (!employeeUid) {
            try {
              const uq = query(collection(db, 'users'), where('email', '==', employeeObj.email));
              const snap = await getDocs(uq);
              if (!snap.empty) {
                employeeUid = snap.docs[0].id;
              }
            } catch (_) {}
          }

          // Generate custom notification payload
          await addDoc(collection(db, 'notifications'), {
            userId: employeeUid || 'admin', // Fallback to admin if they don't have account yet
            userEmail: employeeObj.email,
            title: `Salary Dispatched: ${salPayPeriod}`,
            message: `Hello ${employeeObj.fullName.split(' ')[0]}, your salary of GHS ${netCalculated.toLocaleString()} for the period ${salPayPeriod} has been processed via ${salPaymentMethod}. status: ${salStatus}.`,
            type: 'salary',
            read: false,
            createdAt: new Date().toISOString()
          });
        }

        toast.success(`Payroll record prepared for ${employeeObj.fullName}!`);
      }
      handleClosePayrollForm();
    } catch (error) {
      console.error("Error preparing payroll:", error);
      toast.error("Failed to save payroll salary record.");
    } finally {
      setIsSavingPayroll(false);
    }
  };

  // Delete Payroll - triggers custom modal
  const handleDeletePayroll = async (id: string, employeeName: string) => {
    setDeleteConfirmation({
      id,
      name: `payroll record for ${employeeName}`,
      type: 'payroll'
    });
  };

  // Confirm delete handler for custom modal
  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id, name, type } = deleteConfirmation;
    try {
      if (type === 'employee') {
        await deleteDoc(doc(db, 'employees', id));
        toast.success(`Employee "${name}" has been deleted from the registry.`);
      } else {
        await deleteDoc(doc(db, 'salaries', id));
        toast.success(`Payroll record has been removed.`);
      }
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      toast.error(`Failed to delete ${type}.`);
    } finally {
      setDeleteConfirmation(null);
    }
  };

  // Edit Payroll Loader
  const handleStartEditPayroll = (record: SalaryRecord) => {
    setEditingPayroll(record);
    setSalEmployeeId(record.employeeId);
    setSalPayPeriod(record.payPeriod);
    setSalBaseAmount(record.baseAmount.toString());
    setSalAllowances(record.allowances.toString());
    setSalDeductions(record.deductions.toString());
    setSalPaymentMethod(record.paymentMethod);
    setSalStatus(record.status);
    setSalPaymentRef(record.paymentRef || '');
    setSalPaidDate(record.paidDate);
    setSalNotes(record.notes || '');
    setIsPayrollFormOpen(true);
  };

  // Dispatch custom staff notification
  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationRecipient) return;
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast.error('Please enter a notification Title and Message.');
      return;
    }

    try {
      // Find matched user UID
      let userUid = notificationRecipient.userId || '';
      if (!userUid) {
        try {
          const uq = query(collection(db, 'users'), where('email', '==', notificationRecipient.email));
          const snap = await getDocs(uq);
          if (!snap.empty) {
            userUid = snap.docs[0].id;
          }
        } catch (_) {}
      }

      // Add to standard notifications
      await addDoc(collection(db, 'notifications'), {
        userId: userUid || 'admin',
        userEmail: notificationRecipient.email,
        title: notifTitle.trim(),
        message: notifMessage.trim(),
        type: 'staff_alert',
        read: false,
        createdAt: new Date().toISOString()
      });

      toast.success(`Notification sent successfully to ${notificationRecipient.fullName}!`);
      handleCloseNotificationForm();
    } catch (error) {
      console.error("Error dispatching notification:", error);
      toast.error("Failed to send notification.");
    }
  };

  // Trigger print-friendly payslip
  const handlePrintPayslip = (slip: SalaryRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocker active. Please allow popups to print salary slips!');
      return;
    }

    const formatGHS = (amount: number) => `GHS ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    printWindow.document.write(`
      <html>
        <head>
          <title>Salary Payslip - ${slip.employeeName} - ${slip.payPeriod}</title>
          <style>
            body { 
              font-family: 'Inter', system-ui, sans-serif; 
              color: #1f2937; 
              padding: 40px; 
              max-width: 800px; 
              margin: 0 auto; 
              line-height: 1.5;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 24px;
              margin-bottom: 30px;
            }
            .brand-section h1 {
              font-size: 24px;
              font-weight: 800;
              letter-spacing: -0.025em;
              margin: 0;
              color: #ea580c;
            }
            .brand-section p {
              font-size: 11px;
              color: #4b5563;
              text-transform: uppercase;
              font-weight: bold;
              letter-spacing: 0.05em;
              margin: 4px 0 0 0;
            }
            .slip-title {
              font-size: 18px;
              font-weight: 700;
              color: #111827;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              text-align: right;
            }
            .meta-grid {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 30px;
              margin-bottom: 40px;
            }
            .meta-box h3 {
              font-size: 12px;
              font-weight: 700;
              color: #9ca3af;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin: 0 0 10px 0;
              border-bottom: 1px solid #f3f4f6;
              padding-bottom: 4px;
            }
            .meta-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              margin-bottom: 6px;
            }
            .meta-label {
              color: #6b7280;
              font-weight: 500;
            }
            .meta-value {
              color: #111827;
              font-weight: 600;
            }
            .ledger-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 40px;
            }
            .ledger-table th {
              background-color: #f9fafb;
              color: #374151;
              font-size: 12px;
              text-transform: uppercase;
              font-weight: 700;
              text-align: left;
              padding: 10px 16px;
              border-bottom: 2px solid #e5e7eb;
            }
            .ledger-table td {
              font-size: 13px;
              padding: 12px 16px;
              border-bottom: 1px solid #f3f4f6;
            }
            .amount-col {
              text-align: right;
            }
            .net-pay-card {
              background-color: #fff7ed;
              border: 1px solid #ffedd5;
              border-radius: 8px;
              padding: 20px;
              margin-bottom: 40px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .net-pay-title {
              font-size: 14px;
              font-weight: 700;
              color: #c2410c;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            .net-pay-value {
              font-size: 24px;
              font-weight: 800;
              color: #ea580c;
            }
            .signatures {
              display: grid;
              grid-template-cols: 1fr 1fr;
              gap: 40px;
              margin-top: 60px;
              font-size: 12px;
              text-align: center;
            }
            .sig-line {
              border-top: 1px dashed #9ca3af;
              margin-top: 50px;
              padding-top: 8px;
              color: #4b5563;
              font-weight: 600;
            }
            .footer-note {
              text-align: center;
              font-size: 10px;
              color: #9ca3af;
              margin-top: 8px;
              border-top: 1px solid #f3f4f6;
              padding-top: 20px;
            }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="brand-section">
              <h1>GREFAS ENTERTAINMENT</h1>
              <p>Consulting & World-Class Production Services</p>
              <div style="font-size: 11px; color: #6b7280; margin-top: 6px;">Nyinahin-Ashanti, Ashanti Region, Ghana</div>
            </div>
            <div>
              <div class="slip-title">Official Payslip</div>
              <div style="font-size: 13px; font-weight: 600; color: #4b5563; text-align: right; margin-top: 4px;">Period: ${slip.payPeriod}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-box">
              <h3>Employee Details</h3>
              <div class="meta-row">
                <span class="meta-label">Name:</span>
                <span class="meta-value">${slip.employeeName}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Designated Role:</span>
                <span class="meta-value">${slip.employeeRole}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Email Address:</span>
                <span class="meta-value">${slip.employeeEmail}</span>
              </div>
            </div>
            <div class="meta-box">
              <h3>Payment Metadata</h3>
              <div class="meta-row">
                <span class="meta-label">Payment Date:</span>
                <span class="meta-value">${slip.paidDate}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Payment Method:</span>
                <span class="meta-value">${slip.paymentMethod}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Reference ID:</span>
                <span class="meta-value">${slip.paymentRef || 'N/A'}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Status:</span>
                <span class="meta-value" style="color: ${slip.status === 'Paid' ? '#16a34a' : '#ea580c'}">${slip.status}</span>
              </div>
            </div>
          </div>

          <table class="ledger-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="amount-col">Earnings</th>
                <th class="amount-col">Deductions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Basic Performance / Work Stipend</td>
                <td class="amount-col">${formatGHS(slip.baseAmount)}</td>
                <td class="amount-col">-</td>
              </tr>
              <tr>
                <td>Allowances, Travel & Bonuses</td>
                <td class="amount-col">${formatGHS(slip.allowances)}</td>
                <td class="amount-col">-</td>
              </tr>
              <tr>
                <td>Withholding Tax & Advances</td>
                <td class="amount-col">-</td>
                <td class="amount-col">${formatGHS(slip.deductions)}</td>
              </tr>
              <tr style="font-weight: bold; border-top: 2px solid #e5e7eb; background-color: #fafafa;">
                <td>Sub-totals</td>
                <td class="amount-col">${formatGHS(slip.baseAmount + slip.allowances)}</td>
                <td class="amount-col">${formatGHS(slip.deductions)}</td>
              </tr>
            </tbody>
          </table>

          <div class="net-pay-card">
            <div>
              <div class="net-pay-title">Net Dispatched Remuneration</div>
              <div style="font-size: 11px; color: #9a3412; margin-top: 4px;">This is the total net amount credited to your bank / mobile wallet.</div>
            </div>
            <div class="net-pay-value">${formatGHS(slip.netSalary)}</div>
          </div>

          ${slip.notes ? `
            <div style="margin-bottom: 40px; padding: 15px; background: #f9fafb; border-radius: 8px; font-size: 13px;">
              <strong style="display: block; font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 5px;">Admin Notes & Remittance Memo:</strong>
              ${slip.notes}
            </div>
          ` : ''}

          <div class="signatures">
            <div>
              <div class="sig-line">Prepared & Certified By Grefas Admin</div>
            </div>
            <div>
              <div class="sig-line">Employee Signature & Acceptance</div>
            </div>
          </div>

          <div class="footer-note">
            This salary statement is an official electronic record generated by Grefas Consult & Entertainment administrative portal.<br>
            For any clarifications, please coordinate with the finance desk immediately.
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter lists
  const filteredEmployees = employees.filter(e => {
    const matchesSearch = e.fullName.toLowerCase().includes(empSearch.toLowerCase()) || 
                          e.email.toLowerCase().includes(empSearch.toLowerCase()) ||
                          e.phone.includes(empSearch) ||
                          e.role.toLowerCase().includes(empSearch.toLowerCase());
    const matchesRole = empRoleFilter === 'all' || e.role === empRoleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredSalaries = salaries.filter(s => {
    return s.employeeName.toLowerCase().includes(payrollSearch.toLowerCase()) || 
           s.employeeEmail.toLowerCase().includes(payrollSearch.toLowerCase()) ||
           s.payPeriod.toLowerCase().includes(payrollSearch.toLowerCase()) ||
           s.paymentMethod.toLowerCase().includes(payrollSearch.toLowerCase());
  });

  const uniqueRoles = Array.from(new Set(employees.map(e => e.role)));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-orange-600" /> Staff Portal & Payroll Desk
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register employees, prepare salary records, print professional payslips, and dispatch targeted alerts.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            id="btn-register-employee-init"
            onClick={() => setIsEmployeeFormOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold gap-1.5 h-10 px-4 rounded-xl cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Register Staff
          </Button>
          <Button
            id="btn-prepare-salary-init"
            onClick={() => setIsPayrollFormOpen(true)}
            variant="outline"
            className="text-xs font-bold gap-1.5 h-10 px-4 rounded-xl border-orange-200 hover:bg-orange-50 hover:text-orange-700 text-foreground cursor-pointer"
          >
            <DollarSign className="h-4 w-4" /> Prepare Salary
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('employees')}
          className={`px-5 py-3 text-sm font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === 'employees' 
              ? 'border-orange-600 text-orange-600' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          👥 Employee Directory ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('payroll')}
          className={`px-5 py-3 text-sm font-extrabold border-b-2 transition-all cursor-pointer ${
            activeTab === 'payroll' 
              ? 'border-orange-600 text-orange-600' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          💳 Salary Slips & Payroll ({salaries.length})
        </button>
      </div>

      {/* ====================================================================
          TAB CONTENT: EMPLOYEES
          ==================================================================== */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-employees-input"
                placeholder="Search staff by name, email, phone, or role..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="pl-9 h-10 text-xs rounded-xl"
              />
            </div>
            <select
              id="filter-employees-role"
              value={empRoleFilter}
              onChange={(e) => setEmpRoleFilter(e.target.value)}
              className="h-10 text-xs bg-background border border-border px-3 rounded-xl font-semibold max-w-[200px]"
            >
              <option value="all">All Roles</option>
              <option value="Actor / Actress">Actor / Actress</option>
              <option value="Skit Performer">Skit Performer</option>
              <option value="Creative Writer">Creative Writer</option>
              <option value="Crew / Technical">Crew / Technical</option>
              <option value="Video Editor">Video Editor</option>
              <option value="Cameraman">Cameraman</option>
              <option value="Sound Engineer">Sound Engineer</option>
              <option value="Director">Director</option>
              <option value="Finance Officer">Finance Officer</option>
              <option value="Admin Support">Admin Support</option>
              {uniqueRoles.filter(r => !['Actor / Actress', 'Skit Performer', 'Creative Writer', 'Crew / Technical', 'Video Editor', 'Cameraman', 'Sound Engineer', 'Director', 'Finance Officer', 'Admin Support'].includes(r)).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Directory Grid */}
          {loadingEmployees ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <CardContent className="space-y-3">
                <Users className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
                <h3 className="text-sm font-bold">No Staff Members Found</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {employees.length === 0 
                    ? "Your staff directory is currently empty. Click 'Register Staff' to log your first employee in the Grefas roster."
                    : "No staff members match your current filters. Clear your search or filter settings."}
                </p>
                {employees.length === 0 && (
                  <Button
                    onClick={() => setIsEmployeeFormOpen(true)}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                  >
                    Add Employee Now
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map((emp) => (
                <Card key={emp.id} className="overflow-hidden border/70 shadow-xs hover:shadow-md transition-all">
                  <div className="bg-orange-500/5 px-4 py-3 border-b flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-600">
                        {emp.role}
                      </span>
                      <h3 className="font-bold text-sm tracking-tight text-foreground block mt-0.5">
                        {emp.fullName}
                      </h3>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      emp.status === 'Active' 
                        ? 'bg-green-100 text-green-700' 
                        : emp.status === 'Suspended'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {emp.status}
                    </span>
                  </div>
                  <CardContent className="p-4 space-y-3.5">
                    {/* Contact Details */}
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-orange-500/80" />
                        <span className="truncate">{emp.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Smartphone className="h-3.5 w-3.5 shrink-0 text-orange-500/80" />
                        <span>{emp.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-orange-500/80" />
                        <span>Joined {new Date(emp.joiningDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Pay & Bank details */}
                    <div className="bg-muted/40 p-3 rounded-lg space-y-1.5 border">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Base Remuneration</span>
                        <span className="text-xs font-black text-orange-600">
                          GHS {emp.baseSalary.toLocaleString()} / <span className="text-[10px] text-muted-foreground font-normal">{emp.payFrequency.replace('ly', '')}</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-muted border-dashed">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> Remittance Bank
                        </span>
                        <span className="text-[11px] font-bold text-foreground">
                          {emp.bankName ? `${emp.bankName} (${emp.accountNumber})` : 'Not configured'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 justify-end pt-1">
                      <Button
                        onClick={() => {
                          setNotificationRecipient(emp);
                          setIsNotificationFormOpen(true);
                        }}
                        variant="ghost"
                        size="icon"
                        title="Send Direct Notification"
                        className="h-8 w-8 hover:text-orange-600 hover:bg-orange-50 text-muted-foreground rounded-lg"
                      >
                        <Bell className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleStartEditEmployee(emp)}
                        variant="ghost"
                        size="icon"
                        title="Edit Details"
                        className="h-8 w-8 hover:text-blue-600 hover:bg-blue-50 text-muted-foreground rounded-lg"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteEmployee(emp.id, emp.fullName)}
                        variant="ghost"
                        size="icon"
                        title="Remove Employee"
                        className="h-8 w-8 hover:text-red-600 hover:bg-red-50 text-muted-foreground rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          TAB CONTENT: PAYROLL
          ==================================================================== */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Filter and stats banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-payroll-input"
                  placeholder="Search payroll history by employee name, email, month, or method..."
                  value={payrollSearch}
                  onChange={(e) => setPayrollSearch(e.target.value)}
                  className="pl-9 h-10 text-xs rounded-xl"
                />
              </div>
            </div>
            <div className="bg-orange-500/5 border border-orange-200/50 p-3 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-orange-600">Total Outflow</p>
                <p className="text-lg font-black text-foreground mt-0.5">
                  GHS {salaries.reduce((sum, s) => s.status === 'Paid' ? sum + s.netSalary : sum, 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="h-7 w-7 text-orange-500 opacity-65" />
            </div>
          </div>

          {/* Salaries List Table */}
          {loadingSalaries ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
            </div>
          ) : filteredSalaries.length === 0 ? (
            <Card className="text-center py-12 border-dashed">
              <CardContent className="space-y-3">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
                <h3 className="text-sm font-bold">No Salary Records Found</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {salaries.length === 0 
                    ? "No salary payments have been logged yet. Click 'Prepare Salary' to issue a new staff payment."
                    : "No records match your search phrase."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border/70 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b">
                      <th className="p-4 font-bold text-muted-foreground uppercase">Employee</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase">Period</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-right">Base Salary</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-right">Bonuses</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-right text-red-600">Deductions</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-right font-black text-orange-600">Net Paid</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-center">Status</th>
                      <th className="p-4 font-bold text-muted-foreground uppercase text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSalaries.map((sal) => (
                      <tr key={sal.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-bold text-foreground text-sm">{sal.employeeName}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{sal.employeeRole}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-bold">{sal.payPeriod}</p>
                            <p className="text-[10px] text-muted-foreground">Paid {new Date(sal.paidDate).toLocaleDateString()}</p>
                          </div>
                        </td>
                        <td className="p-4 text-right font-semibold">GHS {sal.baseAmount.toLocaleString()}</td>
                        <td className="p-4 text-right text-green-600 font-semibold">+{sal.allowances.toLocaleString()}</td>
                        <td className="p-4 text-right text-red-600 font-semibold">-{sal.deductions.toLocaleString()}</td>
                        <td className="p-4 text-right font-black text-foreground">GHS {sal.netSalary.toLocaleString()}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            sal.status === 'Paid'
                              ? 'bg-green-100 text-green-700'
                              : sal.status === 'Processing'
                                ? 'bg-amber-100 text-amber-700'
                                : sal.status === 'Approved'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            {sal.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex gap-2.5 justify-center">
                            <Button
                              onClick={() => handlePrintPayslip(sal)}
                              variant="ghost"
                              size="icon"
                              title="Print Salary Slip"
                              className="h-8 w-8 hover:text-orange-600 hover:bg-orange-50 text-muted-foreground rounded-lg"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleStartEditPayroll(sal)}
                              variant="ghost"
                              size="icon"
                              title="Modify Payslip"
                              className="h-8 w-8 hover:text-blue-600 hover:bg-blue-50 text-muted-foreground rounded-lg"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDeletePayroll(sal.id, sal.employeeName)}
                              variant="ghost"
                              size="icon"
                              title="Delete Record"
                              className="h-8 w-8 hover:text-red-600 hover:bg-red-50 text-muted-foreground rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ====================================================================
          MODAL: EMPLOYEE REGISTRATION FORM
          ==================================================================== */}
      {isEmployeeFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-600" /> {editingEmployee ? 'Edit Employee Credentials' : 'Register New Staff Member'}
              </h2>
              <Button
                onClick={handleCloseEmployeeForm}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                  <Input
                    id="emp-name"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    placeholder="e.g. Grice Asante"
                    required
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
                  <Input
                    id="emp-email"
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    placeholder="e.g. grice@grefas.com"
                    required
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone / WhatsApp</label>
                  <Input
                    id="emp-phone"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    placeholder="e.g. +233 24 000 0000"
                    required
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Designated Role</label>
                  <select
                    id="emp-role"
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value)}
                    className="w-full bg-background border border-border text-xs rounded-lg h-9 px-3 font-semibold focus:border-orange-500 text-foreground"
                  >
                    <option value="Actor / Actress">Actor / Actress</option>
                    <option value="Skit Performer">Skit Performer</option>
                    <option value="Creative Writer">Creative Writer</option>
                    <option value="Crew / Technical">Crew / Technical</option>
                    <option value="Video Editor">Video Editor</option>
                    <option value="Cameraman">Cameraman</option>
                    <option value="Sound Engineer">Sound Engineer</option>
                    <option value="Director">Director</option>
                    <option value="Finance Officer">Finance Officer</option>
                    <option value="Admin Support">Admin Support</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Base Salary (GHS)</label>
                  <Input
                    id="emp-salary"
                    type="number"
                    value={empBaseSalary}
                    onChange={(e) => setEmpBaseSalary(e.target.value)}
                    placeholder="e.g. 1500"
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pay Cycle</label>
                  <select
                    id="emp-frequency"
                    value={empPayFrequency}
                    onChange={(e) => setEmpPayFrequency(e.target.value as any)}
                    className="w-full bg-background border border-border text-xs rounded-lg h-9 px-3 font-semibold focus:border-orange-500 text-foreground"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Hourly">Hourly</option>
                    <option value="Project-based">Project-based</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> Bank Name
                  </label>
                  <Input
                    id="emp-bank"
                    value={empBankName}
                    onChange={(e) => setEmpBankName(e.target.value)}
                    placeholder="e.g. GCB Bank, MTN Mobile Money"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account / Wallet Number</label>
                  <Input
                    id="emp-account"
                    value={empAccountNumber}
                    onChange={(e) => setEmpAccountNumber(e.target.value)}
                    placeholder="e.g. 1020304050"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Joining Date</label>
                  <Input
                    id="emp-joining"
                    type="date"
                    value={empJoiningDate}
                    onChange={(e) => setEmpJoiningDate(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operational Status</label>
                  <select
                    id="emp-status"
                    value={empStatus}
                    onChange={(e) => setEmpStatus(e.target.value as any)}
                    className="w-full bg-background border border-border text-xs rounded-lg h-9 px-3 font-semibold focus:border-orange-500 text-foreground"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseEmployeeForm}
                  className="text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  id="emp-save-submit"
                  type="submit"
                  disabled={isSavingEmployee}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingEmployee ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingEmployee ? 'Apply Changes' : 'Register Employee'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: PAYROLL PREPARATION FORM
          ==================================================================== */}
      {isPayrollFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-600" /> {editingPayroll ? 'Edit Salary Slip' : 'Prepare Staff Remittance Payslip'}
              </h2>
              <Button
                onClick={handleClosePayrollForm}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSavePayroll} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Select Employee</label>
                  <select
                    id="sal-employee-id"
                    value={salEmployeeId}
                    onChange={(e) => setSalEmployeeId(e.target.value)}
                    disabled={!!editingPayroll}
                    required
                    className="w-full bg-background border border-border text-xs rounded-lg h-9 px-3 font-semibold focus:border-orange-500 text-foreground"
                  >
                    <option value="">-- Choose Staff Member --</option>
                    {employees.filter(emp => emp.status === 'Active' || editingPayroll).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.role})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Salary Pay Period</label>
                  <Input
                    id="sal-period"
                    value={salPayPeriod}
                    onChange={(e) => setSalPayPeriod(e.target.value)}
                    placeholder="e.g. June 2026, Week 24"
                    required
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Base Amount (GHS)</label>
                  <Input
                    id="sal-base"
                    type="number"
                    value={salBaseAmount}
                    onChange={(e) => setSalBaseAmount(e.target.value)}
                    placeholder="0"
                    required
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-green-700 block">Allowances / Bonus</label>
                  <Input
                    id="sal-allowances"
                    type="number"
                    value={salAllowances}
                    onChange={(e) => setSalAllowances(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs rounded-lg text-green-700 border-green-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-red-600 block">Deductions / Taxes</label>
                  <Input
                    id="sal-deductions"
                    type="number"
                    value={salDeductions}
                    onChange={(e) => setSalDeductions(e.target.value)}
                    placeholder="0"
                    className="h-9 text-xs rounded-lg text-red-600 border-red-200"
                  />
                </div>
              </div>

              {/* Real-time Math Summary */}
              <div className="bg-orange-500/5 border border-orange-200/50 p-3.5 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold uppercase text-orange-600">Calculated Net Salary</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Base + Allowances - Deductions</p>
                </div>
                <span className="text-xl font-black text-orange-600">
                  GHS {((parseFloat(salBaseAmount) || 0) + (parseFloat(salAllowances) || 0) - (parseFloat(salDeductions) || 0)).toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Payment Method</label>
                  <select
                    id="sal-method"
                    value={salPaymentMethod}
                    onChange={(e) => setSalPaymentMethod(e.target.value as any)}
                    className="w-full bg-background border border-border text-xs rounded-lg h-9 px-3 font-semibold focus:border-orange-500 text-foreground"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Payment Status</label>
                  <select
                    id="sal-status-input"
                    value={salStatus}
                    onChange={(e) => setSalStatus(e.target.value as any)}
                    className="w-full bg-background border border-border text-xs rounded-lg h-9 px-3 font-semibold focus:border-orange-500 text-foreground"
                  >
                    <option value="Paid">Paid (Finalized)</option>
                    <option value="Processing">Processing</option>
                    <option value="Approved">Approved</option>
                    <option value="Draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Payment Ref / Transaction ID</label>
                  <Input
                    id="sal-ref"
                    value={salPaymentRef}
                    onChange={(e) => setSalPaymentRef(e.target.value)}
                    placeholder="e.g. TXN-109283749"
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Remittance Date</label>
                  <Input
                    id="sal-date"
                    type="date"
                    value={salPaidDate}
                    onChange={(e) => setSalPaidDate(e.target.value)}
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Remittance Memo / Internal Remarks</label>
                <Textarea
                  id="sal-notes-area"
                  value={salNotes}
                  onChange={(e) => setSalNotes(e.target.value)}
                  placeholder="Enter custom remarks, overtime details or performance feedback..."
                  className="text-xs rounded-lg h-20 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClosePayrollForm}
                  className="text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  id="sal-save-submit"
                  type="submit"
                  disabled={isSavingPayroll}
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingPayroll ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingPayroll ? 'Apply Adjustments' : 'Log & Dispatch Payment'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: DIRECT STAFF NOTIFICATION DISPATCH
          ==================================================================== */}
      {isNotificationFormOpen && notificationRecipient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-600" /> Dispatch Direct Staff Notification
              </h2>
              <Button
                onClick={handleCloseNotificationForm}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="bg-orange-50/5 border border-orange-200 p-3.5 rounded-xl text-xs space-y-1">
              <p className="font-bold text-foreground">Recipient Desk:</p>
              <p className="text-muted-foreground">Name: <span className="text-foreground font-semibold">{notificationRecipient.fullName}</span></p>
              <p className="text-muted-foreground">Email: <span className="text-foreground font-semibold">{notificationRecipient.email}</span></p>
              <p className="text-muted-foreground">Title: <span className="text-foreground font-semibold">{notificationRecipient.role}</span></p>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Notification Alert Title</label>
                <Input
                  id="notif-title"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="e.g. Schedule Change, Studio Call Time Alert"
                  required
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Message Content</label>
                <Textarea
                  id="notif-message"
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="Enter full announcement or alert instructions for this staff member..."
                  required
                  className="text-xs rounded-lg h-28 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseNotificationForm}
                  className="text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  id="notif-save-submit"
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" /> Send Notification
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-full">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">Confirm Deletion</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-foreground">"{deleteConfirmation.name}"</span>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteConfirmation(null)}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                className="text-xs font-bold"
              >
                Yes, Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
