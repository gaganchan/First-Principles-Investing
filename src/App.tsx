/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, FormEvent } from "react";
import { 
  Briefcase, 
  TrendingUp, 
  Calculator, 
  Plus, 
  Trash2, 
  Calendar, 
  AlertCircle, 
  Percent, 
  Activity, 
  Sparkles, 
  RefreshCw, 
  Sliders, 
  Search, 
  DollarSign,
  Download,
  CheckCircle2,
  CalendarCheck,
  TrendingDown,
  ChevronRight,
  ChevronLeft,
  Info,
  Play,
  Maximize2,
  Minimize2,
  X
} from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ReferenceLine
} from "recharts";
import { motion, AnimatePresence } from "motion/react";

import { Holding, DailyDataPoint, PortfolioMetrics } from "./types";
import { analyzePortfolio, computeAnnualReturns, AnnualReturnPoint } from "./utils";
import { INDICES_REGISTRY } from "./data/benchmarks";

// Default initial holdings representing Apple, Microsoft, and Nvidia bought at early 2024 dates
const INITIAL_HOLDINGS: Holding[] = [
  {
    id: "1",
    ticker: "AAPL",
    quantity: 40,
    purchasePrice: 0,
    purchaseDate: "2024-02-15",
    hasSaleDate: false,
  },
  {
    id: "2",
    ticker: "MSFT",
    quantity: 25,
    purchasePrice: 0,
    purchaseDate: "2024-03-10",
    hasSaleDate: false,
  },
  {
    id: "3",
    ticker: "NVDA",
    quantity: 80,
    purchasePrice: 0,
    purchaseDate: "2024-05-12",
    hasSaleDate: false,
  }
];

export const TICKER_COLORS = [
  "#38bdf8", // Sky blue
  "#fb923c", // Orange
  "#c084fc", // Purple
  "#f472b6", // Pink
  "#2dd4bf", // Teal
  "#fb7185", // Rose
  "#60a5fa", // Blue
  "#e879f9", // Fuchsia
  "#fbbf24", // Amber
  "#a7f3d0", // Light Emerald
];

