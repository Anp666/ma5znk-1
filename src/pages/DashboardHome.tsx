import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShoppingCart, 
  Users, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  FileText,
  Plus,
  PieChart,
  Wallet,
  AlertTriangle,
  CreditCard,
  RotateCcw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { auth, db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Product, Invoice } from '../types';
import { translations } from '../translations';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestore-errors';
import { getCurrencySymbol } from '../utils/currency';

interface Props {
  lang: 'ar' | 'en';
  profile: any;
  setActiveTab: (tab: string) => void;
}

export default function DashboardHome({ lang, profile, setActiveTab }: Props) {
  const t = translations[lang];
  const currencySymbol = getCurrencySymbol(profile?.currency, lang);
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProducts: 0,
    totalInvoices: 0,
    inventoryValue: 0,
    lowStockCount: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch Products for stats
    const unsubscribeProducts = onSnapshot(
      collection(db, 'products'), 
      (snapshot) => {
        const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        const totalProducts = products.length;
        const inventoryValue = products.reduce((sum, p) => sum + (p.purchasePrice * p.quantity), 0);
        const lowStock = products.filter(p => p.quantity <= p.minStock);
        
        setStats(prev => ({ ...prev, totalProducts, inventoryValue, lowStockCount: lowStock.length }));
        setLowStockProducts(lowStock.slice(0, 5));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );

    // Fetch Invoices for stats and charts
    const unsubscribeInvoices = onSnapshot(
      collection(db, 'invoices'), 
      (snapshot) => {
        const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
        const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
        const totalInvoices = invoices.length;
        
        setStats(prev => ({ ...prev, totalSales, totalInvoices }));

        // Prepare chart data (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - i);
          return d.toISOString().split('T')[0];
        }).reverse();

        const dailyData = last7Days.map(date => {
          const daySales = invoices
            .filter(inv => inv.date.startsWith(date))
            .reduce((sum, inv) => sum + inv.total, 0);
          return {
            name: new Date(date).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short' }),
            sales: daySales,
            expenses: daySales * 0.6 // Mock expenses for now
          };
        });
        setChartData(dailyData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    // Fetch Recent Invoices
    const qRecent = query(collection(db, 'invoices'), orderBy('date', 'desc'), limit(5));
    const unsubscribeRecent = onSnapshot(
      qRecent, 
      (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
        setRecentInvoices(docs);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    return () => {
      unsubscribeProducts();
      unsubscribeInvoices();
      unsubscribeRecent();
    };
  }, [lang]);

  return (
    <div className="p-8 space-y-10">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard 
          title={t.totalSales} 
          value={`${stats.totalSales.toLocaleString()} ${currencySymbol}`} 
          icon={<Wallet className="w-6 h-6" />} 
          trend="+12.5%"
          color="emerald"
          delay={0}
        />
        <StatCard 
          title={t.inventoryValue} 
          value={`${stats.inventoryValue.toLocaleString()} ${currencySymbol}`} 
          icon={<Package className="w-6 h-6" />} 
          trend="+3.2%"
          color="blue"
          delay={0.1}
        />
        <StatCard 
          title={t.totalInvoices} 
          value={stats.totalInvoices.toString()} 
          icon={<FileText className="w-6 h-6" />} 
          trend="+8.1%"
          color="purple"
          delay={0.2}
        />
        <StatCard 
          title={t.lowStock} 
          value={stats.lowStockCount.toString()} 
          icon={<AlertTriangle className="w-6 h-6" />} 
          trend={stats.lowStockCount > 0 ? `-${stats.lowStockCount}` : "Healthy"}
          color={stats.lowStockCount > 0 ? "red" : "emerald"}
          delay={0.3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Sales Chart */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
        >
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-2xl font-black tracking-tight mb-1">{lang === 'ar' ? 'نظرة عامة على المبيعات' : 'Sales Overview'}</h3>
              <p className="text-sm text-zinc-500 font-medium">{lang === 'ar' ? 'أداء المبيعات خلال الأسبوع الماضي' : 'Sales performance for the last 7 days'}</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-1.5 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 rounded-full">Weekly</button>
              <button className="px-4 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">Monthly</button>
            </div>
          </div>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dx={-10}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    borderRadius: '20px', 
                    border: 'none', 
                    boxShadow: '0 20px 50px -10px rgb(0 0 0 / 0.1)' 
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Right Column */}
        <div className="space-y-10">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <h3 className="text-2xl font-black mb-8 tracking-tight">{t.quickActions}</h3>
            <div className="grid grid-cols-2 gap-4">
              <QuickAction icon={<Plus />} label={lang === 'ar' ? 'إنشاء فاتورة' : 'New Invoice'} color="emerald" onClick={() => setActiveTab('invoices')} />
              <QuickAction icon={<Package />} label={lang === 'ar' ? 'إضافة منتج' : 'Add Product'} color="blue" onClick={() => setActiveTab('inventory')} />
              <QuickAction icon={<CreditCard />} label={lang === 'ar' ? 'إضافة شيك' : 'Add Cheque'} color="purple" onClick={() => setActiveTab('cheques')} />
              <QuickAction icon={<RotateCcw />} label={lang === 'ar' ? 'المرتجعات' : 'Returns'} color="amber" onClick={() => setActiveTab('returns')} />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-zinc-900 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-black tracking-tight">{lang === 'ar' ? 'آخر الفواتير' : 'Recent Invoices'}</h3>
              <button className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-widest">{lang === 'ar' ? 'عرض الكل' : 'View All'}</button>
            </div>
            <div className="space-y-8">
              {recentInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-all">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white group-hover:text-emerald-600 transition-colors">{inv.number}</div>
                      <div className="text-xs text-zinc-500 font-medium">{inv.customerName}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-zinc-900 dark:text-white">{currencySymbol} {inv.total.toLocaleString()}</div>
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-tighter">{new Date(inv.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
              {recentInvoices.length === 0 && (
                <div className="text-center py-10 text-zinc-400 opacity-50">
                  <FileText className="w-12 h-12 mx-auto mb-4" />
                  <p className="font-bold">{lang === 'ar' ? 'لا توجد فواتير مؤخراً' : 'No recent invoices'}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color, delay }: any) {
  const colorClasses: any = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600',
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-xl hover:shadow-zinc-200/20 dark:hover:shadow-zinc-950/40 transition-all group"
    >
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${colorClasses[color]} group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${trend.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend}
          {trend.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        </div>
      </div>
      <div className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">{title}</div>
      <div className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{value}</div>
    </motion.div>
  );
}

function QuickAction({ icon, label, color, onClick }: any) {
  const colorClasses: any = {
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-600 hover:text-white',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-600 hover:text-white',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 hover:bg-purple-600 hover:text-white',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-600 hover:text-white',
  };

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-6 rounded-[2rem] transition-all duration-300 gap-3 group border border-transparent hover:shadow-xl ${colorClasses[color]}`}
    >
      <div className="w-8 h-8 flex items-center justify-center transition-transform group-hover:scale-110">
        {icon}
      </div>
      <span className="text-xs font-bold tracking-tight">{label}</span>
    </button>
  );
}
