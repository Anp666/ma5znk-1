import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, BarChart2, TrendingUp, AlertTriangle, Mic, MicOff, X } from 'lucide-react';
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

export default function AIAssistant({ lang, profile }: Props) {
  const t = translations[lang];
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: lang === 'ar' ? 'مرحباً! أنا مساعدك المالي الذكي. يمكنني تحليل مبيعاتك، مخزونك، وأرباحك. كيف يمكنني مساعدتك اليوم؟' : 'Hello! I am your AI financial assistant. I can analyze your sales, inventory, and profits. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const executeTool = async (call: any) => {
    const { name, args } = call;
    console.log(`Executing tool: ${name}`, args);
    
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
        case 'get_suppliers_data': {
          const q = query(collection(db, 'suppliers'));
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        case 'get_reports_summary': {
          const invoicesQ = query(collection(db, 'invoices'));
          const snapshot = await getDocs(invoicesQ);
          const invoices = snapshot.docs.map(doc => doc.data());
          
          const sales = invoices.filter((inv: any) => inv.type === 'sales').reduce((sum, inv) => sum + inv.total, 0);
          const purchases = invoices.filter((inv: any) => inv.type === 'purchase').reduce((sum, inv) => sum + inv.total, 0);
          const profit = sales - purchases; // Simplified profit

          return { totalSales: sales, totalPurchases: purchases, estimatedProfit: profit };
        }
        default:
          return { error: 'Tool not found' };
      }
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);
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
      
      // Handle function calls
      while (response.functionCalls) {
        const toolResponses = [];
        for (const call of response.functionCalls) {
          const result = await executeTool(call);
          toolResponses.push({
            functionResponse: {
              name: call.name,
              response: { result }
            }
          });
        }

        // Add the model's tool call to history
        if (response.candidates?.[0]?.content?.parts) {
          currentMessages.push({
            role: 'model',
            parts: response.candidates[0].content.parts
          });
        }

        // Add tool responses to history
        currentMessages.push({
          role: 'user',
          parts: toolResponses
        });

        // Get final response after tool execution
        response = await generateFinancialResponse(currentMessages, financialTools);
      }

      let finalContent = response.text || '';
      let chartData = null;

      // Extract chart data if present
      const chartMatch = finalContent.match(/CHART_DATA:\s*(\[.*\])/s);
      if (chartMatch) {
        try {
          chartData = JSON.parse(chartMatch[1]);
          finalContent = finalContent.replace(/CHART_DATA:\s*\[.*\]/s, '').trim();
        } catch (e) {
          console.error('Failed to parse chart data', e);
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: finalContent, chartData }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: lang === 'ar' ? 'عذراً، حدث خطأ أثناء معالجة طلبك.' : 'Sorry, I encountered an error while processing your request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error(lang === 'ar' ? 'متصفحك لا يدعم التعرف على الصوت' : 'Your browser does not support speech recognition');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };

    recognition.start();
  };

  return (
    <div className="fixed inset-0 lg:relative lg:inset-auto h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 z-[60] lg:z-0">
      {/* AI Header */}
      <div className="p-6 lg:p-8 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl shadow-inner">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl lg:text-2xl font-black tracking-tight">{t.aiAssistantTitle}</h2>
            <p className="text-xs lg:text-sm text-zinc-500 font-medium">{t.aiAssistantSub}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            System Online
          </div>
          <button className="lg:hidden p-2 text-zinc-400 hover:text-zinc-600" onClick={() => window.history.back()}>
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 lg:space-y-8 custom-scrollbar" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[90%] lg:max-w-[85%] flex gap-3 lg:gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                  msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-emerald-600'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5 lg:w-6 lg:h-6" /> : <Bot className="w-5 h-5 lg:w-6 lg:h-6" />}
                </div>
                <div className="space-y-4 flex-1">
                  <div className={`p-5 lg:p-8 rounded-[1.5rem] lg:rounded-[2rem] shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none'
                  }`}>
                    <div className="prose dark:prose-invert prose-emerald max-w-none font-medium leading-relaxed text-sm lg:text-base">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>

                  {msg.chartData && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm h-[350px]"
                    >
                      <div className="flex items-center gap-2 mb-6 text-zinc-400 font-bold text-xs uppercase tracking-widest">
                        <BarChart2 className="w-4 h-4" />
                        {lang === 'ar' ? 'تحليل البيانات' : 'Data Analysis'}
                      </div>
                      <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={msg.chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#fff', 
                              borderRadius: '16px', 
                              border: 'none', 
                              boxShadow: '0 10px 30px -5px rgb(0 0 0 / 0.1)' 
                            }} 
                          />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                            {msg.chartData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#3b82f6'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-5">
              <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-emerald-600 flex items-center justify-center shadow-sm">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div className="p-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" />
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 lg:p-10 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 lg:gap-4 mb-4 lg:mb-6 overflow-x-auto pb-2 no-scrollbar">
            <SuggestionChip 
              label={lang === 'ar' ? 'مبيعات هذا الشهر' : 'Sales this month'} 
              onClick={() => handleSend(lang === 'ar' ? 'كم بلغت مبيعاتي هذا الشهر؟' : 'What are my sales this month?')} 
            />
            <SuggestionChip 
              label={lang === 'ar' ? 'المنتجات الأكثر مبيعاً' : 'Best selling products'} 
              onClick={() => handleSend(lang === 'ar' ? 'ما هي أكثر المنتجات مبيعاً؟' : 'What are the best selling products?')} 
            />
            <SuggestionChip 
              label={lang === 'ar' ? 'نقص المخزون' : 'Low stock alerts'} 
              onClick={() => handleSend(lang === 'ar' ? 'هل هناك منتجات منخفضة في المخزون؟' : 'Are there any low stock products?')} 
            />
            <SuggestionChip 
              label={lang === 'ar' ? 'تحليل الأرباح' : 'Profit analysis'} 
              onClick={() => handleSend(lang === 'ar' ? 'حلل أرباحي للأسبوع الماضي' : 'Analyze my profits for the last week')} 
            />
          </div>
          <div className="relative group flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={t.aiHint}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="w-full pl-6 lg:pl-8 pr-16 lg:pr-20 py-4 lg:py-6 bg-zinc-50 dark:bg-zinc-800 border-none rounded-[1.5rem] lg:rounded-[2rem] focus:ring-4 focus:ring-emerald-500/10 outline-none text-base lg:text-lg font-medium transition-all"
              />
              <button 
                onClick={() => handleSend()}
                disabled={isLoading}
                className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 w-10 h-10 lg:w-14 lg:h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl lg:rounded-2xl flex items-center justify-center transition-all shadow-2xl shadow-emerald-600/20 disabled:opacity-50 active:scale-95"
              >
                <Send className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
            </div>
            <button 
              onClick={startListening}
              disabled={isLoading}
              className={`w-12 h-12 lg:w-16 lg:h-16 rounded-xl lg:rounded-[1.5rem] flex items-center justify-center transition-all shadow-sm ${
                isListening 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5 lg:w-6 lg:h-6" /> : <Mic className="w-5 h-5 lg:w-6 lg:h-6" />}
            </button>
          </div>
          <div className="mt-4 lg:mt-6 flex items-center justify-center gap-3 text-[8px] lg:text-[10px] text-zinc-400 font-black uppercase tracking-[0.2em]">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            Makhzanak Intelligence Engine
          </div>
        </div>
      </div>
    </div>
  );
}

function SuggestionChip({ label, onClick }: { label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800"
    >
      {label}
    </button>
  );
}