export default function App() {
  // --- STATE ---
  // Portfolio state
  const [holdings, setHoldings] = useState<Holding[]>(() => {
    const saved = localStorage.getItem("portfolio_holdings");
    return saved ? JSON.parse(saved) : INITIAL_HOLDINGS;
  });

  const uniqueTickers = useMemo(() => {
    return Array.from(new Set(holdings.map(h => h.ticker.toUpperCase())));
  }, [holdings]);

  // Global inputs state
  const [benchmarkTicker, setBenchmarkTicker] = useState<string>(() => {
    return localStorage.getItem("portfolio_benchmark") || "SPY";
  });
  const [benchmarkInput, setBenchmarkInput] = useState<string>(benchmarkTicker);
  const [inflationRate, setInflationRate] = useState<number>(2.5); // Inflation %
  const [riskFreeRate, setRiskFreeRate] = useState<number>(4.2); // Risk-Free Rate %
  const [analysisEndDate, setAnalysisEndDate] = useState<string>(() => {
    return localStorage.getItem("portfolio_analysis_end_date") || "";
  });

  // Active view tab state
  const [activeTab, setActiveTab] = useState<"setup" | "dashboard" | "stats" | "math">("dashboard");

  // Form input states
  const [inputTicker, setInputTicker] = useState("");
  const [inputQuantity, setInputQuantity] = useState("");
  const [inputPurchaseDate, setInputPurchaseDate] = useState("");
  const [hasSaleDate, setHasSaleDate] = useState(false);
  const [inputSaleDate, setInputSaleDate] = useState("");
  const [formError, setFormError] = useState("");

  // Autocomplete search suggestions states
  const [tickerSuggestions, setTickerSuggestions] = useState<any[]>([]);
  const [showTickerDropdown, setShowTickerDropdown] = useState(false);
  const [isSearchingTicker, setIsSearchingTicker] = useState(false);

  const [benchmarkSuggestions, setBenchmarkSuggestions] = useState<any[]>([]);
  const [showBenchmarkDropdown, setShowBenchmarkDropdown] = useState(false);
  const [isSearchingBenchmark, setIsSearchingBenchmark] = useState(false);
  
  // Index Explorer Directory State
  const [showIndexExplorer, setShowIndexExplorer] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [explorerFilterSource, setExplorerFilterSource] = useState<"ALL" | "NSE" | "BSE">("ALL");
  const [explorerFilterCategory, setExplorerFilterCategory] = useState<"ALL" | "Broad Market" | "Sectoral" | "Thematic" | "Popular Strategy">("ALL");

  // Debounced effect for Asset/Ticker suggestions
  useEffect(() => {
    const q = inputTicker.trim();
    if (!q) {
      setTickerSuggestions([]);
      setIsSearchingTicker(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingTicker(true);
      try {
        const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.toLowerCase().includes("application/json")) {
            const data = await res.json();
            // Keep showing if query hasn't changed in the meantime
            setTickerSuggestions(data.results || []);
          } else {
            setTickerSuggestions([]);
          }
        }
      } catch (err) {
        console.error("Error fetching ticker suggestions:", err);
      } finally {
        setIsSearchingTicker(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputTicker]);

  // Debounced effect for Benchmark Ticker suggestions
  useEffect(() => {
    const q = benchmarkInput.trim();
    const timer = setTimeout(async () => {
      setIsSearchingBenchmark(true);
      try {
        const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(q)}&indexOnly=true`);
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.toLowerCase().includes("application/json")) {
            const data = await res.json();
            setBenchmarkSuggestions(data.results || []);
          } else {
            setBenchmarkSuggestions([]);
          }
        }
      } catch (err) {
        console.error("Error fetching benchmark suggestions:", err);
      } finally {
        setIsSearchingBenchmark(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [benchmarkInput]);

  // Grid pipeline states
  const [isLoading, setIsLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [dailyData, setDailyData] = useState<DailyDataPoint[]>([]);
  const [resolvedHoldings, setResolvedHoldings] = useState<Holding[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [annualReturns, setAnnualReturns] = useState<AnnualReturnPoint[]>([]);
  const [pricesData, setPricesData] = useState<Record<string, any[]>>({});

  // Memoized merged holdings incorporating resolved historical prices
  const mergedHoldings = useMemo(() => {
    return holdings.map(h => {
      const match = resolvedHoldings.find(rh => rh.id === h.id);
      return {
        ...h,
        purchasePrice: match ? match.purchasePrice : h.purchasePrice
      };
    });
  }, [holdings, resolvedHoldings]);

  // Date filtering state
  const [timeFilter, setTimeFilter] = useState<"6M" | "1Y" | "2Y" | "5Y" | "ALL">("ALL");

  // Sidebar fold/expand state 
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem("sidebar_expanded");
    return saved !== "false";
  });

  // Maximized chart modal state
  const [maximizedChart, setMaximizedChart] = useState<"growth" | "drawdown" | "annual" | "returns" | null>(null);

  // Customized crash shock state for Historical Stress Tests
  const [customCrashShock, setCustomCrashShock] = useState<number>(-25);

  // Filtered dataset computed targets
  const filteredDailyData = useMemo(() => {
    if (dailyData.length === 0) return [];
    if (timeFilter === "ALL") return dailyData;
    
    const lastPoint = dailyData[dailyData.length - 1];
    const maxDate = lastPoint ? new Date(lastPoint.date) : new Date();
    
    const cutoffDate = new Date(maxDate);
    if (timeFilter === "6M") {
      cutoffDate.setMonth(cutoffDate.getMonth() - 6);
    } else if (timeFilter === "1Y") {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
    } else if (timeFilter === "2Y") {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);
    } else if (timeFilter === "5Y") {
      cutoffDate.setFullYear(cutoffDate.getFullYear() - 5);
    }
    
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    return dailyData.filter(d => d.date >= cutoffStr);
  }, [dailyData, timeFilter]);

  const filteredAnnualReturns = useMemo(() => {
    if (filteredDailyData.length === 0) return [];
    const representedYears = new Set(filteredDailyData.map(d => d.date.substring(0, 4)));
    return annualReturns.filter(item => representedYears.has(String(item.year)));
  }, [annualReturns, filteredDailyData]);

  const statsMetrics = useMemo(() => {
    if (filteredDailyData.length < 2 || Object.keys(pricesData).length === 0) return null;

    const pfReturns = filteredDailyData.map(d => d.portfolioDailyReturn);
    const bmReturns = filteredDailyData.map(d => d.benchmarkDailyReturn);
    const n = pfReturns.length;

    // Descriptive
    const pfMeanDaily = pfReturns.reduce((su, x) => su + x, 0) / n;
    const bmMeanDaily = bmReturns.reduce((su, x) => su + x, 0) / n;
    
    const pfMeanAnnual = pfMeanDaily * 252;
    const bmMeanAnnual = bmMeanDaily * 252;

    const pfSDDaily = Math.sqrt(pfReturns.reduce((su, x) => su + Math.pow(x - pfMeanDaily, 2), 0) / (n - 1 || 1));
    const bmSDDaily = Math.sqrt(bmReturns.reduce((su, x) => su + Math.pow(x - bmMeanDaily, 2), 0) / (n - 1 || 1));

    const pfSDAnnual = pfSDDaily * Math.sqrt(252);
    const bmSDAnnual = bmSDDaily * Math.sqrt(252);

    const skewness = (arr: number[], mean: number, sd: number) => {
      if (arr.length < 3 || sd === 0) return 0;
      const sum3 = arr.reduce((su, x) => su + Math.pow(x - mean, 3), 0);
      return (sum3 / arr.length) / Math.pow(sd, 3);
    };

    const kurtosis = (arr: number[], mean: number, sd: number) => {
      if (arr.length < 4 || sd === 0) return 0;
      const sum4 = arr.reduce((su, x) => su + Math.pow(x - mean, 4), 0);
      return (sum4 / arr.length) / Math.pow(sd, 4) - 3;
    };

    const median = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const pfSkew = skewness(pfReturns, pfMeanDaily, pfSDDaily);
    const bmSkew = skewness(bmReturns, bmMeanDaily, bmSDDaily);

    const pfKurt = kurtosis(pfReturns, pfMeanDaily, pfSDDaily);
    const bmKurt = kurtosis(bmReturns, bmMeanDaily, bmSDDaily);

    const pfMedian = median(pfReturns);
    const bmMedian = median(bmReturns);

    const pfMin = Math.min(...pfReturns);
    const bmMin = Math.min(...bmReturns);

    const pfMax = Math.max(...pfReturns);
    const bmMax = Math.max(...bmReturns);

    const pfWinRateCorrect = (pfReturns.filter(x => x > 0).length / n) * 100;
    const bmWinRateCorrect = (bmReturns.filter(x => x > 0).length / n) * 100;

    // Tracking Error & Information Ratio
    const activeReturns = pfReturns.map((r, idx) => r - bmReturns[idx]);
    const meanActive = activeReturns.reduce((su, x) => su + x, 0) / n;
    const activeVar = activeReturns.reduce((su, x) => su + Math.pow(x - meanActive, 2), 0) / (n - 1 || 1);
    const trackingError = Math.sqrt(activeVar) * Math.sqrt(252);

    // Pearson Correlation
    const computeCorrelationInner = (sA: number[] | undefined, sB: number[] | undefined) => {
      if (!sA || !sB || sA.length < 2 || sA.length !== sB.length) return 0;
      const mA = sA.reduce((su, v) => su + v, 0) / sA.length;
      const mB = sB.reduce((su, v) => su + v, 0) / sB.length;
      let covSum = 0;
      let varA = 0;
      let varB = 0;
      for (let i = 0; i < sA.length; i++) {
        const dA = sA[i] - mA;
        const dB = sB[i] - mB;
        covSum += dA * dB;
        varA += dA * dA;
        varB += dB * dB;
      }
      if (varA === 0 || varB === 0) return 0;
      return covSum / Math.sqrt(varA * varB);
    };

    const correlation = computeCorrelationInner(pfReturns, bmReturns);
    const rSquared = correlation * correlation;

    // Coefficient of Variation (CV) computations
    const pfCVDaily = Math.abs(pfMeanDaily) > 0.000001 ? (pfSDDaily / pfMeanDaily) : 0;
    const pfCVAnnual = Math.abs(pfMeanAnnual) > 0.000001 ? (pfSDAnnual / pfMeanAnnual) : 0;
    const bmCVDaily = Math.abs(bmMeanDaily) > 0.000001 ? (bmSDDaily / bmMeanDaily) : 0;
    const bmCVAnnual = Math.abs(bmMeanAnnual) > 0.000001 ? (bmSDAnnual / bmMeanAnnual) : 0;

    // Regression model & parameters of Portfolio (Y) vs Benchmark (X)
    let regressionBeta = 0;
    let regressionAlphaDaily = 0;
    let regressionAlphaAnnual = 0;
    let regressionRSquared = rSquared;
    let regressionRSEDaily = 0;
    let regressionRSEAnnual = 0;
    let regressionTStat = 0;

    if (n >= 3) {
      const xMean = bmMeanDaily;
      const yMean = pfMeanDaily;

      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        const xDiff = bmReturns[i] - xMean;
        const yDiff = pfReturns[i] - yMean;
        num += xDiff * yDiff;
        den += xDiff * xDiff;
      }

      if (den > 0) {
        regressionBeta = num / den;
        regressionAlphaDaily = yMean - (regressionBeta * xMean);
        regressionAlphaAnnual = regressionAlphaDaily * 252;

        let rss = 0;
        for (let i = 0; i < n; i++) {
          const predY = regressionAlphaDaily + regressionBeta * bmReturns[i];
          rss += Math.pow(pfReturns[i] - predY, 2);
        }
        const df = n - 2;
        const residualVar = rss / (df > 0 ? df : 1);
        regressionRSEDaily = Math.sqrt(residualVar);
        regressionRSEAnnual = regressionRSEDaily * Math.sqrt(252);

        const seBeta = regressionRSEDaily / Math.sqrt(den);
        if (seBeta > 0) {
          regressionTStat = regressionBeta / seBeta;
        }
      }
    }

    // Prepare exact scatter, residuals, and rolling metrics datasets for regression visualization
    const regressionScatterData = filteredDailyData.map((d) => {
      const predY = regressionAlphaDaily + regressionBeta * d.benchmarkDailyReturn;
      const residual = d.portfolioDailyReturn - predY;
      return {
        date: d.date,
        x: Number((d.benchmarkDailyReturn * 100).toFixed(4)), // in %
        y: Number((d.portfolioDailyReturn * 100).toFixed(4)), // in %
        predictedY: Number((predY * 100).toFixed(4)), // in %
        residual: Number((residual * 100).toFixed(4)) // in %
      };
    });

    const regressionLineData = [...regressionScatterData]
      .sort((a, b) => a.x - b.x)
      .map(p => ({ x: p.x, y: p.predictedY }));

    const rollingMetrics: Array<{ date: string; beta: number; rSquared: number }> = [];
    const rollingWindow = Math.min(60, Math.max(5, n)); // use up to 60 days, boundary check
    if (n >= 5) {
      for (let i = rollingWindow - 1; i < n; i++) {
        const date = filteredDailyData[i].date;
        const slicePf = pfReturns.slice(i - rollingWindow + 1, i + 1);
        const sliceBm = bmReturns.slice(i - rollingWindow + 1, i + 1);
        
        const sumPf = slicePf.reduce((s, val) => s + val, 0);
        const sumBm = sliceBm.reduce((s, val) => s + val, 0);
        const meanPf = sumPf / rollingWindow;
        const meanBm = sumBm / rollingWindow;
        
        let num = 0;
        let denSlice = 0;
        let varPf = 0;
        for (let k = 0; k < rollingWindow; k++) {
          const diffBm = sliceBm[k] - meanBm;
          const diffPf = slicePf[k] - meanPf;
          num += diffBm * diffPf;
          denSlice += diffBm * diffBm;
          varPf += diffPf * diffPf;
        }
        
        const b = denSlice > 0 ? num / denSlice : 0;
        let rSq = 0;
        if (denSlice > 0 && varPf > 0) {
          const corr = num / Math.sqrt(denSlice * varPf);
          rSq = corr * corr;
        }
        
        rollingMetrics.push({
          date,
          beta: Number(b.toFixed(4)),
          rSquared: Number((rSq * 100).toFixed(2))
        });
      }
    }

    // VaR and CVaR
    const percentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.floor(p * (sorted.length - 1));
      return sorted[index];
    };

    // VaR reports positive loss, e.g. VaR 95 = -5th percentile
    const pfVaR95 = -percentile(pfReturns, 0.05);
    const pfVaR99 = -percentile(pfReturns, 0.01);
    const bmVaR95 = -percentile(bmReturns, 0.05);
    const bmVaR99 = -percentile(bmReturns, 0.01);

    // CVaR
    const pfCVaR95 = -pfReturns.filter(r => r <= -pfVaR95).reduce((s, x) => s + x, 0) / (pfReturns.filter(r => r <= -pfVaR95).length || 1);
    const pfCVaR99 = -pfReturns.filter(r => r <= -pfVaR99).reduce((s, x) => s + x, 0) / (pfReturns.filter(r => r <= -pfVaR99).length || 1);
    const bmCVaR95 = -bmReturns.filter(r => r <= -bmVaR95).reduce((s, x) => s + x, 0) / (bmReturns.filter(r => r <= -bmVaR95).length || 1);
    const bmCVaR99 = -bmReturns.filter(r => r <= -bmVaR99).reduce((s, x) => s + x, 0) / (bmReturns.filter(r => r <= -bmVaR99).length || 1);

    // Asset Dynamic Returns
    const tickers = Object.keys(pricesData);
    const assetReturns: Record<string, number[]> = {};
    tickers.forEach(t => {
      assetReturns[t] = [];
      const list = pricesData[t] || [];
      const priceMap = new Map<string, number>();
      list.forEach((item: any) => {
        if (item && item.date) {
          priceMap.set(String(item.date), Number(item.price ?? 0));
        }
      });
      let lastPrice = 0;
      const firstAvailable: any = list.find((item: any) => item && item.price !== undefined && item.price !== null);
      if (firstAvailable) lastPrice = Number(firstAvailable.price ?? 0);
      
      let prevPrice = 0;
      filteredDailyData.forEach((pt, index) => {
        let currentPrice = lastPrice;
        if (priceMap.has(pt.date)) {
          const p = priceMap.get(pt.date);
          if (p !== null && p !== undefined) {
            lastPrice = p;
            currentPrice = p;
          }
        }
        if (index === 0) {
          assetReturns[t].push(0);
        } else {
          const r = prevPrice > 0 ? (currentPrice - prevPrice) / prevPrice : 0;
          assetReturns[t].push(r);
        }
        prevPrice = currentPrice;
      });
    });

    // Correlation Matrix
    const correlationMatrix: Record<string, Record<string, number>> = {};
    const corrTickers = [...uniqueTickers, benchmarkTicker];
    corrTickers.forEach(tA => {
      correlationMatrix[tA] = {};
      corrTickers.forEach(tB => {
        correlationMatrix[tA][tB] = computeCorrelationInner(assetReturns[tA], assetReturns[tB]);
      });
    });

    // Individual Asset metrics
    const assetStats = uniqueTickers.map(ticker => {
      const returnsArr = assetReturns[ticker] || [];
      const assetN = returnsArr.length;
      const assetMeanDaily = returnsArr.reduce((su, x) => su + x, 0) / (assetN || 1);
      const assetMeanAnnual = assetMeanDaily * 252;
      const assetVar = returnsArr.reduce((su, x) => su + Math.pow(x - assetMeanDaily, 2), 0) / (assetN - 1 || 1);
      const assetSDDaily = Math.sqrt(assetVar);
      const assetSDAnnual = assetSDDaily * Math.sqrt(252);
      
      // Stock specific drawdown
      let stockPeak = 0;
      let stockMaxDD = 0;
      const list = pricesData[ticker] || [];
      const priceMap = new Map<string, number>();
      list.forEach((item: any) => {
        if (item && item.date) {
          priceMap.set(String(item.date), Number(item.price ?? 0));
        }
      });
      let lastPrice = 0;
      const firstAvailable: any = list.find((item: any) => item && item.price !== undefined && item.price !== null);
      if (firstAvailable) lastPrice = Number(firstAvailable.price ?? 0);
      
      filteredDailyData.forEach(pt => {
        let currentPrice = lastPrice;
        if (priceMap.has(pt.date)) {
          const p = priceMap.get(pt.date);
          if (p !== null && p !== undefined) {
            lastPrice = p;
            currentPrice = p;
          }
        }
        if (currentPrice > stockPeak) stockPeak = currentPrice;
        const dd = stockPeak > 0 ? (currentPrice - stockPeak) / stockPeak : 0;
        if (dd < stockMaxDD) stockMaxDD = dd;
      });

      // Simple CAGR of stock price in filtered dates
      let startPrice = 0;
      let endPrice = 0;
      filteredDailyData.forEach((pt, index) => {
        let currentPrice = lastPrice;
        if (priceMap.has(pt.date)) {
          const p = priceMap.get(pt.date);
          if (p !== null && p !== undefined) {
            lastPrice = p;
            currentPrice = p;
          }
        }
        if (index === 0) startPrice = currentPrice;
        if (index === filteredDailyData.length - 1) endPrice = currentPrice;
      });
      const d0 = new Date(filteredDailyData[0].date);
      const dN = new Date(filteredDailyData[filteredDailyData.length - 1].date);
      const diffDays = Math.max(1, (dN.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24));
      const yearsFraction = diffDays / 365.25;
      const stockCagr = startPrice > 0 ? (Math.pow(endPrice / startPrice, 1 / (yearsFraction || 1)) - 1) * 100 : 0;

      const stockSharpe = assetSDAnnual > 0 ? (stockCagr - riskFreeRate) / (assetSDAnnual * 100) : 0;
      const stockCorr = computeCorrelationInner(returnsArr, bmReturns);
      const stockSkew = skewness(returnsArr, assetMeanDaily, assetSDDaily);
      const stockKurt = kurtosis(returnsArr, assetMeanDaily, assetSDDaily);

      return {
        ticker,
        meanDaily: assetMeanDaily,
        meanAnnual: assetMeanAnnual,
        volDaily: assetSDDaily,
        volAnnual: assetSDAnnual,
        skew: stockSkew,
        kurt: stockKurt,
        cagr: stockCagr,
        sharpe: stockSharpe,
        maxDD: stockMaxDD,
        correlationWithBenchmark: stockCorr
      };
    });

    // Calculate Asset weights based on total cost
    const groups: Record<string, { ticker: string; totalCost: number }> = {};
    mergedHoldings.forEach((h) => {
      const ticker = h.ticker.toUpperCase();
      const cost = h.quantity * h.purchasePrice;
      if (!groups[ticker]) {
        groups[ticker] = { ticker, totalCost: 0 };
      }
      groups[ticker].totalCost += cost;
    });
    const totalCostOverall = Object.values(groups).reduce((sum, item) => sum + item.totalCost, 0);

    const assetWeights: Record<string, number> = {};
    Object.values(groups).forEach(item => {
      assetWeights[item.ticker] = totalCostOverall > 0 ? (item.totalCost / totalCostOverall) : 0;
    });

    let weightedVolSum = 0;
    assetStats.forEach(asset => {
      const w = assetWeights[asset.ticker] ?? 0;
      weightedVolSum += w * asset.volAnnual;
    });

    const diversificationRatio = pfSDAnnual > 0 ? (weightedVolSum / pfSDAnnual) : 1;

    return {
      pfMeanDaily,
      bmMeanDaily,
      pfMeanAnnual,
      bmMeanAnnual,
      pfSDDaily,
      bmSDDaily,
      pfSDAnnual,
      bmSDAnnual,
      pfSkew,
      bmSkew,
      pfKurt,
      bmKurt,
      pfMedian,
      bmMedian,
      pfMin,
      bmMin,
      pfMax,
      bmMax,
      pfWinRate: pfWinRateCorrect,
      bmWinRate: bmWinRateCorrect,
      trackingError,
      correlation,
      rSquared,
      pfVaR95,
      pfVaR99,
      bmVaR95,
      bmVaR99,
      pfCVaR95,
      pfCVaR99,
      bmCVaR95,
      bmCVaR99,
      correlationMatrix,
      assetStats,
      pfReturns,
      diversificationRatio,
      // Added CV & regression outputs
      pfCVDaily,
      pfCVAnnual,
      bmCVDaily,
      bmCVAnnual,
      regressionBeta,
      regressionAlphaDaily,
      regressionAlphaAnnual,
      regressionRSquared,
      regressionRSEDaily,
      regressionRSEAnnual,
      regressionTStat,
      regressionScatterData,
      regressionLineData,
      rollingMetrics
    };
  }, [filteredDailyData, pricesData, uniqueTickers, benchmarkTicker, riskFreeRate, mergedHoldings]);

  const returnDistributionData = useMemo(() => {
    if (!statsMetrics || statsMetrics.pfReturns.length === 0) return [];
    const pfReturns = statsMetrics.pfReturns;
    const min = Math.min(...pfReturns);
    const max = Math.max(...pfReturns);
    
    const binCount = 15;
    const binWidth = (max - min) / binCount;
    if (binWidth === 0) return [];
    
    const bins = Array.from({ length: binCount }, (_, i) => {
      const lower = min + i * binWidth;
      const upper = lower + binWidth;
      return {
        lower,
        upper,
        label: `${(lower * 100).toFixed(2)}%`,
        count: 0,
        middle: (lower + upper) / 2
      };
    });
    
    pfReturns.forEach(r => {
      let placed = false;
      for (let i = 0; i < binCount; i++) {
        if (r >= bins[i].lower && r <= bins[i].upper) {
          bins[i].count++;
          placed = true;
          break;
        }
      }
      if (!placed) {
        if (r < min) bins[0].count++;
        else if (r > max) bins[binCount - 1].count++;
      }
    });

    const mean = statsMetrics.pfMeanDaily;
    const sd = statsMetrics.pfSDDaily || 0.01;
    const pi = Math.PI;

    return bins.map(b => {
      const z = (b.middle - mean) / sd;
      const density = (1 / (sd * Math.sqrt(2 * pi))) * Math.exp(-0.5 * z * z);
      const fitDecimal = pfReturns.length * binWidth * density;
      
      return {
        name: b.label,
        count: b.count,
        normalFit: parseFloat(fitDecimal.toFixed(1))
      };
    });
  }, [statsMetrics]);

  // Percentage of holding breakdown data for Donut Chart
  const holdingBreakdown = useMemo(() => {
    if (mergedHoldings.length === 0) return [];
    
    // Group by ticker symbol
    const groups: Record<string, { ticker: string; totalCost: number }> = {};
    mergedHoldings.forEach((h) => {
      const ticker = h.ticker.toUpperCase();
      const cost = h.quantity * h.purchasePrice;
      if (!groups[ticker]) {
        groups[ticker] = { ticker, totalCost: 0 };
      }
      groups[ticker].totalCost += cost;
    });

    const list = Object.values(groups);
    const overallCost = list.reduce((sum, item) => sum + item.totalCost, 0);

    return list.map((item, index) => {
      return {
        name: item.ticker,
        value: Number(item.totalCost.toFixed(2)),
        percentage: overallCost > 0 ? Number(((item.totalCost / overallCost) * 100).toFixed(1)) : 0,
        color: TICKER_COLORS[index % TICKER_COLORS.length]
      };
    }).sort((a, b) => b.value - a.value);
  }, [mergedHoldings]);

  // AI insights states
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  // Table search and pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Save holdings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("portfolio_holdings", JSON.stringify(holdings));
  }, [holdings]);

  // Save analysisEndDate to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("portfolio_analysis_end_date", analysisEndDate);
  }, [analysisEndDate]);

  // Save last analyzed configuration to safely detect when inputs are modified
  const [lastAnalyzedConfig, setLastAnalyzedConfig] = useState<{
    holdings: Holding[];
    benchmark: string;
    riskFreeRate: number;
    inflationRate: number;
    analysisEndDate: string;
  } | null>(null);

  // Check if inputs have been changed since the last calculation
  const isDirty = useMemo(() => {
    if (!lastAnalyzedConfig) {
      return holdings.length > 0;
    }
    
    // Compare stringified holdings
    const holdingsChanged = JSON.stringify(lastAnalyzedConfig.holdings) !== JSON.stringify(holdings);
    
    // Compare benchmark input
    const benchmarkChanged = lastAnalyzedConfig.benchmark.trim().toUpperCase() !== benchmarkInput.trim().toUpperCase();
    
    // Compare risk free rate
    const rfChanged = lastAnalyzedConfig.riskFreeRate !== riskFreeRate;
    
    // Compare inflation rate
    const inflationChanged = lastAnalyzedConfig.inflationRate !== inflationRate;

    // Compare analysis end date
    const endChanged = lastAnalyzedConfig.analysisEndDate !== analysisEndDate;
    
    return holdingsChanged || benchmarkChanged || rfChanged || inflationChanged || endChanged;
  }, [lastAnalyzedConfig, holdings, benchmarkInput, riskFreeRate, inflationRate, analysisEndDate]);

  // Command: Explicit Core Calculation Pipeline manual trigger
  const triggerCalculationPipeline = async (overrideHoldings?: Holding[], overrideBenchmark?: string) => {
    const currentHoldings = overrideHoldings || holdings;
    const cleanBench = (overrideBenchmark || benchmarkInput).trim().toUpperCase();
    if (!cleanBench) {
      setPipelineError("Benchmark ticker cannot be empty. Specify a valid index or stock symbol.");
      return;
    }

    if (currentHoldings.length === 0) {
      setDailyData([]);
      setMetrics(null);
      setAnnualReturns([]);
      setPipelineError("No assets specified in your portfolio setup. Keep at least one position and click Analyze.");
      return;
    }

    setIsLoading(true);
    setPipelineError("");
    setStatusMessage("Retrieving historical stock price data series...");

    try {
      // Find earliest transaction purchase date to load benchmark & stock data from yahoo finance
      const earliestDate = currentHoldings.reduce((earliest, current) => {
        return current.purchaseDate < earliest ? current.purchaseDate : earliest;
      }, currentHoldings[0].purchaseDate);

      // Deduplicate tickers
      const tickerSet = new Set<string>();
      currentHoldings.forEach(h => tickerSet.add(h.ticker.toUpperCase()));
      tickerSet.add(cleanBench);

      const tickerString = Array.from(tickerSet).join(",");
      setStatusMessage(`Querying Yahoo Finance Chart endpoints for ${tickerString}...`);
      
      const response = await fetch(`/api/stock-history?tickers=${encodeURIComponent(tickerString)}&startDate=${earliestDate}${analysisEndDate ? `&endDate=${analysisEndDate}` : ""}`);
      if (!response.ok) {
        throw new Error(`API error loading stock histories. Ticker might be incorrect.`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.toLowerCase().includes("application/json")) {
        throw new Error(`Server returned unexpected content format. Please try again in a moment.`);
      }

      const payload = await response.json();
      const results = payload.results || {};

      // Validation - Did any transaction asset error in fetching?
      const missingTickers: string[] = [];
      const checkedPricesData: Record<string, any[]> = {};

      // Verify benchmark
      if (!results[cleanBench] || !results[cleanBench].success) {
        throw new Error(`Benchmark ticker "${cleanBench}" could not be retrieved. Set a valid benchmark such as SPY or QQQ.`);
      }
      checkedPricesData[cleanBench] = results[cleanBench].data;

      for (const holding of currentHoldings) {
        const res = results[holding.ticker];
        if (!res || !res.success) {
          missingTickers.push(holding.ticker);
        } else {
          checkedPricesData[holding.ticker] = res.data;
        }
      }

      if (missingTickers.length > 0) {
        throw new Error(`Failed to load historical data for ticker(s): ${missingTickers.join(", ")}. Ensure they exist on Yahoo Finance.`);
      }

      setStatusMessage("Building daily portfolio value index & calculating Sharpe ratios...");
      const analysis = analyzePortfolio(currentHoldings, checkedPricesData, cleanBench, riskFreeRate, inflationRate);

      if (analysis) {
        setDailyData(analysis.dailyData);
        setMetrics(analysis.metrics);
        setAnnualReturns(computeAnnualReturns(analysis.dailyData));
        setPricesData(checkedPricesData);
        setBenchmarkTicker(cleanBench);
        setResolvedHoldings(analysis.resolvedHoldings);
        localStorage.setItem("portfolio_benchmark", cleanBench);
        setLastAnalyzedConfig({
          holdings: JSON.parse(JSON.stringify(currentHoldings)),
          benchmark: cleanBench,
          riskFreeRate,
          inflationRate,
          analysisEndDate
        });
      } else {
        throw new Error("Quantitative math analytics failed to parse. Verify input dates and quantities.");
      }
    } catch (err: any) {
      console.error(err);
      setPipelineError(err.message || "An unexpected error occurred in the execution pipeline.");
    } finally {
      setIsLoading(false);
    }
  };

  // Run calculation ONCE on initial mount to provide pre-loaded beautiful interactive charts
  useEffect(() => {
    triggerCalculationPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Request premium AI diagnostics from Gemini server
  const generateAIDiagnostic = async () => {
    if (!metrics) return;
    setAiLoading(true);
    setAiError("");
    setAiText("");

    try {
      const response = await fetch("/api/portfolio-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metrics,
          portfolioSetup: mergedHoldings.map(h => ({
            ticker: h.ticker,
            quantity: h.quantity,
            purchasePrice: h.purchasePrice,
            purchaseDate: h.purchaseDate,
            saleDate: h.hasSaleDate ? h.saleDate : "Active"
          }))
        })
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.toLowerCase().includes("application/json")) {
        throw new Error("Server returned unexpected format. Check if backend server is active.");
      }

      if (!response.ok) {
        const errPayload = await response.json();
        throw new Error(errPayload.error || "Failed to fetch AI insights");
      }

      const payload = await response.json();
      setAiText(payload.text);
    } catch (err: any) {
      setAiError(err.message || "Could not retrieve AI recommendations. Check if API key is active.");
    } finally {
      setAiLoading(false);
    }
  };

  // Handle Form Submission
  const handleAddHolding = (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    const ticker = inputTicker.trim().toUpperCase();
    const qty = parseFloat(inputQuantity);
    const pDate = inputPurchaseDate;
    const sDate = inputSaleDate;

    // Direct UI Validations
    if (!ticker) {
      setFormError("Asset ticker code is required.");
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setFormError("Quantity must be a positive number.");
      return;
    }
    if (!pDate) {
      setFormError("Please select a buying purchase date.");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (pDate > todayStr) {
      setFormError("Purchase date must be in the past.");
      return;
    }

    if (hasSaleDate) {
      if (!sDate) {
        setFormError("Please select a selling sale date or uncheck the selling date.");
        return;
      }
      if (sDate < pDate) {
        setFormError("Sale date must be after or on the purchase date.");
        return;
      }
    }

    // Insert new transaction holding with purchasePrice: 0 to be automatically resolved
    const newHolding: Holding = {
      id: Date.now().toString(),
      ticker,
      quantity: qty,
      purchasePrice: 0,
      purchaseDate: pDate,
      hasSaleDate,
      saleDate: hasSaleDate ? sDate : undefined
    };

    setHoldings([...holdings, newHolding]);

    // Reset Form fields
    setInputTicker("");
    setInputQuantity("");
    setInputPurchaseDate("");
    setHasSaleDate(false);
    setInputSaleDate("");
  };

  // Delete transaction asset
  const handleDeleteHolding = (id: string) => {
    setHoldings(holdings.filter(h => h.id !== id));
  };

  // Export Daily quantitative values to CSV formatted text
  const handleExportCSV = () => {
    if (dailyData.length === 0) return;
    const sortedTickers = [...uniqueTickers].sort();
    
    let headers = "Date,Portfolio Value,NAV per Unit,Total Units,Portfolio Daily Return,Benchmark Daily Return,NAV vs BM Delta,Portfolio Cumulative Return %,Benchmark Cumulative Return %,Drawdown %,Benchmark Drawdown %";
    sortedTickers.forEach(ticker => {
      headers += `,${ticker} Price (₹),${ticker} Daily Return`;
    });
    headers += "\n";
    
    let csvContent = headers;
    
    dailyData.forEach(d => {
      const delta = d.portfolioDailyReturn - d.benchmarkDailyReturn;
      let row = `${d.date},${d.portfolioValue.toFixed(2)},${(d.currentNav || 100).toFixed(4)},${(d.totalUnits || 0).toFixed(4)},${d.portfolioDailyReturn.toFixed(6)},${d.benchmarkDailyReturn.toFixed(6)},${delta.toFixed(6)},${d.portfolioCumulativeReturn.toFixed(4)},${d.benchmarkCumulativeReturn.toFixed(4)},${(d.drawdown * 100).toFixed(4)},${(d.benchmarkDrawdown * 100).toFixed(4)}`;
      
      sortedTickers.forEach(ticker => {
        const pr = d[`price_${ticker}`];
        const ret = d[`return_${ticker}`];
        const prStr = pr !== undefined ? pr.toFixed(2) : "";
        const retStr = ret !== undefined ? ret.toFixed(6) : "";
        row += `,${prStr},${retStr}`;
      });
      
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `portfolio_daily_curve_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Table filtering based on search
  const filteredTableData = dailyData.filter(d => 
    d.date.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredTableData.length / itemsPerPage);
  const paginatedTableData = filteredTableData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Math Formatting Helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);
  };

  const formatPercent = (val: number) => {
    return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
  };

  const getHoldingDurationLabel = (purchaseDateStr: string, hasSaleDate: boolean, saleDateStr?: string, analysisEndDateStr?: string) => {
    if (!purchaseDateStr) return "-";
    const start = new Date(purchaseDateStr);
    const end = hasSaleDate && saleDateStr 
      ? new Date(saleDateStr) 
      : (analysisEndDateStr ? new Date(analysisEndDateStr) : new Date());
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-";
    
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return "0 days";
    
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 30) {
      return `${diffDays} Day${diffDays !== 1 ? "s" : ""}`;
    } else if (diffDays < 365) {
      const mos = Math.floor(diffDays / 30.4);
      const remainingDays = Math.round(diffDays % 30.4);
      return `${mos} Mo${mos !== 1 ? "s" : ""}${remainingDays > 0 ? ` ${remainingDays} Day${remainingDays !== 1 ? "s" : ""}` : ""}`;
    } else {
      const yrs = Math.floor(diffDays / 365);
      const remainingMos = Math.floor((diffDays % 365) / 30.4);
      return `${yrs} Yr${yrs !== 1 ? "s" : ""}${remainingMos > 0 ? ` ${remainingMos} Mo${remainingMos !== 1 ? "s" : ""}` : ""}`;
    }
  };

  return (
    <div id="main_frame" className="h-screen w-screen bg-slate-950 text-slate-200 font-sans flex flex-col md:flex-row overflow-hidden select-none">
      
      {/* Sidebar Navigation */}
      <aside className={`w-full ${isSidebarExpanded ? "md:w-64" : "md:w-20"} bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800/80 flex flex-col justify-between p-5 md:p-6 shrink-0 z-10 font-sans transition-all duration-300 relative`}>
        <div className="space-y-6">
          {/* Logo / Brand Header */}
          <div className={`flex ${isSidebarExpanded ? "flex-row items-center justify-between" : "flex-col items-center gap-4 animate-fade-in"}`}>
            <div className={`flex ${isSidebarExpanded ? "items-center gap-3" : "flex-col items-center gap-2"}`}>
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              {isSidebarExpanded && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="overflow-hidden"
                >
                  <h1 className="text-sm font-bold tracking-tight text-white italic leading-none font-display whitespace-nowrap">QuantScope</h1>
                  <span className="text-[9px] text-slate-500 tracking-wider font-semibold block mt-0.5 whitespace-nowrap">PORTFOLIO ENGINE</span>
                </motion.div>
              )}
            </div>

            {/* Collapse / Expand Toggle Button (Hidden on Mobile) */}
            <button
              onClick={() => {
                const next = !isSidebarExpanded;
                setIsSidebarExpanded(next);
                localStorage.setItem("sidebar_expanded", String(next));
              }}
              className="hidden md:flex p-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-all border border-slate-800 hover:border-slate-700 outline-none"
              title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>

          {/* FUTURE EXPANSION SLOTS */}
          {isSidebarExpanded ? (
            <div className="pt-6 border-t border-slate-800/60 space-y-2 animate-fade-in hidden md:block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-2">Workspace Modules</span>
              
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-850/60 text-emerald-400 text-xs font-semibold border border-slate-800/80">
                <Briefcase className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="whitespace-nowrap">Active Sandbox</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-500 hover:text-slate-400 text-xs font-medium cursor-not-allowed hover:bg-slate-850/10 transition-all">
                <div className="flex items-center gap-2.5">
                  <Calculator className="h-4 w-4 shrink-0 text-slate-600" />
                  <span className="whitespace-nowrap">Factor Modeling</span>
                </div>
                <span className="text-[8px] bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold leading-none">SOON</span>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg text-slate-500 hover:text-slate-400 text-xs font-medium cursor-not-allowed hover:bg-slate-850/10 transition-all">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4 w-4 shrink-0 text-slate-600" />
                  <span className="whitespace-nowrap">Stress Test Tool</span>
                </div>
                <span className="text-[8px] bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold leading-none">SOON</span>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-800/60 flex-col items-center space-y-3.5 hidden md:flex animate-fade-in">
              <div className="p-2 rounded-lg bg-slate-850/60 text-emerald-400 border border-slate-800/80" title="Active Sandbox">
                <Briefcase className="h-4 w-4 shrink-0" />
              </div>
              <div className="p-2 rounded-lg text-slate-600 hover:text-slate-500 hover:bg-slate-850/10 cursor-not-allowed" title="Factor Modeling (Coming Soon)">
                <Calculator className="h-4 w-4 shrink-0" />
              </div>
              <div className="p-2 rounded-lg text-slate-600 hover:text-slate-500 hover:bg-slate-850/10 cursor-not-allowed" title="Stress Test Tool (Coming Soon)">
                <Activity className="h-4 w-4 shrink-0" />
              </div>
            </div>
          )}
        </div>

        {/* Status indicator in sidebar */}
        <div className={`mt-6 md:mt-0 pt-4 border-t border-slate-800 flex flex-col ${isSidebarExpanded ? "items-stretch space-y-3" : "items-center space-y-3.5"}`}>
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-blue-400 font-mono" title="Engine Processing...">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-450 shrink-0" />
              {isSidebarExpanded && <span className="whitespace-nowrap">Engine Processing...</span>}
            </div>
          ) : pipelineError ? (
            <div className="flex items-center gap-2 text-xs text-rose-455 font-mono" title="Errors Blocked">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              {isSidebarExpanded && <span className="whitespace-nowrap">Errors Blocked</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono" title="Connected to yfinance">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
              {isSidebarExpanded && <span className="whitespace-nowrap">Connected to yfinance</span>}
            </div>
          )}
          <div className="text-[9px] text-slate-600 font-mono uppercase tracking-[0.12em] shrink-0 text-center whitespace-nowrap">
            {isSidebarExpanded ? "v2.4.1 Production Build" : "v2.4.1"}
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-955 bg-slate-950">
        
        {/* Header / Tabs */}
        <header className="h-16 border-b border-slate-800/80 flex items-center justify-between px-6 bg-slate-900/40 backdrop-blur-md shrink-0">
          <nav className="flex gap-6 h-full items-center">
            <button 
              onClick={() => setActiveTab("setup")}
              className={`h-full border-b-2 text-xs uppercase tracking-wider font-semibold transition-all px-1 flex items-center gap-2 ${
                activeTab === "setup" 
                  ? "border-blue-500 text-white" 
                  : "border-transparent text-slate-500 hover:text-slate-350"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Portfolio Setup</span>
              {holdings.length > 0 && (
                <span className="bg-slate-800 px-1.5 py-0.5 rounded-full text-[9px] font-mono text-slate-300 font-normal">
                  {holdings.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={`h-full border-b-2 text-xs uppercase tracking-wider font-semibold transition-all px-1 flex items-center gap-2 ${
                activeTab === "dashboard" 
                  ? "border-blue-500 text-white" 
                  : "border-transparent text-slate-500 hover:text-slate-350"
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Performance Dashboard</span>
            </button>
            <button 
              onClick={() => setActiveTab("stats")}
              className={`h-full border-b-2 text-xs uppercase tracking-wider font-semibold transition-all px-1 flex items-center gap-2 ${
                activeTab === "stats" 
                  ? "border-blue-500 text-white" 
                  : "border-transparent text-slate-500 hover:text-slate-350"
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Statistical Analysis</span>
            </button>
            <button 
              onClick={() => setActiveTab("math")}
              className={`h-full border-b-2 text-xs uppercase tracking-wider font-semibold transition-all px-1 flex items-center gap-2 ${
                activeTab === "math" 
                  ? "border-blue-500 text-white" 
                  : "border-transparent text-slate-500 hover:text-slate-350"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Math Breakdown</span>
            </button>
          </nav>

          <div className="flex items-center gap-4">
            {metrics && (
              <div className="hidden sm:block text-right">
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Current Value</p>
                <p className="text-sm font-bold text-white font-mono">{formatCurrency(metrics.currentValue)}</p>
              </div>
            )}
            
            {activeTab === "dashboard" && metrics && (
              <button 
                onClick={generateAIDiagnostic}
                disabled={aiLoading}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/40 text-white px-4 py-2 rounded text-xs font-semibold tracking-wide transition-all shadow-lg shadow-blue-500/15 flex items-center gap-1.5"
              >
                {aiLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                <span>AI Diagnostics</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Content Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950/20">
          
          {/* Dirty Param Alert Bar */}
          {isDirty && !isLoading && (
            <div className="mb-6 bg-amber-950/20 border border-amber-900/50 text-amber-300 p-4 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3 w-full">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Pending Parameter Changes</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    You have updated the portfolio holdings or global parameter values. Run quantitative calculations to refresh the analytics.
                  </p>
                </div>
              </div>
              <button
                onClick={() => triggerCalculationPipeline()}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded font-bold text-xs uppercase tracking-wider shrink-0 transition-all shadow-md shadow-amber-500/10 flex items-center gap-1.5 justify-center"
              >
                <Play className="h-3 w-3 fill-slate-950 text-slate-950" />
                <span>Analyze Now</span>
              </button>
            </div>
          )}

          {/* Active Error Alerts */}
          {pipelineError && (
            <div className="mb-6 bg-rose-950/20 border border-rose-900/50 text-rose-300 p-4 rounded-xl text-xs flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Backtest Run Delayed</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">{pipelineError}</p>
              </div>
            </div>
          )}

          {/* Active Loading Banners */}
          {isLoading && (
            <div className="mb-6 bg-blue-950/20 border border-blue-900/40 text-blue-300 p-4 rounded-xl text-xs flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
              <div>
                <p className="font-semibold text-slate-200">Executing Backtest Quant Pipeline...</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal font-mono">{statusMessage}</p>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
              
              {/* TAB 1: PORTFOLIO SETUP */}
              {activeTab === "setup" && (
                <motion.div
                  key="setup-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-8"
                >
                  {/* LOCAL SCOPE DEFINITIONS */}
                  {(() => {
                    const PRESET_PORTFOLIOS = [
                      {
                        id: "us_tech",
                        name: "Global Tech Elite",
                        desc: "High-conviction US technology pioneers with massive global R&D moats",
                        icon: "⚡",
                        bgTheme: "bg-gradient-to-br from-blue-950/30 to-slate-900/60 border-blue-500/15 hover:border-blue-500/40 hover:shadow-blue-500/5",
                        pillClass: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
                        benchmark: "SPY",
                        holdings: [
                          { id: "t1", ticker: "AAPL", quantity: 25, purchasePrice: 0, purchaseDate: "2021-01-04", hasSaleDate: false },
                          { id: "t2", ticker: "MSFT", quantity: 15, purchasePrice: 0, purchaseDate: "2021-02-15", hasSaleDate: false },
                          { id: "t3", ticker: "NVDA", quantity: 45, purchasePrice: 0, purchaseDate: "2022-03-10", hasSaleDate: false }
                        ]
                      },
                      {
                        id: "india_bluechip",
                        name: "Indian Nifty Core",
                        desc: "NSE mega-cap compounding giants pacing India's historic index expansion",
                        icon: "📈",
                        bgTheme: "bg-gradient-to-br from-emerald-950/30 to-slate-900/60 border-emerald-500/15 hover:border-emerald-500/40 hover:shadow-emerald-500/5",
                        pillClass: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
                        benchmark: "^NSEI",
                        holdings: [
                          { id: "ib1", ticker: "RELIANCE.NS", quantity: 80, purchasePrice: 0, purchaseDate: "2020-04-15", hasSaleDate: false },
                          { id: "ib2", ticker: "TCS.NS", quantity: 45, purchasePrice: 0, purchaseDate: "2020-08-10", hasSaleDate: false },
                          { id: "ib3", ticker: "INFY.NS", quantity: 60, purchasePrice: 0, purchaseDate: "2020-11-20", hasSaleDate: false }
                        ]
                      },
                      {
                        id: "all_weather",
                        name: "All-Weather Guard",
                        desc: "Ray Dalio-inspired macro diversification spanning equities, gold and yields",
                        icon: "🛡️",
                        bgTheme: "bg-gradient-to-br from-indigo-950/30 to-slate-900/60 border-indigo-500/15 hover:border-indigo-500/40 hover:shadow-indigo-500/5",
                        pillClass: "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
                        benchmark: "SPY",
                        holdings: [
                          { id: "aw1", ticker: "SPY", quantity: 45, purchasePrice: 0, purchaseDate: "2018-01-02", hasSaleDate: false },
                          { id: "aw2", ticker: "GLD", quantity: 30, purchasePrice: 0, purchaseDate: "2018-01-02", hasSaleDate: false },
                          { id: "aw3", ticker: "TLT", quantity: 25, purchasePrice: 0, purchaseDate: "2018-01-02", hasSaleDate: false }
                        ]
                      },
                      {
                        id: "crypto_alpha",
                        name: "Cryptographic Alpha",
                        desc: "High-volatility digital asset exposures tracking core network growth",
                        icon: "🌌",
                        bgTheme: "bg-gradient-to-br from-fuchsia-950/30 to-slate-900/60 border-fuchsia-500/15 hover:border-fuchsia-500/40 hover:shadow-fuchsia-500/5",
                        pillClass: "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20",
                        benchmark: "SPY",
                        holdings: [
                          { id: "cr1", ticker: "BTC-USD", quantity: 1.5, purchasePrice: 0, purchaseDate: "2022-01-03", hasSaleDate: false },
                          { id: "cr2", ticker: "ETH-USD", quantity: 12, purchasePrice: 0, purchaseDate: "2022-01-03", hasSaleDate: false }
                        ]
                      }
                    ];

                    const handleLoadPreset = (preset: typeof PRESET_PORTFOLIOS[0]) => {
                      setHoldings(preset.holdings);
                      setBenchmarkInput(preset.benchmark);
                      if (preset.id === "india_bluechip") {
                        setRiskFreeRate(6.8);
                        setInflationRate(5.1);
                      } else {
                        setRiskFreeRate(4.3);
                        setInflationRate(2.8);
                      }
                      triggerCalculationPipeline(preset.holdings, preset.benchmark);
                    };

                    const totalCostBasis = holdings.reduce((sum, h) => sum + (h.quantity * (h.purchasePrice || 0)), 0);

                    return (
                      <div className="space-y-8">
                        
                        {/* 1. FUTURISTIC HERO BANNER & DIAGNOSTICS CHIPSET */}
                        <div className="relative overflow-hidden bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-2xl">
                          {/* Radial Background Glows */}
                          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>
                          <div className="absolute bottom-0 left-10 w-60 h-60 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none"></div>
                          
                          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div className="space-y-1.5 max-w-2xl">
                              <div className="flex items-center gap-2">
                                <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded-full">
                                  Portfolio Engineering Deck
                                </span>
                                <span className="text-slate-700 font-mono text-[10px]">v1.4.0</span>
                              </div>
                              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight font-display">Configure Backtest Benchmarks & Holdings</h2>
                              <p className="text-slate-400 text-xs leading-relaxed max-w-xl font-sans">
                                Input custom stock purchase transactions, set macroeconomic indices, and compile your historical performance index compared with benchmark metrics.
                              </p>
                            </div>

                            {/* Core Diagnostics Indicators */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
                              
                              <div className="bg-slate-900/60 backdrop-blur border border-slate-800/60 p-3 rounded-xl flex flex-col gap-1.5 min-w-[130px]">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Engine Status</span>
                                <div className="flex items-center gap-2">
                                  {isDirty ? (
                                    <>
                                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                      <span className="text-xs text-amber-400 font-mono font-bold uppercase select-none">Sync Needed</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                                      <span className="text-xs text-emerald-400 font-mono font-bold uppercase select-none">Compiled</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="bg-slate-900/60 backdrop-blur border border-slate-800/60 p-3 rounded-xl flex flex-col gap-1.5 min-w-[130px]">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Assets</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-base font-bold text-white font-mono">{holdings.length}</span>
                                  <span className="text-[10px] text-slate-500 font-sans">positions</span>
                                </div>
                              </div>

                              <div className="bg-slate-900/60 backdrop-blur border border-slate-800/60 p-3 rounded-xl flex flex-col gap-1.5 col-span-2 sm:col-span-1 min-w-[150px]">
                                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Capital Outflow</span>
                                <div className="flex items-baseline gap-1 font-mono">
                                  <span className="text-sm font-bold text-blue-400 truncate">
                                    {totalCostBasis > 0 ? formatCurrency(totalCostBasis) : "—"}
                                  </span>
                                  {totalCostBasis === 0 && <span className="text-[9px] text-slate-505 text-slate-500 font-sans">pending compile</span>}
                                </div>
                              </div>

                            </div>
                          </div>
                                         {/* COLUMN DESKTOP */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    
                    {/* Setup Parameters & Forms - Organised vertically */}
                    <div className="space-y-6 xl:col-span-1">
                              {/* Unified Config Card combining Step 1 (Register Position) & Step 2 (Benchmark & Run Options) */}
                      <div className="bg-slate-900 border border-slate-800/85 rounded-xl p-5 shadow-lg space-y-6">
                        
                        {/* Step 1: Register Position Form */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800/60">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-mono font-bold border border-blue-500/15">01</span>
                              <h3 className="font-bold text-white text-xs uppercase tracking-wider font-display">Register Transaction</h3>
                            </div>
                            <Plus className="text-slate-500 h-4 w-4" />
                          </div>

                          <form onSubmit={handleAddHolding} className="space-y-4">
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1.5 relative">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Ticker Symbol</label>
                                <input
                                  type="text"
                                  value={inputTicker}
                                  onChange={(e) => {
                                    setInputTicker(e.target.value.toUpperCase());
                                    setShowTickerDropdown(true);
                                  }}
                                  onFocus={() => setShowTickerDropdown(true)}
                                  onBlur={() => setTimeout(() => setShowTickerDropdown(false), 250)}
                                  placeholder="e.g. DABUR"
                                  className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase w-full"
                                />

                                {showTickerDropdown && (tickerSuggestions.length > 0 || isSearchingTicker) && (
                                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-800 rounded-lg p-1 max-h-56 overflow-y-auto shadow-2xl divide-y divide-slate-800/40">
                                    {isSearchingTicker && (
                                      <div className="p-2 text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-2">
                                        <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                                        Searching...
                                      </div>
                                    )}
                                    {tickerSuggestions.map((item: any, idx: number) => (
                                      <button
                                        key={`${item.symbol}-${idx}`}
                                        type="button"
                                        onMouseDown={() => {
                                          setInputTicker(item.symbol);
                                          setTickerSuggestions([]);
                                          setShowTickerDropdown(false);
                                        }}
                                        className="w-full text-left p-2 hover:bg-slate-800 flex flex-col gap-0.5 rounded transition-colors"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-xs text-white font-mono">{item.symbol}</span>
                                          <span className="text-[8px] font-mono font-bold uppercase py-0.5 px-1.5 bg-slate-850 text-slate-400 rounded-full border border-slate-800">
                                            {item.exchange}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate max-w-[150px] font-sans">
                                          {item.name}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Shares Owned</label>
                                <input
                                  type="number"
                                  step="any"
                                  value={inputQuantity}
                                  onChange={(e) => setInputQuantity(e.target.value)}
                                  placeholder="Shares"
                                  className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Purchase Date (Start)</label>
                              <input
                                type="date"
                                value={inputPurchaseDate}
                                onChange={(e) => setInputPurchaseDate(e.target.value)}
                                className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none inline-block w-full"
                              />
                              <p className="text-[9.5px] text-blue-400 bg-blue-500/5 border border-blue-500/10 p-2 rounded leading-normal font-sans">
                                ℹ️ Unit prices are pulled automatically from Yahoo Finance adjusted historical closes based on selected transaction start date.
                              </p>
                            </div>

                            {/* Closed Transaction checkbox */}
                            <div className="pt-2 border-t border-slate-800/55 mt-2">
                              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-400 select-none">
                                <input
                                  type="checkbox"
                                  checked={hasSaleDate}
                                  onChange={(e) => setHasSaleDate(e.target.checked)}
                                  className="rounded bg-slate-950 border-slate-800 text-blue-500 focus:ring-0"
                                />
                                <span>Position closed / sold later</span>
                              </label>
                            </div>

                            {hasSaleDate && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                className="space-y-1.5 pt-1"
                              >
                                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sale / Out Date</label>
                                <input
                                  type="date"
                                  value={inputSaleDate}
                                  onChange={(e) => setInputSaleDate(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <p className="text-[10px] text-slate-500 leading-normal">Liquidates to fixed cash value lock at the selected close date.</p>
                              </motion.div>
                            )}

                            {formError && (
                              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded text-[11px] flex items-center gap-2">
                                <AlertCircle className="h-3.5 w-3.5 block text-rose-500 shrink-0" />
                                <span className="leading-snug">{formError}</span>
                              </div>
                            )}

                            <button
                              type="submit"
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-2.5 px-4 rounded transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 border border-blue-500/15"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Add Position Asset</span>
                            </button>
                          </form>
                        </div>

                        {/* Visual separating line */}
                        <div className="border-t border-slate-800/80 my-4"></div>

                        {/* Step 2: Benchmark & Test Boundary */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800/60 font-sans">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-mono font-bold border border-blue-500/15">02</span>
                              <h3 className="font-bold text-white text-xs uppercase tracking-wider font-display">Benchmark & Run Options</h3>
                            </div>
                            <Sliders className="text-slate-500 h-4 w-4" />
                          </div>

                          {/* BENCHMARK INPUT */}
                          <div className="space-y-2 relative">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Index Benchmark</label>
                              <button
                                type="button"
                                onClick={() => setShowIndexExplorer(true)}
                                className="text-[9px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/15"
                              >
                                <Search className="h-2.5 w-2.5" />
                                Browse Options
                              </button>
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                value={benchmarkInput}
                                onChange={(e) => {
                                    setBenchmarkInput(e.target.value.toUpperCase());
                                    setShowBenchmarkDropdown(true);
                                  }}
                                onFocus={() => setShowBenchmarkDropdown(true)}
                                onBlur={() => setTimeout(() => setShowBenchmarkDropdown(false), 250)}
                                onKeyDown={(e) => { if (e.key === "Enter") triggerCalculationPipeline(); }}
                                placeholder="e.g. NIFTY 50"
                                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-blue-400 font-mono tracking-wide focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                              />
                            </div>

                            {showBenchmarkDropdown && (benchmarkSuggestions.length > 0 || isSearchingBenchmark) && (
                              <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-800 rounded-lg p-1 max-h-56 overflow-y-auto shadow-2xl divide-y divide-slate-800/40">
                                {isSearchingBenchmark && (
                                  <div className="p-2 text-center text-[10px] text-slate-500 font-mono flex items-center justify-center gap-2">
                                    <span className="w-3.5 h-3.5 border-2 border-blue-550 border-t-transparent rounded-full animate-spin"></span>
                                    Searching...
                                  </div>
                                )}
                                {benchmarkSuggestions.map((item: any, idx: number) => (
                                  <button
                                    key={`${item.symbol}-${idx}`}
                                    type="button"
                                    onMouseDown={() => {
                                        setBenchmarkInput(item.symbol);
                                        setBenchmarkSuggestions([]);
                                        setShowBenchmarkDropdown(false);
                                      }}
                                    className="w-full text-left p-2 hover:bg-slate-800 flex flex-col gap-0.5 rounded transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-xs text-blue-400 font-mono">{item.symbol}</span>
                                      <span className="text-[8px] font-mono font-bold uppercase py-0.5 px-1.5 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20">
                                        {item.exchange}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate max-w-[200px] font-sans">
                                      {item.name}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* MACRO RATES SIDE BY SIDE */}
                          <div className="grid grid-cols-2 gap-3 pb-1">
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Risk-Free Rate</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="25"
                                  value={riskFreeRate}
                                  onChange={(e) => setRiskFreeRate(parseFloat(e.target.value) || 0)}
                                  onKeyDown={(e) => { if (e.key === "Enter") triggerCalculationPipeline(); }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 pr-7"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-500">%</span>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Inflation Rate</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="50"
                                  value={inflationRate}
                                  onChange={(e) => setInflationRate(parseFloat(e.target.value) || 0)}
                                  onKeyDown={(e) => { if (e.key === "Enter") triggerCalculationPipeline(); }}
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 pr-7"
                                />
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-500">%</span>
                              </div>
                            </div>
                          </div>

                          {/* ANALYSIS END DATE INPUT */}
                          <div className="space-y-1.5 pt-1 border-t border-slate-800/40">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Analysis End Date</label>
                              <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                            </div>
                            <input
                              type="date"
                              value={analysisEndDate}
                              onChange={(e) => setAnalysisEndDate(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") triggerCalculationPipeline(); }}
                              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none inline-block w-full"
                            />
                            <p className="text-[10px] text-slate-505 text-slate-500 leading-normal">
                              Leave empty to backtest all positions up to current active market sessions.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Unified Calculation Core Command */}
                      <div className="bg-slate-900/50 border border-slate-800/60 rounded-xl p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block font-mono">Backtest Engine Diagnostics</span>
                          <span className={`w-2 h-2 rounded-full ${isDirty ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`}></span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-normal font-sans">
                          {isDirty ? (
                            <span className="text-amber-400 font-medium">⚠️ Setup parameters modified. Run analytical compilation to update charts.</span>
                          ) : (
                            <span className="text-slate-550 text-slate-500">Pipeline active & synchronized with latest transaction configurations.</span>
                          )}
                        </p>
                        <button
                          type="button"
                          onClick={() => triggerCalculationPipeline()}
                          disabled={isLoading}
                          className={`w-full py-2.5 px-4 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                            isLoading
                              ? "bg-blue-900/40 text-blue-300 cursor-not-allowed"
                              : isDirty
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/10 border border-emerald-500/10 md:animate-pulse"
                              : "bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700/60"
                          }`}
                        >
                          {isLoading ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5 fill-emerald-400/20 text-emerald-400" />
                          )}
                          <span>Compile Portfolio Data</span>
                        </button>
                      </div>

                    </div>

                    {/* ACTIVE POSITIONS TABLE & DONUT ALLOCATION CHART */}
                    <div className="xl:col-span-2 space-y-6">
                      
                      {/* Active Position / Transaction Board */}
                      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 shadow-lg flex flex-col h-fit">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 mb-4 border-b border-slate-800/60">
                          <div>
                            <h3 className="font-bold text-white text-sm font-display flex items-center gap-2">
                              Active Transaction Board
                              <span className="text-[10px] font-mono py-0.5 px-1.5 bg-slate-950 text-slate-400 rounded-full border border-slate-800">
                                {holdings.length} Assets
                              </span>
                            </h3>
                            <p className="text-xs text-slate-400">Listed individual asset transactions compile the combined portfolio metrics backtest.</p>
                          </div>
                          {holdings.length > 0 && (
                            <button
                              onClick={() => {
                                if (confirm("Proceed to reset and empty active transaction database?")) {
                                  setHoldings([]);
                                }
                              }}
                              className="text-xs px-2.5 py-1 text-rose-400 border border-rose-550/15 rounded hover:bg-rose-550/10 transition-colors bg-rose-550/5 font-mono"
                            >
                              Reset Database
                            </button>
                          )}
                        </div>

                        {holdings.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
                            <Briefcase className="h-10 w-10 text-slate-700 mb-3" />
                            <h4 className="font-semibold text-slate-400 text-sm">Active Holdings Records Empty</h4>
                            <p className="text-xs text-slate-500 max-w-xs mt-1.5 leading-normal">
                              Use the left-hand form to register stock transactions and initialize the Quant compilation pipeline.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                              <thead>
                                <tr className="border-b border-slate-800 text-[10px] text-slate-550 text-slate-500 font-bold uppercase tracking-wider">
                                  <th className="py-3 px-4">Asset Code</th>
                                  <th className="py-3 px-4 text-right">Shares</th>
                                  <th className="py-3 px-4 text-right">Unit cost</th>
                                  <th className="py-3 px-4 text-right">Capital Outflow</th>
                                  <th className="py-3 px-4">Buy Date (Start)</th>
                                  <th className="py-3 px-4">End Date / status</th>
                                  <th className="py-3 px-4">duration</th>
                                  <th className="py-3 px-4 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {mergedHoldings.map((h) => {
                                  const totalCost = h.quantity * h.purchasePrice;
                                  return (
                                    <tr key={h.id} className="hover:bg-slate-950/40 transition-all group">
                                      {/* Ticker / Code */}
                                      <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono font-bold px-2.5 py-0.5 rounded">
                                            {h.ticker}
                                          </span>
                                        </div>
                                      </td>
                                      
                                      {/* Shares */}
                                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                                        {Number(h.quantity).toLocaleString()}
                                      </td>
                                      
                                      {/* Buy Price */}
                                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                                        {h.purchasePrice > 0 ? formatCurrency(h.purchasePrice) : (
                                          <span className="text-blue-400 animate-pulse text-[10px] bg-blue-500/5 px-1.5 py-0.5 rounded border border-blue-500/10 font-sans">
                                            Fetching...
                                          </span>
                                        )}
                                      </td>
                                      
                                      {/* Capital Outflow */}
                                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                                        {h.purchasePrice > 0 ? formatCurrency(totalCost) : <span className="text-slate-500">-</span>}
                                      </td>
                                      
                                      {/* Buy Date (Start) */}
                                      <td className="py-3 px-4 text-slate-300 font-mono">
                                        {h.purchaseDate}
                                      </td>
                                      
                                      {/* End Date / Status */}
                                      <td className="py-3 px-4 font-mono">
                                        {h.hasSaleDate && h.saleDate ? (
                                          <span className="bg-rose-500/10 text-rose-450 border border-rose-555/15 text-[10px] px-2 py-0.5 rounded font-semibold inline-block">
                                            Closed: {h.saleDate}
                                          </span>
                                        ) : (
                                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[10px] px-2 py-0.5 rounded font-semibold inline-block">
                                            {analysisEndDate ? `Bound: ${analysisEndDate}` : "Live tracking"}
                                          </span>
                                        )}
                                      </td>
                                      
                                      {/* Duration column */}
                                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                                        {getHoldingDurationLabel(h.purchaseDate, h.hasSaleDate, h.saleDate, analysisEndDate)}
                                      </td>
                                      
                                      {/* Action delete */}
                                      <td className="py-3 px-4 text-right">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteHolding(h.id)}
                                          className="text-slate-500 hover:text-rose-450 p-1 rounded hover:bg-rose-500/10 transition-colors opacity-60 group-hover:opacity-100"
                                          title="Remove Position"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Donut Chart for Holdings Allocation */}
                      {holdings.length > 0 && (
                        <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 shadow-lg">
                          <div className="pb-4 mb-4 border-b border-slate-800/60 flex items-center justify-between">
                            <div>
                              <h3 className="font-bold text-white text-sm font-display">Holdings Allocation Breakdown</h3>
                              <p className="text-xs text-slate-400">Relative allocation percentage based on purchase capital commitment</p>
                            </div>
                            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/15 border border-blue-500/20 px-2.5 py-1 rounded">
                              {holdingBreakdown.length} unique assets
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            {/* Left: Recharts Pie Chart */}
                            <div className="h-48 flex items-center justify-center">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={holdingBreakdown}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={3}
                                  >
                                    {holdingBreakdown.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 11 }}
                                    formatter={(value: any, name: any) => [formatCurrency(Number(value)) + ` (${holdingBreakdown.find(h => h.name === name)?.percentage}%)`, name]}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>

                            {/* Right: Legend & Metrics List */}
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                              {holdingBreakdown.map((item) => (
                                <div key={item.name} className="flex items-center justify-between text-xs font-mono border-b border-slate-850 pb-1.5 last:border-0 last:pb-0">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-sm block shrink-0" style={{ backgroundColor: item.color }}></span>
                                    <span className="font-bold text-white">{item.name}</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-slate-355 text-slate-300">{formatCurrency(item.value)}</span>
                                    <span className="text-slate-500 ml-2 font-bold bg-slate-1000 bg-slate-950 px-1.5 py-0.5 rounded text-[10px]">
                                      {item.percentage}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  </motion.div>
                )}

              {/* TAB 2: PERFORMANCE DASHBOARD */}
              {activeTab === "dashboard" && (
                <motion.div
                  key="dashboard-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  
                  {metrics === null ? (
                    <div className="bg-slate-900 border border-slate-800 p-10 rounded-xl text-center space-y-4 shadow-2xl">
                      <Briefcase className="h-12 w-12 mx-auto text-slate-700 animate-pulse" />
                      <h3 className="font-bold text-white text-base">Setup Transactions First</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Please proceed to the 💼 Portfolio Setup tab, register your stock purchases, and verify assets to run backtests.
                      </p>
                      <button
                        onClick={() => setActiveTab("setup")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 py-2.5 rounded transition-all"
                      >
                        Create Portfolio Now
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* DATE RANGE FILTERS */}
                      <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-md mb-6">
                        <div className="flex items-center gap-2">
                          <Sliders className="text-emerald-400 h-4 w-4 shrink-0" />
                          <span className="text-xs font-semibold text-slate-250 text-slate-200">Historical Backtest Horizon</span>
                          <span className="text-[10px] text-slate-500 font-mono">({timeFilter === "ALL" ? "MAX" : timeFilter} Filter Engaged)</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800/80">
                          {(["6M", "1Y", "2Y", "5Y", "ALL"] as const).map((filter) => (
                            <button
                              key={filter}
                              type="button"
                              onClick={() => setTimeFilter(filter)}
                              className={`text-[10px] font-mono px-3 py-1 rounded transition-all font-bold ${
                                timeFilter === filter
                                  ? "bg-emerald-600 text-white shadow"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {filter === "ALL" ? "MAX" : filter}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* STATS BENTO GRID */}
                      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
                        
                        {/* CARD 1: PORTFOLIO VALUE */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg relative group">
                          <div className="absolute right-0 top-0 bg-emerald-500/5 h-20 w-20 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all overflow-hidden pointer-events-none"></div>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>Current Portfolio Value</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                Value = Σ(Current Price_i × Shares_i)
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Multiplies the latest registered market day closing price of each active ticker asset by total shares owned, then sums across your portfolio positions.
                              </p>
                            </div>
                          </span>
                          <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-white mt-2 block">
                            {formatCurrency(metrics.currentValue)}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-1">
                            from {formatCurrency(metrics.totalInvested)} basis
                          </span>
                        </div>

                        {/* CARD 2: ABSOLUTE RETURN */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>Absolute Return</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2 whitespace-pre-wrap">
                                Return % = ((Current - Basis) / Basis) × 100
                              </div>
                              <p className="text-[11px] text-slate-300">
                                The non-annualized percentage gain or loss. Measures total capital appreciation Relative to the net money outflows committed.
                              </p>
                            </div>
                          </span>
                          <span className={`text-lg sm:text-xl font-bold font-mono tracking-tight mt-2 block ${
                            metrics.absoluteReturn >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {formatPercent(metrics.absoluteReturn)}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-1">
                            cumulative gains (₹)
                          </span>
                        </div>

                        {/* CARD 3: CAGR */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>CAGR (Annualized)</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                CAGR = (End/Start) ^ (365/Days) - 1
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Compound Annual Growth Rate. Represents the smoothed annualized rate required to grow your initial transaction capital up to your final balance asset state.
                              </p>
                            </div>
                          </span>
                          <span className={`text-lg sm:text-xl font-bold font-mono tracking-tight mt-2 block ${
                            metrics.cagr >= 0 ? "text-emerald-400 text-glow" : "text-rose-400"
                          }`}>
                            {formatPercent(metrics.cagr)}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-1">
                            vs {formatPercent(metrics.benchmarkCagr)} index
                          </span>
                        </div>

                        {/* CARD 4: MWR / XIRR */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>MWR (XIRR)</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0 animate-pulse" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                NPV = Σ [CF_t / (1 + r)^(d_t/365)] = 0
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Money-Weighted Return / Internal Rate of Return. Solves for the yield discount rate that forces the net present value of all buy/sell cash flow allocations to equal zero.
                              </p>
                            </div>
                          </span>
                          <span className={`text-lg sm:text-xl font-bold font-mono tracking-tight mt-2 block ${
                            metrics.mwrXirr >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {formatPercent(metrics.mwrXirr)}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-1">
                            asset transaction weighted
                          </span>
                        </div>

                        {/* CARD 5: TWR */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>TWR (Compounded)</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                TWR = Π(1 + Subperiod Return_j) - 1
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Time-Weighted Return. Measures compounding growth of funds while neutralizing distortions from deposit and withdrawal cash sizing events.
                              </p>
                            </div>
                          </span>
                          <span className={`text-lg sm:text-xl font-bold font-mono tracking-tight mt-2 block ${
                            metrics.twr >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {formatPercent(metrics.twr)}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-1">
                            excluding ledger deposits
                          </span>
                        </div>

                        {/* CARD 6: REAL RETURN */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>Real Return</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                Real = [(1 + CAGR) / (1 + Inflation)] - 1
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Adjusts nominal CAGR relative to standard inflation. Isolates and displays actual changes to true raw domestic purchasing power.
                              </p>
                            </div>
                          </span>
                          <span className={`text-lg sm:text-xl font-bold font-mono tracking-tight mt-2 block ${
                            metrics.realReturn >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {formatPercent(metrics.realReturn)}
                          </span>
                          <span className="text-[11px] text-slate-400 mt-1">
                            discounting {inflationRate}% inflation
                          </span>
                        </div>

                      </div>

                      {/* STATS BENTO GRID ROW 2: RISK RATIOS */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                        
                        {/* VOLATILITY */}
                        <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>Risk Volatility</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                Volatility_annual = Daily_SD × √252
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Annualized standard deviation of daily portfolio returns. Quantifies market movement scatter, providing primary raw metrics for drawdown and ratio stress modeling.
                              </p>
                            </div>
                          </span>
                          <span className="text-base sm:text-lg font-bold font-mono text-slate-100 block mt-1.5">
                            {(metrics.annualizedVolatility * 100).toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            vs {(metrics.benchmarkVolatility * 100).toFixed(2)}% bench
                          </span>
                        </div>

                        {/* SHARPE RATIO */}
                        <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>Sharpe Ratio</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                Sharpe = (CAGR - RiskFree_5%) / Vol_annual
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Returns generated per unit of absolute pricing risk. Assumes a default 5.0% risk-free rate hurdle to analyze raw strategy efficiency performance.
                              </p>
                            </div>
                          </span>
                          <span className="text-base sm:text-lg font-bold font-mono text-emerald-400 block mt-1.5">
                            {metrics.sharpeRatio.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            risk premium hurdle
                          </span>
                        </div>

                        {/* SORTINO RATIO */}
                        <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>Sortino Ratio</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                Sortino = (CAGR - RiskFree_5%) / DownSD
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Downside risk-adjusted return metric. Isolates standard deviation exclusively on negative days (DownSD) to protect portfolios from penalizing upside volatility.
                              </p>
                            </div>
                          </span>
                          <span className="text-base sm:text-lg font-bold font-mono text-emerald-400 block mt-1.5">
                            {metrics.sortinoRatio.toFixed(2)}
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            downside penalty only
                          </span>
                        </div>

                        {/* MAX DRAWDOWN */}
                        <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>Max Drawdown</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                Drawdown = Min [ (Value_t - Peak_t) / Peak_t ]
                              </div>
                              <p className="text-[11px] text-slate-300">
                                The worst-case Peak-to-Trough percentage wipeout. Tracks largest trailing peak drop experienced by portfolio capital before regaining the old historical high benchmark watermarks.
                              </p>
                            </div>
                          </span>
                          <span className="text-base sm:text-lg font-bold font-mono text-rose-400 block mt-1.5">
                            {(metrics.maxDrawdown * 100).toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            historical peak-to-trough
                          </span>
                        </div>

                        {/* BETA & ALPHA */}
                        <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>Beta & Alpha</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2 text-[9px]">
                                β = Cov(Rp,Rm)/Var(Rm) | α = Rp - [Rf + β(Rm-Rf)]
                              </div>
                              <p className="text-[11px] text-slate-300">
                                <strong>Beta (β)</strong> measures portfolio systematic sensitivity to index benchmark pricing. <strong>Alpha (α)</strong> computes absolute risk-adjusted excess yield outperformance (Jensen's Alpha via CAPM).
                              </p>
                            </div>
                          </span>
                          <span className="text-base sm:text-lg font-bold font-mono text-purple-300 block mt-1.5">
                            {metrics.beta.toFixed(2)} / <span className="text-indigo-400">{metrics.alpha >= 0 ? "+" : ""}{(metrics.alpha * 100).toFixed(2)}%</span>
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            hedged characteristics
                          </span>
                        </div>

                        {/* MODIGLIANI-SQUARED (M2) */}
                        <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>M² Return</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                M² = Rf + Sharpe × Vol_benchmark
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Modigliani-squared measures the return of the portfolio if it were leveraged or deleveraged (by mixing it with the risk-free asset) to match the volatility of the benchmark index.
                              </p>
                            </div>
                          </span>
                          <span className="text-base sm:text-lg font-bold font-mono text-amber-400 block mt-1.5">
                            {metrics.m2.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            vol-matched return
                          </span>
                        </div>

                        {/* MODIGLIANI-SQUARED alpha (M2 ALPHA) */}
                        <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow relative group">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider flex items-center justify-between relative group/tooltip">
                            <span>M² Alpha</span>
                            <Info className="h-3 w-3 text-slate-500 group-hover/tooltip:text-emerald-400 cursor-help transition-all ml-1.5 shrink-0" />
                            
                            <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-950/98 border border-slate-800/80 rounded-xl p-3.5 shadow-2xl transition-all duration-150 ease-out font-sans normal-case tracking-normal opacity-0 pointer-events-none group-hover/tooltip:opacity-100 group-hover/tooltip:pointer-events-auto z-[60] text-slate-300 font-normal leading-relaxed text-left">
                              <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b border-slate-800">
                                <span className="font-bold text-white text-[11px] uppercase tracking-wider">Calculation Details</span>
                              </div>
                              <div className="font-mono text-emerald-400 text-[10px] bg-emerald-950/30 border border-emerald-900/45 px-2 py-1 rounded mb-2">
                                M²_Alpha = M² - Return_benchmark
                              </div>
                              <p className="text-[11px] text-slate-300">
                                Modigliani-squared alpha represents the excess return over the benchmark index after adjusting the portfolio volatility to equal the benchmark's volatility.
                              </p>
                            </div>
                          </span>
                          <span className={`text-base sm:text-lg font-bold font-mono block mt-1.5 ${metrics.m2Alpha >= 0 ? "text-emerald-400" : "text-rose-455"}`}>
                            {metrics.m2Alpha >= 0 ? "+" : ""}{metrics.m2Alpha.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            excess vol-matched return
                          </span>
                        </div>

                      </div>

                      {/* CHARTING GRID */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        
                         {/* CHART 0: PORTFOLIO CUMULATIVE RETURN vs INDEX */}
                         <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl relative group xl:col-span-2">
                           <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-4 border-b border-slate-800 gap-3">
                             <div className="flex items-center justify-between w-full md:w-auto">
                               <div>
                                 <h3 className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap">
                                   Portfolio Cumulative Returns (%)
                                   <span className="text-[9px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">NAV Unitized</span>
                                 </h3>
                                 <p className="text-[10px] text-slate-400">True performance return curve (NAV unitization) stripping out distorting effects of staggered capital injections</p>
                               </div>
                               <button
                                 type="button"
                                 onClick={() => setMaximizedChart("returns")}
                                 className="md:hidden bg-slate-800 hover:bg-slate-755 text-slate-400 hover:text-white p-1.5 rounded transition-all"
                                 title="Expand to Wide Screen"
                               >
                                 <Maximize2 className="h-4 w-4" />
                               </button>
                             </div>
                             <div className="flex items-center gap-3 text-xs font-mono">
                               <span className="flex items-center gap-1.5">
                                 <span className="w-2.5 h-2.5 rounded bg-emerald-500 block"></span>
                                 <span className="font-semibold text-slate-300">Portfolio: <span className="text-emerald-400">{metrics.cagr ? `${metrics.cagr.toFixed(2)}% CAGR` : ""}</span></span>
                               </span>
                               <span className="flex items-center gap-1.5">
                                 <span className="w-2.5 h-2.5 rounded bg-slate-500 block"></span>
                                 <span className="text-slate-400">Index ({benchmarkTicker})</span>
                               </span>
                               
                               <button
                                 type="button"
                                 onClick={() => setMaximizedChart("returns")}
                                 className="hidden md:flex bg-slate-800 hover:bg-slate-755 text-slate-400 hover:text-white px-2 py-1 rounded transition-all border border-slate-755 text-[10px] items-center gap-1 shadow-sm"
                                 title="Expand to Wide Screen"
                               >
                                 <Maximize2 className="h-3 w-3" />
                                 <span>Maximize</span>
                               </button>
                             </div>
                           </div>
 
                           <div className="h-72 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                               <AreaChart data={filteredDailyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                 <defs>
                                   <linearGradient id="portfolioReturnGrad" x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                     <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                   </linearGradient>
                                 </defs>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                                 <XAxis 
                                   dataKey="date" 
                                   stroke="#64748b" 
                                   fontSize={10} 
                                   tickLine={false}
                                   minTickGap={40}
                                 />
                                 <YAxis 
                                   stroke="#64748b" 
                                   fontSize={10} 
                                   tickLine={false}
                                   tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                                 />
                                 <Tooltip 
                                   content={({ active, payload }) => {
                                     if (active && payload && payload.length) {
                                       const data = payload[0].payload;
                                       return (
                                         <div className="bg-slate-955 bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-2xl font-mono text-[11px] space-y-2 z-50">
                                           <div className="text-slate-400 font-bold border-b border-slate-805 border-slate-800 pb-1 flex items-center justify-between gap-4">
                                             <span>{data.date}</span>
                                             <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-blue-400 font-bold uppercase tracking-wider">NAV Basis</span>
                                           </div>
                                           <div className="space-y-1.5">
                                             <div className="flex items-center justify-between gap-6">
                                               <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                                                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block shrink-0"></span>
                                                 Portfolio Return:
                                               </span>
                                               <span className="font-bold text-white">{Number(data.portfolioCumulativeReturn).toFixed(2)}%</span>
                                             </div>
                                             <div className="flex items-center justify-between gap-6">
                                               <span className="text-slate-450 text-slate-400 flex items-center gap-1.5">
                                                 <span className="w-1.5 h-1.5 rounded-full bg-slate-500 block shrink-0"></span>
                                                 Index Return:
                                               </span>
                                               <span className="text-slate-300 font-semibold">{Number(data.benchmarkCumulativeReturn).toFixed(2)}%</span>
                                             </div>
                                             
                                             <div className="border-t border-slate-805 border-slate-800 my-1 pt-1.5 space-y-1 text-slate-300">
                                               <div className="flex items-center justify-between gap-6">
                                                 <span className="text-slate-500">Portfolio Value:</span>
                                                 <span className="font-semibold text-slate-200">{formatCurrency(data.portfolioValue)}</span>
                                               </div>
                                               <div className="flex items-center justify-between gap-6">
                                                 <span className="text-slate-500">Current NAV:</span>
                                                 <span className="font-bold text-blue-450 text-blue-400">{Number(data.currentNav).toFixed(2)}</span>
                                               </div>
                                               <div className="flex items-center justify-between gap-6">
                                                 <span className="text-slate-500">Total Units:</span>
                                                 <span className="font-semibold text-slate-300">{Number(data.totalUnits).toFixed(2)}</span>
                                               </div>
                                             </div>
                                           </div>
                                         </div>
                                       );
                                     }
                                     return null;
                                   }}
                                 />
                                 <Area 
                                   type="monotone" 
                                   dataKey="portfolioCumulativeReturn" 
                                   name="Portfolio Return" 
                                   stroke="#10b981" 
                                   strokeWidth={2}
                                   fillOpacity={1} 
                                   fill="url(#portfolioReturnGrad)" 
                                 />
                                 <Line 
                                   type="monotone" 
                                   dataKey="benchmarkCumulativeReturn" 
                                   name={`Index (${benchmarkTicker})`}
                                   stroke="#64748b" 
                                   strokeWidth={1.5} 
                                   dot={false}
                                 />
                               </AreaChart>
                             </ResponsiveContainer>
                           </div>
                         </div>

                        {/* CHART 1: REBASED CUMULATIVE RETURNS */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl relative">
                          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-4 border-b border-slate-800 gap-3">
                            <div className="flex items-center justify-between w-full md:w-auto">
                              <div>
                                <h3 className="font-bold text-white text-sm">Equity Growth (Rebased to 100)</h3>
                                <p className="text-[10px] text-slate-400">Compares cumulative compounded growth vs. index since starting purchase date</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setMaximizedChart("growth")}
                                className="md:hidden bg-slate-800 hover:bg-slate-755 text-slate-400 hover:text-white p-1.5 rounded transition-all"
                                title="Expand to Wide Screen"
                              >
                                <Maximize2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-400 max-w-md justify-start md:justify-end">
                              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500 block"></span>Index ({benchmarkTicker})</span>
                              {uniqueTickers.map((ticker, idx) => {
                                const color = TICKER_COLORS[idx % TICKER_COLORS.length];
                                return (
                                  <span key={ticker} className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="w-2 h-2 rounded-sm block" style={{ backgroundColor: color }}></span>
                                    <span>{ticker}</span>
                                  </span>
                                );
                              })}
                              
                              <button
                                type="button"
                                onClick={() => setMaximizedChart("growth")}
                                className="hidden md:flex items-center gap-1 bg-slate-800 hover:bg-slate-755 text-slate-400 hover:text-white px-2 py-1 rounded transition-all ml-2 border border-slate-755 text-[10px]"
                                title="Expand to Wide Screen"
                              >
                                <Maximize2 className="h-3 w-3" />
                                <span>Maximize</span>
                              </button>
                            </div>
                          </div>
                          
                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={filteredDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#64748b" 
                                  fontSize={10} 
                                  tickLine={false}
                                  minTickGap={40}
                                />
                                <YAxis 
                                  stroke="#64748b" 
                                  fontSize={10} 
                                  tickLine={false}
                                  domain={['auto', 'auto']}
                                />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 11 }}
                                  formatter={(value: any, name: any) => [`${Number(value).toFixed(2)}`, name]}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey={(d) => d.benchmarkCumulativeReturn + 100}
                                  name={benchmarkTicker} 
                                  stroke="#64748b" 
                                  strokeWidth={1.5} 
                                  dot={false}
                                />
                                {uniqueTickers.map((ticker, idx) => {
                                  const color = TICKER_COLORS[idx % TICKER_COLORS.length];
                                  return (
                                    <Line 
                                      key={ticker}
                                      type="monotone" 
                                      dataKey={`rebased_${ticker}`}
                                      name={ticker} 
                                      stroke={color} 
                                      strokeWidth={1.2} 
                                      dot={false}
                                      strokeDasharray="4 2"
                                      activeDot={{ r: 3 }}
                                    />
                                  );
                                })}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                                                {/* CHART 2: UNDERWATER DRAWDOWN */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl relative group">
                          <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800">
                            <div>
                              <h3 className="font-bold text-white text-sm">Underwater Peak-to-Trough Drawdown (%)</h3>
                              <p className="text-[10px] text-slate-400">Monitors historical asset erosion and recovery periods (%)</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-mono animate-fade-in">
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500 block"></span>Portfolio</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-600 block"></span>Index</span>
                              
                              <button
                                type="button"
                                onClick={() => setMaximizedChart("drawdown")}
                                className="bg-slate-800 hover:bg-slate-755 text-slate-400 hover:text-white px-2 py-1 rounded transition-all border border-slate-755 text-[10px] flex items-center gap-1 shadow-sm"
                                title="Expand to Wide Screen"
                              >
                                <Maximize2 className="h-3 w-3" />
                                <span className="hidden sm:inline">Maximize</span>
                              </button>
                            </div>
                          </div>

                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={filteredDailyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <defs>
                                  <linearGradient id="pfDrawdownGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#64748b" 
                                  fontSize={10} 
                                  tickLine={false}
                                  minTickGap={40}
                                />
                                <YAxis 
                                  stroke="#64748b" 
                                  fontSize={10} 
                                  tickLine={false}
                                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                                />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 11 }}
                                  formatter={(value: any) => [`${(Number(value) * 100).toFixed(2)}%`, '']}
                                />
                                <Area 
                                  type="monotone" 
                                  dataKey="drawdown" 
                                  name="Portfolio" 
                                  stroke="#f43f5e" 
                                  fillOpacity={1} 
                                  fill="url(#pfDrawdownGrad)" 
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="benchmarkDrawdown" 
                                  stroke="#475569" 
                                  strokeWidth={1} 
                                  dot={false}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* CHART 3: ANNUAL RETURNS COMPARISON */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl xl:col-span-2 relative group">
                          <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800">
                            <div>
                              <h3 className="font-bold text-white text-sm">Annual Performance Comparison (%)</h3>
                              <p className="text-[10px] text-slate-400">Yearly return comparison side-by-side</p>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400 block font-bold"></span>Portfolio</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-500 block"></span>Benchmark ({benchmarkTicker})</span>
                              
                              <button
                                type="button"
                                onClick={() => setMaximizedChart("annual")}
                                className="bg-slate-800 hover:bg-slate-755 text-slate-400 hover:text-white px-2 py-1 rounded transition-all border border-slate-755 text-[10px] flex items-center gap-1 shadow-sm"
                                title="Expand to Wide Screen"
                              >
                                <Maximize2 className="h-3 w-3" />
                                <span className="hidden sm:inline">Maximize</span>
                              </button>
                            </div>
                          </div>

                          {filteredAnnualReturns.length === 0 ? (
                            <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                              Insufficient data to compute calendar year aggregates
                            </div>
                          ) : (
                            <div className="h-60 w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={filteredAnnualReturns} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                                  <XAxis dataKey="year" stroke="#64748b" fontSize={11} tickLine={false} />
                                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => `${v}%`} />
                                  <Tooltip 
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 11 }}
                                    formatter={(v: any) => [`${Number(v).toFixed(2)}%`, '']}
                                  />
                                  <Bar dataKey="portfolioReturn" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                  <Bar dataKey="benchmarkReturn" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>

                      </div>

                      {/* AI DIAGNOSTICS BLOCK */}
                      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 shadow-2xl relative overflow-hidden">
                        <div className="absolute right-0 top-0 bg-indigo-500/5 h-28 w-28 rounded-full blur-3xl"></div>
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 mb-4 border-b border-slate-800">
                          <div className="flex items-center gap-2">
                            <Sparkles className="text-indigo-400 h-5 w-5 animate-pulse" />
                            <div>
                              <h3 className="font-bold text-white text-sm">Gemini Quantitative Assistant Diagnostics</h3>
                              <p className="text-[10px] text-slate-400 font-sans">Automated hedge optimization proposals & risk analyses</p>
                            </div>
                          </div>
                          
                          <button
                            onClick={generateAIDiagnostic}
                            disabled={aiLoading}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 text-white font-medium text-xs px-4 py-2 rounded-md transition-all flex items-center gap-2 shrink-0 border border-indigo-500/20"
                          >
                            {aiLoading ? (
                              <>
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                <span>Generating insights...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Get AI Diagnostic</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* AI INSIGHTS RESPONSE DISP */}
                        {aiLoading && (
                          <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                            <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                            <p className="text-xs text-slate-400 font-mono animate-pulse">Consulting sovereign Gemini quant advisor models...</p>
                          </div>
                        )}

                        {aiError && (
                          <div className="bg-rose-500/10 border border-rose-500/25 p-3.5 rounded-lg text-xs space-y-1 text-rose-300">
                            <div className="flex items-center gap-1 font-bold">
                              <AlertCircle className="h-4 w-4 text-rose-500" />
                              <span>AI Diagnostics Restricted</span>
                            </div>
                            <p className="text-[11px] leading-relaxed">{aiError}</p>
                          </div>
                        )}

                        {!aiLoading && !aiError && aiText && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="prose prose-sm prose-invert max-w-none text-slate-350 leading-relaxed text-xs sm:text-sm font-sans"
                          >
                            <div className="whitespace-pre-wrap bg-slate-950/40 border border-slate-850 p-4 rounded-lg">
                              {aiText}
                            </div>
                          </motion.div>
                        )}

                        {!aiLoading && !aiError && !aiText && (
                          <div className="bg-slate-950/30 border border-slate-850 p-4 rounded-lg flex items-start gap-2.5 text-xs text-slate-400">
                            <Info className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                            <div>
                              <span>Click <b>Get AI Diagnostic</b> to let Google Gemini review your backtest. The AI will critique your risk ratios, benchmark correlations, and recommend exactly two portfolio hedging adjustments dynamically.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* TAB: STATISTICAL ANALYSIS */}
              {activeTab === "stats" && (
                <motion.div
                  key="stats-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6 flex-1 flex flex-col"
                >
                  {!statsMetrics || !metrics ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl flex flex-col items-center justify-center text-center py-20">
                      <Activity className="h-12 w-12 text-slate-600 mb-4 animate-pulse" />
                      <h3 className="font-bold text-white text-lg">Statistical Analysis Stale</h3>
                      <p className="text-sm text-slate-400 max-w-md mt-1 font-sans">
                        Run portfolio backtest calculations first under <b>Portfolio Setup</b> to construct the descriptive & joint risk-modeling matrices.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* STATS OVERVIEW CARDS */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                        
                        {/* CARD 1: DAILY RETURN STATS */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Daily Returns Range</span>
                            <span className="p-1 rounded bg-blue-500/10 text-blue-400"><Activity className="h-4 w-4" /></span>
                          </div>
                          <span className="text-xl sm:text-2xl font-bold font-mono text-white block mt-1">
                            {(statsMetrics.pfMeanDaily * 100).toFixed(3)}%
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Average Daily Return (Portfolio)</span>
                          <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Min / Max Daily:</span>
                            <span className="font-mono font-semibold text-rose-450">{(statsMetrics.pfMin * 100).toFixed(1)}%</span>
                            <span className="text-slate-500">/</span>
                            <span className="font-mono font-semibold text-emerald-450">{(statsMetrics.pfMax * 100).toFixed(1)}%</span>
                          </div>
                        </div>

                        {/* CARD 2: PORTFOLIO VOLATILITY (STANDRD DEVIATION) */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl select-none group relative">
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Standard Deviation</span>
                            <span className="p-1 rounded bg-teal-500/10 text-teal-400"><Activity className="h-4 w-4" /></span>
                          </div>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-xl sm:text-2xl font-bold font-mono text-white block">
                              {(statsMetrics.pfSDAnnual * 100).toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-teal-300">(Annualized)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Annualized volatility of the overall portfolio</span>
                          <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Daily StdDev:</span>
                            <span className="font-mono font-bold text-teal-350">{(statsMetrics.pfSDDaily * 100).toFixed(3)}%</span>
                          </div>
                          <div className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 bg-slate-950 border border-slate-800 text-slate-300 p-2.5 rounded-lg text-[10px] leading-relaxed shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all z-20 mx-2">
                            <strong>Portfolio Volatility (Standard Deviation) Calculation:</strong><br />
                            Derived as the sample standard deviation of historical daily returns, scaled to annualized terms by multiplying the daily standard deviation by the square root of 252 trading days.
                          </div>
                        </div>

                        {/* CARD 3: DIVERSIFICATION RATIO */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl select-none group relative">
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Diversification Ratio</span>
                            <span className="p-1 rounded bg-orange-500/10 text-orange-450"><TrendingUp className="h-4 w-4" /></span>
                          </div>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-xl sm:text-2xl font-bold font-mono text-white block">
                              {statsMetrics.diversificationRatio.toFixed(3)}
                            </span>
                            <span className="text-[10px] text-orange-450">(DR)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Weighted avg asset risk / portfolio risk</span>
                          <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Benefit:</span>
                            <span className={`font-mono font-bold ${statsMetrics.diversificationRatio > 1 ? "text-emerald-400" : "text-slate-400"}`}>
                              {(statsMetrics.diversificationRatio > 1) 
                                ? `+${((statsMetrics.diversificationRatio - 1) * 100).toFixed(1)}% Risk Red.` 
                                : "No Diversification"
                              }
                            </span>
                          </div>
                          <div className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 bg-slate-950 border border-slate-800 text-slate-300 p-2.5 rounded-lg text-[10px] leading-relaxed shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all z-20 mx-2">
                            <strong>Diversification Ratio Calculation:</strong><br />
                            Calculated as the weighted average of the individual assets' annualized volatilities divided by the portfolio's total annualized volatility:<br />
                            <i>DR = (Σ w_i * σ_i) / σ_portfolio</i>.<br />
                            A ratio greater than 1.0 indicates that diversification benefits are reducing the overall portfolio risk below its weighted average.
                          </div>
                        </div>

                        {/* CARD 4: VALUE AT RISK (VaR) */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl select-none group relative">
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Value at Risk (VaR)</span>
                            <span className="p-1 rounded bg-rose-500/10 text-rose-400"><TrendingDown className="h-4 w-4" /></span>
                          </div>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-xl sm:text-2xl font-bold font-mono text-white block">
                              {(statsMetrics.pfVaR95 * 100).toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-slate-400">(95% Conf)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Max daily loss expected with 95% confidence</span>
                          <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Extreme Var (99%):</span>
                            <span className="font-mono font-bold text-rose-400">{(statsMetrics.pfVaR99 * 100).toFixed(2)}%</span>
                          </div>
                          {/* Calculation explanation on hover */}
                          <div className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 bg-slate-950 border border-slate-800 text-slate-300 p-2.5 rounded-lg text-[10px] leading-relaxed shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all z-20 mx-2">
                            <strong>Value at Risk (VaR) Calculation:</strong><br />
                            Derived using <i>Historical Simulation</i>. Re-orders the historical daily portfolio returns from worst to best, and locates the bottom 5th percentile return (for 95% confidence) and 1st percentile return (for 99% confidence).
                          </div>
                        </div>

                        {/* CARD 5: EXPECTED SHORTFALL (CVaR) */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl select-none group relative">
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Conditional VaR (CVaR)</span>
                            <span className="p-1 rounded bg-pink-500/10 text-pink-400"><Trash2 className="h-4 w-4" /></span>
                          </div>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-xl sm:text-2xl font-bold font-mono text-white block">
                              {(statsMetrics.pfCVaR95 * 100).toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-pink-400">(Expected Shortfall)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Average loss if return goes below 95% VaR</span>
                          <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">CVaR (99% Worst):</span>
                            <span className="font-mono font-bold text-pink-400">{(statsMetrics.pfCVaR99 * 100).toFixed(2)}%</span>
                          </div>
                          {/* Calculation explanation on hover */}
                          <div className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 bg-slate-950 border border-slate-800 text-slate-300 p-2.5 rounded-lg text-[10px] leading-relaxed shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all z-20 mx-2">
                            <strong>Expected Shortfall (CVaR) Calculation:</strong><br />
                            Calculates the <i>Expected Value</i> (simple arithmetic mean) of the portfolio returns that fell below the calculated 95% (or 99%) Value-at-Risk boundary on trading days.
                          </div>
                        </div>

                        {/* CARD 6: TRACKING RISK & INF RATIO */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl select-none group relative">
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Active Tracking Risk</span>
                            <span className="p-1 rounded bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="h-4 w-4" /></span>
                          </div>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-xl sm:text-2xl font-bold font-mono text-white block">
                              {(statsMetrics.trackingError * 100).toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-slate-450">(Tracking Error)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Annualized active risk vs benchmark index</span>
                          <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Information Ratio:</span>
                            <span className="font-mono font-bold text-emerald-400">
                              {statsMetrics.trackingError > 0 
                                ? ((metrics.cagr - metrics.benchmarkCagr) / (statsMetrics.trackingError * 100)).toFixed(2)
                                : "0.00"
                              }
                            </span>
                          </div>
                          {/* Calculation explanation on hover */}
                          <div className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 bg-slate-950 border border-slate-800 text-slate-300 p-2.5 rounded-lg text-[10px] leading-relaxed shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all z-20 mx-2">
                            <strong>Information Ratio:</strong><br />
                            Computes active return over active risk: <br />
                            <i>IR = (CAGR_pf - CAGR_benchmark) / (Tracking Error)</i>.<br />
                            Tracking Error is the annualized standard deviation of active daily returns (Rp_t - Rb_t).
                          </div>
                        </div>

                        {/* CARD 7: COEFFICIENT OF VARIATION (CV) */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl select-none group relative">
                          <div className="flex justify-between items-start">
                            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Coef. of Variation</span>
                            <span className="p-1 rounded bg-indigo-500/10 text-indigo-400"><Sliders className="h-4 w-4" /></span>
                          </div>
                          <div className="flex items-baseline gap-1 mt-1">
                            <span className={`text-xl sm:text-2xl font-bold font-mono block ${statsMetrics.pfCVAnnual >= 0 ? "text-white" : "text-rose-400"}`}>
                              {statsMetrics.pfCVAnnual.toFixed(4)}
                            </span>
                            <span className="text-[10px] text-indigo-400">(Annual)</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Risk-per-unit-return: Volatility / Mean Return</span>
                          <div className="mt-3 pt-2.5 border-t border-slate-850 flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Daily CV:</span>
                            <span className={`font-mono font-bold ${statsMetrics.pfCVDaily >= 0 ? "text-indigo-350" : "text-rose-400"}`}>{statsMetrics.pfCVDaily.toFixed(4)}</span>
                          </div>
                          {/* Calculation explanation on hover */}
                          <div className="pointer-events-none absolute left-0 right-0 bottom-full mb-2 bg-slate-950 border border-slate-800 text-slate-300 p-2.5 rounded-lg text-[10px] leading-relaxed shadow-2xl opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 transition-all z-20 mx-2">
                            <strong>Coefficient of Variation (CV) Calculation:</strong><br />
                            Measured as the standard deviation of returns divided by the expected mean return:<br />
                            <i>CV = Volatility / Mean Return</i>.<br />
                            A lower positive CV indicates a higher risk-efficiency (requires less risk per unit of expected return).
                          </div>
                        </div>

                      </div>

                      {/* STATS CHARTS SPLIT: DISTRIBUTION vs CORRELATION */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* DAILY RETURN DISTRIBUTION HISTOGRAM */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                          <div className="pb-3 border-b border-slate-800 mb-4 flex justify-between items-center">
                            <div>
                              <h3 className="font-bold text-white text-sm">Portfolio Daily Returns Distribution</h3>
                              <p className="text-[10px] text-slate-400">Daily return frequency buckets overlaid by fitted normal bell curve</p>
                            </div>
                            <span className="text-[10px] font-mono text-slate-450 px-2 py-0.5 bg-slate-950 rounded">
                              N = {statsMetrics.pfReturns.length} trading days
                            </span>
                          </div>

                          <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={returnDistributionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.2} />
                                <XAxis 
                                  dataKey="name" 
                                  stroke="#64748b" 
                                  fontSize={9} 
                                  tickLine={false} 
                                />
                                <YAxis 
                                  stroke="#64748b" 
                                  fontSize={10} 
                                  tickLine={false} 
                                />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 11 }}
                                />
                                <Legend verticalAlign="top" height={36} iconSize={10} style={{ fontSize: 10 }} />
                                {/* Bar counts as Area for standard density curve feel */}
                                <Bar 
                                  dataKey="count" 
                                  name="Actual Daily Frequency" 
                                  fill="#10b981" 
                                  opacity={0.7} 
                                  radius={[3, 3, 0, 0]} 
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="normalFit" 
                                  name="Normal Gaussian Curve Fit" 
                                  stroke="#3b82f6" 
                                  strokeWidth={2} 
                                  dot={false} 
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* INTERACTIVE CORRELATION MATRIX */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                          <div className="pb-3 border-b border-slate-800 mb-4">
                            <h3 className="font-bold text-white text-sm">Pearson Correlation Coefficient Matrix</h3>
                            <p className="text-[10px] text-slate-400">Quantifies joint linear risk sensitivity (1.00 is perfectly positive, -1.00 is inverse)</p>
                          </div>

                          <div className="overflow-x-auto border border-slate-850 rounded">
                            <table className="w-full text-left border-collapse border border-slate-850">
                              <thead>
                                <tr className="bg-slate-950/60">
                                  <th className="p-2 border border-slate-800 text-[10px] uppercase font-bold text-slate-400 font-mono">Asset</th>
                                  {[...uniqueTickers, benchmarkTicker].map(t => (
                                    <th key={t} className="p-2 border border-slate-800 text-[10px] uppercase font-bold text-slate-400 font-mono text-center">{t}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {[...uniqueTickers, benchmarkTicker].map(rowTicker => (
                                  <tr key={rowTicker} className="hover:bg-slate-850/30 transition-all">
                                    <td className="p-2 border border-slate-800 text-xs font-mono font-bold text-white">{rowTicker}</td>
                                    {[...uniqueTickers, benchmarkTicker].map(colTicker => {
                                      const val = statsMetrics.correlationMatrix[rowTicker]?.[colTicker] ?? 0;
                                      
                                      // Dynamically calculate background color intensity based on correlation
                                      let bgClass = "bg-slate-950/20";
                                      let textStyle = "text-slate-400";
                                      if (rowTicker === colTicker) {
                                        bgClass = "bg-slate-800";
                                        textStyle = "text-white font-bold";
                                      } else if (val > 0.8) {
                                        bgClass = "bg-emerald-500/20";
                                        textStyle = "text-emerald-450 font-semibold";
                                      } else if (val > 0.5) {
                                        bgClass = "bg-teal-500/15";
                                        textStyle = "text-teal-350";
                                      } else if (val > 0.2) {
                                        bgClass = "bg-blue-500/10";
                                        textStyle = "text-blue-300";
                                      } else if (val < 0) {
                                        bgClass = "bg-rose-500/15";
                                        textStyle = "text-rose-450 font-semibold";
                                      }

                                      return (
                                        <td 
                                          key={colTicker} 
                                          className={`p-3 border border-slate-800 text-[11px] font-mono text-center ${bgClass} ${textStyle}`}
                                          title={`Correlation coefficient between ${rowTicker} and ${colTicker}: ${val.toFixed(4)}`}
                                        >
                                          {val.toFixed(3)}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          <div className="flex flex-wrap items-center mt-4 gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-slate-800 block rounded-sm border border-slate-800"></span> Perfect Self (1.000)</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500/20 block rounded-sm"></span> High Risk Co-movement (&gt; 0.8)</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500/10 block rounded-sm"></span> Moderate Relationship (&gt; 0.2)</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500/15 block rounded-sm"></span> Diversification / Inverse (&lt; 0.0)</span>
                          </div>
                        </div>

                      </div>

                      {/* NEW SECTION: LINEAR REGRESSION & SENSITIVITY FRAMEWORK */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                        <div className="pb-3 border-b border-slate-800 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <h3 className="font-bold text-white text-sm">Linear Regression & Market Sensitivity Model</h3>
                            <p className="text-[10px] text-slate-400">Classical Ordinary Least Squares (OLS) regression of daily portfolio returns against the {benchmarkTicker} benchmark index</p>
                          </div>
                          <span className="text-[10px] uppercase font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/15">
                            CAPM Baseline Model
                          </span>
                        </div>

                        {/* Model Formula Banner */}
                        <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 mb-5 flex flex-col md:flex-row justify-between items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] uppercase tracking-wider text-slate-450 font-bold font-mono">Fitted Model Equation:</span>
                            <code className="text-xs text-blue-400 font-mono font-bold bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                              R_portfolio(t) = {statsMetrics.regressionAlphaDaily.toFixed(6)} + {statsMetrics.regressionBeta.toFixed(4)} × R_benchmark(t) + ε(t)
                            </code>
                          </div>
                          <div className="text-[10px] text-slate-500 font-sans max-w-xs md:text-right">
                            Derived across <span className="text-slate-300 font-mono font-bold">{statsMetrics.pfReturns.length}</span> historical joint trading sessions.
                          </div>
                        </div>

                        {/* Regression Metrics Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          
                          {/* Beta Stat */}
                          <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-lg flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Systemic Beta (β)</span>
                              <span className="text-xl font-bold font-mono text-emerald-400 block mt-1">
                                {statsMetrics.regressionBeta.toFixed(4)}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-450 mt-2 leading-relaxed">
                              Portfolio systemic risk sensitivity. A Beta of <span className="font-mono text-slate-200">{statsMetrics.regressionBeta > 1 ? ">1.0" : "<1.0"}</span> implies standard returns are <span className="font-mono text-slate-200">{statsMetrics.regressionBeta > 1 ? "more volatile" : "more defensive"}</span> than "{benchmarkTicker}".
                            </p>
                          </div>

                          {/* R-Squared Stat */}
                          <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-lg flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">R-Squared Coefficient (R²)</span>
                              <span className="text-xl font-bold font-mono text-blue-400 block mt-1">
                                {(statsMetrics.regressionRSquared * 100).toFixed(2)}%
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-450 mt-2 leading-relaxed">
                              Indicates that <span className="font-bold text-slate-200">{(statsMetrics.regressionRSquared * 100).toFixed(1)}%</span> of portfolio variance is explained purely by benchmark movements. Residuals represent unique, unsystematic component risk.
                            </p>
                          </div>

                          {/* Alpha (Intercept) Stat */}
                          <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-lg flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Annualized Alpha (α)</span>
                              <span className="text-xl font-bold font-mono text-purple-400 block mt-1">
                                {(statsMetrics.regressionAlphaAnnual * 100).toFixed(2)}%
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-450 mt-2 leading-relaxed">
                              Active daily intercept rate of <span className="font-mono text-slate-200">{(statsMetrics.regressionAlphaDaily * 100).toFixed(4)}%</span> scaled to annualized trading sessions. Measures portfolio manager/asset outperformance.
                            </p>
                          </div>

                          {/* Residual Standard Error (RSE) Stat */}
                          <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-lg flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Residual Std Error (RSE / Idio. Risk)</span>
                              <span className="text-xl font-bold font-mono text-rose-400 block mt-1">
                                {(statsMetrics.regressionRSEAnnual * 100).toFixed(2)}%
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-450 mt-2 leading-relaxed">
                              Annualized standard error of the regression residuals. Represents the unsystematic risk noise around the line of best fit (daily error is <span className="font-mono text-slate-200">{(statsMetrics.regressionRSEDaily * 100).toFixed(3)}%</span>).
                            </p>
                          </div>

                        </div>

                        {/* Joint Means & Diagnostics Sub-Table */}
                        <div className="mt-5 border-t border-slate-800 pt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                          
                          {/* Statistics T-Stat Label */}
                          <div className="lg:col-span-4 flex flex-col justify-center bg-slate-950/40 p-3 rounded-lg border border-slate-850/60 font-sans">
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Beta Significance T-Statistic</span>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-lg font-bold font-mono text-indigo-400">
                                t = {statsMetrics.regressionTStat.toFixed(3)}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400">
                                ({Math.abs(statsMetrics.regressionTStat) > 1.96 ? "Highly Significant" : "Not Statistically Significant"})
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                              An absolute value greater than 1.96 confirms portfolio leverage relation to market index is genuine, with &gt; 95% confidence level.
                            </p>
                          </div>

                          {/* Arithmetic Means comparison */}
                          <div className="lg:col-span-8 bg-slate-950/20 rounded-lg border border-slate-850 overflow-hidden">
                            <table className="w-full text-left text-[11px] font-sans">
                              <thead>
                                <tr className="bg-slate-950/60 border-b border-slate-850 font-bold text-slate-400 font-mono uppercase tracking-wider text-[9px]">
                                  <th className="p-2.5">Regression Group</th>
                                  <th className="p-2.5 text-right font-mono text-[9px] uppercase">Mean Daily Return</th>
                                  <th className="p-2.5 text-right font-mono text-[9px] uppercase">Mean Annualized Return</th>
                                  <th className="p-2.5 text-right font-mono text-[9px] uppercase bg-indigo-950/10 text-indigo-300">Mean Value CV</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850 font-mono">
                                <tr className="text-xs">
                                  <td className="p-2.5 font-bold font-sans text-white text-xs">Portfolio (Y-Series)</td>
                                  <td className="p-2.5 text-right text-slate-300">{(statsMetrics.pfMeanDaily * 100).toFixed(4)}%</td>
                                  <td className="p-2.5 text-right text-slate-300">{(statsMetrics.pfMeanAnnual * 100).toFixed(2)}%</td>
                                  <td className="p-2.5 text-right bg-indigo-950/10 text-indigo-300 font-bold">{statsMetrics.pfCVAnnual.toFixed(4)}</td>
                                </tr>
                                <tr className="text-xs">
                                  <td className="p-2.5 font-bold font-sans text-slate-400 text-xs">Benchmark Index (X-Series) ({benchmarkTicker})</td>
                                  <td className="p-2.5 text-right text-slate-400">{(statsMetrics.bmMeanDaily * 100).toFixed(4)}%</td>
                                  <td className="p-2.5 text-right text-slate-400">{(statsMetrics.bmMeanAnnual * 100).toFixed(2)}%</td>
                                  <td className="p-2.5 text-right bg-indigo-950/10 text-indigo-400 font-semibold">{statsMetrics.bmCVAnnual.toFixed(4)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                        </div>

                        {/* REGRESSION VISUAL DIAGNOSTICS SECTION */}
                        <div className="mt-6 pt-5 border-t border-slate-800">
                          <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-3 bg-indigo-500 rounded-sm"></span>
                            Regression Diagnostic Charts & Rolling Sensitivity
                          </h4>

                          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                            
                            {/* CHART 1: OLS LINE OF BEST FIT */}
                            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col h-[340px]">
                              <div className="mb-2">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Chart A: OLS Line of Best Fit</span>
                                <span className="text-[11px] text-slate-450">Plots joint daily returns {benchmarkTicker} (X) vs Portfolio (Y)</span>
                              </div>
                              <div className="flex-1 min-h-0 text-[10px]">
                                {statsMetrics?.regressionScatterData && statsMetrics?.regressionScatterData.length > 0 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                      <XAxis 
                                        type="number" 
                                        dataKey="x" 
                                        name="Benchmark Return" 
                                        unit="%" 
                                        stroke="#64748b" 
                                        fontSize={9}
                                        tickFormatter={(v) => `${v}%`}
                                        domain={['auto', 'auto']}
                                      />
                                      <YAxis 
                                        type="number" 
                                        dataKey="y" 
                                        name="Portfolio Return" 
                                        unit="%" 
                                        stroke="#64748b" 
                                        fontSize={9}
                                        tickFormatter={(v) => `${v}%`}
                                        domain={['auto', 'auto']}
                                      />
                                      <Tooltip 
                                        content={({ active, payload }) => {
                                          if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-slate-300 font-sans shadow-xl text-[10px] leading-relaxed max-w-[180px]">
                                                <div className="border-b border-slate-850 pb-1 font-bold text-[11px] text-white font-mono">{data.date}</div>
                                                <div className="mt-1 flex justify-between gap-2">
                                                  <span>Bench Return:</span>
                                                  <span className="font-mono text-blue-400 font-bold">{data.x}%</span>
                                                </div>
                                                <div className="flex justify-between gap-2">
                                                  <span>Portf Return:</span>
                                                  <span className="font-mono text-emerald-300 font-bold">{data.y}%</span>
                                                </div>
                                                <div className="flex justify-between gap-2 border-t border-slate-850/60 pt-1 mt-1 text-slate-400">
                                                  <span>Deviation (ε):</span>
                                                  <span className={`font-mono font-bold ${data.residual >= 0 ? "text-indigo-400" : "text-rose-400"}`}>{data.residual}%</span>
                                                </div>
                                              </div>
                                            );
                                          }
                                          return null;
                                        }}
                                      />
                                      <Scatter 
                                        name="Joint Returns" 
                                        data={statsMetrics.regressionScatterData} 
                                        fill="#3b82f6" 
                                        opacity={0.35} 
                                      />
                                      <Scatter 
                                        name="Linear Best Fit" 
                                        data={statsMetrics.regressionLineData} 
                                        line={{ stroke: '#8b5cf6', strokeWidth: 1.5 }} 
                                        shape="none" 
                                      />
                                    </ScatterChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="h-full flex items-center justify-center text-slate-500 font-mono text-[10px]">
                                    No regression data points available.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* CHART 2: DAILY OLS RESIDUAL ERROR DISTRIBUTION */}
                            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col h-[340px]">
                              <div className="mb-2">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Chart B: Unsystematic Residual Error (ε)</span>
                                <span className="text-[11px] text-slate-450 font-sans">Chronological daily distance from line-of-best-fit</span>
                              </div>
                              <div className="flex-1 min-h-0">
                                {statsMetrics?.regressionScatterData && statsMetrics?.regressionScatterData.length > 0 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={statsMetrics.regressionScatterData} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                      <XAxis 
                                        dataKey="date" 
                                        stroke="#64748b" 
                                        fontSize={8} 
                                        tickFormatter={(d) => d ? d.substring(5) : ""} 
                                      />
                                      <YAxis 
                                        stroke="#64748b" 
                                        fontSize={9} 
                                        tickFormatter={(v) => `${v}%`}
                                      />
                                      <Tooltip 
                                        content={({ active, payload }) => {
                                          if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                              <div className="bg-slate-950 border border-slate-800 p-2 rounded-lg text-[10px] leading-relaxed shadow-2xl font-mono text-slate-300">
                                                <div className="font-bold text-white mb-1 font-sans">{data.date}</div>
                                                <span className="text-slate-400 font-sans">Residual (Unsystematic):</span> <span className={`font-bold ${data.residual >= 0 ? "text-indigo-400" : "text-rose-400"}`}>{data.residual}%</span>
                                              </div>
                                            );
                                          }
                                          return null;
                                        }}
                                      />
                                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} />
                                      <Area 
                                        type="monotone" 
                                        dataKey="residual" 
                                        stroke="#10b981" 
                                        fill="url(#colorResidual)" 
                                        strokeWidth={1} 
                                      />
                                      <defs>
                                        <linearGradient id="colorResidual" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                    </AreaChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="h-full flex items-center justify-center text-slate-500 font-mono text-[10px]">
                                    No residual points available.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* CHART 3: 60-DAY ROLLING BETA & R-SQUARED */}
                            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col h-[340px] lg:col-span-2 xl:col-span-1">
                              <div className="mb-2">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">Chart C: Rolling Dynamic Market Beta (60-Day)</span>
                                <span className="text-[11px] text-slate-450">Demonstrates dynamic systematic sensitivity shifting over time</span>
                              </div>
                              <div className="flex-1 min-h-0">
                                {statsMetrics?.rollingMetrics && statsMetrics?.rollingMetrics.length > 0 ? (
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={statsMetrics.rollingMetrics} margin={{ top: 10, right: -5, bottom: 20, left: -20 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                      <XAxis 
                                        dataKey="date" 
                                        stroke="#64748b" 
                                        fontSize={8} 
                                        tickFormatter={(d) => d ? d.substring(2) : ""} 
                                      />
                                      <YAxis 
                                        yAxisId="left" 
                                        stroke="#10b981" 
                                        fontSize={9} 
                                        domain={['auto', 'auto']}
                                      />
                                      <YAxis 
                                        yAxisId="right" 
                                        orientation="right" 
                                        stroke="#3b82f6" 
                                        fontSize={9} 
                                        tickFormatter={(v) => `${v}%`}
                                        domain={[0, 100]}
                                      />
                                      <Tooltip 
                                        content={({ active, payload }) => {
                                          if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                              <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-[10px] leading-relaxed shadow-2xl font-mono text-slate-300">
                                                <div className="font-bold text-white mb-1 font-sans">{data.date}</div>
                                                <div className="flex justify-between gap-3">
                                                  <span className="text-[#10b981] font-sans">60D Beta (β):</span>
                                                  <strong>{data.beta}</strong>
                                                </div>
                                                <div className="flex justify-between gap-3">
                                                  <span className="text-[#3b82f6] font-sans">60D R-Squared (R²):</span>
                                                  <strong>{data.rSquared}%</strong>
                                                </div>
                                              </div>
                                            );
                                          }
                                          return null;
                                        }}
                                      />
                                      <Legend wrapperStyle={{ fontSize: '9px', marginTop: '-5px' }} />
                                      <Line 
                                        yAxisId="left" 
                                        type="monotone" 
                                        dataKey="beta" 
                                        stroke="#10b981" 
                                        name="Rolling Beta" 
                                        dot={false} 
                                        strokeWidth={1.5} 
                                      />
                                      <Line 
                                        yAxisId="right" 
                                        type="monotone" 
                                        dataKey="rSquared" 
                                        stroke="#3b82f6" 
                                        name="R-Squared %" 
                                        dot={false} 
                                        strokeWidth={1.5} 
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="h-full flex items-center justify-center text-slate-500 font-mono text-[10px]">
                                    Insufficient days (&lt;60) to compute rolling Beta.
                                  </div>
                                )}
                              </div>
                            </div>

                          </div>
                        </div>

                      </div>

                      {/* HISTORICAL STRESS TESTS & DRAWDOWN SIMULATION SECTION */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
                        <div className="pb-3 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-white text-sm flex items-center gap-2">
                              <span className="w-1.5 h-3 bg-rose-500 rounded-sm"></span>
                              Historical Extreme Stress Testing & Drawdown Scenarios
                            </h3>
                            <p className="text-[10px] text-slate-400">
                              Simulates expected portfolio capital destruction during historic macroeconomic crises based on the portfolio's estimated systematic volatility sensitivity (β = {metrics.beta.toFixed(3)})
                            </p>
                          </div>
                          <span className="bg-rose-505/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-wider">
                            Systemic Risk Modeling
                          </span>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                          
                          {/* CRISIS TABULAR COMPARISONS */}
                          <div className="xl:col-span-2 space-y-3.5">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                              Classic Systemic Liquidity Shocks & Black Swan Scenarios
                            </span>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {[
                                {
                                  name: "2008 Great Financial Crisis",
                                  desc: "Subprime Mortgages & Global Banking Freeze",
                                  period: "Oct 2007 – Mar 2009",
                                  shock: -50.0
                                },
                                {
                                  name: "2020 COVID-19 Panic Crash",
                                  desc: "Lockdown Sudden Stop & Worldwide Liquidity Vacuum",
                                  period: "Feb 2020 – Mar 2020",
                                  shock: -33.9
                                },
                                {
                                  name: "2000 Dot-Com Bubble Implosion",
                                  desc: "Exponential Tech Valuations Deflate",
                                  period: "Mar 2000 – Oct 2002",
                                  shock: -49.1
                                },
                                {
                                  name: "1970s Oil Shock & Stagflation",
                                  desc: "OPEC Embargo & Great Inflation Spirals",
                                  period: "Jan 1973 – Dec 1974",
                                  shock: -27.5
                                }
                              ].map((item, idx) => {
                                const expectedPortLoss = metrics.beta * item.shock;
                                const lossDollar = metrics.currentValue * (expectedPortLoss / 100);
                                const finalValue = metrics.currentValue + lossDollar;
                                
                                return (
                                  <div key={idx} className="border border-slate-800 bg-slate-950/20 p-3.5 rounded-xl flex flex-col justify-between hover:border-slate-700 transition duration-150">
                                    <div>
                                      <div className="flex justify-between items-start gap-1">
                                        <div className="min-w-0">
                                          <h4 className="font-bold text-white text-xs leading-normal truncate">{item.name}</h4>
                                          <p className="text-[10px] text-slate-500 truncate leading-relaxed">{item.desc}</p>
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-505 shrink-0 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850">
                                          {item.period}
                                        </span>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 gap-2 mt-3 bg-slate-950/40 rounded-lg p-2.5 border border-slate-850/40 font-mono text-[10px]">
                                        <div>
                                          <span className="text-[9px] text-slate-500 uppercase font-sans font-bold leading-none block mb-0.5">Index Drawdown</span>
                                          <span className="font-bold text-slate-300">{item.shock.toFixed(1)}%</span>
                                        </div>
                                        <div>
                                          <span className="text-[9px] text-slate-500 uppercase font-sans font-bold leading-none block mb-0.5">Est. Portfolio Return</span>
                                          <span className={`font-bold ${expectedPortLoss < 0 ? "text-rose-450" : "text-emerald-400"}`}>
                                            {expectedPortLoss.toFixed(2)}%
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="mt-3 pt-2.5 border-t border-slate-850/70 flex justify-between items-center text-[11px]">
                                      <span className="text-slate-400">Value Post-Shock:</span>
                                      <div className="text-right">
                                        <span className="font-bold text-white font-mono">{formatCurrency(finalValue)}</span>
                                        <span className="text-[9.5px] font-mono text-rose-450 block leading-none mt-0.5">
                                          ({formatCurrency(lossDollar)})
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* INTERACTIVE CUSTOM SLIDER BLOCK */}
                          <div className="bg-slate-950 border border-slate-850 rounded-xl p-4.5 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1.5 pb-2 border-b border-slate-900">
                                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Custom Shock Estimator</span>
                                <Sliders className="h-3.5 w-3.5 text-blue-500" />
                              </div>
                              <p className="text-[11px] text-slate-450 leading-relaxed font-sans mt-1">
                                Drag the slider to simulate a custom severe index correction and review the expected systemic impact across your current position size.
                              </p>

                              <div className="space-y-4 mt-4">
                                <div className="space-y-1.5">
                                  <div className="flex justify-between font-mono text-[11px] font-bold">
                                    <span className="text-slate-400">Index Correction Magnitude:</span>
                                    <span className="text-rose-400">{customCrashShock}%</span>
                                  </div>
                                  <input 
                                    type="range"
                                    min="-80"
                                    max="50"
                                    step="1"
                                    value={customCrashShock}
                                    onChange={(e) => setCustomCrashShock(Number(e.target.value))}
                                    className="w-full accent-blue-500 cursor-ew-resize h-1.5 bg-slate-850 rounded-lg appearance-none"
                                  />
                                  <div className="flex justify-between font-mono text-[9px] text-slate-500 px-0.5 mt-0.5">
                                    <span>Extreme Crash (-80%)</span>
                                    <span>Neutral (0%)</span>
                                    <span>Bull shock (+50%)</span>
                                  </div>
                                </div>

                                <div className="space-y-2 pt-1 border-t border-slate-900/80">
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-400">Total Portfolio Beta (β):</span>
                                    <span className="font-mono text-white font-bold">{metrics.beta.toFixed(3)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-400">Predicted Portfolio Shock:</span>
                                    <span className={`font-mono font-bold ${(metrics.beta * customCrashShock) < 0 ? "text-rose-450" : "text-emerald-450"}`}>
                                      {(metrics.beta * customCrashShock).toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-400">Portfolio Capital Deficit:</span>
                                    <span className={`font-mono font-bold ${(metrics.beta * customCrashShock) < 0 ? "text-rose-450" : "text-emerald-450"}`}>
                                      {formatCurrency(metrics.currentValue * (metrics.beta * customCrashShock / 100))}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 pt-3.5 border-t border-slate-900 flex justify-between items-center bg-slate-900/30 rounded-lg p-2.5 border border-slate-900">
                              <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Simulated Value:</span>
                              <div className="text-right">
                                <span className={`text-sm font-black font-mono leading-none block ${(metrics.beta * customCrashShock) < 0 ? "text-rose-455" : "text-emerald-400"}`}>
                                  {formatCurrency(metrics.currentValue * (1 + (metrics.beta * customCrashShock / 100)))}
                                </span>
                              </div>
                            </div>

                          </div>

                        </div>
                      </div>

                      {/* INDIVIDUAL ASSET QUANTITATIVE METRICS TABLE */}
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                        <div className="pb-3 border-b border-slate-800 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-white text-sm">Individual Assets Quantitative Diagnostics</h3>
                            <p className="text-[10px] text-slate-400">Micro-level volatility benchmarks, skewness, Sharpe, and peak drawdowns relative to backtested timeline</p>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            * Sharpe uses Risk-Free Rate = {riskFreeRate}%
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 bg-slate-950/40 text-[10px] uppercase font-bold text-slate-400 font-mono leading-normal">
                                <th className="py-2.5 px-3">Asset</th>
                                <th className="py-2.5 px-3 text-right">Mean Daily</th>
                                <th className="py-2.5 px-3 text-right text-teal-400 font-semibold">Annual Vol (StdDev)</th>
                                <th className="py-2.5 px-3 text-right text-emerald-400 font-semibold">Stock CAGR</th>
                                <th className="py-2.5 px-3 text-right text-indigo-400 font-semibold">Sharpe Ratio*</th>
                                <th className="py-2.5 px-3 text-right text-rose-400 font-semibold">Max Drawdown</th>
                                <th className="py-2.5 px-3 text-right">Skewness</th>
                                <th className="py-2.5 px-3 text-right">Kurtosis (Ex)</th>
                                <th className="py-2.5 px-3 text-right font-bold">Bench Corr</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/60">
                              {statsMetrics.assetStats.map(asset => (
                                <tr key={asset.ticker} className="hover:bg-slate-850/20 transition-all">
                                  <td className="py-3 px-3 font-mono font-bold text-white text-xs">{asset.ticker}</td>
                                  <td className="py-3 px-3 text-right font-mono text-slate-300">{(asset.meanDaily * 100).toFixed(3)}%</td>
                                  <td className="py-3 px-3 text-right font-mono text-teal-300">{(asset.volAnnual * 100).toFixed(2)}%</td>
                                  <td className="py-3 px-3 text-right font-mono text-emerald-300 font-semibold">
                                    {asset.cagr >= 0 ? "+" : ""}{asset.cagr.toFixed(2)}%
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono font-bold ${asset.sharpe >= 1 ? "text-emerald-400" : asset.sharpe >= 0 ? "text-slate-200" : "text-rose-450"}`}>
                                    {asset.sharpe.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-rose-455">{(asset.maxDD * 100).toFixed(2)}%</td>
                                  <td className={`py-3 px-3 text-right font-mono ${asset.skew < 0 ? "text-orange-400" : "text-slate-400"}`}>{asset.skew.toFixed(2)}</td>
                                  <td className="py-3 px-3 text-right font-mono text-slate-400">{asset.kurt > 0 ? "+" : ""}{asset.kurt.toFixed(2)}</td>
                                  <td className="py-3 px-3 text-right font-mono font-bold text-indigo-300">{asset.correlationWithBenchmark.toFixed(3)}</td>
                                </tr>
                              ))}
                              {/* Include Benchmark as row as well for complete baseline comparison */}
                              <tr className="bg-slate-950/40 divide-y divide-slate-850 font-semibold">
                                <td className="py-3 px-3 font-mono font-bold text-slate-405 text-xs">INDEX ({benchmarkTicker})</td>
                                <td className="py-3 px-3 text-right font-mono text-slate-405">{(statsMetrics.bmMeanDaily * 100).toFixed(3)}%</td>
                                <td className="py-3 px-3 text-right font-mono text-slate-405">{(statsMetrics.bmSDAnnual * 100).toFixed(2)}%</td>
                                <td className="py-3 px-3 text-right font-mono text-slate-405">
                                  {metrics.benchmarkCagr >= 0 ? "+" : ""}{metrics.benchmarkCagr.toFixed(2)}%
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-slate-405">
                                  {metrics.benchmarkSharpe.toFixed(2)}
                                </td>
                                <td className="py-3 px-3 text-right font-mono text-slate-500">{(metrics.benchmarkMaxDrawdown * 100).toFixed(2)}%</td>
                                <td className="py-3 px-3 text-right font-mono text-slate-405">{statsMetrics.bmSkew.toFixed(2)}</td>
                                <td className="py-3 px-3 text-right font-mono text-slate-405">{statsMetrics.bmKurt > 0 ? "+" : ""}{statsMetrics.bmKurt.toFixed(2)}</td>
                                <td className="py-3 px-3 text-right font-mono text-slate-405 font-bold">1.000</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* TAB 3: GRANULAR MATH TABLES */}
              {activeTab === "math" && (
                <motion.div
                  key="math-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6 flex-1 flex flex-col"
                >
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex-1 flex flex-col">
                    
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 mb-4 border-b border-slate-800">
                      <div>
                        <h3 className="font-bold text-white text-base">Historical Equity curves Register</h3>
                        <p className="text-xs text-slate-400">Granular daily prices, compounded return indices, and peak drawdowns</p>
                      </div>
                      
                      {dailyData.length > 0 && (
                        <div className="flex flex-row items-center gap-2 self-stretch sm:self-auto">
                          
                          {/* TABLE SEARCH BAR */}
                          <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-500" />
                            <input
                              type="text"
                              placeholder="Search Date (YYYY-MM-DD)..."
                              value={searchTerm}
                              onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                              }}
                              className="w-full sm:w-48 bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          <button
                            onClick={handleExportCSV}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3 py-1.5 rounded transition-all flex items-center gap-1.5 shrink-0"
                            title="Export to CSV"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Export CSV</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {dailyData.length === 0 ? (
                      <div className="py-16 text-center text-slate-500">
                        No calculations loaded. Add assets and verify performance in Setup/Performance views first.
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-between">
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                                <th className="py-2.5 px-3">Date</th>
                                <th className="py-2.5 px-3 text-right">Portfolio Equity (₹)</th>
                                <th className="py-2.5 px-3 text-right text-blue-400">NAV per Unit (₹)</th>
                                <th className="py-2.5 px-3 text-right text-purple-400">Total Units</th>
                                <th className="py-2.5 px-3 text-right text-emerald-400">NAV Daily Return</th>
                                <th className="py-2.5 px-3 text-right text-slate-450">BM Daily Return</th>
                                <th className="py-2.5 px-3 text-right text-amber-500 font-bold">NAV vs BM Delta</th>
                                <th className="py-2.5 px-3 text-right">Cumulative Return (%)</th>
                                <th className="py-2.5 px-3 text-right">Benchmark Price (₹)</th>
                                <th className="py-2.5 px-3 text-right">Benchmark Cumulative</th>
                                {[...uniqueTickers].sort().map((ticker) => (
                                  <React.Fragment key={ticker}>
                                    <th className="py-2.5 px-3 text-right text-cyan-400 font-medium border-l border-slate-800/40">
                                      {ticker} Price (₹)
                                    </th>
                                    <th className="py-2.5 px-3 text-right text-amber-500 font-medium">
                                      {ticker} Return
                                    </th>
                                  </React.Fragment>
                                ))}
                                <th className="py-2.5 px-3 text-right">Underwater Drawdown</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850/65 font-mono">
                              {paginatedTableData.map((d) => {
                                const delta = d.portfolioDailyReturn - d.benchmarkDailyReturn;
                                return (
                                  <tr key={d.date} className="hover:bg-slate-850/30 transition-all text-slate-200">
                                    <td className="py-2.5 px-3 font-semibold text-slate-400">{d.date}</td>
                                    <td className="py-2.5 px-3 text-right text-white font-bold">{formatCurrency(d.portfolioValue)}</td>
                                    <td className="py-2.5 px-3 text-right text-blue-300 font-semibold">₹{(d.currentNav || 100).toFixed(4)}</td>
                                    <td className="py-2.5 px-3 text-right text-purple-300">{(d.totalUnits || 0).toLocaleString("en-IN", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                                    <td className={`py-2.5 px-3 text-right ${
                                      d.portfolioDailyReturn >= 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}>
                                      {vPercent(d.portfolioDailyReturn)}
                                    </td>
                                    <td className={`py-2.5 px-3 text-right ${
                                      d.benchmarkDailyReturn >= 0 ? "text-slate-400" : "text-rose-400/90"
                                    }`}>
                                      {vPercent(d.benchmarkDailyReturn)}
                                    </td>
                                    <td className={`py-2.5 px-3 text-right font-bold ${
                                      delta >= 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}>
                                      {vPercent(delta)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-semibold">{d.portfolioCumulativeReturn.toFixed(2)}%</td>
                                    <td className="py-2.5 px-3 text-right text-slate-400">{formatCurrency(d.benchmarkValue)}</td>
                                    <td className="py-2.5 px-3 text-right text-slate-500">{d.benchmarkCumulativeReturn.toFixed(2)}%</td>
                                    {[...uniqueTickers].sort().map((ticker) => {
                                      const pr = d[`price_${ticker}`];
                                      const ret = d[`return_${ticker}`];
                                      return (
                                        <React.Fragment key={ticker}>
                                          <td className="py-2.5 px-3 text-right text-cyan-300 font-semibold border-l border-slate-800/40">
                                            {pr !== undefined ? `₹${pr.toFixed(2)}` : "-"}
                                          </td>
                                          <td className={`py-2.5 px-3 text-right font-semibold ${
                                            ret !== undefined && ret >= 0 ? "text-emerald-400" : ret !== undefined ? "text-rose-400" : "text-slate-500"
                                          }`}>
                                            {ret !== undefined ? vPercent(ret) : "-"}
                                          </td>
                                        </React.Fragment>
                                      );
                                    })}
                                    <td className={`py-2.5 px-3 text-right font-medium ${
                                      d.drawdown < 0 ? "text-rose-500/80" : "text-emerald-500"
                                    }`}>
                                      {(d.drawdown * 100).toFixed(2)}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* TABLE PAGINATION */}
                        {filteredTableData.length > itemsPerPage && (
                          <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-400 mt-4">
                            <span>
                              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTableData.length)} of {filteredTableData.length} records
                            </span>
                            
                            <div className="flex gap-1">
                              <button
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-2 py-1 rounded bg-slate-800 text-white disabled:opacity-40 hover:bg-slate-750 font-medium font-sans"
                              >
                                Prev
                              </button>
                              
                              <span className="px-3 py-1 bg-slate-950 rounded border border-slate-800 font-mono">
                                Page {currentPage} of {totalPages}
                              </span>

                              <button
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="px-2 py-1 rounded bg-slate-800 text-white disabled:opacity-40 hover:bg-slate-750 font-medium font-sans"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}

                      </div>
                    )}

                  </div>
                </motion.div>
              )}

            </AnimatePresence>

          </div>

          {/* FULL-SIZE CHART MODAL */}
          <AnimatePresence>
            {maximizedChart && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-6"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 15 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 15 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden shadow-2xl relative"
                >
                  {/* Modal Head */}
                  <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
                    <div>
                      <h3 className="font-bold text-white text-base font-display">
                        {maximizedChart === "returns" && "Portfolio Cumulative Returns (%)"}
                        {maximizedChart === "growth" && "Equity Growth (Rebased to 100)"}
                        {maximizedChart === "drawdown" && "Underwater Peak-to-Trough Drawdown (%)"}
                        {maximizedChart === "annual" && "Annual Performance Comparison (%)"}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {maximizedChart === "returns" && "Compounded total percentage return over time vs benchmark index"}
                        {maximizedChart === "growth" && "Compares cumulative compounded growth vs. index since starting purchase date"}
                        {maximizedChart === "drawdown" && "Monitors historical asset erosion and recovery periods (%)"}
                        {maximizedChart === "annual" && "Yearly return comparison side-by-side"}
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => setMaximizedChart(null)}
                      className="bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white p-2 rounded-lg transition-all border border-slate-750"
                      title="Close Fullsize View"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Modal Body: Active Chart Area */}
                  <div className="flex-1 p-6 min-h-0 min-w-0 bg-slate-900 flex flex-col justify-between">
                    
                    {/* Specific Chart Keys / Legends */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono text-slate-400 mb-4 pb-2 border-b border-slate-850/50 shrink-0">
                      {maximizedChart === "returns" && (
                        <>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500 block"></span>Portfolio Return</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-500 block"></span>Index Benchmark ({benchmarkTicker})</span>
                        </>
                      )}
                      {maximizedChart === "growth" && (
                        <>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500 block"></span>Index ({benchmarkTicker})</span>
                          {uniqueTickers.map((ticker, idx) => {
                            const color = TICKER_COLORS[idx % TICKER_COLORS.length];
                            return (
                              <span key={ticker} className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="w-2 h-2 rounded-sm block" style={{ backgroundColor: color }}></span>
                                <span>{ticker}</span>
                              </span>
                            );
                          })}
                        </>
                      )}
                      {maximizedChart === "drawdown" && (
                        <>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500 block"></span>Portfolio</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-600 block"></span>Index</span>
                        </>
                      )}
                      {maximizedChart === "annual" && (
                        <>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-400 block"></span>Portfolio</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-500 block"></span>Benchmark ({benchmarkTicker})</span>
                        </>
                      )}
                    </div>

                    <div className="flex-1 min-h-0 min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        {maximizedChart === "growth" ? (
                          <LineChart data={filteredDailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                            <XAxis 
                              dataKey="date" 
                              stroke="#64748b" 
                              fontSize={11} 
                              tickLine={false}
                              minTickGap={60}
                            />
                            <YAxis 
                              stroke="#64748b" 
                              fontSize={11} 
                              tickLine={false}
                              domain={['auto', 'auto']}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 12 }}
                              formatter={(value: any, name: any) => [`${Number(value).toFixed(2)}`, name]}
                            />
                            <Line 
                              type="monotone" 
                              dataKey={(d) => d.benchmarkCumulativeReturn + 100}
                              name={benchmarkTicker} 
                              stroke="#64748b" 
                              strokeWidth={2} 
                              dot={false}
                            />
                            {uniqueTickers.map((ticker, idx) => {
                              const color = TICKER_COLORS[idx % TICKER_COLORS.length];
                              return (
                                <Line 
                                  key={ticker}
                                  type="monotone" 
                                  dataKey={`rebased_${ticker}`}
                                  name={ticker} 
                                  stroke={color} 
                                  strokeWidth={1.8} 
                                  dot={false}
                                  strokeDasharray="4 2"
                                  activeDot={{ r: 4 }}
                                />
                              );
                            })}
                          </LineChart>
                        ) : maximizedChart === "returns" ? (
                          <AreaChart data={filteredDailyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="modalPortfolioReturnGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                            <XAxis 
                              dataKey="date" 
                              stroke="#64748b" 
                              fontSize={11} 
                              tickLine={false}
                              minTickGap={60}
                            />
                            <YAxis 
                              stroke="#64748b" 
                              fontSize={11} 
                              tickLine={false}
                              tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                            />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-2xl font-mono text-[11px] space-y-2 z-50">
                                      <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 flex items-center justify-between gap-4">
                                        <span>{data.date}</span>
                                        <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded text-blue-400 font-bold uppercase tracking-wider">NAV Basis</span>
                                      </div>
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-6">
                                          <span className="text-emerald-400 flex items-center gap-1.5 font-bold font-mono">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block shrink-0"></span>
                                            Portfolio Return:
                                          </span>
                                          <span className="font-bold text-white">{Number(data.portfolioCumulativeReturn).toFixed(2)}%</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-6">
                                          <span className="text-slate-400 flex items-center gap-1.5 font-mono">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500 block shrink-0"></span>
                                            Index Return:
                                          </span>
                                          <span className="text-slate-300 font-semibold">{Number(data.benchmarkCumulativeReturn).toFixed(2)}%</span>
                                        </div>
                                        
                                        <div className="border-t border-slate-800 my-1 pt-1.5 space-y-1 text-slate-300">
                                          <div className="flex items-center justify-between gap-6">
                                            <span className="text-slate-500">Portfolio Value:</span>
                                            <span className="font-semibold text-slate-200">{formatCurrency(data.portfolioValue)}</span>
                                          </div>
                                          <div className="flex items-center justify-between gap-6">
                                            <span className="text-slate-500">Current NAV:</span>
                                            <span className="font-bold text-blue-400">{Number(data.currentNav).toFixed(2)}</span>
                                          </div>
                                          <div className="flex items-center justify-between gap-6">
                                            <span className="text-slate-500">Total Units:</span>
                                            <span className="font-semibold text-slate-300">{Number(data.totalUnits).toFixed(2)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="portfolioCumulativeReturn" 
                              name="Portfolio Return" 
                              stroke="#10b981" 
                              strokeWidth={2.5}
                              fillOpacity={1} 
                              fill="url(#modalPortfolioReturnGrad)" 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="benchmarkCumulativeReturn" 
                              name={`Index (${benchmarkTicker})`}
                              stroke="#64748b" 
                              strokeWidth={2} 
                              dot={false}
                            />
                          </AreaChart>
                        ) : maximizedChart === "drawdown" ? (
                          <AreaChart data={filteredDailyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="modalPfDrawdownGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                            <XAxis 
                              dataKey="date" 
                              stroke="#64748b" 
                              fontSize={11} 
                              tickLine={false}
                              minTickGap={60}
                            />
                            <YAxis 
                              stroke="#64748b" 
                              fontSize={11} 
                              tickLine={false}
                              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 12 }}
                              formatter={(value: any) => [`${(Number(value) * 100).toFixed(2)}%`, '']}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="drawdown" 
                              name="Portfolio" 
                              stroke="#f43f5e" 
                              fillOpacity={1} 
                              fill="url(#modalPfDrawdownGrad)" 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="benchmarkDrawdown" 
                              stroke="#475569" 
                              strokeWidth={1.5} 
                              dot={false}
                            />
                          </AreaChart>
                        ) : (
                          <BarChart data={filteredAnnualReturns} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.3} />
                            <XAxis dataKey="year" stroke="#64748b" fontSize={12} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: 12 }}
                              formatter={(v: any) => [`${Number(v).toFixed(2)}%`, '']}
                            />
                            <Bar dataKey="portfolioReturn" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={60} />
                            <Bar dataKey="benchmarkReturn" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={60} />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dynamic Theme Bottom Status bar */}
          <footer className="h-10 bg-slate-900 border-t border-slate-800/80 px-6 flex items-center justify-between text-[11px] text-slate-500 font-mono shrink-0 select-none">
            {metrics ? (
              <div className="flex gap-4 items-center overflow-x-auto whitespace-nowrap">
                <span className="shrink-0">VOLATILITY: {(metrics.annualizedVolatility * 100).toFixed(2)}%</span>
                <span className="text-slate-850 shrink-0">|</span>
                <span className="shrink-0">SORTINO: {metrics.sortinoRatio.toFixed(2)}</span>
                <span className="shrink-0 text-slate-850">|</span>
                <span className="shrink-0">CAGR: {(metrics.cagr).toFixed(2)}%</span>
                <span className="shrink-0 text-slate-850">|</span>
                <span className="shrink-0">REAL RETURN: {(metrics.realReturn).toFixed(2)}%</span>
              </div>
            ) : (
              <div className="text-slate-650">AWAITING BACKTEST COMPUTATIONS</div>
            )}
            <div className="hidden sm:flex items-center gap-2">
              <span className="italic">Last Refresh: {new Date().toISOString().split("T")[0]} ET</span>
            </div>
          </footer>

          {/* INDEX SYSTEM DIRECTORY EXPLORER MODAL */}
          <AnimatePresence>
            {showIndexExplorer && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowIndexExplorer(false)}
                  className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                />

                {/* Modal Container */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                  className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden z-10"
                >
                  {/* Header */}
                  <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 sticky top-0 backdrop-blur-md z-10">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base font-display">Index Benchmarks Directory</h3>
                        <p className="text-xs text-slate-400">Select any official NSE Nifty index or S&P BSE index to compute tracking metrics.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIndexExplorer(false)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Search and Filters toolbar */}
                  <div className="p-4 bg-slate-950/40 border-b border-slate-850 space-y-3.5 shrink-0">
                    <div className="flex flex-col sm:flex-row gap-3">
                      {/* Search Bar */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          value={explorerSearch}
                          onChange={(e) => setExplorerSearch(e.target.value)}
                          placeholder="Search indices by name or symbol (e.g. Nifty Microcap, Auto)..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 font-sans tracking-wide focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {explorerSearch && (
                          <button
                            type="button"
                            onClick={() => setExplorerSearch("")}
                            className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 text-xs"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Source/Exchange Filter */}
                      <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0 self-start sm:self-auto select-none">
                        <button
                          type="button"
                          onClick={() => setExplorerFilterSource("ALL")}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            explorerFilterSource === "ALL"
                              ? "bg-blue-500/10 text-blue-300"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          All Exchanges
                        </button>
                        <button
                          type="button"
                          onClick={() => setExplorerFilterSource("NSE")}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            explorerFilterSource === "NSE"
                              ? "bg-blue-500/10 text-blue-300"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          NSE (Nifty)
                        </button>
                        <button
                          type="button"
                          onClick={() => setExplorerFilterSource("BSE")}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                            explorerFilterSource === "BSE"
                              ? "bg-blue-500/10 text-blue-300"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          BSE (S&P BSE)
                        </button>
                      </div>
                    </div>

                    {/* Category Filter */}
                    <div className="flex flex-wrap items-center gap-1.5 select-none">
                      <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mr-2">Index Class:</span>
                      {[
                        { id: "ALL", label: "All Classes" },
                        { id: "Broad Market", label: "Broad Market" },
                        { id: "Sectoral", label: "Sectoral" },
                        { id: "Thematic", label: "Thematic" },
                        { id: "Popular Strategy", label: "Popular Strategies" }
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setExplorerFilterCategory(cat.id as any)}
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full transition-all border ${
                            explorerFilterCategory === cat.id
                              ? "bg-slate-800 text-white border-blue-500/40"
                              : "bg-transparent text-slate-400 border-slate-800 hover:text-slate-200"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid Content */}
                  <div className="flex-1 p-6 overflow-y-auto bg-slate-950/20 space-y-6">
                    {/* Render filtered grid */}
                    {(() => {
                      const filtered = INDICES_REGISTRY.filter((ind) => {
                        const matchesSearch =
                          ind.name.toLowerCase().includes(explorerSearch.toLowerCase()) ||
                          ind.symbol.toLowerCase().includes(explorerSearch.toLowerCase());
                        const matchesSource =
                          explorerFilterSource === "ALL" || ind.source === explorerFilterSource;
                        const matchesCategory =
                          explorerFilterCategory === "ALL" || ind.category === explorerFilterCategory;
                        return matchesSearch && matchesSource && matchesCategory;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-16">
                            <Sliders className="h-8 w-8 text-slate-600 mx-auto mb-3.5 stroke-1" />
                            <h4 className="text-sm font-bold text-slate-350">No Benchmark Indices Found</h4>
                            <p className="text-xs text-slate-550 mt-1 max-w-sm mx-auto">
                              Try searching another index term or clearing your current filters. We support custom index tracking as well!
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setExplorerSearch("");
                                setExplorerFilterSource("ALL");
                                setExplorerFilterCategory("ALL");
                              }}
                              className="mt-4 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition-colors border border-slate-750"
                            >
                              Reset All Filters
                            </button>
                          </div>
                        );
                      }

                      // Categorize the results to display grouped or flat
                      const nseGroup = filtered.filter(f => f.source === "NSE");
                      const bseGroup = filtered.filter(f => f.source === "BSE");

                      const renderGroupList = (list: typeof filtered, title: string, colorClass: string) => {
                        if (list.length === 0) return null;
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5 pb-1 border-b border-slate-800">
                              <span className={`w-2 h-2 rounded-full ${colorClass}`}></span>
                              <span className="font-bold text-xs uppercase tracking-wider text-slate-400">{title} ({list.length})</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {list.map((ind) => (
                                <button
                                  key={`${ind.source}-${ind.symbol}-${ind.name}`}
                                  type="button"
                                  onClick={() => {
                                    setBenchmarkInput(ind.symbol);
                                    setBenchmarkSuggestions([]);
                                    setShowIndexExplorer(false);
                                  }}
                                  className="text-left bg-slate-900 border border-slate-800/80 hover:border-blue-500/40 hover:bg-slate-850 p-3.5 rounded-xl transition-all relative group shadow-sm flex flex-col justify-between h-28"
                                >
                                  <div>
                                    <div className="flex items-center justify-between gap-2.5">
                                      <span className="font-bold font-mono text-xs text-blue-400 group-hover:text-blue-300 truncate max-w-[155px]">
                                        {ind.symbol}
                                      </span>
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-400 group-hover:text-slate-300 transform scale-90">
                                        {ind.category}
                                      </span>
                                    </div>
                                    <h4 className="text-xs font-semibold text-white mt-1.5 font-display leading-tight line-clamp-2">
                                      {ind.name}
                                    </h4>
                                  </div>

                                  <div className="mt-2 pt-1.5 border-t border-slate-800/40 flex items-center justify-between text-[10px]">
                                    <span className="text-slate-500 font-mono">{ind.source} exchange</span>
                                    {ind.proxyNote ? (
                                      <span className="text-[10px] text-amber-500/80 font-mono font-medium flex items-center gap-1">
                                        {ind.proxyNote}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-500/80 font-mono">100% active feed</span>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-6">
                          {renderGroupList(nseGroup, "National Stock Exchange (NSE) - NIFTY Indices", "bg-emerald-500")}
                          {renderGroupList(bseGroup, "BSE Limited (BSE) - S&P BSE Indices", "bg-blue-500")}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Explorer Footer */}
                  <div className="p-4 bg-slate-900 border-t border-slate-800/80 shrink-0 flex items-center justify-between text-[11px] text-slate-500 font-mono select-none">
                    <span>Registry Volume: {INDICES_REGISTRY.length} index feeds</span>
                    <span className="hidden sm:inline">Daily tracking resolved via Yahoo Chart API lookup</span>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </main>
      </div>
    );
  }

// Inline return delta formater
function vPercent(num: number): string {
  const v = num * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(3)}%`;
}
