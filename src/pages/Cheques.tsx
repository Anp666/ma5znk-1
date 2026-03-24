import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  runTransaction,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { translations } from '../translations';
import { Cheque, Customer, Supplier, Account } from '../types';
import { toast } from 'react-hot-toast';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  CreditCard,
  Building2,
  Calendar,
  User,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  lang: 'ar' | 'en';
}

const Cheques: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'cleared' | 'rejected'>('all');
  const [filterType, setFilterType] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);

  const [formData, setFormData] = useState({
    number: '',
    bank: '',
    amount: 0,
    dueDate: new Date().toISOString().split('T')[0],
    type: 'incoming' as 'incoming' | 'outgoing',
    status: 'pending' as 'pending' | 'cleared' | 'rejected',
    entityId: '',
    entityName: '',
    accountId: '', // Treasury/Bank account
    notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'cheques'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chequesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Cheque[];
      setCheques(chequesData);
      setLoading(false);
    });

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[]);
    });

    const unsubscribeSuppliers = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Supplier[]);
    });

    const unsubscribeAccounts = onSnapshot(collection(db, 'accounts'), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Account[]);
    });

    return () => {
      unsubscribe();
      unsubscribeCustomers();
      unsubscribeSuppliers();
      unsubscribeAccounts();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const entity = formData.type === 'incoming' 
      ? customers.find(c => c.id === formData.entityId)
      : suppliers.find(s => s.id === formData.entityId);

    const data = {
      ...formData,
      entityName: entity ? entity.name : '',
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingCheque) {
        await updateDoc(doc(db, 'cheques', editingCheque.id), data);
      } else {
        await addDoc(collection(db, 'cheques'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingCheque(null);
      setFormData({
        number: '',
        bank: '',
        amount: 0,
        dueDate: new Date().toISOString().split('T')[0],
        type: 'incoming',
        status: 'pending',
        entityId: '',
        entityName: '',
        accountId: '',
        notes: ''
      });
    } catch (error) {
      console.error("Error saving cheque:", error);
    }
  };

  const updateStatus = async (id: string, newStatus: 'cleared' | 'rejected') => {
    try {
      const cheque = cheques.find(c => c.id === id);
      if (!cheque) return;

      await runTransaction(db, async (transaction) => {
        const chequeRef = doc(db, 'cheques', id);
        transaction.update(chequeRef, { 
          status: newStatus,
          updatedAt: new Date().toISOString()
        });

        if (newStatus === 'cleared') {
          // Create treasury transaction
          const treasuryRef = collection(db, 'treasury_transactions');
          const newTxRef = doc(treasuryRef);
          transaction.set(newTxRef, {
            type: cheque.type === 'incoming' ? 'income' : 'expense',
            amount: cheque.amount,
            date: new Date().toISOString().split('T')[0],
            description: `${lang === 'ar' ? 'تحصيل شيك رقم' : 'Cheque clearance #'} ${cheque.number}`,
            accountId: cheque.accountId,
            category: 'cheque',
            createdAt: new Date().toISOString()
          });

          // Update account balance
          const accountRef = doc(db, 'accounts', cheque.accountId);
          const accountSnap = await transaction.get(accountRef);
          if (accountSnap.exists()) {
            const currentBalance = accountSnap.data().balance || 0;
            const newBalance = cheque.type === 'incoming' 
              ? currentBalance + cheque.amount 
              : currentBalance - cheque.amount;
            transaction.update(accountRef, { balance: newBalance });
          }
        }
      });
      
      toast.success(lang === 'ar' ? 'تم تحديث حالة الشيك' : 'Cheque status updated');
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(lang === 'ar' ? 'خطأ في تحديث الحالة' : 'Error updating status');
    }
  };

  const filteredCheques = cheques.filter(cheque => {
    const matchesSearch = cheque.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cheque.bank.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cheque.entityName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || cheque.status === filterStatus;
    const matchesType = filterType === 'all' || cheque.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'cleared': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-rose-500" />;
      default: return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'cleared': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'rejected': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
  };

  return (
    <div className="p-6 space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {lang === 'ar' ? 'إدارة الشيكات' : 'Cheque Management'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {lang === 'ar' ? 'تتبع وتحصيل الشيكات الصادرة والواردة' : 'Track and collect incoming and outgoing cheques'}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCheque(null);
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl hover:opacity-90 transition-all font-bold"
        >
          <Plus className="w-5 h-5" />
          {lang === 'ar' ? 'إضافة شيك' : 'Add Cheque'}
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder={lang === 'ar' ? 'بحث برقم الشيك أو البنك...' : 'Search by cheque number or bank...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
        >
          <option value="all">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
          <option value="pending">{lang === 'ar' ? 'قيد الانتظار' : 'Pending'}</option>
          <option value="cleared">{lang === 'ar' ? 'تم التحصيل' : 'Cleared'}</option>
          <option value="rejected">{lang === 'ar' ? 'مرفوض' : 'Rejected'}</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as any)}
          className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-500 outline-none transition-all"
        >
          <option value="all">{lang === 'ar' ? 'كل الأنواع' : 'All Types'}</option>
          <option value="incoming">{lang === 'ar' ? 'وارد' : 'Incoming'}</option>
          <option value="outgoing">{lang === 'ar' ? 'صادر' : 'Outgoing'}</option>
        </select>
      </div>

      {/* Cheques List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode='popLayout'>
          {filteredCheques.map((cheque) => (
            <motion.div
              key={cheque.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 hover:shadow-lg transition-all group relative overflow-hidden"
            >
              {/* Type Indicator */}
              <div className={`absolute top-0 right-0 w-1 h-full ${cheque.type === 'incoming' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${cheque.type === 'incoming' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} dark:bg-opacity-10`}>
                    {cheque.type === 'incoming' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">#{cheque.number}</h3>
                    <p className="text-xs text-zinc-500">{cheque.bank}</p>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${getStatusColor(cheque.status)}`}>
                  {getStatusIcon(cheque.status)}
                  {lang === 'ar' ? (cheque.status === 'pending' ? 'انتظار' : cheque.status === 'cleared' ? 'تم' : 'مرفوض') : cheque.status}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500 flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {cheque.entityName}
                  </span>
                  <span className="text-lg font-black text-zinc-900 dark:text-white">
                    {cheque.amount.toLocaleString()} <span className="text-xs font-normal opacity-50">EGP</span>
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {cheque.dueDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {accounts.find(a => a.id === cheque.accountId)?.name || 'N/A'}
                  </span>
                </div>
              </div>

              {cheque.status === 'pending' && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => updateStatus(cheque.id, 'cleared')}
                    className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all"
                  >
                    {lang === 'ar' ? 'تحصيل' : 'Clear'}
                  </button>
                  <button
                    onClick={() => updateStatus(cheque.id, 'rejected')}
                    className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-all"
                  >
                    {lang === 'ar' ? 'رفض' : 'Reject'}
                  </button>
                </div>
              )}

              <div className="absolute top-4 left-4 opacity-0 group-hover:opacity-100 transition-all">
                <button 
                  onClick={() => {
                    setEditingCheque(cheque);
                    setFormData({
                      number: cheque.number,
                      bank: cheque.bank,
                      amount: cheque.amount,
                      dueDate: cheque.dueDate,
                      type: cheque.type,
                      status: cheque.status,
                      entityId: cheque.entityId,
                      entityName: cheque.entityName,
                      accountId: cheque.accountId,
                      notes: cheque.notes || ''
                    });
                    setIsModalOpen(true);
                  }}
                  className="p-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  <MoreVertical className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-zinc-200 dark:border-zinc-800"
            >
              <h2 className="text-xl font-bold mb-6 text-zinc-900 dark:text-white">
                {editingCheque ? (lang === 'ar' ? 'تعديل شيك' : 'Edit Cheque') : (lang === 'ar' ? 'إضافة شيك جديد' : 'Add New Cheque')}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-500">{lang === 'ar' ? 'رقم الشيك' : 'Cheque Number'}</label>
                    <input
                      required
                      type="text"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-500">{lang === 'ar' ? 'البنك' : 'Bank'}</label>
                    <input
                      required
                      type="text"
                      value={formData.bank}
                      onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-500">{lang === 'ar' ? 'المبلغ' : 'Amount'}</label>
                    <input
                      required
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-500">{lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
                    <input
                      required
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-500">{lang === 'ar' ? 'النوع' : 'Type'}</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any, entityId: '' })}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-zinc-500"
                    >
                      <option value="incoming">{lang === 'ar' ? 'وارد (من عميل)' : 'Incoming (from Customer)'}</option>
                      <option value="outgoing">{lang === 'ar' ? 'صادر (إلى مورد)' : 'Outgoing (to Supplier)'}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-zinc-500">
                      {formData.type === 'incoming' ? (lang === 'ar' ? 'العميل' : 'Customer') : (lang === 'ar' ? 'المورد' : 'Supplier')}
                    </label>
                    <select
                      required
                      value={formData.entityId}
                      onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-zinc-500"
                    >
                      <option value="">{lang === 'ar' ? 'اختر...' : 'Select...'}</option>
                      {formData.type === 'incoming' 
                        ? customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                        : suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                      }
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-zinc-500">{lang === 'ar' ? 'الحساب (خزينة/بنك)' : 'Account (Treasury/Bank)'}</label>
                  <select
                    required
                    value={formData.accountId}
                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-zinc-500"
                  >
                    <option value="">{lang === 'ar' ? 'اختر الحساب...' : 'Select Account...'}</option>
                    {accounts.filter(a => a.type === 'Asset').map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:opacity-90 transition-all"
                  >
                    {editingCheque ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes') : (lang === 'ar' ? 'إضافة الشيك' : 'Add Cheque')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Cheques;
