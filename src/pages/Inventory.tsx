import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Mic, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Package,
  ScanBarcode,
  X,
  AlertTriangle,
  Download,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { auth, db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  writeBatch,
  getDocs,
  where
} from 'firebase/firestore';
import { Product } from '../types';
import { translations } from '../translations';
import { parseVoiceCommand } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { getCurrencySymbol } from '../utils/currency';

import Pagination from '../components/Pagination';
import { Filter, RotateCcw } from 'lucide-react';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function Inventory({ lang, profile }: Props) {
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [importStats, setImportStats] = useState({ success: 0, failed: 0, errors: [] as string[] });
  const [isImporting, setIsImporting] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    purchasePrice: 0,
    sellingPrice: 0,
    wholesalePrice: 0,
    vipPrice: 0,
    quantity: 0,
    minStock: 5,
    category: '',
    description: ''
  });

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(docs);
    });
    return () => unsubscribe();
  }, []);

  const handleVoiceEntry = async () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      const parsed = await parseVoiceCommand(transcript);
      if (parsed && parsed.name) {
        await addDoc(collection(db, 'products'), {
          name: parsed.name,
          purchasePrice: parsed.price || 0,
          sellingPrice: (parsed.price || 0) * 1.2,
          quantity: parsed.quantity || 0,
          sku: `VOICE-${Date.now()}`,
          minStock: 5,
          createdAt: new Date().toISOString()
        });
      }
    };

    recognition.start();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      const productData = {
        name: formData.name,
        sku: formData.sku,
        barcode: formData.barcode,
        purchasePrice: formData.purchasePrice,
        sellingPrice: formData.sellingPrice,
        wholesalePrice: formData.wholesalePrice,
        vipPrice: formData.vipPrice,
        quantity: formData.quantity,
        minStock: formData.minStock,
        categoryId: formData.category,
        description: formData.description,
        userId: auth.currentUser.uid
      };

      if (editingProduct?.id) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        toast.success(lang === 'ar' ? 'تم تحديث المنتج بنجاح' : 'Product updated successfully');
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString()
        });
        toast.success(lang === 'ar' ? 'تم إضافة المنتج بنجاح' : 'Product added successfully');
      }
      closeModal();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error(lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving product');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا المنتج؟' : 'Are you sure you want to delete this product?')) {
      await deleteDoc(doc(db, 'products', id));
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        wholesalePrice: product.wholesalePrice || 0,
        vipPrice: product.vipPrice || 0,
        quantity: product.quantity,
        minStock: product.minStock,
        category: product.categoryId || '',
        description: product.description || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: `SKU-${Date.now()}`,
        barcode: '',
        purchasePrice: 0,
        sellingPrice: 0,
        wholesalePrice: 0,
        vipPrice: 0,
        quantity: 0,
        minStock: 5,
        category: '',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
    const matchesLowStock = !lowStockOnly || p.quantity <= p.minStock;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const categories = Array.from(new Set(products.map(p => p.categoryId))).filter(Boolean);

  const handleExportExcel = () => {
    try {
      const exportData = products.map(p => ({
        [lang === 'ar' ? 'اسم المنتج' : 'Product Name']: p.name,
        'SKU': p.sku,
        [lang === 'ar' ? 'الباركود' : 'Barcode']: p.barcode || '',
        [lang === 'ar' ? 'الفئة' : 'Category']: p.categoryId || '',
        [lang === 'ar' ? 'سعر الشراء' : 'Cost Price']: p.purchasePrice,
        [lang === 'ar' ? 'سعر البيع' : 'Selling Price']: p.sellingPrice,
        [lang === 'ar' ? 'الكمية' : 'Stock']: p.quantity,
        [lang === 'ar' ? 'تاريخ الإضافة' : 'Created Date']: (p as any).createdAt ? new Date((p as any).createdAt).toLocaleDateString() : '-'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products");
      XLSX.writeFile(wb, `makhzanak-products-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(lang === 'ar' ? 'تم تصدير البيانات بنجاح' : 'Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(lang === 'ar' ? 'فشل تصدير البيانات' : 'Failed to export data');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Product Name': 'Example Product',
        'SKU': 'SKU-001',
        'Barcode': '123456789',
        'Category': 'Electronics',
        'Cost Price': 100,
        'Selling Price': 150,
        'Stock Quantity': 50,
        'Description': 'Optional description here'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "makhzanak-import-template.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          toast.error(lang === 'ar' ? 'الملف فارغ' : 'File is empty');
          return;
        }

        setImportData(data);
        setIsImportModalOpen(true);
        setImportStats({ success: 0, failed: 0, errors: [] });
      } catch (error) {
        console.error('Import error:', error);
        toast.error(lang === 'ar' ? 'فشل قراءة الملف' : 'Failed to read file');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const confirmImport = async () => {
    setIsImporting(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // Process in batches of 500 (Firestore limit is 500 per batch)
      const batchSize = 400; 
      for (let i = 0; i < importData.length; i += batchSize) {
        const chunk = importData.slice(i, i + batchSize);
        const batch = writeBatch(db);
        
        for (const row of chunk) {
          const name = row['Product Name'] || row['اسم المنتج'];
          const sku = row['SKU'] || row['رمز المنتج'];
          const sellingPrice = Number(row['Selling Price'] || row['سعر البيع']);

          // Validation
          if (!name || isNaN(sellingPrice)) {
            failed++;
            errors.push(`${lang === 'ar' ? 'صف' : 'Row'} ${i + chunk.indexOf(row) + 1}: ${lang === 'ar' ? 'الاسم أو السعر مفقود' : 'Name or Price missing'}`);
            continue;
          }

          const productData = {
            name,
            sku: sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            barcode: row['Barcode'] || row['الباركود'] || '',
            categoryId: row['Category'] || row['الفئة'] || 'General',
            purchasePrice: Number(row['Cost Price'] || row['سعر الشراء'] || 0),
            sellingPrice: sellingPrice,
            quantity: Number(row['Stock Quantity'] || row['الكمية'] || 0),
            description: row['Description'] || row['الوصف'] || '',
            minStock: 5,
            updatedAt: new Date().toISOString()
          };

          // Duplicate Handling
          if (sku) {
            const q = query(collection(db, 'products'), where('sku', '==', sku));
            const existing = await getDocs(q);
            
            if (!existing.empty) {
              if (duplicateStrategy === 'skip') {
                failed++;
                errors.push(`${lang === 'ar' ? 'تخطي' : 'Skip'} SKU: ${sku}`);
                continue;
              } else {
                // Update existing
                const docId = existing.docs[0].id;
                batch.update(doc(db, 'products', docId), productData);
                success++;
                continue;
              }
            }
          }

          // Create new
          const newDocRef = doc(collection(db, 'products'));
          batch.set(newDocRef, { ...productData, createdAt: new Date().toISOString() });
          success++;
        }
        
        await batch.commit();
      }

      setImportStats({ success, failed, errors });
      toast.success(lang === 'ar' ? `تم استيراد ${success} منتج` : `Imported ${success} products`);
      if (failed > 0) {
        toast.error(lang === 'ar' ? `فشل استيراد ${failed} منتج` : `Failed to import ${failed} products`);
      }
      
      // Keep modal open to show results, but clear data
      setImportData([]);
    } catch (error) {
      console.error('Import processing error:', error);
      toast.error(lang === 'ar' ? 'حدث خطأ أثناء الاستيراد' : 'Error during import');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-[450px] group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                type="text" 
                placeholder={t.searchProduct}
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
              onClick={handleVoiceEntry}
              className={`p-4.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 transition-all shadow-sm ${isListening ? 'bg-red-500 text-white animate-pulse border-red-500' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50'}`}
            >
              <Mic className="w-6 h-6" />
            </button>
            <button className="p-4.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl hover:bg-zinc-50 transition-all shadow-sm">
              <ScanBarcode className="w-6 h-6" />
            </button>
            <button 
              onClick={() => openModal()}
              className="flex-1 md:flex-none px-10 py-4.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-2xl shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Plus className="w-6 h-6" />
              {lang === 'ar' ? 'إضافة منتج' : 'Add Product'}
            </button>
          </div>
        </div>

        {/* Excel Actions */}
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all"
          >
            <Download className="w-4 h-4 text-blue-500" />
            {lang === 'ar' ? 'تصدير إكسل' : 'Export Excel'}
          </button>
          <label className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-500" />
            {lang === 'ar' ? 'استيراد إكسل' : 'Import Excel'}
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
          </label>
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold hover:bg-zinc-50 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-500" />
            {lang === 'ar' ? 'تحميل القالب' : 'Download Template'}
          </button>
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
              <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] grid grid-cols-1 md:grid-cols-3 gap-6 shadow-sm">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">{t.category}</label>
                  <select 
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-5 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm outline-none focus:ring-2 ring-emerald-500/20 font-bold"
                  >
                    <option value="all">{t.all}</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setLowStockOnly(!lowStockOnly);
                      setCurrentPage(1);
                    }}
                    className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all border ${
                      lowStockOnly 
                        ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800' 
                        : 'bg-zinc-50 dark:bg-zinc-800 border-transparent text-zinc-500'
                    }`}
                  >
                    {t.lowStockOnly}
                  </button>
                  <button 
                    onClick={() => {
                      setCategoryFilter('all');
                      setLowStockOnly(false);
                      setCurrentPage(1);
                    }}
                    className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl hover:bg-zinc-200 transition-all"
                    title={t.reset}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left responsive-table">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'الباركود' : 'SKU/Barcode'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{lang === 'ar' ? 'الكمية' : 'Stock'}</th>
                <th className="px-10 py-6 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {paginatedProducts.map((product) => (
                <tr key={product.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'المنتج' : 'Product'}>
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-[1.25rem] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all duration-500">
                        <Package className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="font-black text-zinc-900 dark:text-white group-hover:text-emerald-600 transition-colors">{product.name}</div>
                        <div className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-1">{product.categoryId || 'General'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'الباركود' : 'SKU/Barcode'}>
                    <div className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">{product.sku}</div>
                    <div className="text-xs text-zinc-500 font-medium mt-1">{product.barcode || 'No Barcode'}</div>
                  </td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'السعر' : 'Price'}>
                    <div className="text-sm font-black text-emerald-600">{currencySymbol} {product.sellingPrice.toLocaleString()}</div>
                    <div className="text-xs text-zinc-400 font-bold mt-1">{lang === 'ar' ? 'التكلفة' : 'Cost'}: {currencySymbol} {product.purchasePrice.toLocaleString()}</div>
                  </td>
                  <td className="px-10 py-8" data-label={lang === 'ar' ? 'الكمية' : 'Stock'}>
                    <div className="flex items-center gap-3">
                      <div className={`text-sm font-black ${product.quantity <= product.minStock ? 'text-red-500' : 'text-zinc-900 dark:text-white'}`}>
                        {product.quantity}
                      </div>
                      {product.quantity <= product.minStock && (
                        <div className="px-2 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 text-[10px] font-black rounded-lg uppercase tracking-widest">Low</div>
                      )}
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <button 
                        onClick={() => openModal(product)}
                        className="p-3 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => product.id && handleDelete(product.id)}
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
          totalRecords={filteredProducts.length}
          pageSize={pageSize}
          lang={lang}
        />
      </div>

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isImporting && setIsImportModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-5xl bg-white dark:bg-zinc-900 rounded-[3.5rem] shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-10 max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-3xl font-black tracking-tighter">
                    {lang === 'ar' ? 'استيراد المنتجات' : 'Import Products'}
                  </h3>
                  <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {importData.length > 0 ? (
                  <>
                    <div className="mb-6 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 p-6 rounded-3xl">
                      <div className="flex items-center gap-6">
                        <div className="text-sm font-bold text-zinc-500">
                          {lang === 'ar' ? 'استراتيجية التكرار:' : 'Duplicate Strategy:'}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setDuplicateStrategy('skip')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${duplicateStrategy === 'skip' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-500'}`}
                          >
                            {lang === 'ar' ? 'تخطي المكرر' : 'Skip Duplicates'}
                          </button>
                          <button 
                            onClick={() => setDuplicateStrategy('update')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${duplicateStrategy === 'update' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-500'}`}
                          >
                            {lang === 'ar' ? 'تحديث المكرر' : 'Update Duplicates'}
                          </button>
                        </div>
                      </div>
                      <div className="text-sm font-black text-emerald-600">
                        {importData.length} {lang === 'ar' ? 'منتج جاهز للاستيراد' : 'Products ready to import'}
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto rounded-2xl border border-zinc-100 dark:border-zinc-800 mb-8">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 font-black text-zinc-400 uppercase text-[10px]">{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                            <th className="px-4 py-3 font-black text-zinc-400 uppercase text-[10px]">SKU</th>
                            <th className="px-4 py-3 font-black text-zinc-400 uppercase text-[10px]">{lang === 'ar' ? 'السعر' : 'Price'}</th>
                            <th className="px-4 py-3 font-black text-zinc-400 uppercase text-[10px]">{lang === 'ar' ? 'الكمية' : 'Stock'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                          {importData.slice(0, 50).map((row, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-3 font-bold">{row['Product Name'] || row['اسم المنتج'] || '-'}</td>
                              <td className="px-4 py-3 text-zinc-500">{row['SKU'] || row['رمز المنتج'] || '-'}</td>
                              <td className="px-4 py-3 font-black text-emerald-600">{row['Selling Price'] || row['سعر البيع'] || 0}</td>
                              <td className="px-4 py-3">{row['Stock Quantity'] || row['الكمية'] || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importData.length > 50 && (
                        <div className="p-4 text-center text-xs text-zinc-400 font-bold">
                          {lang === 'ar' ? `و ${importData.length - 50} منتج آخر...` : `And ${importData.length - 50} more products...`}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={() => setIsImportModalOpen(false)}
                        disabled={isImporting}
                        className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-black hover:bg-zinc-200 transition-all"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button 
                        onClick={confirmImport}
                        disabled={isImporting}
                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                      >
                        {isImporting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {lang === 'ar' ? 'جاري الاستيراد...' : 'Importing...'}
                          </>
                        ) : (
                          lang === 'ar' ? 'تأكيد الاستيراد' : 'Confirm Import'
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-8">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-8 rounded-3xl text-center">
                      <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                        <Package className="w-8 h-8" />
                      </div>
                      <h4 className="text-xl font-black text-emerald-900 dark:text-emerald-100 mb-2">
                        {lang === 'ar' ? 'اكتمل الاستيراد' : 'Import Completed'}
                      </h4>
                      <div className="flex justify-center gap-8 mt-6">
                        <div className="text-center">
                          <div className="text-2xl font-black text-emerald-600">{importStats.success}</div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase">{lang === 'ar' ? 'ناجح' : 'Success'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-black text-red-500">{importStats.failed}</div>
                          <div className="text-[10px] font-bold text-zinc-400 uppercase">{lang === 'ar' ? 'فشل' : 'Failed'}</div>
                        </div>
                      </div>
                    </div>

                    {importStats.errors.length > 0 && (
                      <div className="max-h-[200px] overflow-auto p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/20">
                        <div className="text-xs font-black text-red-600 uppercase mb-2">{lang === 'ar' ? 'الأخطاء:' : 'Errors:'}</div>
                        <ul className="space-y-1">
                          {importStats.errors.map((err, i) => (
                            <li key={i} className="text-xs text-red-500 font-medium">• {err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button 
                      onClick={() => setIsImportModalOpen(false)}
                      className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black hover:opacity-90 transition-all"
                    >
                      {lang === 'ar' ? 'إغلاق' : 'Close'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl max-h-[90vh] min-h-[70vh] bg-white dark:bg-zinc-900 rounded-[3.5rem] shadow-2xl flex flex-col border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-12 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-12 sticky top-0 bg-white dark:bg-zinc-900 z-10 py-2">
                  <h3 className="text-4xl font-black tracking-tighter">
                    {editingProduct ? (lang === 'ar' ? 'تعديل منتج' : 'Edit Product') : (lang === 'ar' ? 'إضافة منتج جديد' : 'Add New Product')}
                  </h3>
                  <button onClick={closeModal} className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                    <X className="w-7 h-7" />
                  </button>
                </div>

                <form className="space-y-8 pb-12" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">{lang === 'ar' ? 'اسم المنتج' : 'Product Name'}</label>
                      <input 
                        type="text" 
                        required 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none font-black text-lg" 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">{lang === 'ar' ? 'SKU / رمز المنتج' : 'SKU'}</label>
                      <input 
                        type="text" 
                        required 
                        value={formData.sku}
                        onChange={(e) => setFormData({...formData, sku: e.target.value})}
                        className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none font-black text-lg" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">{lang === 'ar' ? 'سعر الشراء' : 'Purchase Price'}</label>
                      <input 
                        type="number" 
                        required 
                        value={formData.purchasePrice}
                        onChange={(e) => setFormData({...formData, purchasePrice: Number(e.target.value)})}
                        className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none font-black text-lg" 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">{lang === 'ar' ? 'سعر البيع (قطاعي)' : 'Retail Price'}</label>
                      <input 
                        type="number" 
                        required 
                        value={formData.sellingPrice}
                        onChange={(e) => setFormData({...formData, sellingPrice: Number(e.target.value)})}
                        className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none font-black text-lg" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">{lang === 'ar' ? 'سعر الجملة' : 'Wholesale Price'}</label>
                      <input 
                        type="number" 
                        required 
                        value={formData.wholesalePrice}
                        onChange={(e) => setFormData({...formData, wholesalePrice: Number(e.target.value)})}
                        className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none font-black text-lg" 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">{lang === 'ar' ? 'سعر VIP' : 'VIP Price'}</label>
                      <input 
                        type="number" 
                        required 
                        value={formData.vipPrice}
                        onChange={(e) => setFormData({...formData, vipPrice: Number(e.target.value)})}
                        className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none font-black text-lg" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">{lang === 'ar' ? 'الكمية الحالية' : 'Current Quantity'}</label>
                      <input 
                        type="number" 
                        required 
                        value={formData.quantity}
                        onChange={(e) => setFormData({...formData, quantity: Number(e.target.value)})}
                        className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none font-black text-lg" 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">{lang === 'ar' ? 'تنبيه نقص المخزون' : 'Min Stock Alert'}</label>
                      <input 
                        type="number" 
                        required 
                        value={formData.minStock}
                        onChange={(e) => setFormData({...formData, minStock: Number(e.target.value)})}
                        className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none font-black text-lg" 
                      />
                    </div>
                  </div>

                    <div className="space-y-3 col-span-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">{lang === 'ar' ? 'الوصف' : 'Description'}</label>
                      <textarea 
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-6 py-5 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] focus:ring-4 focus:ring-emerald-500/10 outline-none font-bold text-lg min-h-[120px]" 
                      />
                    </div>

                    <div className="flex gap-6 pt-10 col-span-2 sticky bottom-0 bg-white dark:bg-zinc-900 py-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button 
                      type="button" 
                      onClick={closeModal} 
                      className="flex-1 px-10 py-6 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-[1.5rem] font-black text-lg hover:bg-zinc-200 transition-all active:scale-95"
                    >
                      {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 px-10 py-6 bg-emerald-600 text-white rounded-[1.5rem] font-black text-lg hover:bg-emerald-700 shadow-2xl shadow-emerald-600/20 transition-all active:scale-95"
                    >
                      {lang === 'ar' ? 'حفظ المنتج' : 'Save Product'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
