import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  Printer, 
  Download, 
  Trash2, 
  ShoppingCart,
  User,
  Calendar,
  CreditCard,
  Package,
  X,
  Minus,
  Plus as PlusIcon,
  ScanBarcode,
  Percent,
  Banknote,
  Eye,
  FileDown
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
import { Invoice, Product, Customer, Account } from '../types';
import { translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fixArabic, initArabicPdf, generateInvoicePDF } from '../utils/pdfUtils';
import { useAuth } from '../hooks/useAuth';
import Pagination from '../components/Pagination';
import { Filter, RotateCcw } from 'lucide-react';
import { logAction } from '../services/actionTrackingService';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';
import { recordSalesInvoice } from '../services/accountingService';
import { getCurrencySymbol } from '../utils/currency';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

interface CartItem extends Product {
  cartQuantity: number;
}

export default function Invoices({ lang, profile }: Props) {
  const { user } = useAuth();
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [posSearchTerm, setPosSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [taxRate, setTaxRate] = useState(15);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'credit'>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'invoices'), orderBy('date', 'desc'));
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
    const q = query(collection(db, 'customers'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'accounts'), where('type', 'in', ['Asset']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
      // Only show Cash/Bank accounts
      setAccounts(docs.filter(a => a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('bank')));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isModalOpen && barcodeRef.current) {
      barcodeRef.current.focus();
    }
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setViewingInvoice(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen]);

  const addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      toast.error(lang === 'ar' ? 'هذا المنتج غير متوفر في المخزون' : 'This product is out of stock');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cartQuantity + 1 > product.quantity) {
          toast.error(lang === 'ar' ? 'الكمية المطلوبة أكبر من الكمية المتاحة في المخزون' : 'Requested quantity exceeds available stock');
          return prev;
        }
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
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.id !== productId));
      return;
    }

    if (quantity > product.quantity) {
      toast.error(lang === 'ar' ? 'الكمية المطلوبة أكبر من الكمية المتاحة في المخزون' : 'Requested quantity exceeds available stock');
    }

    setCart(prev => prev.map(item => 
      item.id === productId ? { ...item, cartQuantity: quantity } : item
    ));
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.barcode === barcodeInput || p.sku === barcodeInput);
    if (product) {
      addToCart(product);
      setBarcodeInput('');
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.sellingPrice * item.cartQuantity), 0);
  const discountValue = discountType === 'percentage' ? (subtotal * discount / 100) : discount;
  const taxableAmount = subtotal - discountValue;
  const taxValue = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxValue;

  const handleCheckout = async () => {
    if (cart.length === 0 || !user) return;

    // Validate Stock
    const outOfStockItems = cart.filter(item => item.cartQuantity > item.quantity);
    if (outOfStockItems.length > 0) {
      toast.error(lang === 'ar' ? 'الكمية المطلوبة أكبر من الكمية المتاحة في المخزون' : 'Requested quantity exceeds available stock');
      return;
    }
    
    try {
      const invoiceNumber = `INV-${Date.now()}`;
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      const invoiceData: Omit<Invoice, 'id'> = {
        number: invoiceNumber,
        date: new Date().toISOString(),
        customerId: selectedCustomerId || null,
        customerName: customer?.name || (lang === 'ar' ? 'عميل نقدي' : 'Cash Customer'),
        items: cart.map(item => ({
          productId: item.id!,
          name: item.name,
          quantity: item.cartQuantity,
          price: item.sellingPrice,
          total: item.sellingPrice * item.cartQuantity
        })),
        subtotal,
        discount: discountValue,
        discountType,
        taxRate,
        tax: taxValue,
        total,
        paidAmount: paymentMethod === 'credit' ? 0 : total,
        paymentMethod,
        type: 'sales',
        status: paymentMethod === 'credit' ? 'unpaid' : 'paid',
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
            quantity: increment(-item.cartQuantity)
          });
        }
      });
      await batch.commit();

      // 3. Record Accounting Entry
      await recordSalesInvoice({ ...invoiceData, id: invoiceRef.id }, selectedAccountId || undefined);
      
      // 4. Log Action
      await logAction({
        userId: user.uid,
        userName: user.displayName || user.email || 'Unknown',
        action: 'CREATED_INVOICE',
        module: 'Sales',
        details: `Created invoice ${invoiceNumber} for ${invoiceData.customerName} - Total: ${currencySymbol} ${total}`
      });

      // Print after save
      const newInvoice = { ...invoiceData, id: invoiceRef.id };
      setViewingInvoice(newInvoice);
      
      setCart([]);
      setSelectedCustomerId('');
      setSelectedAccountId('');
      setDiscount(0);
      setIsModalOpen(false);
      
      setTimeout(() => {
        window.print();
      }, 500);

    } catch (error) {
      console.error('Checkout error:', error);
      handleFirestoreError(error, OperationType.WRITE, 'invoices');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذه الفاتورة؟' : 'Are you sure you want to delete this invoice?')) {
      try {
        await deleteDoc(doc(db, 'invoices', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `invoices/${id}`);
      }
    }
  };

  const exportToPDF = async (invoice: Invoice) => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    
    // Header Section
    doc.setFillColor(248, 250, 252); // Light gray background for header
    doc.rect(0, 0, pageWidth, 60, 'F');
    
    // Company Logo (Placeholder)
    doc.setFillColor(16, 185, 129); // Emerald-600
    doc.roundedRect(isAr ? pageWidth - 40 : margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', isAr ? pageWidth - 30 : margin + 10, 29, { align: 'center' });
    
    // Company Name
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFontSize(18);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - 45 : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    doc.setFontSize(10);
    doc.setFont('Cairo', 'normal');
    doc.text(fixArabic(isAr ? 'نظام المحاسبة المتكامل' : 'Integrated Accounting System'), isAr ? pageWidth - 45 : margin + 25, 35, { align: isAr ? 'right' : 'left' });
    
    // Invoice Title & Details
    doc.setFontSize(22);
    doc.setFont('Cairo', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(fixArabic(isAr ? 'فاتورة ضريبية' : 'Tax Invoice'), isAr ? margin : pageWidth - margin, 28, { align: isAr ? 'left' : 'right' });
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont('Cairo', 'normal');
    doc.text(fixArabic(`${isAr ? 'رقم الفاتورة' : 'Invoice #'}: ${invoice.number}`), isAr ? margin : pageWidth - margin, 38, { align: isAr ? 'left' : 'right' });
    doc.text(fixArabic(`${isAr ? 'التاريخ' : 'Date'}: ${new Date(invoice.date).toLocaleDateString(isAr ? 'ar-SA' : 'en-US')}`), isAr ? margin : pageWidth - margin, 44, { align: isAr ? 'left' : 'right' });
    
    // Customer Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('Cairo', 'bold');
    doc.text(fixArabic(isAr ? 'معلومات العميل' : 'Customer Information'), isAr ? pageWidth - margin : margin, 80, { align: isAr ? 'right' : 'left' });
    
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(10);
    doc.text(fixArabic(`${isAr ? 'الاسم' : 'Name'}: ${invoice.customerName}`), isAr ? pageWidth - margin : margin, 88, { align: isAr ? 'right' : 'left' });
    
    // Products Table
    const tableData = invoice.items.map(item => [
      fixArabic(item.name),
      item.quantity,
      `${currencySymbol} ${item.price.toLocaleString()}`,
      `${currencySymbol} ${item.total.toLocaleString()}`
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
        fontSize: 9,
        cellPadding: 6,
        halign: isAr ? 'right' : 'left' 
      },
      headStyles: { 
        fillColor: [30, 41, 59], 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: isAr ? 'right' : 'left' 
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: margin, right: margin },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    
    // Totals Section
    const totalsX = isAr ? margin : pageWidth - margin;
    const align = isAr ? 'left' : 'right';

    doc.setFontSize(10);
    doc.setFont('Cairo', 'normal');
    doc.setTextColor(100);
    doc.text(fixArabic(`${isAr ? 'المجموع الفرعي' : 'Subtotal'}: ${currencySymbol} ${invoice.subtotal.toLocaleString()}`), totalsX, finalY + 15, { align });
    doc.text(fixArabic(`${isAr ? 'الخصم' : 'Discount'}: ${currencySymbol} ${invoice.discount.toLocaleString()}`), totalsX, finalY + 22, { align });
    doc.text(fixArabic(`${isAr ? 'الضريبة' : 'Tax'}: ${currencySymbol} ${invoice.tax.toLocaleString()}`), totalsX, finalY + 29, { align });

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, finalY + 35, pageWidth - margin, finalY + 35);

    doc.setFontSize(14);
    doc.setFont('Cairo', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(fixArabic(`${isAr ? 'الإجمالي النهائي' : 'Final Total'}: ${currencySymbol} ${invoice.total.toLocaleString()}`), totalsX, finalY + 45, { align });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(fixArabic(isAr ? 'شكراً لتعاملكم معنا! تم إنشاء هذه الفاتورة إلكترونياً.' : 'Thank you for your business! This is an electronically generated invoice.'), pageWidth / 2, 285, { align: 'center' });

    doc.save(`Invoice-${invoice.number}.pdf`);
  };

  const exportReceiptPDF = async (invoice: Invoice) => {
    // 80mm width for thermal printers
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const width = 80;
    const margin = 5;
    
    // Set custom page size
    (doc as any).internal.pageSize.width = width;
    (doc as any).internal.pageSize.height = 150; 

    const centerX = width / 2;
    
    // Company Header
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text(fixArabic(t.brand), centerX, 10, { align: 'center' });
    
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(8);
    doc.text(fixArabic(isAr ? 'فاتورة مبسطة' : 'Simplified Invoice'), centerX, 15, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(margin, 18, width - margin, 18);
    
    // Invoice Info
    doc.setFontSize(7);
    doc.text(fixArabic(`${isAr ? 'رقم الفاتورة' : 'Invoice #'}: ${invoice.number}`), isAr ? width - margin : margin, 25, { align: isAr ? 'right' : 'left' });
    doc.text(fixArabic(`${isAr ? 'التاريخ' : 'Date'}: ${new Date(invoice.date).toLocaleString(isAr ? 'ar-SA' : 'en-US')}`), isAr ? width - margin : margin, 29, { align: isAr ? 'right' : 'left' });
    doc.text(fixArabic(`${isAr ? 'العميل' : 'Customer'}: ${invoice.customerName}`), isAr ? width - margin : margin, 33, { align: isAr ? 'right' : 'left' });
    
    // Items Table
    const tableData = invoice.items.map(item => [
      fixArabic(item.name),
      item.quantity,
      item.total.toFixed(2)
    ]);

    autoTable(doc, {
      startY: 38,
      margin: { left: margin, right: margin },
      tableWidth: width - (margin * 2),
      head: [[
        fixArabic(isAr ? 'المنتج' : 'Item'), 
        fixArabic(isAr ? 'الكمية' : 'Qty'), 
        fixArabic(isAr ? 'الإجمالي' : 'Total')
      ]],
      body: tableData,
      theme: 'plain',
      styles: { 
        font: 'Cairo', 
        fontSize: 7,
        cellPadding: 1,
        halign: isAr ? 'right' : 'left' 
      },
      headStyles: { 
        fontStyle: 'bold',
        lineWidth: 0.1,
        lineColor: 200
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 60;
    
    // Totals
    doc.setFontSize(8);
    doc.setFont('Cairo', 'bold');
    doc.text(fixArabic(`${isAr ? 'الإجمالي' : 'Total'}:`), isAr ? width - margin : margin, finalY + 10, { align: isAr ? 'right' : 'left' });
    doc.text(`${invoice.total.toFixed(2)} ${currencySymbol}`, isAr ? margin : width - margin, finalY + 10, { align: isAr ? 'left' : 'right' });
    
    // Footer
    doc.setFont('Cairo', 'normal');
    doc.setFontSize(6);
    doc.text(fixArabic(isAr ? 'شكراً لزيارتكم' : 'Thank you for visiting'), centerX, finalY + 20, { align: 'center' });
    
    doc.save(`Receipt-${invoice.number}.pdf`);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(invoices.map(inv => ({
      Number: inv.number,
      Date: new Date(inv.date).toLocaleDateString(),
      Customer: inv.customerName,
      Total: inv.total,
      Status: inv.status
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");
    XLSX.writeFile(workbook, "Invoices_Report.xlsx");
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesCustomer = customerFilter === 'all' || inv.customerId === customerFilter;
    
    const invDate = new Date(inv.date);
    const matchesStartDate = !startDate || invDate >= new Date(startDate);
    const matchesEndDate = !endDate || invDate <= new Date(endDate + 'T23:59:59');

    return matchesSearch && matchesStatus && matchesCustomer && matchesStartDate && matchesEndDate;
  });

  const totalPages = Math.ceil(filteredInvoices.length / pageSize);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(posSearchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(posSearchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(posSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10">
      {/* Printable Invoice (Hidden) */}
      <div id="printable-invoice" className="hidden print:block p-10 bg-white text-black font-sans">
        {viewingInvoice && (
          <div className="max-w-4xl mx-auto border p-10">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h1 className="text-4xl font-black mb-2">{t.storeName}</h1>
                <p className="text-zinc-500">الرياض، المملكة العربية السعودية</p>
                <p className="text-zinc-500">هاتف: 966500000000+</p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-bold text-emerald-600 mb-4">{lang === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice'}</h2>
                <p className="font-bold">{t.invoiceNumber}: {viewingInvoice.number}</p>
                <p>{t.date}: {new Date(viewingInvoice.date).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mb-10 p-6 bg-zinc-50 rounded-2xl">
              <h3 className="font-bold mb-2">{t.customerName}:</h3>
              <p className="text-xl">{viewingInvoice.customerName}</p>
            </div>

            <table className="w-full mb-10">
              <thead>
                <tr className="border-b-2 border-zinc-200">
                  <th className="py-4 text-left">{t.productName}</th>
                  <th className="py-4 text-center">{t.quantity}</th>
                  <th className="py-4 text-right">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                  <th className="py-4 text-right">{t.total}</th>
                </tr>
              </thead>
              <tbody>
                {viewingInvoice.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-zinc-100">
                    <td className="py-4">{item.name}</td>
                    <td className="py-4 text-center">{item.quantity}</td>
                    <td className="py-4 text-right">{currencySymbol} {item.price.toFixed(2)}</td>
                    <td className="py-4 text-right">{currencySymbol} {item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-80 space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t.subtotal}</span>
                  <span className="font-bold">{currencySymbol} {viewingInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t.discount}</span>
                  <span className="font-bold text-red-500">- {currencySymbol} {viewingInvoice.discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t.taxValue} ({viewingInvoice.taxRate}%)</span>
                  <span className="font-bold">{currencySymbol} {viewingInvoice.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-2xl font-black border-t pt-4">
                  <span>{t.finalTotal}</span>
                  <span className="text-emerald-600">{currencySymbol} {viewingInvoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-20 text-center text-zinc-400 text-sm">
              شكراً لتعاملكم معنا!
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 no-print">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-[450px] group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                placeholder={lang === 'ar' ? 'بحث عن فاتورة أو عميل...' : 'Search invoices or customers...'}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-14 pr-6 py-4.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 transition-all outline-none shadow-sm font-medium"
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-4.5 rounded-2xl border transition-all shadow-sm flex items-center gap-2 ${
                showFilters 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800' 
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <Filter className="w-6 h-6" />
              <span className="hidden md:inline font-bold">{t.filter}</span>
            </button>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button 
              onClick={exportToExcel}
              className="p-4.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-50 transition-all shadow-sm"
            >
              <Download className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex-1 md:flex-none px-10 py-4.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-2xl shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Plus className="w-6 h-6" />
              {lang === 'ar' ? 'فاتورة جديدة' : 'New Invoice'}
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-4 gap-6 shadow-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.status}</label>
                  <select 
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                  >
                    <option value="all">{t.all}</option>
                    <option value="paid">{t.paid}</option>
                    <option value="pending">{t.pending}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.customerName}</label>
                  <select 
                    value={customerFilter}
                    onChange={(e) => {
                      setCustomerFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                  >
                    <option value="all">{t.all}</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.startDate}</label>
                  <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.endDate}</label>
                  <div className="flex gap-2">
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="flex-1 px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                    />
                    <button 
                      onClick={() => {
                        setStatusFilter('all');
                        setCustomerFilter('all');
                        setStartDate('');
                        setEndDate('');
                        setCurrentPage(1);
                      }}
                      className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl hover:bg-zinc-200 transition-all"
                      title={t.reset}
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden no-print">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left responsive-table">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.invoiceNumber}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.customerName}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.date}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{t.total}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-10 py-8" data-label={t.invoiceNumber}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-[1rem] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all duration-500">
                        <FileText className="w-6 h-6" />
                      </div>
                      <span className="font-black text-zinc-900 dark:text-white group-hover:text-emerald-600 transition-colors">{inv.number}</span>
                    </div>
                  </td>
                  <td className="px-10 py-8 text-sm font-black text-zinc-600 dark:text-zinc-400" data-label={t.customerName}>{inv.customerName}</td>
                  <td className="px-10 py-8 text-sm text-zinc-500 font-medium" data-label={t.date}>{new Date(inv.date).toLocaleDateString()}</td>
                  <td className="px-10 py-8 font-black text-emerald-600" data-label={t.total}>{currencySymbol} {inv.total.toLocaleString()}</td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'الحالة' : 'Status'}>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20' : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <button 
                        onClick={() => setViewingInvoice(inv)}
                        className="p-3 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => exportToPDF(inv)}
                        className="p-3 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                        title={lang === 'ar' ? 'تصدير PDF' : 'Export PDF'}
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => exportReceiptPDF(inv)}
                        className="p-3 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                        title={lang === 'ar' ? 'تصدير إيصال' : 'Export Receipt'}
                      >
                        <Banknote className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => {
                          setViewingInvoice(inv);
                          setTimeout(() => window.print(), 500);
                        }}
                        className="p-3 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => inv.id && handleDelete(inv.id)}
                        className="p-3 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
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

      {/* POS Modal */}
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
              className="relative w-full h-full md:h-[90vh] lg:h-[85vh] md:max-w-[1200px] bg-white dark:bg-zinc-900 md:rounded-[2.5rem] shadow-2xl overflow-y-auto md:overflow-hidden flex flex-col md:flex-row border border-zinc-200 dark:border-zinc-800"
            >
              {/* LEFT SIDE: Product Selection */}
              <div className="w-full md:flex-1 flex flex-col md:h-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="p-4 md:p-10 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-xl md:text-4xl font-black tracking-tighter">{lang === 'ar' ? 'إنشاء فاتورة' : 'Create Invoice'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                      <X className="w-6 h-6 md:w-7 md:h-7" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                      <input 
                        type="text" 
                        placeholder={t.searchProduct}
                        value={posSearchTerm}
                        onChange={(e) => setPosSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 md:py-3.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold shadow-sm" 
                      />
                    </div>
                    <form onSubmit={handleBarcodeSubmit} className="relative group">
                      <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                      <input 
                        ref={barcodeRef}
                        type="text" 
                        placeholder={t.barcode}
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 md:py-3.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold shadow-sm" 
                      />
                    </form>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-10 pt-4 custom-scrollbar min-h-[300px] md:min-h-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                    {filteredProducts.map(product => (
                      <div 
                        key={product.id} 
                        onClick={() => addToCart(product)}
                        className="p-3 md:p-5 bg-white dark:bg-zinc-800 rounded-[1.25rem] md:rounded-[2rem] hover:ring-4 hover:ring-emerald-500/20 cursor-pointer transition-all group relative shadow-sm border border-zinc-100 dark:border-zinc-700/50"
                      >
                        <div className="w-full aspect-square bg-zinc-50 dark:bg-zinc-700 rounded-lg md:rounded-[1.25rem] mb-2 md:mb-4 flex items-center justify-center text-zinc-300 group-hover:scale-105 transition-all duration-500">
                          <Package className="w-6 h-6 md:w-10 md:h-10" />
                        </div>
                        <div className="font-black text-[10px] md:text-sm mb-1 md:mb-2 text-zinc-900 dark:text-white line-clamp-1 group-hover:text-emerald-600 transition-colors">{product.name}</div>
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-600 font-black text-[10px] md:text-base">{lang === 'ar' ? 'ج.م' : 'EGP'} {product.sellingPrice}</span>
                          <div className="flex flex-col items-end">
                            <span className={`text-[7px] md:text-[10px] font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg uppercase tracking-widest ${
                              product.quantity <= 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/20' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300'
                            }`}>
                              {lang === 'ar' ? 'المخزون' : 'Stock'}: {product.quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mobile Cart Toggle (Visible only on mobile) */}
                <div className="md:hidden p-4 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between sticky bottom-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.total}</span>
                    <span className="text-xl font-black text-emerald-600">{total.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => {
                      const cartSection = document.getElementById('cart-section');
                      cartSection?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {lang === 'ar' ? 'عرض السلة' : 'View Cart'} ({cart.length})
                  </button>
                </div>
              </div>

              {/* RIGHT SIDE: Live Invoice Preview */}
              <div id="cart-section" className="w-full md:w-[380px] lg:w-[420px] xl:w-[480px] bg-white dark:bg-zinc-900 p-4 md:p-8 flex flex-col border-t md:border-t-0 md:border-l border-zinc-100 dark:border-zinc-800 h-auto md:h-full overflow-visible md:overflow-hidden">
                <div className="flex items-center gap-4 mb-4 md:mb-6">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
                    <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <h4 className="text-lg md:text-2xl font-black tracking-tighter">{lang === 'ar' ? 'معاينة الفاتورة' : 'Invoice Preview'}</h4>
                </div>

                {/* Top Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.customerName}</label>
                      <select 
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 font-bold"
                      >
                        <option value="">{lang === 'ar' ? 'عميل نقدي' : 'Cash Customer'}</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'طريقة الدفع' : 'Payment Method'}</label>
                      <select 
                        value={paymentMethod}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setPaymentMethod(val);
                          if (val === 'credit') {
                            setSelectedAccountId('');
                          }
                        }}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 font-bold"
                      >
                        <option value="cash">{lang === 'ar' ? 'نقدي' : 'Cash'}</option>
                        <option value="card">{lang === 'ar' ? 'بطاقة' : 'Card'}</option>
                        <option value="bank_transfer">{lang === 'ar' ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                        <option value="credit">{lang === 'ar' ? 'آجل' : 'Credit'}</option>
                      </select>
                    </div>
                  </div>

                  {paymentMethod !== 'credit' && (
                    <div className="mb-6 space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{lang === 'ar' ? 'حساب الدفع' : 'Payment Account'}</label>
                      <select 
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-4 focus:ring-emerald-500/10 font-bold"
                      >
                        <option value="">{lang === 'ar' ? 'اختر حساب' : 'Select Account'}</option>
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                {/* Live Receipt Preview */}
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/50 rounded-[2rem] p-4 md:p-6 flex flex-col overflow-hidden border border-zinc-100 dark:border-zinc-800/50 min-h-[400px] md:min-h-0">
                  <div className="text-center mb-4 md:mb-6">
                    <h5 className="font-black text-lg md:text-xl tracking-tighter">{t.storeName}</h5>
                    <p className="text-[8px] text-zinc-400 font-black uppercase tracking-[0.3em] mt-1">POS RECEIPT</p>
                  </div>

                  <div className="flex justify-between text-[10px] font-black text-zinc-400 mb-4 border-b border-dashed border-zinc-200 dark:border-zinc-700 pb-4 uppercase tracking-widest">
                    <span>{new Date().toLocaleDateString()}</span>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 md:space-y-4 pr-2 custom-scrollbar mb-4 md:mb-6">
                    {cart.map(item => {
                      const isOverStock = item.cartQuantity > item.quantity;
                      return (
                        <div key={item.id} className={`p-3 md:p-4 rounded-2xl border transition-all ${
                          isOverStock 
                            ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30' 
                            : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'
                        }`}>
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <div className="text-xs font-black text-zinc-900 dark:text-white">{item.name}</div>
                              <div className="text-[9px] md:text-[10px] text-zinc-500 font-bold mt-1">
                                {lang === 'ar' ? 'المخزون المتاح' : 'Available Stock'}: {item.quantity}
                              </div>
                              <div className="flex items-center gap-3 mt-3 no-print">
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => updateCartQuantity(item.id!, item.cartQuantity - 1)} 
                                    className="p-2 md:p-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
                                  >
                                    <Minus className="w-4 h-4 md:w-3 md:h-3" />
                                  </button>
                                  <input 
                                    type="number"
                                    value={item.cartQuantity}
                                    onChange={(e) => updateCartQuantity(item.id!, Number(e.target.value))}
                                    className={`w-14 md:w-12 text-center bg-transparent border-none text-sm md:text-xs font-black focus:ring-0 ${isOverStock ? 'text-red-600' : ''}`}
                                  />
                                  <button 
                                    onClick={() => updateCartQuantity(item.id!, item.cartQuantity + 1)} 
                                    className="p-2 md:p-1.5 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
                                  >
                                    <PlusIcon className="w-4 h-4 md:w-3 md:h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-xs md:text-sm font-black ${isOverStock ? 'text-red-600' : 'text-emerald-600'}`}>
                                {currencySymbol} {(item.sellingPrice * item.cartQuantity).toFixed(2)}
                              </div>
                              <div className="text-[9px] text-zinc-400 font-bold mt-1">
                                {currencySymbol} {item.sellingPrice} / {lang === 'ar' ? 'وحدة' : 'unit'}
                              </div>
                            </div>
                          </div>
                          {isOverStock && (
                            <div className="mt-2 text-[9px] font-black text-red-500 uppercase tracking-widest">
                              {lang === 'ar' ? 'الكمية المطلوبة أكبر من الكمية المتاحة في المخزون' : 'Requested quantity exceeds available stock'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {cart.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-300 dark:text-zinc-700 py-10">
                        <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Cart is empty</p>
                      </div>
                    )}
                  </div>

                  {/* Totals Section */}
                  <div className="space-y-2 md:space-y-3 border-t border-dashed border-zinc-200 dark:border-zinc-700 pt-4">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-zinc-500">{t.subtotal}</span>
                      <span className="text-zinc-900 dark:text-white">{currencySymbol} {subtotal.toFixed(2)}</span>
                    </div>
                    
                    {/* Discount & Tax Inputs */}
                    <div className="grid grid-cols-2 gap-2 no-print">
                      <div className="relative group">
                        <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input 
                          type="number" 
                          value={discount}
                          onChange={(e) => setDiscount(Number(e.target.value))}
                          placeholder={t.discount}
                          className="w-full pl-8 pr-2 py-2 md:py-2.5 bg-white dark:bg-zinc-800 rounded-lg text-[10px] outline-none focus:ring-4 focus:ring-emerald-500/10 font-black shadow-sm"
                        />
                      </div>
                      <select 
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as any)}
                        className="w-full px-2 py-2 md:py-2.5 bg-white dark:bg-zinc-800 rounded-lg text-[10px] outline-none focus:ring-4 focus:ring-emerald-500/10 font-black shadow-sm"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">{currencySymbol}</option>
                      </select>
                    </div>

                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-zinc-500">{t.discount}</span>
                      <span className="text-red-500">- {currencySymbol} {discountValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-zinc-500">{t.taxValue} ({taxRate}%)</span>
                      <span className="text-zinc-900 dark:text-white">{currencySymbol} {taxValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xl md:text-2xl font-black pt-3 border-t border-zinc-200 dark:border-zinc-700 tracking-tighter">
                      <span>{t.total}</span>
                      <span className="text-emerald-600">{currencySymbol} {total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 md:mt-6 flex flex-col sm:flex-row gap-2 md:gap-3 sticky bottom-0 bg-white dark:bg-zinc-900 pt-2 pb-4 md:pb-0">
                  <div className="flex gap-2 w-full">
                    <button 
                      onClick={() => {
                        const inv: any = {
                          number: `PRE-${Date.now()}`,
                          date: new Date().toISOString(),
                          customerName: customers.find(c => c.id === selectedCustomerId)?.name || 'Cash Customer',
                          items: cart.map(item => ({
                            productId: item.id!,
                            name: item.name,
                            quantity: item.cartQuantity,
                            price: item.sellingPrice,
                            total: item.sellingPrice * item.cartQuantity
                          })),
                          subtotal,
                          discount: discountValue,
                          discountType,
                          taxRate,
                          tax: taxValue,
                          total,
                          paymentMethod,
                          type: 'sales',
                          status: 'paid',
                          userId: user?.uid || ''
                        };
                        setViewingInvoice(inv);
                        setTimeout(() => window.print(), 500);
                      }}
                      className="flex-1 py-3 md:py-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-black text-[10px] md:text-xs flex items-center justify-center gap-2 hover:bg-zinc-50 transition-all active:scale-95"
                    >
                      <Printer className="w-4 h-4 md:w-5 md:h-5" />
                      {t.printInvoice}
                    </button>
                    <button 
                      onClick={() => {
                        const inv = {
                          number: `PRE-${Date.now()}`,
                          date: new Date().toISOString(),
                          customerName: customers.find(c => c.id === selectedCustomerId)?.name || 'Cash Customer',
                          items: cart.map(item => ({
                            productId: item.id!,
                            name: item.name,
                            quantity: item.cartQuantity,
                            price: item.sellingPrice,
                            total: item.sellingPrice * item.cartQuantity
                          })),
                          subtotal,
                          discount: discountValue,
                          discountType,
                          taxRate,
                          tax: taxValue,
                          total,
                          paymentMethod,
                          type: 'sales',
                          status: 'paid',
                          userId: user?.uid || ''
                        };
                        generateInvoicePDF(inv, lang);
                      }}
                      className="flex-1 py-3 md:py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200 dark:border-emerald-800 rounded-xl font-black text-[10px] md:text-xs flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all active:scale-95"
                    >
                      <FileDown className="w-4 h-4 md:w-5 md:h-5" />
                      {lang === 'ar' ? 'تحميل PDF' : 'Download PDF'}
                    </button>
                  </div>
                  <button 
                    onClick={handleCheckout}
                    disabled={cart.length === 0}
                    className="w-full py-4 md:py-4 bg-emerald-600 text-white rounded-xl font-black text-sm md:text-xs shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <CreditCard className="w-5 h-5" />
                    {lang === 'ar' ? 'إتمام وحفظ' : 'Complete & Save'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Invoice Modal */}
      <AnimatePresence>
        {viewingInvoice && !isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 no-print">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingInvoice(null)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[3.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-12">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-3xl font-black tracking-tighter">{t.invoiceNumber}: {viewingInvoice.number}</h3>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => generateInvoicePDF(viewingInvoice, lang)}
                      className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-full hover:bg-emerald-100 transition-colors"
                      title={lang === 'ar' ? 'تحميل PDF' : 'Download PDF'}
                    >
                      <FileDown className="w-6 h-6" />
                    </button>
                    <button onClick={() => setViewingInvoice(null)} className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                      <X className="w-7 h-7" />
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-[1.5rem]">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">{t.customerName}</div>
                      <div className="font-black text-lg">{viewingInvoice.customerName}</div>
                    </div>
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-800 rounded-[1.5rem]">
                      <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-2">{t.date}</div>
                      <div className="font-black text-lg">{new Date(viewingInvoice.date).toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className="border border-zinc-100 dark:border-zinc-800 rounded-[2rem] overflow-hidden">
                    <table className="w-full text-sm responsive-table">
                      <thead className="bg-zinc-50 dark:bg-zinc-800">
                        <tr>
                          <th className="px-6 py-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.productName}</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.quantity}</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t.total}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {viewingInvoice.items.map((item, i) => (
                          <tr key={i}>
                            <td className="px-6 py-4 font-bold" data-label={t.productName}>{item.name}</td>
                            <td className="px-6 py-4 text-center font-black" data-label={t.quantity}>{item.quantity}</td>
                            <td className="px-6 py-4 text-right font-black text-emerald-600" data-label={t.total}>{currencySymbol} {item.total.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 pt-6">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-zinc-500">{t.subtotal}</span>
                      <span className="text-zinc-900 dark:text-white">{currencySymbol} {viewingInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-zinc-500">{t.discount}</span>
                      <span className="text-red-500">- {currencySymbol} {viewingInvoice.discount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-zinc-500">{t.taxValue}</span>
                      <span className="text-zinc-900 dark:text-white">{currencySymbol} {viewingInvoice.tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-4xl font-black pt-6 border-t border-zinc-100 dark:border-zinc-800 tracking-tighter">
                      <span>{t.total}</span>
                      <span className="text-emerald-600">{currencySymbol} {viewingInvoice.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex gap-6 pt-10">
                    <button 
                      onClick={() => exportToPDF(viewingInvoice)}
                      className="flex-1 py-5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all active:scale-95"
                    >
                      <Download className="w-6 h-6" />
                      PDF
                    </button>
                    <button 
                      onClick={() => window.print()}
                      className="flex-1 py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-emerald-700 shadow-2xl shadow-emerald-600/20 transition-all active:scale-95"
                    >
                      <Printer className="w-6 h-6" />
                      {t.printInvoice}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
