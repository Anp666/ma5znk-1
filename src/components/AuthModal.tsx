import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, User, Phone, ArrowRight, Loader2, Package } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { translations } from '../translations';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'en';
}

export default function AuthModal({ isOpen, onClose, lang }: Props) {
  const t = translations[lang];
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signIn(formData.email, formData.password);
      } else {
        await signUp(formData.email, formData.password, formData.name, formData.phone);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || t.errorLoginFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onClose();
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
                    <Package className="w-6 h-6" />
                  </div>
                  <span className="text-xl font-black text-emerald-600 tracking-tighter">{t.brand}</span>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-8">
                <h2 className="text-3xl font-black text-zinc-900 dark:text-white mb-2">
                  {isLogin ? t.login : t.register}
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium">
                  {isLogin ? t.heroSub : t.createAccount}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        type="text"
                        placeholder={t.name}
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                      <input
                        type="tel"
                        placeholder={t.phoneNumber}
                        required
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                      />
                    </div>
                  </>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type="email"
                    placeholder={t.email}
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    type="password"
                    placeholder={t.password}
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium"
                  />
                </div>

                {error && (
                  <p className="text-sm font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl border border-rose-100 dark:border-rose-900/30">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {isLogin ? t.login : t.register}
                      <ArrowRight className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
                  </div>
                  <span className="relative px-4 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Or
                  </span>
                </div>

                <button
                  onClick={handleGoogleLogin}
                  className="w-full py-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white rounded-2xl font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  {t.connectGoogle}
                </button>

                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="w-full text-sm font-bold text-zinc-500 hover:text-emerald-600 transition-colors"
                >
                  {isLogin ? t.noAccount : t.haveAccount}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
