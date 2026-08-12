import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase';

export interface AuditLogParams {
  type: 'create' | 'update' | 'delete' | 'login' | 'status_change' | 'policy_update' | 'sms_sent' | 'role_change' | 'system' | string;
  module: string; // e.g., 'Services', 'Portfolio', 'Gallery', 'Blog', 'Bookings', 'Team', 'Users', 'Payroll', 'Settings', 'Applications'
  action: string; // e.g., 'CREATED_SERVICE', 'DELETED_BLOG', 'UPDATED_ROLE'
  description: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
  actorEmail?: string;
  actorName?: string;
  actorRole?: string;
}

/**
 * Log an audit activity event to the `activity_logs` collection in Firestore.
 */
export async function logAuditActivity(params: AuditLogParams): Promise<void> {
  try {
    const user = auth.currentUser;
    const userEmail = params.actorEmail || user?.email || 'System / Guest';
    const userName = params.actorName || user?.displayName || (userEmail.includes('@') ? userEmail.split('@')[0] : 'System User');
    const userId = user?.uid || 'unauthenticated';

    const logPayload = {
      type: params.type,
      module: params.module,
      action: params.action,
      actionType: params.action || params.type,
      description: params.description,
      details: params.description,
      userEmail,
      userName,
      userId,
      userRole: params.actorRole || (userEmail.toLowerCase().includes('grefas') || userEmail.toLowerCase().includes('admin') ? 'admin' : 'user'),
      targetId: params.targetId || null,
      targetName: params.targetName || null,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
    };

    // Write to both audit_logs and activity_logs collections to ensure complete synchronization
    await Promise.allSettled([
      addDoc(collection(db, 'audit_logs'), logPayload),
      addDoc(collection(db, 'activity_logs'), logPayload)
    ]);
  } catch (error) {
    console.warn('Failed to record audit activity log:', error);
  }
}
