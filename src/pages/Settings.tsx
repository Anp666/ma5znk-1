import React, { useState } from 'react';
import { 
  Settings, 
  User, 
  Shield, 
  Bell, 
  Globe, 
  Moon, 
  Save,
  Check,
  History,
  Activity,
  Download,
  Upload,
  Database
} from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { UserProfile } from '../types';
import { translations } from '../translations';
import { toast } from 'react-hot-toast';
import { getActions, UserAction } from '../services/actionTrackingService';
import { useEffect } from 'react';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function SettingsPage({ lang, profile }: Props) {
  const t = translations[lang];
  const [formData, setFormData] = useState({
    displayName: '',
    role: 'cashier',
    currency: 'EGP'
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        role: profile.role || 'cashier',
        currency: profile.currency || 'EGP'
      });
    }
  }, [profile]);
  const [saved, setSaved] = useState(false);
  const [actions, setActions] = useState<UserAction[]>([]);

  useEffect(() => {
    const unsubscribe = getActions(setActions);
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!profile?.uid) return;
    try {
      await updateDoc(doc(db, 'users', profile.uid), formData);
      setSaved(true);
      toast.success(lang === 'ar' ? 'تم حفظ الإعدادات بنجاح' : 'Settings saved successfully');
      setTimeout(() => setSaved(false), 3000);
      // Reload page to apply currency changes globally if needed, 
      // or use a context/state management.
      window.location.reload();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ الإعدادات' : 'Error saving settings');
    }
  };

  const handleExport = async () => {
    try {
      const collections = ['products', 'invoices', 'customers', 'suppliers', 'accounts', 'cheques', 'returns', 'treasury_transactions'];
      const backupData: any = {};

      for (const colName of collections) {
        const snapshot = await getDocs(collection(db, colName));
        backupData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `makhzanak_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(lang === 'ar' ? 'تم تصدير النسخة الاحتياطية بنجاح' : 'Backup exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(lang === 'ar' ? 'خطأ في تصدير النسخة الاحتياطية' : 'Error exporting backup');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        const batch = writeBatch(db);

        // This is a destructive operation in this simple implementation
        // Ideally, we should ask for confirmation or merge data
        for (const colName in backupData) {
          const items = backupData[colName];
          for (const item of items) {
            const { id, ...data } = item;
            const docRef = doc(db, colName, id);
            batch.set(docRef, data);
          }
        }

        await batch.commit();
        toast.success(lang === 'ar' ? 'تم استيراد النسخة الاحتياطية بنجاح' : 'Backup imported successfully');
        setTimeout(() => window.location.reload(), 2000);
      } catch (error) {
        console.error('Import error:', error);
        toast.error(lang === 'ar' ? 'خطأ في استيراد النسخة الاحتياطية' : 'Error importing backup');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">{t.settings}</h2>
          <p className="text-sm text-zinc-500">Manage your account settings and preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
              <User className="w-5 h-5 text-emerald-600" />
              {lang === 'ar' ? 'إعدادات الملف الشخصي' : 'Profile Settings'}
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'الاسم المعروض' : 'Display Name'}</label>
                <input 
                  type="text" 
                  value={formData.displayName}
                  onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'الدور' : 'Role'}</label>
                <select 
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                >
                  <option value="admin">{lang === 'ar' ? 'مدير' : 'Admin'}</option>
                  <option value="accountant">{lang === 'ar' ? 'محاسب' : 'Accountant'}</option>
                  <option value="cashier">{lang === 'ar' ? 'كاشير' : 'Cashier'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{t.currency}</label>
                <select 
                  value={formData.currency}
                  onChange={e => setFormData({ ...formData, currency: e.target.value as any })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                >
                  <option value="EGP">{t.egp}</option>
                  <option value="SAR">{t.sar}</option>
                </select>
              </div>
              <div className="pt-4">
                <button 
                  onClick={handleSave}
                  className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  {saved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                  {saved ? (lang === 'ar' ? 'تم الحفظ' : 'Saved') : (lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes')}
                </button>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm opacity-50 pointer-events-none">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
              <Shield className="w-5 h-5 text-blue-600" />
              {lang === 'ar' ? 'الأمان' : 'Security'}
            </h3>
            <p className="text-sm text-zinc-500 mb-6">Security settings are managed by Google Authentication.</p>
          </div>

          {/* Audit Log */}
          {profile?.role === 'admin' && (
            <div className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                <Activity className="w-5 h-5 text-purple-600" />
                {lang === 'ar' ? 'سجل النشاطات' : 'Audit Log'}
              </h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {actions.map((action) => (
                  <div key={action.id} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{action.module}</span>
                      <span className="text-[10px] text-zinc-400">{new Date(action.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white mb-1">{action.action.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-zinc-500">{action.details}</div>
                    <div className="mt-2 text-[10px] font-medium text-zinc-400">By: {action.userName}</div>
                  </div>
                ))}
                {actions.length === 0 && (
                  <div className="text-center py-10 text-zinc-400 italic">No activity recorded yet.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preferences */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
              <Bell className="w-5 h-5 text-orange-600" />
              {lang === 'ar' ? 'التفضيلات' : 'Preferences'}
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{lang === 'ar' ? 'إشعارات البريد' : 'Email Notifications'}</div>
                  <div className="text-xs text-zinc-500">Receive weekly reports</div>
                </div>
                <div className="w-12 h-6 bg-emerald-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-sm">{lang === 'ar' ? 'وضع المتصفح' : 'Browser Mode'}</div>
                  <div className="text-xs text-zinc-500">Sync with system settings</div>
                </div>
                <div className="w-12 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Backup & Restore */}
          {profile?.role === 'admin' && (
            <div className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                <Database className="w-5 h-5 text-emerald-600" />
                {lang === 'ar' ? 'النسخ الاحتياطي' : 'Backup & Restore'}
              </h3>
              <div className="space-y-4">
                <button 
                  onClick={handleExport}
                  className="w-full py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
                >
                  <Download className="w-5 h-5" />
                  {lang === 'ar' ? 'تصدير نسخة احتياطية' : 'Export Backup'}
                </button>
                <div className="relative">
                  <input 
                    type="file" 
                    accept=".json"
                    onChange={handleImport}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <button className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all">
                    <Upload className="w-5 h-5" />
                    {lang === 'ar' ? 'استيراد نسخة احتياطية' : 'Import Backup'}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 text-center">
                  {lang === 'ar' ? 'تحذير: الاستيراد سيقوم باستبدال البيانات الحالية' : 'Warning: Import will overwrite existing data'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
