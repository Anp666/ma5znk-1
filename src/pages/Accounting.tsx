import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  Folder, 
  FileText,
  DollarSign,
  ArrowRightLeft,
  PieChart
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Account } from '../types';
import { translations } from '../translations';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol } from '../utils/currency';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function Accounting({ lang, profile }: Props) {
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Account>>({
    name: '',
    code: '',
    type: 'Asset',
    parentId: '',
    balance: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'accounts'), orderBy('code'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      setAccounts(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        const { id, ...data } = formData;
        await updateDoc(doc(db, 'accounts', id), data);
        toast.success(lang === 'ar' ? 'تم تحديث الحساب بنجاح' : 'Account updated successfully');
      } else {
        await addDoc(collection(db, 'accounts'), {
          ...formData,
          balance: formData.balance || 0,
          isSystem: false
        });
        toast.success(lang === 'ar' ? 'تم إضافة الحساب بنجاح' : 'Account added successfully');
      }
      setIsModalOpen(false);
      setFormData({ name: '', code: '', type: 'Asset', parentId: '', balance: 0 });
    } catch (error) {
      console.error('Error saving account:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ الحساب' : 'Error saving account');
    }
  };

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const rootAccounts = accounts.filter(a => !a.parentId);

  const renderAccount = (account: Account, level = 0) => {
    const children = accounts.filter(a => a.parentId === account.id);
    const isExpanded = expanded[account.id || ''];

    return (
      <div key={account.id} className="select-none">
        <div 
          className={`flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-colors cursor-pointer group`}
          style={{ paddingLeft: `${level * 2 + 1}rem`, paddingRight: `${level * 2 + 1}rem` }}
          onClick={() => toggle(account.id || '')}
        >
          <div className="flex items-center gap-3">
            {children.length > 0 ? (
              isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className={`w-4 h-4 text-zinc-400 ${lang === 'ar' ? 'rotate-180' : ''}`} />
            ) : (
              <div className="w-4" />
            )}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              account.type === 'Asset' ? 'bg-blue-100 text-blue-600' :
              account.type === 'Liability' ? 'bg-red-100 text-red-600' :
              account.type === 'Equity' ? 'bg-purple-100 text-purple-600' :
              account.type === 'Revenue' ? 'bg-emerald-100 text-emerald-600' :
              'bg-orange-100 text-orange-600'
            }`}>
              {children.length > 0 ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-400">{account.code}</div>
              <div className="font-bold text-sm">{account.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold">{currencySymbol} {account.balance.toLocaleString()}</div>
            <div className="text-[10px] uppercase font-bold tracking-wider opacity-50">
              {account.type === 'Asset' ? t.assets :
               account.type === 'Liability' ? t.liabilities :
               account.type === 'Equity' ? t.equity :
               account.type === 'Revenue' ? t.revenue :
               t.expensesCat}
            </div>
          </div>
        </div>
        {isExpanded && children.map(child => renderAccount(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t.chartOfAccounts}</h2>
            <p className="text-sm text-zinc-500">Manage your financial structure and ledger accounts</p>
          </div>
        </div>
        <button 
          onClick={() => {
            setFormData({ name: '', code: '', type: 'Asset', parentId: '', balance: 0 });
            setIsModalOpen(true);
          }}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
        >
          <Plus className="w-5 h-5" />
          {lang === 'ar' ? 'إضافة حساب' : 'Add Account'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <AccountSummaryCard title={t.assets} amount={accounts.filter(a => a.type === 'Asset').reduce((sum, a) => sum + a.balance, 0).toLocaleString()} color="blue" currencySymbol={currencySymbol} />
        <AccountSummaryCard title={t.liabilities} amount={accounts.filter(a => a.type === 'Liability').reduce((sum, a) => sum + a.balance, 0).toLocaleString()} color="red" currencySymbol={currencySymbol} />
        <AccountSummaryCard title={t.equity} amount={accounts.filter(a => a.type === 'Equity').reduce((sum, a) => sum + a.balance, 0).toLocaleString()} color="purple" currencySymbol={currencySymbol} />
        <AccountSummaryCard title={t.revenue} amount={accounts.filter(a => a.type === 'Revenue').reduce((sum, a) => sum + a.balance, 0).toLocaleString()} color="emerald" currencySymbol={currencySymbol} />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden p-4">
        <div className="space-y-1">
          {rootAccounts.length > 0 ? rootAccounts.map(a => renderAccount(a)) : (
            <div className="p-12 text-center opacity-50 italic">No accounts found. Add your first account to start.</div>
          )}
        </div>
      </div>

      {/* Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl">
            <h3 className="text-2xl font-bold mb-8">{formData.id ? (lang === 'ar' ? 'تعديل حساب' : 'Edit Account') : (lang === 'ar' ? 'إضافة حساب جديد' : 'Add New Account')}</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'كود الحساب' : 'Account Code'}</label>
                  <input 
                    required
                    type="text" 
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'نوع الحساب' : 'Account Type'}</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                  >
                    <option value="Asset">Asset</option>
                    <option value="Liability">Liability</option>
                    <option value="Equity">Equity</option>
                    <option value="Revenue">Revenue</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'اسم الحساب' : 'Account Name'}</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'الحساب الأب' : 'Parent Account'}</label>
                <select 
                  value={formData.parentId}
                  onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                >
                  <option value="">None (Root)</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  {lang === 'ar' ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountSummaryCard({ title, amount, color, currencySymbol }: any) {
  const colors: any = {
    blue: 'bg-blue-50 dark:bg-blue-900/10 text-blue-600 border-blue-100 dark:border-blue-900/20',
    red: 'bg-red-50 dark:bg-red-900/10 text-red-600 border-red-100 dark:border-red-900/20',
    purple: 'bg-purple-50 dark:bg-purple-900/10 text-purple-600 border-purple-100 dark:border-purple-900/20',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 border-emerald-100 dark:border-emerald-900/20'
  };

  return (
    <div className={`p-6 rounded-3xl border ${colors[color]}`}>
      <div className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">{title}</div>
      <div className="text-2xl font-black">{currencySymbol} {amount.toLocaleString()}</div>
    </div>
  );
}
