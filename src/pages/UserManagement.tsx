import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Shield, 
  Mail, 
  Edit2, 
  Trash2, 
  X,
  UserCheck,
  UserMinus,
  Lock
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';
import { translations } from '../translations';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { logAction } from '../services/actionTrackingService';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function UserManagement({ lang, profile: currentProfile }: Props) {
  const { user } = useAuth();
  const t = translations[lang];
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    displayName: '',
    email: '',
    role: 'cashier'
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    });
    return () => unsubscribe();
  }, []);

  if (currentProfile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-10">
        <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-12 h-12" />
        </div>
        <h2 className="text-3xl font-black mb-4">{t.accessDenied}</h2>
        <p className="text-zinc-500 max-w-md">{lang === 'ar' ? 'عذراً، هذه الصفحة مخصصة لمديري النظام فقط.' : 'Sorry, this page is restricted to system administrators only.'}</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.uid) {
        await updateDoc(doc(db, 'users', formData.uid), {
          displayName: formData.displayName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          password: formData.password,
          role: formData.role,
          permissions: getPermissionsForRole(formData.role as UserRole)
        });
        
        if (user) {
          await logAction({
            userId: user.uid,
            userName: user.displayName || user.email || 'Admin',
            action: 'UPDATE_USER',
            module: 'Users',
            details: `Updated user ${formData.displayName}`
          });
        }
        
        toast.success(lang === 'ar' ? 'تم تحديث المستخدم بنجاح' : 'User updated successfully');
      } else {
        // Create new user profile
        const newUid = Math.random().toString(36).substring(2, 15);
        const newUser: UserProfile = {
          uid: newUid,
          displayName: formData.displayName || '',
          email: formData.email || '',
          phoneNumber: formData.phoneNumber || '',
          password: formData.password || '',
          role: formData.role as UserRole || 'cashier',
          permissions: getPermissionsForRole(formData.role as UserRole || 'cashier'),
          createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', newUid), newUser);
        
        if (user) {
          await logAction({
            userId: user.uid,
            userName: user.displayName || user.email || 'Admin',
            action: 'CREATE_USER',
            module: 'Users',
            details: `Created user ${formData.displayName}`
          });
        }
        
        toast.success(lang === 'ar' ? 'تم إضافة المستخدم بنجاح' : 'User added successfully');
      }
      setIsModalOpen(false);
      setFormData({ displayName: '', email: '', role: 'cashier', phoneNumber: '', password: '' });
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ بيانات المستخدم' : 'Error saving user');
    }
  };

  const handleDelete = async (uid: string, name: string) => {
    if (!window.confirm(lang === 'ar' ? `هل أنت متأكد من حذف المستخدم ${name}؟` : `Are you sure you want to delete user ${name}?`)) return;
    
    try {
      await deleteDoc(doc(db, 'users', uid));
      
      if (user) {
        await logAction({
          userId: user.uid,
          userName: user.displayName || user.email || 'Admin',
          action: 'DELETE_USER',
          module: 'Users',
          details: `Deleted user ${name}`
        });
      }
      
      toast.success(lang === 'ar' ? 'تم حذف المستخدم بنجاح' : 'User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(lang === 'ar' ? 'خطأ في حذف المستخدم' : 'Error deleting user');
    }
  };

  const getPermissionsForRole = (role: UserRole): string[] => {
    switch (role) {
      case 'admin': return ['all'];
      case 'accountant': return ['invoices', 'suppliers', 'expenses', 'treasury', 'reports'];
      case 'cashier': return ['invoices', 'products'];
      default: return [];
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-purple-600/10">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black tracking-tight">{t.userManagement}</h2>
            <p className="text-sm text-zinc-500 font-medium">{lang === 'ar' ? 'إدارة صلاحيات وأدوار فريق العمل' : 'Manage team roles and permissions'}</p>
          </div>
        </div>
        <button 
          onClick={() => { setFormData({ displayName: '', email: '', role: 'cashier', phoneNumber: '', password: '' }); setIsModalOpen(true); }}
          className="w-full md:w-auto px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-purple-600/20 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5" />
          {t.addUser}
        </button>
      </div>

      <div className="relative max-w-md group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-purple-500 transition-colors" />
        <input 
          type="text" 
          placeholder={lang === 'ar' ? 'البحث عن مستخدم...' : 'Search users...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-6 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-4 ring-purple-500/10 transition-all font-medium"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredUsers.map((user) => (
          <motion.div 
            layout
            key={user.uid} 
            className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            
            <div className="flex justify-between items-start mb-6 relative">
              <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-2xl font-black text-purple-600 group-hover:scale-110 transition-transform">
                {user.displayName[0]}
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setFormData(user); setIsModalOpen(true); }}
                  className="p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl text-zinc-400 hover:text-purple-600 transition-all"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDelete(user.uid, user.displayName)}
                  className="p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-zinc-400 hover:text-red-600 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-black mb-1 text-zinc-900 dark:text-white">{user.displayName}</h3>
            <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium mb-6">
              <Mail className="w-4 h-4" />
              {user.email}
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                user.role === 'admin' ? 'bg-red-100 text-red-600' : 
                user.role === 'accountant' ? 'bg-blue-100 text-blue-600' : 
                'bg-emerald-100 text-emerald-600'
              }`}>
                {t[user.role as keyof typeof t] || user.role}
              </span>
            </div>

            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">{t.permissions}</div>
              <div className="flex flex-wrap gap-2">
                {user.permissions.map(p => (
                  <span key={p} className="px-3 py-1 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-[10px] font-bold text-zinc-500">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[3rem] p-10 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-3xl font-black mb-8 tracking-tighter">{formData.uid ? (lang === 'ar' ? 'تعديل مستخدم' : 'Edit User') : t.addUser}</h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 ml-2">{t.name}</label>
                    <input 
                      type="text" 
                      required
                      value={formData.displayName}
                      onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl outline-none font-bold focus:ring-2 ring-purple-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 ml-2">{t.email}</label>
                    <input 
                      type="email" 
                      required
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl outline-none font-bold focus:ring-2 ring-purple-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 ml-2">{t.phoneNumber}</label>
                    <input 
                      type="tel" 
                      value={formData.phoneNumber || ''}
                      onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl outline-none font-bold focus:ring-2 ring-purple-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 ml-2">{t.password}</label>
                    <input 
                      type="password" 
                      required={!formData.uid}
                      value={formData.password || ''}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-2xl outline-none font-bold focus:ring-2 ring-purple-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 ml-2">{t.role}</label>
                  <div className="grid grid-cols-1 gap-3">
                    {(['admin', 'accountant', 'cashier'] as UserRole[]).map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setFormData({ ...formData, role })}
                        className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                          formData.role === role 
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600' 
                            : 'border-zinc-100 dark:border-zinc-800 hover:border-purple-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            formData.role === role ? 'bg-purple-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                          }`}>
                            {role === 'admin' ? <Shield className="w-5 h-5" /> : role === 'accountant' ? <UserCheck className="w-5 h-5" /> : <UserMinus className="w-5 h-5" />}
                          </div>
                          <div className="text-left">
                            <div className="font-black text-sm">{t[role as keyof typeof t] || role}</div>
                            <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
                              {role === 'admin' ? 'Full Access' : role === 'accountant' ? 'Financial Access' : 'Sales Only'}
                            </div>
                          </div>
                        </div>
                        {formData.role === role && <div className="w-3 h-3 bg-purple-500 rounded-full shadow-lg shadow-purple-500/50" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-5 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-black text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 transition-all active:scale-95"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-5 bg-purple-600 text-white rounded-2xl font-black shadow-xl shadow-purple-600/20 hover:bg-purple-700 transition-all active:scale-95"
                  >
                    {lang === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
