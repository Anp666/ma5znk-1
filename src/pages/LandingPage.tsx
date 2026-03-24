import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, 
  BarChart3, 
  Package, 
  ShieldCheck, 
  Mic, 
  ScanBarcode, 
  Users, 
  Globe,
  CheckCircle2,
  FileText,
  PieChart,
  Zap,
  Layout
} from 'lucide-react';
import { translations } from '../translations';
import AuthModal from '../components/AuthModal';

interface Props {
  lang: 'ar' | 'en';
  setLang: (l: 'ar' | 'en') => void;
}

export default function LandingPage({ lang, setLang }: Props) {
  const t = translations[lang];
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <div className="overflow-x-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        lang={lang} 
      />
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-2xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <span className="text-2xl font-black text-emerald-600 tracking-tighter flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                <Package className="w-5 h-5" />
              </div>
              {t.brand}
            </span>
            <div className="hidden lg:flex items-center gap-8 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              <a href="#features" className="hover:text-emerald-600 transition-all duration-300">{t.features}</a>
              <a href="#how-it-works" className="hover:text-emerald-600 transition-all duration-300">{t.howItWorks}</a>
              <a href="#pricing" className="hover:text-emerald-600 transition-all duration-300">{t.pricing}</a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="px-4 py-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 text-sm font-bold"
            >
              <Globe className="w-4 h-4" />
              <span>{lang === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="hidden sm:block text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 transition-colors"
            >
              {t.login}
            </button>
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-bold transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
            >
              {t.startNow}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-400/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-xs font-bold tracking-widest text-emerald-600 uppercase bg-emerald-50 dark:bg-emerald-900/20 rounded-full border border-emerald-100 dark:border-emerald-800">
              <Zap className="w-3 h-3" />
              {t.tagline}
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-zinc-900 dark:text-white mb-8 leading-[1.1] tracking-tight">
              {t.heroTitle}
            </h1>
            <p className="text-xl md:text-2xl text-zinc-500 dark:text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
              {t.heroSub}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="group w-full sm:w-auto px-10 py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-lg font-bold transition-all flex items-center justify-center gap-3 shadow-2xl shadow-emerald-600/30 active:scale-95"
              >
                {t.startNow}
                <ArrowRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${lang === 'ar' ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
              </button>
              <button className="w-full sm:w-auto px-10 py-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-2xl text-lg font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all active:scale-95">
                {t.requestDemo}
              </button>
            </div>
          </motion.div>

          {/* Dashboard Preview Image */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-24 relative"
          >
            <div className="absolute inset-0 bg-emerald-500/5 blur-[100px] rounded-full -z-10" />
            <div className="relative mx-auto max-w-6xl p-2 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)]">
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-[2rem] overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-[16/10] flex flex-col">
                <div className="h-12 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-6 gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <div className="w-3 h-3 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="w-64 h-6 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
                  </div>
                </div>
                <div className="flex-1 p-8 grid grid-cols-12 gap-6">
                  <div className="col-span-3 space-y-4">
                    <div className="h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-3/4" />
                    <div className="space-y-2">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-10 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
                      ))}
                    </div>
                  </div>
                  <div className="col-span-9 space-y-6">
                    <div className="grid grid-cols-3 gap-6">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl" />
                      ))}
                    </div>
                    <div className="h-full bg-zinc-100 dark:bg-zinc-800 rounded-3xl" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 bg-zinc-50 dark:bg-zinc-900/30 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">{t.features}</h2>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto font-medium">
              Everything you need to scale your business in one integrated platform.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Package />} 
              title={t.inventory} 
              desc="Full control over your stock with real-time tracking and automated alerts."
            />
            <FeatureCard 
              icon={<FileText />} 
              title={t.invoices} 
              desc="Create professional invoices in seconds. Automated tax calculations and PDF export."
            />
            <FeatureCard 
              icon={<PieChart />} 
              title={t.accounting} 
              desc="Professional chart of accounts and ledger system for precise financial management."
            />
            <FeatureCard 
              icon={<ShieldCheck />} 
              title={t.aiAssistant} 
              desc="AI-powered insights and reports to help you make better business decisions."
            />
            <FeatureCard 
              icon={<ScanBarcode />} 
              title={t.barcodeSupport} 
              desc="Full support for barcode scanning to speed up your sales and inventory processes."
            />
            <FeatureCard 
              icon={<Mic />} 
              title={t.voiceEntry} 
              desc="Add products and manage your warehouse using simple voice commands."
            />
            <FeatureCard 
              icon={<BarChart3 />} 
              title={t.reports} 
              desc="Comprehensive financial reports including sales, expenses, and profit analysis."
            />
            <FeatureCard 
              icon={<Users />} 
              title={t.permissions} 
              desc="Role-based access control for admins, accountants, and cashiers."
            />
            <FeatureCard 
              icon={<Layout />} 
              title="Responsive Design" 
              desc="Access your business from anywhere. Fully optimized for mobile, tablet, and desktop."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-zinc-900 dark:bg-black rounded-[3rem] p-12 md:p-24 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 blur-[100px] rounded-full" />
            <div className="relative z-10">
              <h2 className="text-4xl md:text-6xl font-black mb-8">{t.pricing}</h2>
              <div className="max-w-md mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-12">
                <h3 className="text-xl font-bold mb-4 opacity-60 uppercase tracking-widest">{t.singlePlan}</h3>
                <div className="flex items-baseline justify-center gap-2 mb-8">
                  <span className="text-7xl font-black">$49</span>
                  <span className="text-xl opacity-50">/mo</span>
                </div>
                <ul className="text-left space-y-5 mb-12">
                  {[
                    "Unlimited Products & Invoices",
                    "Advanced AI Financial Assistant",
                    "Multi-user Role Permissions",
                    "Real-time Inventory Sync",
                    "24/7 Priority Support"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-4 font-medium">
                      <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-lg font-bold transition-all shadow-xl shadow-emerald-600/20 active:scale-95"
                >
                  {t.startNow}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24">
            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight">{t.howItWorks}</h2>
            <p className="text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto font-medium">
              Get up and running in minutes with our intuitive four-step process.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-zinc-100 dark:bg-zinc-800 -z-10" />
            
            <StepCard number="01" title={t.step1} desc="Import your products via Excel or add them manually with our smart entry system." />
            <StepCard number="02" title={t.step2} desc="Generate professional invoices, manage discounts, and handle taxes automatically." />
            <StepCard number="03" title={t.step3} desc="Monitor stock levels in real-time across multiple warehouses and locations." />
            <StepCard number="04" title={t.step4} desc="Analyze your business performance with AI-driven financial reports and insights." />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative bg-emerald-600 rounded-[3rem] p-12 md:p-24 text-center text-white overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1),transparent)]" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative z-10"
            >
              <h2 className="text-4xl md:text-7xl font-black mb-8 tracking-tighter">{t.ctaTitle}</h2>
              <p className="text-xl md:text-2xl text-emerald-50 mb-12 max-w-2xl mx-auto font-medium opacity-90">
                Join thousands of businesses that trust Makhzanak for their daily operations.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full sm:w-auto px-12 py-6 bg-white text-emerald-600 rounded-2xl text-xl font-black hover:bg-emerald-50 transition-all shadow-2xl active:scale-95"
                >
                  {t.startNow}
                </button>
                <button className="w-full sm:w-auto px-12 py-6 bg-emerald-700/50 text-white border border-emerald-500/30 rounded-2xl text-xl font-black hover:bg-emerald-700 transition-all active:scale-95">
                  {t.requestDemo}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <span className="text-2xl font-black text-emerald-600 tracking-tighter">{t.brand}</span>
            <p className="text-zinc-500 font-medium max-w-xs text-center md:text-left">
              The ultimate platform for modern business management.
            </p>
          </div>
          <div className="flex gap-12 text-sm font-bold text-zinc-500 dark:text-zinc-400">
            <div className="flex flex-col gap-4">
              <span className="text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Product</span>
              <a href="#features" className="hover:text-emerald-600 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-emerald-600 transition-colors">Pricing</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Updates</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-zinc-900 dark:text-white uppercase tracking-widest text-xs">Company</span>
              <a href="#" className="hover:text-emerald-600 transition-colors">About</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Contact</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Privacy</a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-zinc-100 dark:border-zinc-900 text-center">
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
            © 2026 {t.brand}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative p-8 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/20 dark:shadow-none"
    >
      <div className="text-5xl font-black text-emerald-600/20 mb-6">{number}</div>
      <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-4">{title}</h3>
      <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
        {desc}
      </p>
    </motion.div>
  );
}
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="group p-10 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200/50 dark:border-zinc-800 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] transition-all duration-500"
    >
      <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 text-emerald-600 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-sm">
        <div className="w-8 h-8 flex items-center justify-center">{icon}</div>
      </div>
      <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">{title}</h3>
      <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
        {desc}
      </p>
    </motion.div>
  );
}
