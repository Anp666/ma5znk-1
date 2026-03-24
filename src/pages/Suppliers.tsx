import React, { useState, useEffect } from 'react';
import { Truck, Plus, Search, Mail, Phone, MapPin, Edit2, Trash2, Package, DollarSign, X } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { translations } from '../translations';
import { recordSupplierPayment } from '../services/accountingService';
import { Account, Supplier } from '../types';
import { toast } from 'react-hot-toast';
import { getCurrencySymbol } from '../utils/currency';

import Pagination from '../components/Pagination';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function Suppliers({ lang, profile }: Props) {
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [formData, setFormData] = useState<Supplier>({
    name: '',
    email: '',
    phone: '',
    address: '',
    category: '',
    balance: 0
  });
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    description: '',
    accountId: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });

    const qAcc = query(collection(db, 'accounts'), orderBy('code'));
    const unsubscribeAcc = onSnapshot(qAcc, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });

    return () => {
      unsubscribe();
      unsubscribeAcc();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        const { id, ...data } = formData;
        await updateDoc(doc(db, 'suppliers', id), data as any);
        toast.success(lang === 'ar' ? 'تم تحديث بيانات المورد بنجاح' : 'Supplier updated successfully');
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...formData,
          balance: formData.balance || 0
        });
        toast.success(lang === 'ar' ? 'تم إضافة المورد بنجاح' : 'Supplier added successfully');
      }
      setIsModalOpen(false);
      setFormData({ name: '', email: '', phone: '', address: '', category: '', balance: 0 });
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ بيانات المورد' : 'Error saving supplier');
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier?.id) return;
    try {
      await recordSupplierPayment(
        selectedSupplier.id,
        paymentData.amount,
        paymentData.description,
        paymentData.accountId
      );
      toast.success(lang === 'ar' ? 'تم تسجيل الدفعة بنجاح' : 'Payment recorded successfully');
      setIsPaymentModalOpen(false);
      setPaymentData({ amount: 0, description: '', accountId: '' });
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error(lang === 'ar' ? 'خطأ في تسجيل الدفعة' : 'Error recording payment');
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSuppliers.length / pageSize);
  const paginatedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-2xl">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t.suppliers}</h2>
            <p className="text-sm text-zinc-500">Manage your supply chain and vendor relationships</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
        >
          <Plus className="w-5 h-5" />
          {lang === 'ar' ? 'إضافة مورد' : 'Add Supplier'}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
        <input 
          type="text" 
          placeholder={lang === 'ar' ? 'البحث عن مورد...' : 'Search suppliers...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl outline-none focus:ring-2 ring-emerald-500/20 transition-all"
        />
      </div>

      {/* Suppliers Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left responsive-table">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 text-xs uppercase tracking-widest font-bold">
                <th className="px-8 py-4">{lang === 'ar' ? 'المورد' : 'Supplier'}</th>
                <th className="px-8 py-4">{lang === 'ar' ? 'التصنيف' : 'Category'}</th>
                <th className="px-8 py-4">{lang === 'ar' ? 'الاتصال' : 'Contact'}</th>
                <th className="px-8 py-4">{lang === 'ar' ? 'الرصيد' : 'Balance'}</th>
                <th className="px-8 py-4 text-right">{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-8 py-5" data-label={lang === 'ar' ? 'المورد' : 'Supplier'}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                        {supplier.name[0]}
                      </div>
                      <div className="font-bold">{supplier.name}</div>
                    </div>
                  </td>
                  <td className="px-8 py-5" data-label={lang === 'ar' ? 'التصنيف' : 'Category'}>
                    <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {supplier.category}
                    </span>
                  </td>
                  <td className="px-8 py-5" data-label={lang === 'ar' ? 'الاتصال' : 'Contact'}>
                    <div className="space-y-1">
                      <div className="text-sm flex items-center gap-2 text-zinc-500">
                        <Phone className="w-3 h-3" /> {supplier.phone}
                      </div>
                      <div className="text-xs flex items-center gap-2 text-zinc-400">
                        <Mail className="w-3 h-3" /> {supplier.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5" data-label={lang === 'ar' ? 'الرصيد' : 'Balance'}>
                    <div className={`font-black ${supplier.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {currencySymbol} {supplier.balance?.toLocaleString() || 0}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setSelectedSupplier(supplier); setIsPaymentModalOpen(true); }}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-emerald-600 flex items-center gap-1 text-xs font-bold"
                      >
                        <DollarSign className="w-4 h-4" />
                        {lang === 'ar' ? 'دفع' : 'Pay'}
                      </button>
                      <button 
                        onClick={() => { setFormData(supplier); setIsModalOpen(true); }}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-blue-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteDoc(doc(db, 'suppliers', supplier.id!))}
                        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredSuppliers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center opacity-50 italic">No suppliers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalRecords={filteredSuppliers.length}
        pageSize={pageSize}
        lang={lang}
      />

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl">
            <h3 className="text-2xl font-bold mb-8">{formData.id ? (lang === 'ar' ? 'تعديل مورد' : 'Edit Supplier') : (lang === 'ar' ? 'إضافة مورد جديد' : 'Add New Supplier')}</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'اسم المورد' : 'Supplier Name'}</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'التصنيف' : 'Category'}</label>
                <input 
                  required
                  type="text" 
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Email</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">Phone</label>
                  <input 
                    required
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                  />
                </div>
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

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold">{lang === 'ar' ? 'دفع للمورد' : 'Pay Supplier'}</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl border border-orange-100 dark:border-orange-900/20">
              <div className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-1">{lang === 'ar' ? 'المورد' : 'Supplier'}</div>
              <div className="text-lg font-bold">{selectedSupplier?.name}</div>
              <div className="text-sm text-orange-600 font-bold mt-2">
                {lang === 'ar' ? 'الرصيد المستحق:' : 'Outstanding Balance:'} {currencySymbol} {selectedSupplier?.balance?.toLocaleString()}
              </div>
            </div>
            <form onSubmit={handlePayment} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'الحساب (الخزينة/البنك)' : 'Account (Cash/Bank)'}</label>
                <select 
                  required
                  value={paymentData.accountId}
                  onChange={e => setPaymentData({ ...paymentData, accountId: e.target.value })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20"
                >
                  <option value="">Select Account</option>
                  {accounts.filter(a => a.type === 'Asset').map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'المبلغ' : 'Amount'}</label>
                <input 
                  required
                  type="number" 
                  value={paymentData.amount || ''}
                  onChange={e => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20 text-2xl font-black"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">{lang === 'ar' ? 'البيان' : 'Description'}</label>
                <textarea 
                  required
                  value={paymentData.description}
                  onChange={e => setPaymentData({ ...paymentData, description: e.target.value })}
                  className="w-full px-6 py-4 bg-zinc-50 dark:bg-zinc-800 border-none rounded-2xl outline-none focus:ring-2 ring-emerald-500/20 h-24 resize-none"
                  placeholder={lang === 'ar' ? 'تفاصيل الدفع...' : 'Payment details...'}
                />
              </div>
              <button 
                type="submit"
                className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all"
              >
                {lang === 'ar' ? 'تأكيد الدفع' : 'Confirm Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
