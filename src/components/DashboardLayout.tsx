import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Moon, 
  Sun, 
  Globe,
  MessageSquare,
  Wallet,
  PieChart,
  Truck,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  BarChart as BarChartNavIcon,
  CreditCard,
  RotateCcw
} from 'lucide-react';
import { translations } from '../translations';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { UserProfile } from '../types';
import DashboardHome from '../pages/DashboardHome';
import Inventory from '../pages/Inventory';
import Accounting from '../pages/Accounting';
import Invoices from '../pages/Invoices';
import Purchases from '../pages/Purchases';
import AIAssistant from '../pages/AIAssistant';
import FloatingAIAssistant from './FloatingAIAssistant';
import Reports from '../pages/Reports';
import Cheques from '../pages/Cheques';
import Returns from '../pages/Returns';
import Treasury from '../pages/Treasury';
import Customers from '../pages/Customers';
import Suppliers from '../pages/Suppliers';
import SettingsPage from '../pages/Settings';
import UserManagement from '../pages/UserManagement';
import { motion, AnimatePresence } from 'motion/react';
import { Shield } from 'lucide-react';

interface Props {
  lang: 'ar' | 'en';
  setLang: (l: 'ar' | 'en') => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  profile: UserProfile | null;
}

export default function DashboardLayout({ lang, setLang, theme, setTheme, profile }: Props) {
  const t = translations[lang];
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', icon: <LayoutDashboard />, label: t.dashboard, roles: ['admin', 'accountant', 'cashier'] },
    { id: 'inventory', icon: <Package />, label: t.inventory, roles: ['admin', 'accountant'] },
    { id: 'accounting', icon: <PieChart />, label: t.chartOfAccounts, roles: ['admin', 'accountant'] },
    { id: 'invoices', icon: <FileText />, label: t.latestInvoices, roles: ['admin', 'accountant', 'cashier'] },
    { id: 'purchases', icon: <ShoppingCart />, label: lang === 'ar' ? 'المشتريات' : 'Purchases', roles: ['admin', 'accountant'] },
    { id: 'treasury', icon: <Wallet />, label: t.treasury, roles: ['admin', 'accountant'] },
    { id: 'customers', icon: <Users />, label: t.customers, roles: ['admin', 'accountant', 'cashier'] },
    { id: 'suppliers', icon: <Truck />, label: t.suppliers, roles: ['admin', 'accountant'] },
    { id: 'cheques', icon: <CreditCard />, label: lang === 'ar' ? 'الشيكات' : 'Cheques', roles: ['admin', 'accountant'] },
    { id: 'returns', icon: <RotateCcw />, label: lang === 'ar' ? 'المرتجعات' : 'Returns', roles: ['admin', 'accountant'] },
    { id: 'reports', icon: <BarChartNavIcon />, label: t.reportsSystem, roles: ['admin', 'accountant'] },
    { id: 'users', icon: <Shield />, label: t.userManagement, roles: ['admin'] },
    { id: 'settings', icon: <Settings />, label: t.settings, roles: ['admin', 'accountant', 'cashier'] },
  ].filter(item => item.roles.includes(profile?.role || 'cashier'));

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardHome lang={lang} profile={profile} setActiveTab={setActiveTab} />;
      case 'inventory': return <Inventory lang={lang} profile={profile} />;
      case 'accounting': return <Accounting lang={lang} profile={profile} />;
      case 'invoices': return <Invoices lang={lang} profile={profile} />;
      case 'purchases': return <Purchases lang={lang} profile={profile} />;
      case 'treasury': return <Treasury lang={lang} profile={profile} />;
      case 'customers': return <Customers lang={lang} profile={profile} />;
      case 'suppliers': return <Suppliers lang={lang} profile={profile} />;
      case 'cheques': return <Cheques lang={lang} />;
      case 'returns': return <Returns lang={lang} />;
      case 'reports': return <Reports lang={lang} profile={profile} />;
      case 'users': return <UserManagement lang={lang} profile={profile} />;
      case 'settings': return <SettingsPage lang={lang} profile={profile} />;
      default: return <div className="p-8 text-center opacity-50">Coming Soon: {activeTab}</div>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <FloatingAIAssistant lang={lang} profile={profile} />
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 280 : 88,
          x: (typeof window !== 'undefined' && window.innerWidth < 1024) ? (isSidebarOpen ? 0 : (lang === 'ar' ? 280 : -280)) : 0
        }}
        className={`fixed lg:relative bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col z-50 transition-colors duration-300 h-full ${lang === 'ar' ? 'right-0' : 'left-0'}`}
      >
        <div className="h-20 flex items-center px-6 gap-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-600/20 flex-shrink-0">
            <Package className="w-6 h-6" />
          </div>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter"
            >
              {t.brand}
            </motion.span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5 custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 group ${
                activeTab === item.id 
                  ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20' 
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <div className={`w-6 h-6 flex items-center justify-center transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                {item.icon}
              </div>
              {isSidebarOpen && (
                <motion.span 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-bold text-sm tracking-tight"
                >
                  {item.label}
                </motion.span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-full flex items-center gap-4 p-3.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl transition-all group"
          >
            <div className="w-6 h-6 flex items-center justify-center group-hover:rotate-12 transition-transform">
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            {isSidebarOpen && <span className="text-sm font-bold">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
          </button>
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-4 p-3.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all group"
          >
            <div className="w-6 h-6 flex items-center justify-center group-hover:-translate-x-1 transition-transform">
              <LogOut className="w-5 h-5" />
            </div>
            {isSidebarOpen && <span className="text-sm font-bold">{t.logout}</span>}
          </button>
        </div>

        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-24 w-6 h-6 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform z-40 hidden lg:flex"
        >
          {isSidebarOpen ? (
            lang === 'ar' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          ) : (
            lang === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 md:px-8 z-20">
          <div className="flex items-center gap-4 md:gap-8 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg md:text-xl font-black text-zinc-900 dark:text-white tracking-tight truncate">
              {menuItems.find(i => i.id === activeTab)?.label}
            </h2>
            
            <div className="relative max-w-md w-full hidden xl:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input 
                type="text" 
                placeholder={t.searchProduct}
                className="w-full pl-11 pr-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <button className="relative p-2.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900" />
            </button>
            
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block" />

            <div className="flex items-center gap-2 md:gap-4 group cursor-pointer">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-black text-zinc-900 dark:text-white group-hover:text-emerald-600 transition-colors">{profile?.displayName}</span>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{profile?.role}</span>
              </div>
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-black text-lg shadow-inner group-hover:scale-105 transition-transform">
                {profile?.displayName?.[0] || 'U'}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="h-full p-4 md:p-8"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function BarChartIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bar-chart-3"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>;
}
