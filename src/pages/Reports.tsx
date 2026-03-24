import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  FileText,
  Filter,
  Users
} from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { Product, Invoice, Account, Customer } from '../types';
import { translations } from '../translations';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { fixArabic, initArabicPdf } from '../utils/pdfUtils';
import { Eye, X } from 'lucide-react';
import { getCurrencySymbol } from '../utils/currency';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function Reports({ lang, profile }: Props) {
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [viewingReport, setViewingReport] = useState<{ title: string; headers: string[]; data: any[][] } | null>(null);

  useEffect(() => {
    const unsubscribeInvoices = onSnapshot(collection(db, 'invoices'), (snapshot) => {
      setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
    });
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    });
    const unsubscribeAccounts = onSnapshot(collection(db, 'accounts'), (snapshot) => {
      setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
    });
    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });
    return () => {
      unsubscribeInvoices();
      unsubscribeProducts();
      unsubscribeAccounts();
      unsubscribeCustomers();
    };
  }, []);

  const filteredInvoices = invoices.filter(inv => {
    if (!dateRange.start || !dateRange.end) return true;
    return inv.date >= dateRange.start && inv.date <= dateRange.end;
  });

  const totalSales = filteredInvoices.filter(inv => inv.type === 'sales').reduce((sum, inv) => sum + inv.total, 0);
  const totalPurchases = filteredInvoices.filter(inv => inv.type === 'purchase').reduce((sum, inv) => sum + inv.total, 0);
  
  const totalProfit = filteredInvoices.filter(inv => inv.type === 'sales').reduce((sum, inv) => {
    const cost = inv.items.reduce((acc, item) => {
      const product = products.find(p => p.id === item.productId);
      return acc + (product ? product.purchasePrice * item.quantity : 0);
    }, 0);
    return sum + (inv.total - cost);
  }, 0);

  const assets = accounts.filter(a => a.type === 'Asset');
  const liabilities = accounts.filter(a => a.type === 'Liability');
  const equity = accounts.filter(a => a.type === 'Equity');
  const revenue = accounts.filter(a => a.type === 'Revenue');
  const expenses = accounts.filter(a => a.type === 'Expense');

  const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
  const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);
  const totalRevenue = revenue.reduce((sum, a) => sum + a.balance, 0);
  const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
  const netIncome = totalRevenue - totalExpenses;

  const exportBalanceSheetPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(245, 158, 11); // Amber-500
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(t.balanceSheet), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = [
      ...assets.map(a => [fixArabic(a.name), fixArabic(t.assets), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      ...liabilities.map(a => [fixArabic(a.name), fixArabic(t.liabilities), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      ...equity.map(a => [fixArabic(a.name), fixArabic(t.equity), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      [fixArabic(isAr ? 'إجمالي الأصول' : 'Total Assets'), '', `${currencySymbol} ${totalAssets.toLocaleString()}`],
      [fixArabic(isAr ? 'إجمالي الخصوم وحقوق الملكية' : 'Total Liabilities & Equity'), '', `${currencySymbol} ${(totalLiabilities + totalEquity).toLocaleString()}`],
    ];

    const headers = [isAr ? 'الحساب' : 'Account', isAr ? 'النوع' : 'Type', t.total];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`balance-sheet-${new Date().toISOString()}.pdf`);
  };

  const exportProfitLossPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(225, 29, 72); // Rose-600
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(t.profitLoss), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = [
      ...revenue.map(a => [fixArabic(a.name), fixArabic(t.revenue), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      ...expenses.map(a => [fixArabic(a.name), fixArabic(t.expensesCat), `${currencySymbol} ${a.balance.toLocaleString()}`]),
      ['', '', ''],
      [fixArabic(isAr ? 'صافي الدخل' : 'Net Income'), '', `${currencySymbol} ${netIncome.toLocaleString()}`],
    ];

    const headers = [isAr ? 'الحساب' : 'Account', isAr ? 'النوع' : 'Type', t.total];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`profit-loss-${new Date().toISOString()}.pdf`);
  };

  const exportSalesReportPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(16, 185, 129); // Emerald-600
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(lang === 'ar' ? 'تقرير المبيعات' : 'Sales Report'), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = filteredInvoices.map(inv => [
      inv.number,
      inv.date,
      fixArabic(inv.customerName),
      `${currencySymbol} ${inv.total.toLocaleString()}`
    ]);

    const headers = [t.invoiceNumber, t.date, t.customerName, t.total];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`sales-report-${new Date().toISOString()}.pdf`);
  };

  const exportInventoryReportPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(lang === 'ar' ? 'تقرير المخزون' : 'Inventory Report'), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = products.map(p => [
      fixArabic(p.name),
      p.sku,
      p.quantity,
      `${currencySymbol} ${p.purchasePrice.toLocaleString()}`,
      `${currencySymbol} ${(p.purchasePrice * p.quantity).toLocaleString()}`
    ]);

    const headers = [t.productName, 'SKU', t.quantity, t.purchasePrice, t.inventoryValue];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`inventory-report-${new Date().toISOString()}.pdf`);
  };

  const exportCustomerBalancesPDF = async () => {
    const doc = await initArabicPdf();
    const isAr = lang === 'ar';
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    
    // Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    // Logo Placeholder
    doc.setFillColor(244, 63, 94); // Rose-500
    doc.roundedRect(margin, 15, 20, 20, 4, 4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(14);
    doc.text('M', margin + 10, 29, { align: 'center' });

    doc.setTextColor(30, 41, 59);
    doc.setFont('Cairo', 'bold');
    doc.setFontSize(20);
    doc.text(fixArabic(t.brand), isAr ? pageWidth - margin : margin + 25, 28, { align: isAr ? 'right' : 'left' });
    
    doc.setFontSize(12);
    doc.text(fixArabic(lang === 'ar' ? 'تقرير أرصدة العملاء المستحقة' : 'Customer Outstanding Balances Report'), isAr ? pageWidth - margin : margin + 25, 38, { align: isAr ? 'right' : 'left' });
    
    const tableData = customers.filter(c => (c.balance ?? 0) > 0).map(c => [
      fixArabic(c.name),
      c.phone || '-',
      `${currencySymbol} ${(c.totalPurchases ?? 0).toLocaleString()}`,
      `${currencySymbol} ${(c.totalPaid ?? 0).toLocaleString()}`,
      `${currencySymbol} ${(c.balance ?? 0).toLocaleString()}`
    ]);

    const headers = [
      lang === 'ar' ? 'اسم العميل' : 'Customer Name',
      lang === 'ar' ? 'الهاتف' : 'Phone',
      lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases',
      lang === 'ar' ? 'إجمالي المدفوع' : 'Total Paid',
      lang === 'ar' ? 'الرصيد المستحق' : 'Outstanding Balance'
    ];
    const processedHeaders = isAr ? headers.map(h => fixArabic(h)).reverse() : headers;
    const processedBody = isAr 
      ? tableData.map(row => row.map(cell => fixArabic(cell)).reverse())
      : tableData;

    autoTable(doc, {
      head: [processedHeaders],
      body: processedBody,
      startY: 60,
      styles: { font: 'Cairo', fontSize: 10, halign: isAr ? 'right' : 'left', cellPadding: 5 },
      headStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255], fontStyle: 'bold', halign: isAr ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    doc.save(`customer-balances-${new Date().toISOString()}.pdf`);
  };

  const exportToExcel = (title: string, headers: string[], data: any[][]) => {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${title}-${new Date().toISOString()}.xlsx`);
  };

  const viewReport = (title: string, headers: string[], data: any[][]) => {
    setViewingReport({ title, headers, data });
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{t.reportsSystem}</h2>
            <p className="text-sm text-zinc-500">Generate and export detailed business reports</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-zinc-400" />
          <input 
            type="date" 
            value={dateRange.start}
            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2 text-sm outline-none"
          />
          <span className="text-zinc-400">to</span>
          <input 
            type="date" 
            value={dateRange.end}
            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2 text-sm outline-none"
          />
        </div>
        <button className="px-6 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-all">
          <Filter className="w-4 h-4" />
          {lang === 'ar' ? 'تصفية' : 'Filter'}
        </button>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Sales Report Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'تقرير المبيعات' : 'Sales Report'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي المبيعات' : 'Total Sales'}</span>
              <span className="font-bold">{currencySymbol} {totalSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'عدد الفواتير' : 'Invoice Count'}</span>
              <span className="font-bold">{filteredInvoices.length}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                const title = lang === 'ar' ? 'تقرير المبيعات' : 'Sales Report';
                const headers = [t.invoiceNumber, t.date, t.customerName, t.total];
                const data = filteredInvoices.map(inv => [
                  inv.number,
                  inv.date,
                  inv.customerName,
                  `${currencySymbol} ${inv.total.toLocaleString()}`
                ]);
                viewReport(title, headers, data);
              }}
              className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
            >
              <Eye className="w-4 h-4" />
              {lang === 'ar' ? 'عرض' : 'View'}
            </button>
            <button 
              onClick={exportSalesReportPDF}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* Inventory Report Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'تقرير المخزون' : 'Inventory Report'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي المنتجات' : 'Total Products'}</span>
              <span className="font-bold">{products.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'قيمة المخزون' : 'Inventory Value'}</span>
              <span className="font-bold">{currencySymbol} {products.reduce((sum, p) => sum + (p.purchasePrice * p.quantity), 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                const title = lang === 'ar' ? 'تقرير المخزون' : 'Inventory Report';
                const headers = [t.productName, 'SKU', t.quantity, t.purchasePrice, t.inventoryValue];
                const data = products.map(p => [
                  p.name,
                  p.sku,
                  p.quantity,
                  `${currencySymbol} ${p.purchasePrice.toLocaleString()}`,
                  `${currencySymbol} ${(p.purchasePrice * p.quantity).toLocaleString()}`
                ]);
                viewReport(title, headers, data);
              }}
              className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
            >
              <Eye className="w-4 h-4" />
              {lang === 'ar' ? 'عرض' : 'View'}
            </button>
            <button 
              onClick={exportInventoryReportPDF}
              className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* Profit Report Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-violet-100 text-violet-600 rounded-2xl">
              <TrendingDown className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'تقرير الأرباح' : 'Profit Report'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي الربح' : 'Total Profit'}</span>
              <span className="font-bold text-emerald-600">{currencySymbol} {totalProfit.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'هامش الربح' : 'Profit Margin'}</span>
              <span className="font-bold">{totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(1) : 0}%</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                const title = lang === 'ar' ? 'تقرير الأرباح' : 'Profit Report';
                const headers = [t.invoiceNumber, t.date, lang === 'ar' ? 'التكلفة' : 'Cost', t.total, lang === 'ar' ? 'الربح' : 'Profit'];
                const data = filteredInvoices.filter(inv => inv.type === 'sales').map(inv => {
                  const cost = inv.items.reduce((acc, item) => {
                    const product = products.find(p => p.id === item.productId);
                    return acc + (product ? product.purchasePrice * item.quantity : 0);
                  }, 0);
                  return [
                    inv.number,
                    inv.date,
                    `${currencySymbol} ${cost.toLocaleString()}`,
                    `${currencySymbol} ${inv.total.toLocaleString()}`,
                    `${currencySymbol} ${(inv.total - cost).toLocaleString()}`
                  ];
                });
                viewReport(title, headers, data);
              }}
              className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
            >
              <Eye className="w-4 h-4" />
              {lang === 'ar' ? 'عرض' : 'View'}
            </button>
            <button className="flex-1 py-3 bg-violet-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-700 transition-all">
              <Download className="w-4 h-4" />
              {lang === 'ar' ? 'تصدير' : 'Export'}
            </button>
          </div>
        </div>

        {/* Balance Sheet Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{t.balanceSheet}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.assets}</span>
              <span className="font-bold">{currencySymbol} {totalAssets.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.liabilities}</span>
              <span className="font-bold">{currencySymbol} {totalLiabilities.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                const title = t.balanceSheet;
                const headers = [lang === 'ar' ? 'الحساب' : 'Account', lang === 'ar' ? 'النوع' : 'Type', t.total];
                const data = [
                  ...assets.map(a => [a.name, t.assets, `${currencySymbol} ${a.balance.toLocaleString()}`]),
                  ...liabilities.map(a => [a.name, t.liabilities, `${currencySymbol} ${a.balance.toLocaleString()}`]),
                  ...equity.map(a => [a.name, t.equity, `${currencySymbol} ${a.balance.toLocaleString()}`])
                ];
                viewReport(title, headers, data);
              }}
              className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
            >
              <Eye className="w-4 h-4" />
              {lang === 'ar' ? 'عرض' : 'View'}
            </button>
            <button 
              onClick={exportBalanceSheetPDF}
              className="flex-1 py-3 bg-amber-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-700 transition-all"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* P&L Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{t.profitLoss}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.revenue}</span>
              <span className="font-bold">{currencySymbol} {totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.expensesCat}</span>
              <span className="font-bold">{currencySymbol} {totalExpenses.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                const title = t.profitLoss;
                const headers = [lang === 'ar' ? 'الحساب' : 'Account', lang === 'ar' ? 'النوع' : 'Type', t.total];
                const data = [
                  ...revenue.map(a => [a.name, t.revenue, `${currencySymbol} ${a.balance.toLocaleString()}`]),
                  ...expenses.map(a => [a.name, t.expensesCat, `${currencySymbol} ${a.balance.toLocaleString()}`])
                ];
                viewReport(title, headers, data);
              }}
              className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
            >
              <Eye className="w-4 h-4" />
              {lang === 'ar' ? 'عرض' : 'View'}
            </button>
            <button 
              onClick={exportProfitLossPDF}
              className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-700 transition-all"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* Customer Balances Card */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold">{lang === 'ar' ? 'أرصدة العملاء' : 'Customer Balances'}</h3>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'إجمالي المستحق' : 'Total Outstanding'}</span>
              <span className="font-bold text-red-600">{currencySymbol} {customers.reduce((sum, c) => sum + (c.balance || 0), 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{lang === 'ar' ? 'عملاء مدينون' : 'Debtor Customers'}</span>
              <span className="font-bold">{customers.filter(c => c.balance > 0).length}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                const title = lang === 'ar' ? 'أرصدة العملاء المستحقة' : 'Customer Outstanding Balances';
                const headers = [
                  lang === 'ar' ? 'اسم العميل' : 'Customer Name',
                  lang === 'ar' ? 'الهاتف' : 'Phone',
                  lang === 'ar' ? 'إجمالي المشتريات' : 'Total Purchases',
                  lang === 'ar' ? 'إجمالي المدفوع' : 'Total Paid',
                  lang === 'ar' ? 'الرصيد المستحق' : 'Outstanding Balance'
                ];
                const data = customers.filter(c => (c.balance ?? 0) > 0).map(c => [
                  c.name,
                  c.phone || '-',
                  `${currencySymbol} ${(c.totalPurchases ?? 0).toLocaleString()}`,
                  `${currencySymbol} ${(c.totalPaid ?? 0).toLocaleString()}`,
                  `${currencySymbol} ${(c.balance ?? 0).toLocaleString()}`
                ]);
                viewReport(title, headers, data);
              }}
              className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all"
            >
              <Eye className="w-4 h-4" />
              {lang === 'ar' ? 'عرض' : 'View'}
            </button>
            <button 
              onClick={exportCustomerBalancesPDF}
              className="flex-1 py-3 bg-rose-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-700 transition-all"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Report Viewer Modal */}
      {viewingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">{viewingReport.title}</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  {lang === 'ar' ? 'تاريخ التقرير:' : 'Report Date:'} {new Date().toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => exportToExcel(viewingReport.title, viewingReport.headers, viewingReport.data)}
                  className="px-6 py-3 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm hover:bg-emerald-100 transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Excel
                </button>
                <button 
                  onClick={() => setViewingReport(null)}
                  className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl hover:bg-zinc-200 transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-8">
              <table className="w-full text-sm text-left rtl:text-right border-collapse">
                <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 z-10">
                  <tr>
                    {viewingReport.headers.map((header, i) => (
                      <th key={i} className="px-6 py-4 font-black text-zinc-400 uppercase tracking-widest text-[10px] border-b border-zinc-100 dark:border-zinc-700">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {viewingReport.data.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      {row.map((cell, j) => (
                        <td key={j} className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
