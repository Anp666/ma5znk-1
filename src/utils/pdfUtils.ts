import reshaper from 'arabic-reshaper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Fixes Arabic text for PDF generation by reshaping characters and handling RTL for mixed text.
 */
export const fixArabic = (text: string | number | undefined): string => {
  if (text === undefined || text === null) return '';
  const str = String(text);
  
  // Check if text contains Arabic characters
  const arabicPattern = /[\u0600-\u06FF]/;
  if (!arabicPattern.test(str)) return str;
  
  try {
    const config = {
      deleteHarakat: false,
      supportLigatures: true,
    };

    // Helper to get the reshape function regardless of module format
    const reshapeFunc = (reshaper as any).reshape || 
                        (reshaper as any).default?.reshape || 
                        (reshaper as any).default || 
                        (typeof reshaper === 'function' ? reshaper : null);

    if (!reshapeFunc || typeof reshapeFunc !== 'function') {
      console.error('Arabic reshaper function not found', { reshaperType: typeof reshaper, hasReshape: !!(reshaper as any).reshape });
      return str;
    }

    // 1. Reshape the entire string first to handle connections
    const reshaped = reshapeFunc(str, config);

    // 2. Handle RTL for mixed text (Arabic + English/Numbers)
    // We need to tokenize the string into Arabic and non-Arabic parts
    // then reverse the order of tokens and reverse the characters of Arabic tokens
    
    const tokens: { text: string; isArabic: boolean }[] = [];
    let currentToken = '';
    let lastIsArabic = arabicPattern.test(reshaped[0]);

    for (let i = 0; i < reshaped.length; i++) {
      const char = reshaped[i];
      const isArabic = arabicPattern.test(char) || (char === ' ' && i < reshaped.length - 1 && arabicPattern.test(reshaped[i+1]));
      
      if (isArabic === lastIsArabic) {
        currentToken += char;
      } else {
        tokens.push({ text: currentToken, isArabic: lastIsArabic });
        currentToken = char;
        lastIsArabic = isArabic;
      }
    }
    tokens.push({ text: currentToken, isArabic: lastIsArabic });

    // Reverse the characters within Arabic tokens and reverse the overall order of tokens
    const processedTokens = tokens.map(token => {
      if (token.isArabic) {
        return token.text.split('').reverse().join('');
      }
      return token.text;
    });

    return processedTokens.reverse().join('');
  } catch (e) {
    console.error('Error reshaping Arabic text:', e);
    return str;
  }
};

/**
 * Formats currency in Arabic/English style
 */
export const formatCurrency = (amount: number, lang: 'ar' | 'en') => {
  const formatted = amount.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return lang === 'ar' ? `${formatted} ج.م` : `EGP ${formatted}`;
};

/**
 * Loads a font from a URL and returns its base64 string
 */
export const loadFont = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (!result) {
          reject(new Error('FileReader result is empty'));
          return;
        }
        const base64String = result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`Error loading font from ${url}:`, error);
    throw error;
  }
};

/**
 * Tries to load a font from multiple URLs until one succeeds
 */
const loadFontWithFallback = async (urls: string[]): Promise<string> => {
  let lastError: any;
  for (const url of urls) {
    try {
      return await loadFont(url);
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  throw lastError || new Error('All font URLs failed to load');
};

// URLs for Cairo fonts (Using multiple CDNs for reliability)
export const CAIRO_REGULAR_URLS = [
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/static/Cairo-Regular.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/static/Cairo-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/googlefonts/cairo@master/fonts/ttf/Cairo-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/googlefonts/tajawal@master/fonts/ttf/Tajawal-Regular.ttf' // Fallback to Tajawal
];

export const CAIRO_BOLD_URLS = [
  'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/static/Cairo-Bold.ttf',
  'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/static/Cairo-Bold.ttf',
  'https://cdn.jsdelivr.net/gh/googlefonts/cairo@master/fonts/ttf/Cairo-Bold.ttf',
  'https://cdn.jsdelivr.net/gh/googlefonts/tajawal@master/fonts/ttf/Tajawal-Bold.ttf' // Fallback to Tajawal
];

/**
 * Initializes a jsPDF instance with Cairo support and RTL configuration
 */
export const initArabicPdf = async (orientation: 'p' | 'l' = 'p') => {
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true
  });

  try {
    // Load fonts with fallbacks
    const [regBase64, boldBase64] = await Promise.all([
      loadFontWithFallback(CAIRO_REGULAR_URLS),
      loadFontWithFallback(CAIRO_BOLD_URLS)
    ]);
    
    doc.addFileToVFS('Cairo-Regular.ttf', regBase64);
    doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
    
    doc.addFileToVFS('Cairo-Bold.ttf', boldBase64);
    doc.addFont('Cairo-Bold.ttf', 'Cairo', 'bold');
    
    doc.setFont('Cairo', 'normal');
  } catch (error) {
    console.error('Failed to load Cairo font, falling back to default:', error);
  }
  return doc;
};

/**
 * Generates a professional invoice PDF
 */
