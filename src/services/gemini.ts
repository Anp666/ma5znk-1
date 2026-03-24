import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const financialTools = [
  {
    name: "get_inventory_data",
    description: "Get current inventory status, including product names, quantities, and low stock alerts.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        filter: {
          type: Type.STRING,
          description: "Optional filter: 'all' or 'low_stock'",
        }
      }
    }
  },
  {
    name: "get_sales_data",
    description: "Get sales data and invoices for a specific period.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: "Period to analyze: 'today', 'this_week', 'this_month', or 'all'",
        }
      },
      required: ["period"]
    }
  },
  {
    name: "get_treasury_data",
    description: "Get treasury transactions and current balance.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.NUMBER,
          description: "Number of recent transactions to return",
        }
      }
    }
  },
  {
    name: "get_suppliers_data",
    description: "Get list of suppliers and their current balances.",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  },
  {
    name: "get_reports_summary",
    description: "Get a summary of financial reports including total sales, purchases, and profit.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        period: {
          type: Type.STRING,
          description: "Period: 'this_month', 'last_month', or 'all'",
        }
      }
    }
  }
];

export const generateFinancialResponse = async (messages: any[], tools: any[] = []) => {
  const model = "gemini-3-flash-preview";
  
  const response = await ai.models.generateContent({
    model,
    contents: messages,
    config: {
      systemInstruction: `
        You are Makhzanak AI (المساعد المالي الذكي), a professional financial and inventory assistant for the "Makhzanak" platform.
        Your goal is to provide real business insights based on the user's data.
        
        Guidelines:
        1. ALWAYS use the provided tools to fetch data before answering questions about sales, inventory, or finances.
        2. If the user asks a generic question, you can answer directly, but prefer data-driven answers.
        3. Format your responses using Markdown.
        4. Use tables and bullet points for clarity.
        5. If the data suggests a trend (e.g., declining sales or low stock), provide a proactive insight or recommendation.
        6. Respond in the same language as the user (Arabic or English).
        7. For charts, describe the data in a way that the UI can render it (e.g., "CHART_DATA: [JSON_DATA]").
      `,
      tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined,
    },
  });

  return response;
};

export const parseVoiceCommand = async (transcript: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `
      Extract product information from this voice command: "${transcript}"
      Return a JSON object with: name, price, quantity.
      Example: "Add product Coca Cola price 20 quantity 50" -> { "name": "Coca Cola", "price": 20, "quantity": 50 }
    `,
    config: {
      responseMimeType: "application/json"
    }
  });
  
  try {
    return JSON.parse(response.text || '{}');
  } catch (e) {
    return null;
  }
};
