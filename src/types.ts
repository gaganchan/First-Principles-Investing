export interface Holding {
  id: string;
  ticker: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string; // YYYY-MM-DD
  saleDate?: string;
  hasSaleDate: boolean;
}

export interface DailyPrice {
  date: string;
  price: number;
}

export interface TickerHistory {
  ticker: string;
  success: boolean;
  data?: DailyPrice[];
  error?: string;
}

export interface DailyDataPoint {
  date: string;
  portfolioValue: number;
  benchmarkValue: number;
  portfolioDailyReturn: number;
  benchmarkDailyReturn: number;
  portfolioCumulativeReturn: number;
  benchmarkCumulativeReturn: number;
  drawdown: number;
  benchmarkDrawdown: number;
  currentNav: number;
  totalUnits: number;
  [key: string]: any;
}

export interface PortfolioMetrics {
  currentValue: number;
  totalInvested: number;
  absoluteReturn: number;
  cagr: number;
  twr: number;
  mwrXirr: number;
  realReturn: number;
  annualizedVolatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  beta: number;
  alpha: number;
  benchmarkCagr: number;
  benchmarkVolatility: number;
  benchmarkSharpe: number;
  benchmarkMaxDrawdown: number;
  m2: number;
  m2Alpha: number;
}