export const generateInvoicePDF = async (invoice: any, lang: 'ar' | 'en') => {
  const doc = await initArabicPdf('p');
  const isAr = lang === 'ar';
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  
  // Header Background
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Brand Logo/Name
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(16, 185, 129); // Emerald-600
  const brandName = isAr ? fixArabic('مخزنك | Makhzanak') : 'Makhzanak';
  doc.text(brandName, isAr ? pageWidth - margin : margin, 25, { align: isAr ? 'right' : 'left' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const subTitle = isAr ? fixArabic('نظام إدارة المخازن والمبيعات الذكي') : 'Smart Inventory & Sales Management System';
  doc.text(subTitle, isAr ? pageWidth - margin : margin, 33, { align: isAr ? 'right' : 'left' });
  
  // Invoice Title & Details
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  const invTitle = isAr ? fixArabic('فاتورة مبيعات') : 'Sales Invoice';
  doc.text(invTitle, isAr ? margin : pageWidth - margin, 25, { align: isAr ? 'left' : 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const invNum = isAr ? fixArabic(`رقم الفاتورة: ${invoice.number}`) : `Invoice #: ${invoice.number}`;
  doc.text(invNum, isAr ? margin : pageWidth - margin, 33, { align: isAr ? 'left' : 'right' });
  
  const invDate = isAr ? fixArabic(`التاريخ: ${new Date(invoice.date).toLocaleDateString()}`) : `Date: ${new Date(invoice.date).toLocaleDateString()}`;
  doc.text(invDate, isAr ? margin : pageWidth - margin, 39, { align: isAr ? 'left' : 'right' });
  
  // Billing Info
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.setFont('Cairo', 'bold');
  doc.text(isAr ? fixArabic('بيانات العميل:') : 'Bill To:', isAr ? pageWidth - margin : margin, 60, { align: isAr ? 'right' : 'left' });
  
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(11);
  doc.text(fixArabic(invoice.customerName), isAr ? pageWidth - margin : margin, 68, { align: isAr ? 'right' : 'left' });
  
  // Table
  const tableData = invoice.items.map((item: any) => [
    isAr ? fixArabic(item.name) : item.name,
    item.quantity.toString(),
    item.price.toFixed(2),
    item.total.toFixed(2)
  ]);
  
  const headers = isAr 
    ? [fixArabic('المنتج'), fixArabic('الكمية'), fixArabic('السعر'), fixArabic('الإجمالي')]
    : ['Product', 'Quantity', 'Price', 'Total'];
  
  // For RTL tables in autoTable, we need to reverse the columns if we are in Arabic mode
  // and set the styles to align right.
  const processedHeaders = isAr ? [...headers].reverse() : headers;
  const processedBody = isAr ? tableData.map((row: any) => [...row].reverse()) : tableData;

  autoTable(doc, {
    startY: 80,
    head: [processedHeaders],
    body: processedBody,
    styles: { 
      font: 'Cairo', 
      fontSize: 10,
      halign: isAr ? 'right' : 'left',
      cellPadding: 5
    },
    headStyles: { 
      fillColor: [16, 185, 129], 
      textColor: 255, 
      fontStyle: 'bold',
      halign: isAr ? 'right' : 'left'
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
  });
  
  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  const totalBoxWidth = 70;
  const totalBoxX = isAr ? margin : pageWidth - margin - totalBoxWidth;
  
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(10);
  
  const drawTotalLine = (label: string, value: string, y: number) => {
    doc.text(fixArabic(label), isAr ? margin + totalBoxWidth : pageWidth - margin - totalBoxWidth, y, { align: isAr ? 'right' : 'left' });
    doc.text(value, isAr ? margin : pageWidth - margin, y, { align: isAr ? 'left' : 'right' });
  };

  drawTotalLine(isAr ? 'المجموع الفرعي:' : 'Subtotal:', invoice.subtotal.toFixed(2), finalY);
  drawTotalLine(isAr ? 'الخصم:' : 'Discount:', `-${invoice.discount.toFixed(2)}`, finalY + 7);
  drawTotalLine(isAr ? 'الضريبة:' : 'Tax:', invoice.tax.toFixed(2), finalY + 14);
  
  doc.setDrawColor(200, 200, 200);
  doc.line(isAr ? margin : pageWidth - margin - totalBoxWidth, finalY + 18, isAr ? margin + totalBoxWidth : pageWidth - margin, finalY + 18);
  
  doc.setFont('Cairo', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(16, 185, 129);
  const totalLabel = isAr ? 'الإجمالي النهائي:' : 'Grand Total:';
  const totalValue = `${invoice.total.toFixed(2)} ${isAr ? 'ج.م' : 'EGP'}`;
  
  doc.text(fixArabic(totalLabel), isAr ? margin + totalBoxWidth : pageWidth - margin - totalBoxWidth, finalY + 28, { align: isAr ? 'right' : 'left' });
  doc.text(isAr ? fixArabic(totalValue) : totalValue, isAr ? margin : pageWidth - margin, finalY + 28, { align: isAr ? 'left' : 'right' });
  
  // Footer
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const footerText = isAr ? fixArabic('شكراً لتعاملكم معنا') : 'Thank you for your business';
  doc.text(footerText, pageWidth / 2, 285, { align: 'center' });
  
  doc.save(`Invoice-${invoice.number}.pdf`);
};

