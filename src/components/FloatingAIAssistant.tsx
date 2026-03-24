import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, BarChart2, X, MessageSquare, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import { generateFinancialResponse, financialTools } from '../services/gemini';
import { translations } from '../translations';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface Message {
  role: 'user' | 'assistant' | 'model';
  content: string;
  chartData?: any;
}

interface Props {
  lang: 'ar' | 'en';
  profile: any;
}

export default function FloatingAIAssistant({ lang, profile }: Props) {
  const t = translations[lang];
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: lang === 'ar' ? 'مرحباً! أنا مساعدك المالي الذكي. كيف يمكنني مساعدتك اليوم؟' : 'Hello! I am your AI financial assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const executeTool = async (call: any) => {
    const { name, args } = call;
    try {
      switch (name) {
        case 'get_inventory_data': {
          const q = query(collection(db, 'products'));
          const snapshot = await getDocs(q);
          let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (args.filter === 'low_stock') {
            products = products.filter((p: any) => p.quantity <= (p.minStock || 5));
          }
          return products;
        }
        case 'get_sales_data': {
          const q = query(collection(db, 'invoices'), orderBy('date', 'desc'));
          const snapshot = await getDocs(q);
          let invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          if (args.period && args.period !== 'all') {
            const now = new Date();
            let startDate = new Date();
            if (args.period === 'today') startDate.setHours(0, 0, 0, 0);
            if (args.period === 'this_week') startDate.setDate(now.getDate() - 7);
            if (args.period === 'this_month') startDate.setMonth(now.getMonth() - 1);
            invoices = invoices.filter((inv: any) => new Date(inv.date) >= startDate);
          }
          return invoices;
        }
        case 'get_treasury_data': {
          const q = query(collection(db, 'transactions'), orderBy('date', 'desc'), limit(args.limit || 20));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        case 'get_reports_summary': {
          const invoicesQ = query(collection(db, 'invoices'));
          const snapshot = await getDocs(invoicesQ);
          const invoices = snapshot.docs.map(doc => doc.data());
          const sales = invoices.filter((inv: any) => inv.type === 'sales').reduce((sum, inv) => sum + inv.total, 0);
          const purchases = invoices.filter((inv: any) => inv.type === 'purchase').reduce((sum, inv) => sum + inv.total, 0);
          return { totalSales: sales, totalPurchases: purchases, estimatedProfit: sales - purchases };
        }
        default: return { error: 'Tool not found' };
      }
    } catch (error) {
      return { error: 'Failed to fetch data' };
    }
  };

  const handleSend = async (overrideInput?: string) => {
    const messageToSend = overrideInput || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage = messageToSend.trim();
    setInput('');
    const newMessages: any[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      let currentMessages: any[] = newMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' : m.role,
        parts: [{ text: m.content }]
      }));

      let response = await generateFinancialResponse(currentMessages, financialTools);
      
      while (response.functionCalls) {
        const toolResponses = [];
        for (const call of response.functionCalls) {
          const result = await executeTool(call);
          toolResponses.push({
            functionResponse: { name: call.name, response: { result } }
          });
        }
        if (response.candidates?.[0]?.content?.parts) {
          currentMessages.push({ role: 'model', parts: response.candidates[0].content.parts });
        }
        currentMessages.push({ role: 'user', parts: toolResponses });
        response = await generateFinancialResponse(currentMessages, financialTools);
      }

      let finalContent = response.text || '';
      let chartData = null;
      const chartMatch = finalContent.match(/CHART_DATA:\s*(\[.*\])/s);
      if (chartMatch) {
        try {
          chartData = JSON.parse(chartMatch[1]);
          finalContent = finalContent.replace(/CHART_DATA:\s*\[.*\]/s, '').trim();
        } catch (e) {}
      }
      setMessages(prev => [...prev, { role: 'assistant', content: finalContent, chartData }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: lang === 'ar' ? 'عذراً، حدث خطأ.' : 'Sorry, an error occurred.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed bottom-6 ${lang === 'ar' ? 'left-6' : 'right-6'} z-[100]`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`
              bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-[2rem] overflow-hidden flex flex-col
              ${isMinimized ? 'h-16 w-64' : 'h-[500px] w-[350px] sm:w-[380px]'}
              fixed bottom-24 ${lang === 'ar' ? 'left-6' : 'right-6'}
              max-sm:fixed max-sm:inset-0 max-sm:w-full max-sm:h-full max-sm:rounded-none
            `}
          >
            {/* Header */}
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5" />
                <span className="font-bold text-sm tracking-tight">{lang === 'ar' ? 'المساعد المالي' : 'Financial Assistant'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                        msg.role === 'user' 
                          ? 'bg-emerald-600 text-white rounded-tr-none' 
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none'
                      }`}>
                        <div className="prose dark:prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {msg.chartData && (
                          <div className="mt-4 h-32 w-full bg-white dark:bg-zinc-900 rounded-xl p-2 border border-zinc-200 dark:border-zinc-700">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={msg.chartData}>
                                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={lang === 'ar' ? 'اسألني أي شيء...' : 'Ask me anything...'}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                      className="w-full pl-4 pr-12 py-3 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl text-sm focus:ring-2 ring-emerald-500/20 outline-none"
                    />
                    <button 
                      onClick={() => handleSend()}
                      disabled={isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-600/40"
      >
        {isOpen ? <ChevronDown className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}
