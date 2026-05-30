import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Initialize Express
const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header if API key exists
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Helper to fetch stock history from Yahoo Finance v8 Chart API with fallback variants
async function fetchYahooFinanceData(ticker: string, startDateSec: number, endDateSec: number) {
  const cleanTicker = ticker.trim().toUpperCase();
  const variants: string[] = [];

  // Parse prefixes like "NSE:NETWEB" or "BSE:NETWEB"
  if (cleanTicker.includes(":")) {
    const parts = cleanTicker.split(":");
    const exchange = parts[0].trim();
    const symbol = parts[1].trim();
    if (exchange === "NSE") {
      variants.push(`${symbol}.NS`);
    } else if (exchange === "BSE") {
      variants.push(`${symbol}.BO`);
    } else {
      variants.push(symbol);
    }
  }

  // Common index alias mapping
  if (cleanTicker === "NIFTY" || cleanTicker === "NIFTY50" || cleanTicker === "NIFTY 50" || cleanTicker === "NSEI") {
    variants.push("^NSEI");
  } else if (cleanTicker === "SENSEX" || cleanTicker === "BSESN") {
    variants.push("^BSESN");
  }

  // Push the original ticker as is (if not already pushed)
  if (!variants.includes(cleanTicker)) {
    variants.push(cleanTicker);
  }

  // If no extension, add NSE / BSE suffixes as variants
  if (!cleanTicker.includes(".") && !cleanTicker.startsWith("^") && !cleanTicker.includes(":")) {
    variants.push(`${cleanTicker}.NS`);
    variants.push(`${cleanTicker}.BO`);
  }

  let finalData: any[] | null = null;
  let lastError: any = null;

  for (const variant of variants) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(variant)}?period1=${startDateSec}&period2=${endDateSec}&interval=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} - Ticker might be invalid or Yahoo Finance is throttling requests.`);
      }

      const json = await response.json() as any;
      const result = json?.chart?.result?.[0];
      if (!result) {
        throw new Error(`No chart results found for ticker "${variant}". Verify if it is correct.`);
      }

      const timestamps = result.timestamp || [];
      const adjclose = result.indicators?.adjclose?.[0]?.adjclose || [];
      const close = result.indicators?.quote?.[0]?.close || [];

      const data = [];
      for (let i = 0; i < timestamps.length; i++) {
        // Fallback to Close if Adj Close is missing
        const price = adjclose[i] !== undefined && adjclose[i] !== null ? adjclose[i] : close[i];
        if (price !== undefined && price !== null) {
          const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
          data.push({ date, price: Number(price) });
        }
      }

      if (data.length === 0) {
        throw new Error(`Data is empty for symbol "${variant}" in the requested date range.`);
      }

      finalData = data;
      break; // Success! Break out of the loop
    } catch (err: any) {
      lastError = err;
    }
  }

  if (finalData) {
    return finalData;
  }

  throw lastError || new Error(`No historical data could be retrieved for ticker "${ticker}" or any of its standard variants.`);
}

// Local references for solid auto-completions and fallback searches
const LOCAL_BENCHMARKS = [
  { symbol: "^NSEI", name: "Nifty 50", exchange: "NSE", type: "INDEX" },
  { symbol: "^BSESN", name: "S&P BSE Sensex", exchange: "BSE", type: "INDEX" },
  { symbol: "^NIFTNXT50", name: "Nifty Next 50", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX100", name: "Nifty 100", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX200", name: "Nifty 200", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX500", name: "Nifty 500", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX500", name: "Nifty Total Market (Proxy: Nifty 500)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX200", name: "Nifty LargeMidcap 250 (Proxy: Nifty 200)", exchange: "NSE", type: "INDEX" },
  { symbol: "^NSEMDCP50", name: "Nifty Midcap 50", exchange: "NSE", type: "INDEX" },
  { symbol: "^NSMIDCP", name: "Nifty Midcap 100", exchange: "NSE", type: "INDEX" },
  { symbol: "^NSMIDCP", name: "Nifty Midcap 150 (Proxy: Midcap 100)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXSC", name: "Nifty Smallcap 50 (Proxy: Smallcap 100)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXSC", name: "Nifty Smallcap 100", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXSC", name: "Nifty Smallcap 250 (Proxy: Smallcap 100)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXSC", name: "Nifty Smallcap 500 (Proxy: Smallcap 100)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXSC", name: "Nifty Microcap 250 (Proxy: Smallcap 100)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX500", name: "Nifty500 Multicap 50:25:25 (Proxy: Nifty 500)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX500", name: "Nifty500 LargeMidSmall Equal-Cap Weighted (Proxy: Nifty 500)", exchange: "NSE", type: "INDEX" },

  { symbol: "^NSEBANK", name: "Nifty Bank", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXFIN", name: "Nifty Financial Services", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXFIN", name: "Nifty Financial Services 25/50 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXFIN", name: "Nifty Financial Services Ex-Bank (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXIT", name: "Nifty IT", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXFMCG", name: "Nifty FMCG", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXAUTO", name: "Nifty Auto", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXPHARMA", name: "Nifty Pharma", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXPHARMA", name: "Nifty Healthcare (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXREALTY", name: "Nifty Realty", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXMETAL", name: "Nifty Metal", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXMEDIA", name: "Nifty Media", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXENERGY", name: "Nifty Oil & Gas (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXFMCG", name: "Nifty Consumer Durables (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^NIFTY_PVT_BANK", name: "Nifty Private Bank", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXPSUBANK", name: "Nifty PSU Bank", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXPHARMA", name: "Nifty Chemicals (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXINFRA", name: "Nifty Cement (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXREALTY", name: "Nifty REITs & Realty (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXSERVICE", name: "Nifty Services Sector", exchange: "NSE", type: "INDEX" },

  { symbol: "^CNXENERGY", name: "Nifty Energy", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXCMDT", name: "Nifty Commodities", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXCPSE", name: "Nifty CPSE", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXCONSUM", name: "Nifty India Consumption", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXINFRA", name: "Nifty India Defence (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXIT", name: "Nifty India Digital (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXFIN", name: "Nifty Capital Markets (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXREALTY", name: "Nifty Housing (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXREALTY", name: "Nifty Core Housing (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXINFRA", name: "Nifty Infrastructure & Logistics", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNXAUTO", name: "Nifty EV & New Age Automotive (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^NSEI", name: "Nifty Conglomerate 50 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX100", name: "Nifty100 ESG (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX100", name: "Nifty100 ESG Sector Leaders (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX100", name: "Nifty100 Enhanced ESG (Proxy)", exchange: "NSE", type: "INDEX" },

  { symbol: "^NSEI", name: "Nifty Alpha 50 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^NSEI", name: "Nifty Alpha Low Volatility 30 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^NSEI", name: "Nifty Quality 30 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^NSEI", name: "Nifty Low Volatility 50 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^NSEI", name: "Nifty Value 20 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^NSEI", name: "Nifty Momentum 30 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX200", name: "Nifty200 Momentum 30 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX200", name: "Nifty200 Quality 30 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX200", name: "Nifty200 Alpha 30 (Proxy)", exchange: "NSE", type: "INDEX" },
  { symbol: "^CNX100", name: "Nifty100 Equal Weight (Proxy)", exchange: "NSE", type: "INDEX" },

  { symbol: "^BSESN", name: "S&P BSE Sensex 50 (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSESN", name: "S&P BSE Sensex Next 50 (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSE100", name: "S&P BSE 100", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSE200", name: "S&P BSE 200", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSE500", name: "S&P BSE 500", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEMID", name: "BSE MidCap", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSESML", name: "BSE SmallCap", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSE100", name: "BSE LargeCap (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSE200", name: "BSE India 150 (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEMID", name: "BSE Focused Midcap (Proxy)", exchange: "BSE", type: "INDEX" },

  { symbol: "^BSEBANK", name: "BSE Bankex", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEAUTO", name: "BSE Auto (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSECGC", name: "BSE Capital Goods (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSECD", name: "BSE Consumer Durables (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEFMCG", name: "BSE FMCG (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEHC", name: "BSE Healthcare (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEIT", name: "BSE IT (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEMETAL", name: "BSE Metal (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEOIL", name: "BSE Oil & Gas (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEPOWER", name: "BSE Power (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEREALTY", name: "BSE Realty (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSETE", name: "BSE Telecom (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEPSU", name: "BSE PSU (Proxy: Sensex)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEBANK", name: "BSE Private Banks (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSEBANK", name: "BSE PSU Bank (Proxy)", exchange: "BSE", type: "INDEX" },

  { symbol: "^BSE500", name: "BSE Bharat 22 (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSE500", name: "BSE CPSE (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSE500", name: "BSE India Infrastructure (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSE500", name: "BSE India Manufacturing (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSESN", name: "BSE India Sector Leaders (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSE100", name: "BSE ESG Index (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSESN", name: "BSE Greenex (Proxy)", exchange: "BSE", type: "INDEX" },
  { symbol: "^BSESN", name: "BSE Carbonex (Proxy)", exchange: "BSE", type: "INDEX" },

  { symbol: "^GSPC", name: "S&P 500", exchange: "US", type: "INDEX" },
  { symbol: "^IXIC", name: "NASDAQ Composite", exchange: "US", type: "INDEX" },
  { symbol: "^DJI", name: "Dow Jones Industrial Average", exchange: "US", type: "INDEX" },
  { symbol: "^FTSE", name: "FTSE 100", exchange: "UK", type: "INDEX" },
  { symbol: "^N225", name: "Nikkei 225", exchange: "Japan", type: "INDEX" },
  { symbol: "^HSI", name: "Hang Seng Index", exchange: "Hong Kong", type: "INDEX" },
];

const LOCAL_EQUITIES = [
  { ticker: "DABUR", name: "Dabur India Limited" },
  { ticker: "TCS", name: "Tata Consultancy Services Limited" },
  { ticker: "RELIANCE", name: "Reliance Industries Limited" },
  { ticker: "HDFCBANK", name: "HDFC Bank Limited" },
  { ticker: "INFY", name: "Infosys Limited" },
  { ticker: "ICICIBANK", name: "ICICI Bank Limited" },
  { ticker: "ITC", name: "ITC Limited" },
  { ticker: "SBIN", name: "State Bank of India" },
  { ticker: "BHARTIARTL", name: "Bharti Airtel Limited" },
  { ticker: "HINDUNILVR", name: "Hindustan Unilever Limited" },
  { ticker: "LTIM", name: "LTIMindtree Limited" },
  { ticker: "WIPRO", name: "Wipro Limited" },
  { ticker: "LT", name: "Larsen & Toubro Limited" },
  { ticker: "TATAMOTORS", name: "Tata Motors Limited" },
  { ticker: "M&M", name: "Mahindra & Mahindra Limited" },
  { ticker: "KOTAKBANK", name: "Kotak Mahindra Bank Limited" },
  { ticker: "AXISBANK", name: "Axis Bank Limited" },
  { ticker: "ASIANPAINT", name: "Asian Paints Limited" },
  { ticker: "SUNPHARMA", name: "Sun Pharmaceutical Industries Limited" },
  { ticker: "MARUTI", name: "Maruti Suzuki India Limited" },
  { ticker: "ULTRACEMCO", name: "UltraTech Cement Limited" },
  { ticker: "TITAN", name: "Titan Company Limited" },
  { ticker: "ADANIENT", name: "Adani Enterprises Limited" },
  { ticker: "BAJFINANCE", name: "Bajaj Finance Limited" },
  { ticker: "JSWSTEEL", name: "JSW Steel Limited" },
  { ticker: "TATASTEEL", name: "Tata Steel Limited" },
  { ticker: "POWERGRID", name: "Power Grid Corporation of India Limited" },
  { ticker: "NTPC", name: "NTPC Limited" },
  { ticker: "COALINDIA", name: "Coal India Limited" },
  { ticker: "BPCL", name: "Bharat Petroleum Corporation Limited" },
  { ticker: "IOC", name: "Indian Oil Corporation Limited" },
  { ticker: "ONGC", name: "Oil and Natural Gas Corporation Limited" },
  { ticker: "HEROMOTOCO", name: "Hero MotoCorp Limited" },
  { ticker: "BAJAJ-AUTO", name: "Bajaj Auto Limited" },
  { ticker: "EICHERMOT", name: "Eicher Motors Limited" },
  { ticker: "GRASIM", name: "Grasim Industries Limited" },
  { ticker: "HINDALCO", name: "Hindalco Industries Limited" },
  { ticker: "JIOFIN", name: "Jio Financial Services Limited" },
  { ticker: "TATACONSUM", name: "Tata Consumer Products Limited" },
  { ticker: "TECHM", name: "Tech Mahindra Limited" },
  { ticker: "HCLTECH", name: "HCL Technologies Limited" },
  { ticker: "CIPLA", name: "Cipla Limited" },
  { ticker: "DRREDDY", name: "Dr. Reddy's Laboratories Limited" },
  { ticker: "DIVISLAB", name: "Divi's Laboratories Limited" },
  { ticker: "APOLLOHOSP", name: "Apollo Hospitals Enterprise Limited" },
  { ticker: "BRITANNIA", name: "Britannia Industries Limited" },
  { ticker: "NESTLEIND", name: "Nestle India Limited" },
  { ticker: "SBILIFE", name: "SBI Life Insurance Company Limited" },
  { ticker: "HDFCLIFE", name: "HDFC Life Insurance Company Limited" },
  { ticker: "INDUSINDBK", name: "IndusInd Bank Limited" },
  { ticker: "SHRIRAMFIN", name: "Shriram Finance Limited" },
];

interface SearchSuggestion {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

// Endpoint: Search/Suggest Ticker Symbols
app.get("/api/search-ticker", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  const indexOnly = req.query.indexOnly === "true";

  if (!query) {
    if (indexOnly) {
      return res.json({ results: LOCAL_BENCHMARKS });
    }
    return res.json({ results: [] });
  }

  const queryUpper = query.toUpperCase();

  // Benchmark index search
  if (indexOnly) {
    const matchedBenchmarks = LOCAL_BENCHMARKS.filter(b => 
      b.symbol.toUpperCase().includes(queryUpper) || 
      b.name.toUpperCase().includes(queryUpper)
    );

    try {
      const response = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=0`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const json = await response.json() as any;
        const quotes = json?.quotes || [];
        const indexQuotes = quotes
          .filter((q: any) => q.quoteType === "INDEX" || q.quoteType === "MUTUALFUND" || q.symbol?.startsWith("^"))
          .map((q: any) => ({
            symbol: q.symbol,
            name: q.shortname || q.longname || q.symbol,
            exchange: q.exchange || q.exchDisp || "INDEX",
            type: "INDEX"
          }));

        const seenSymbols = new Set(matchedBenchmarks.map(b => b.symbol));
        const merged = [...matchedBenchmarks];
        for (const iq of indexQuotes) {
          if (!seenSymbols.has(iq.symbol)) {
            seenSymbols.add(iq.symbol);
            merged.push(iq);
          }
        }
        return res.json({ results: merged.slice(0, 10) });
      }
    } catch (err) {
      console.warn("Live benchmark search failed, returning local presets", err);
    }
    return res.json({ results: matchedBenchmarks.slice(0, 10) });
  }

  // Stock / Equity search
  const localMatches: SearchSuggestion[] = [];
  for (const eq of LOCAL_EQUITIES) {
    if (eq.ticker.includes(queryUpper) || eq.name.toUpperCase().includes(queryUpper)) {
      localMatches.push({
        symbol: `${eq.ticker}.NS`,
        name: `${eq.name} (NSE)`,
        exchange: "NSE",
        type: "EQUITY"
      });
      localMatches.push({
        symbol: `${eq.ticker}.BO`,
        name: `${eq.name} (BSE)`,
        exchange: "BSE",
        type: "EQUITY"
      });
    }
  }

  try {
    const response = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=0`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (response.ok) {
      const json = await response.json() as any;
      const quotes = json?.quotes || [];
      const yahooMatches = quotes
        .filter((q: any) => q.quoteType === "EQUITY" || q.quoteType === "INDEX")
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.shortname || q.longname || q.symbol,
          exchange: q.exchange || q.exchDisp || "",
          type: q.quoteType
        }));

      const seenSymbols = new Set();
      const combined: SearchSuggestion[] = [];

      // Add local matches first to guarantee instant NSE and BSE options
      for (const lm of localMatches) {
        if (!seenSymbols.has(lm.symbol)) {
          seenSymbols.add(lm.symbol);
          combined.push(lm);
        }
      }

      // Add Yahoo matches
      for (const ym of yahooMatches) {
        if (!seenSymbols.has(ym.symbol)) {
          seenSymbols.add(ym.symbol);
          combined.push(ym);
        }
      }

      return res.json({ results: combined.slice(0, 12) });
    }
  } catch (err) {
    console.error("Live Yahoo stock search failed:", err);
  }

  return res.json({ results: localMatches.slice(0, 12) });
});

// Endpoint: Fetch multiple ticker histories safely and in parallel
app.get("/api/stock-history", async (req, res) => {
  const tickersStr = req.query.tickers as string;
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  if (!tickersStr) {
    return res.status(400).json({ error: "Missing tickers query parameter" });
  }

  const tickers = tickersStr.split(",").map(t => t.trim().toUpperCase());
  // Benchmark/stocks from the given start date to standard or custom end date
  const startSec = Math.floor(new Date(startDateStr || "2024-01-01").getTime() / 1000);
  const endSec = endDateStr ? Math.floor(new Date(endDateStr).getTime() / 1000) : Math.floor(Date.now() / 1000);

  const results: Record<string, { success: boolean; data?: any[]; error?: string }> = {};

  await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const data = await fetchYahooFinanceData(ticker, startSec, endSec);
        results[ticker] = { success: true, data };
      } catch (err: any) {
        console.error(`Error fetching ticker ${ticker}:`, err.message);
        results[ticker] = { success: false, error: err.message };
      }
    })
  );

  res.json({ results });
});

// Endpoint: Call server-side Gemini to get portfolio review and professional recommendations
app.post("/api/portfolio-insights", async (req, res) => {
  const { metrics, portfolioSetup } = req.body;

  if (!ai) {
    return res.status(400).json({ 
      error: "Gemini API integration is not configured or GEMINI_API_KEY environmental variable is missing. Configure it in Settings > Secrets." 
    });
  }

  try {
    const prompt = `You are a high-caliber Quantitative Analyst and Portfolio Manager.
Review the following portfolio metrics and setup:
Assets Held: ${JSON.stringify(portfolioSetup)}
Historical Stats: ${JSON.stringify(metrics)}

Provide a concise, premium structured markdown critique (maximum 280 words):
1. **Risk-Adjusted Return Profile**: Summarize Sharpe (${metrics.sharpeRatio?.toFixed(2)}), Sortino (${metrics.sortinoRatio?.toFixed(2)}), Volatility (${(metrics.annualizedVolatility * 100)?.toFixed(1)}%), and Max Drawdown (${(metrics.maxDrawdown * 100)?.toFixed(1)}%).
2. **Benchmark Comparison**: Commentary on Beta (${metrics.beta?.toFixed(2)}) and Alpha (${metrics.alpha !== undefined ? (metrics.alpha * 100)?.toFixed(2) + '%' : 'N/A'}) compared to the benchmark tracker.
3. **Quantitative Allocations**: Highlight any dynamic over-exposure issues and propose exactly two clear mathematical adjustments (e.g. standard correlation adjustment or risk-parity buffer weights) to boost overall Sharpe and Sortino ratios.

Ensure writing is intellectual, calm, direct, and elite. Do not include introductory conversational pleasantries ("Here is the report"). Start immediately with the headers.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error("Gemini call failed:", err.message);
    res.status(500).json({ error: `AI analysis retrieval failed: ${err.message}` });
  }
});

// Integrate Vite development server or production build static folder
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Serve HTML
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Portfolio Performance Analyzer server listening on Port ${PORT}`);
  });
}

initializeServer();
