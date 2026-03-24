import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  runTransaction,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { translations } from '../translations';
import { Invoice, Product, Customer, Supplier } from '../types';
import { 
  RotateCcw, 
  Search, 
  Plus, 
  ArrowLeftRight, 
  Calendar, 
  User, 
  Hash, 
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  lang: 'ar' | 'en';
}

const Returns: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [returnItems, setReturnItems] = useState<{ productId: string; quantity: number; reason: string }[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'invoices'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Invoice[]);
      setLoading(false);
    });

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    });

    return () => {
      unsubscribe();
      unsubscribeProducts();
    };
  }, []);

  const handleCreateReturn = async () => {
    if (!selectedInvoice || returnItems.length === 0) return;

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Create the return document
        const returnDoc = {
          invoiceId: selectedInvoice.id,
          invoiceNumber: selectedInvoice.number,
          type: selectedInvoice.type === 'sales' ? 'sales_return' : 'purchase_return',
          items: returnItems,
          totalAmount: returnItems.reduce((acc, item) => {
            const invItem = selectedInvoice.items.find(i => i.productId === item.productId);
            return acc + (invItem ? invItem.price * item.quantity : 0);
          }, 0),
          createdAt: new Date().toISOString(),
          status: 'completed'
        };

        const returnsRef = collection(db, 'returns');
        const newReturnDocRef = doc(returnsRef);
        transaction.set(newReturnDocRef, returnDoc);

        // 2. Update product stock
        for (const item of returnItems) {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await transaction.get(productRef);
          if (productSnap.exists()) {
            const currentQty = productSnap.data().quantity || 0;
            // If sales return, stock increases. If purchase return, stock decreases.
            const newQty = selectedInvoice.type === 'sales' 
              ? currentQty + item.quantity 
              : currentQty - item.quantity;
            transaction.update(productRef, { quantity: newQty });
          }
        }

        // 3. Update customer/supplier balance if needed
        // (Simplified: assuming returns reduce the outstanding balance or create a credit)
        const entityRef = doc(db, selectedInvoice.type === 'sales' ? 'customers' : 'suppliers', selectedInvoice.customerId || selectedInvoice.supplierId || '');
        const entitySnap = await transaction.get(entityRef);
        if (entitySnap.exists()) {
          const currentBalance = entitySnap.data().balance || 0;
          const newBalance = selectedInvoice.type === 'sales'
            ? currentBalance - returnDoc.totalAmount
            : currentBalance + returnDoc.totalAmount;
          transaction.update(entityRef, { balance: newBalance });
        }
      });

      setIsModalOpen(false);
      setSelectedInvoice(null);
      setReturnItems([]);
    } catch (error) {
      console.error("Error creating return:", error);
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {lang === 'ar' ? 'إدارة المرتجعات' : 'Returns Management'}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            {lang === 'ar' ? 'معالجة مرتجعات المبيعات والمشتريات' : 'Process sales and purchase returns'}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl hover:opacity-90 transition-all font-bold"
        >
          <RotateCcw className="w-5 h-5" />
          {lang === 'ar' ? 'إنشاء مرتجع' : 'Create Return'}
        </button>
      </div>

      {/* Recent Returns List (Placeholder for now) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 dark:text-white">
            {lang === 'ar' ? 'آخر المرتجعات' : 'Recent Returns'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left rtl:text-right">
            <thead className="text-xs text-zinc-500 uppercase bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-6 py-4">{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice #'}</th>
                <th className="px-6 py-4">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                <th className="px-6 py-4">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                <th className="px-6 py-4">{lang === 'ar' ? 'القيمة' : 'Amount'}</th>
                <th className="px-6 py-4">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {/* This would be populated from a 'returns' collection */}
              <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <td colSpan={5} className="px-6 py-10 text-center text-zinc-500 italic">
                  {lang === 'ar' ? 'لا توجد مرتجعات مسجلة حالياً' : 'No returns recorded yet'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Return Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-xl font-bold mb-6 text-zinc-900 dark:text-white">
                {lang === 'ar' ? 'إنشاء مرتجع جديد' : 'Create New Return'}
              </h2>

              {!selectedInvoice ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'ابحث عن الفاتورة برقمها...' : 'Search for invoice by number...'}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-500"
                    />
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredInvoices.map(inv => (
                      <button
                        key={inv.id}
                        onClick={() => setSelectedInvoice(inv)}
                        className="w-full flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-all text-left rtl:text-right"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${inv.type === 'sales' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'} dark:bg-opacity-10`}>
                            <Hash className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white">{inv.number}</p>
                            <p className="text-xs text-zinc-500">{inv.customerName || inv.supplierName}</p>
                          </div>
                        </div>
                        <div className="text-right rtl:text-left">
                          <p className="font-bold text-zinc-900 dark:text-white">{inv.total.toLocaleString()} EGP</p>
                          <p className="text-xs text-zinc-500">{inv.date}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                    <div>
                      <p className="text-xs text-zinc-500">{lang === 'ar' ? 'الفاتورة المختارة' : 'Selected Invoice'}</p>
                      <p className="font-bold text-zinc-900 dark:text-white">{selectedInvoice.number}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedInvoice(null)}
                      className="text-sm text-emerald-600 font-bold hover:underline"
                    >
                      {lang === 'ar' ? 'تغيير' : 'Change'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-zinc-900 dark:text-white">{lang === 'ar' ? 'اختر الأصناف المرتجعة' : 'Select Returned Items'}</h3>
                    <div className="space-y-3">
                      {selectedInvoice.items.map(item => {
                        const product = products.find(p => p.id === item.productId);
                        const returnItem = returnItems.find(ri => ri.productId === item.productId);
                        
                        return (
                          <div key={item.productId} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
                            <div className="flex-1">
                              <p className="font-bold text-zinc-900 dark:text-white">{product?.name || 'Unknown'}</p>
                              <p className="text-xs text-zinc-500">{lang === 'ar' ? 'الكمية الأصلية:' : 'Original Qty:'} {item.quantity}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <input
                                type="number"
                                min="0"
                                max={item.quantity}
                                placeholder="0"
                                value={returnItem?.quantity || ''}
                                onChange={(e) => {
                                  const qty = Math.min(Number(e.target.value), item.quantity);
                                  if (qty > 0) {
                                    setReturnItems(prev => {
                                      const existing = prev.find(p => p.productId === item.productId);
                                      if (existing) {
                                        return prev.map(p => p.productId === item.productId ? { ...p, quantity: qty } : p);
                                      }
                                      return [...prev, { productId: item.productId, quantity: qty, reason: '' }];
                                    });
                                  } else {
                                    setReturnItems(prev => prev.filter(p => p.productId !== item.productId));
                                  }
                                }}
                                className="w-20 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleCreateReturn}
                      disabled={returnItems.length === 0}
                      className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {lang === 'ar' ? 'تأكيد المرتجع' : 'Confirm Return'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Returns;
