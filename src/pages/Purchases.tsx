import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  Printer, 
  Download, 
  Trash2, 
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  Package,
  X,
  Minus,
  Plus as PlusIcon,
  Percent
} from 'lucide-react';
import { auth, db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc,
  increment,
  writeBatch,
  deleteDoc,
  where
} from 'firebase/firestore';
import { Invoice, Product, Supplier, Account } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';
import { recordPurchaseInvoice } from '../services/accountingService';
import { toast } from 'react-hot-toast';
import { fixArabic, initArabicPdf } from '../utils/pdfUtils';
import autoTable from 'jspdf-autotable';
import Pagination from '../components/Pagination';
import { logAction } from '../services/actionTrackingService';
import { getCurrencySymbol } from '../utils/currency';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

interface CartItem extends Product {
  cartQuantity: number;
}

export default function Purchases({ lang, profile }: Props) {
  const { user } = useAuth();
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [posSearchTerm, setPosSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Purchase State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [taxRate, setTaxRate] = useState(15);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'invoices'), where('type', '==', 'purchase'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
        setInvoices(docs);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(docs);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'accounts'), where('type', 'in', ['Asset']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      setAccounts(docs.filter(a => a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')));
    });
    return () => unsubscribe();
  }, []);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id 
            ? { ...item, cartQuantity: item.cartQuantity + 1 } 
            : item
        );
      }
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== productId));
      return;
    }
    setCart(prev => prev.map(item => 
      item.id === productId ? { ...item, cartQuantity: quantity } : item
    ));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.purchasePrice * item.cartQuantity), 0);
  const discountValue = discountType === 'percentage' ? (subtotal * discount / 100) : discount;
  const taxableAmount = subtotal - discountValue;
  const taxValue = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxValue;

  const handleCheckout = async () => {
    if (cart.length === 0 || !user) return;
    
    try {
      const invoiceNumber = `PUR-${Date.now()}`;
      const supplier = suppliers.find(s => s.id === selectedSupplierId);
      
      const invoiceData: Omit<Invoice, 'id'> = {
        number: invoiceNumber,
        date: new Date().toISOString(),
        supplierId: selectedSupplierId || null,
        items: cart.map(item => ({
          productId: item.id!,
          name: item.name,
          quantity: item.cartQuantity,
          price: item.purchasePrice,
          total: item.purchasePrice * item.cartQuantity
        })),
        subtotal,
        discount: discountValue,
        discountType,
        taxRate,
        tax: taxValue,
        total,
        paidAmount: selectedAccountId ? total : 0,
        paymentMethod: 'cash', // Default
        type: 'purchase',
        status: selectedAccountId ? 'paid' : 'pending',
        userId: user.uid
      };

      // 1. Save Invoice
      const invoiceRef = await addDoc(collection(db, 'invoices'), invoiceData);

      // 2. Update Product Quantities
      const batch = writeBatch(db);
      cart.forEach(item => {
        if (item.id) {
          const productRef = doc(db, 'products', item.id);
          batch.update(productRef, {
            quantity: increment(item.cartQuantity) // Purchase increases stock
          });
        }
      });
      await batch.commit();

      // 3. Record Accounting Entry
      await recordPurchaseInvoice({ ...invoiceData, id: invoiceRef.id }, selectedAccountId || undefined);
      
      // 4. Log Action
      await logAction({
        userId: user.uid,
        userName: user.displayName || user.email || 'Unknown',
        action: 'CREATED_PURCHASE_INVOICE',
        module: 'Purchases',
        details: `Created purchase invoice ${invoiceNumber} from ${supplier?.name} - Total: ${currencySymbol} ${total}`
      });

      toast.success(lang === 'ar' ? 'تم حفظ فاتورة الشراء بنجاح' : 'Purchase invoice saved successfully');
      setCart([]);
      setSelectedSupplierId('');
      setSelectedAccountId('');
      setDiscount(0);
      setIsModalOpen(false);
      
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(lang === 'ar' ? 'خطأ في حفظ الفاتورة' : 'Error saving invoice');
      handleFirestoreError(error, OperationType.WRITE, 'invoices');
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    suppliers.find(s => s.id === inv.supplierId)?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(posSearchTerm.toLowerCase())
  );

  const exportToPDF = async (invoice: Invoice) => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    
    // Header Section
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    // Company Logo (Placeholder)
    doc.setFillColor(16, 185, 129);
    doc.circle(isAr ? pageWidth - 30 : 30, 30, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(12);
    doc.text(fixArabic(t.brand[0]), isAr ? pageWidth - 30 : 30, 31, { align: 'center' });
    
    // Company Name
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.text(fixArabic(t.storeName), isAr ? pageWidth - 45 : 45, 32, { align: isAr ? 'right' : 'left' });
    
    // Invoice Title & Details
    doc.setFontSize(24);
    doc.setTextColor(16, 185, 129);
    doc.text(fixArabic(isAr ? 'فاتورة شراء' : 'Purchase Invoice'), isAr ? margin : pageWidth - margin, 32, { align: isAr ? 'left' : 'right' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(fixArabic(`${isAr ? 'رقم الفاتورة' : 'Invoice #'}: ${invoice.number}`), isAr ? margin : pageWidth - margin, 42, { align: isAr ? 'left' : 'right' });
    doc.text(fixArabic(`${isAr ? 'التاريخ' : 'Date'}: ${new Date(invoice.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}`), isAr ? margin : pageWidth - margin, 48, { align: isAr ? 'left' : 'right' });
    
    // Supplier Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('Cairo', 'bold');
    doc.text(fixArabic(isAr ? 'معلومات المورد' : 'Supplier Information'), isAr ? pageWidth - margin : margin, 80, { align: isAr ? 'right' : 'left' });
    
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(11);
    const supplier = suppliers.find(s => s.id === invoice.supplierId);
    doc.text(fixArabic(`${isAr ? 'الاسم' : 'Name'}: ${supplier?.name || '---'}`), isAr ? pageWidth - margin : margin, 90, { align: isAr ? 'right' : 'left' });
    
    const tableData = invoice.items.map(item => [
      fixArabic(item.name),
      item.quantity,
      item.price.toFixed(2),
      item.total.toFixed(2)
    ]);

    autoTable(doc, {
      startY: 100,
      head: [[
        fixArabic(isAr ? 'المنتج' : 'Product'), 
        fixArabic(isAr ? 'الكمية' : 'Qty'), 
        fixArabic(isAr ? 'السعر' : 'Price'), 
        fixArabic(isAr ? 'الإجمالي' : 'Total')
      ]],
      body: tableData,
      styles: { 
        font: 'Cairo', 
        fontSize: 10,
        cellPadding: 6,
        halign: isAr ? 'right' : 'left' 
      },
      headStyles: { 
        fillColor: [16, 185, 129], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: isAr ? 'right' : 'left' 
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    
    doc.setFontSize(11);
    const totalsX = isAr ? margin : pageWidth - margin - 40;
    const labelsX = isAr ? margin + 60 : pageWidth - margin - 60;
    const align = isAr ? 'left' : 'right';

    doc.setFont('Cairo', 'normal');
    doc.text(fixArabic(`${isAr ? 'المجموع الفرعي' : 'Subtotal'}:`), labelsX, finalY + 20, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.subtotal.toFixed(2)} ${currencySymbol}`, totalsX, finalY + 20, { align });

    doc.text(fixArabic(`${isAr ? 'الخصم' : 'Discount'}:`), labelsX, finalY + 30, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.discount.toFixed(2)} ${currencySymbol}`, totalsX, finalY + 30, { align });

    doc.text(fixArabic(`${isAr ? 'الضريبة' : 'Tax'}:`), labelsX, finalY + 40, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.tax.toFixed(2)} ${currencySymbol}`, totalsX, finalY + 40, { align });

    doc.setDrawColor(226, 232, 240);
    doc.line(isAr ? margin : pageWidth - margin - 100, finalY + 45, isAr ? margin + 100 : pageWidth - margin, finalY + 45);

    doc.setFontSize(16);
    doc.setFont('Cairo', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(fixArabic(`${isAr ? 'الإجمالي النهائي' : 'Final Total'}:`), labelsX, finalY + 60, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.total.toFixed(2)} ${currencySymbol}`, totalsX, finalY + 60, { align });

    doc.save(`Purchase-Invoice-${invoice.number}.pdf`);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="relative w-full md:w-[450px] group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text" 
            placeholder={lang === 'ar' ? 'بحث عن فاتورة شراء...' : 'Search purchase invoices...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-sm font-medium"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-10 py-4.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-2xl shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Plus className="w-6 h-6" />
          {lang === 'ar' ? 'فاتورة شراء جديدة' : 'New Purchase Invoice'}
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left responsive-table">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.invoiceNumber}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.supplier}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.date}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.total}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] text-right">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-10 py-8 font-black text-zinc-900 dark:text-white" data-label={t.invoiceNumber}>{inv.number}</td>
                  <td className="px-10 py-8 text-sm font-black text-zinc-600 dark:text-zinc-400" data-label={t.supplier}>
                    {suppliers.find(s => s.id === inv.supplierId)?.name || 'Unknown Supplier'}
                  </td>
                  <td className="px-10 py-8 text-sm text-zinc-500 font-medium" data-label={t.date}>{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-10 py-8 font-black text-emerald-600" data-label={t.total}>{currencySymbol} {inv.total.toLocaleString()}</td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'الحالة' : 'Status'}>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-yellow-100 text-yellow-600'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <button 
                        onClick={() => exportToPDF(inv)}
                        className="p-3 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                        title={lang === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalRecords={filteredInvoices.length}
          pageSize={pageSize}
          lang={lang}
        />
      </div>

      {/* Purchase Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center md:p-6 no-print">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full h-full md:h-[90vh] md:max-w-[1200px] bg-white dark:bg-zinc-900 md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-zinc-200 dark:border-zinc-800"
            >
              {/* LEFT SIDE: Product Selection */}
              <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="p-6 md:p-10 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl md:text-4xl font-black tracking-tighter">{lang === 'ar' ? 'فاتورة شراء' : 'Purchase Invoice'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                      <X className="w-6 h-6 md:w-7 md:h-7" />
                    </button>
                  </div>

                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                      type="text" 
                      placeholder={t.searchProduct}
                      value={posSearchTerm}
                      onChange={(e) => setPosSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold shadow-sm" 
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-10 pt-4 custom-scrollbar">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    {filteredProducts.map(product => (
                      <div 
                        key={product.id} 
                        onClick={() => addToCart(product)}
                        className="p-3 md:p-5 bg-white dark:bg-zinc-800 rounded-[1.5rem] md:rounded-[2rem] hover:ring-4 hover:ring-emerald-500/20 cursor-pointer transition-all group relative shadow-sm border border-zinc-100 dark:border-zinc-700/50"
                      >
                        <div className="w-full aspect-square bg-zinc-50 dark:bg-zinc-700 rounded-xl md:rounded-[1.25rem] mb-3 md:mb-4 flex items-center justify-center text-zinc-300 group-hover:scale-105 transition-all duration-500">
                          <Package className="w-8 h-8 md:w-10 md:h-10" />
                        </div>
                        <div className="font-black text-xs md:text-sm mb-1 md:mb-2 text-zinc-900 dark:text-white line-clamp-1 group-hover:text-emerald-600 transition-colors">{product.name}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-600 font-black text-xs md:text-base">{currencySymbol} {product.purchasePrice.toLocaleString()}</span>
                          <span className="text-[8px] md:text-[10px] font-black px-2 py-1 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-zinc-500 dark:text-zinc-300 uppercase tracking-widest">
                            {product.quantity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile Cart Toggle */}
                <div className="md:hidden p-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky bottom-0 z-10">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.total}</span>
                    <span className="text-xl font-black text-emerald-600">{currencySymbol} {total.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => {
                      const cartSection = document.getElementById('cart-section');
                      cartSection?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-600/20"
                  >
                    {lang === 'ar' ? 'عرض السلة' : 'View Cart'} ({cart.length})
                  </button>
                </div>
              </div>

              {/* RIGHT SIDE: Cart & Totals */}
              <div id="cart-section" className="w-full md:w-[400px] lg:w-[450px] xl:w-[500px] bg-white dark:bg-zinc-900 p-6 md:p-10 flex flex-col border-t md:border-t-0 md:border-l border-zinc-100 dark:border-zinc-800 h-full overflow-y-auto md:overflow-hidden">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl md:text-2xl font-black tracking-tighter">{lang === 'ar' ? 'تفاصيل الشراء' : 'Purchase Details'}</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.supplier}</label>
                    <select 
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 font-bold"
                    >
                      <option value="">{lang === 'ar' ? 'اختر مورد' : 'Select Supplier'}</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'حساب الدفع' : 'Payment Account'}</label>
                    <select 
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 font-bold"
                    >
                      <option value="">{lang === 'ar' ? 'شراء آجل (دائنون)' : 'Credit Purchase (AP)'}</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2rem] p-6 flex flex-col overflow-hidden border border-zinc-100 dark:border-zinc-800/50">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar mb-6">
                    {cart.map(item => (
                      <div key={item.id} className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="text-xs font-black text-zinc-900 dark:text-white">{item.name}</div>
                          <div className="text-[10px] text-zinc-500 font-bold flex items-center gap-2 mt-1">
                            <span>{item.cartQuantity} x {currencySymbol} {item.purchasePrice.toLocaleString()}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateCartQuantity(item.id!, item.cartQuantity - 1)} className="p-1 bg-white dark:bg-zinc-700 hover:bg-zinc-100 rounded-md shadow-sm transition-colors"><Minus className="w-3 h-3" /></button>
                              <button onClick={() => updateCartQuantity(item.id!, item.cartQuantity + 1)} className="p-1 bg-white dark:bg-zinc-700 hover:bg-zinc-100 rounded-md shadow-sm transition-colors"><PlusIcon className="w-3 h-3" /></button>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs font-black text-emerald-600">{currencySymbol} {(item.purchasePrice * item.cartQuantity).toFixed(2)}</div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700 py-10">
                        <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Cart is empty</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-4">
                    <div className="flex justify-between text-2xl font-black pt-3 tracking-tighter">
                      <span>{t.total}</span>
                      <span className="text-emerald-600">{currencySymbol} {total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3 sticky bottom-0 bg-white dark:bg-zinc-900 pt-2">
                  <button 
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || !selectedSupplierId}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black text-xs shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <CreditCard className="w-5 h-5" />
                    {lang === 'ar' ? 'حفظ فاتورة الشراء' : 'Save Purchase Invoice'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
