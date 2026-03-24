import { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LandingPage from './pages/LandingPage';
import DashboardLayout from './components/DashboardLayout';
import { motion, AnimatePresence } from 'motion/react';
import { ensureSystemAccounts } from './services/accountingService';
import { Toaster } from 'react-hot-toast';

export default function App() {
  const { user, profile, loading } = useAuth();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (user) {
      ensureSystemAccounts().catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [lang, theme]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-zinc-950">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-3xl font-bold text-emerald-600 font-sans"
        >
          مخزنك
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
      <Toaster position="top-center" reverseOrder={false} />
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LandingPage lang={lang} setLang={setLang} />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <DashboardLayout 
              lang={lang} 
              setLang={setLang} 
              theme={theme} 
              setTheme={setTheme}
              profile={profile}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
