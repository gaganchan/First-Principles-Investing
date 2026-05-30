import { Holding, DailyPrice, DailyDataPoint, PortfolioMetrics } from "./types";

// Newton-Raphson method to calculate XIRR (Money-Weighted Return)
export function calculateXIRR(cashFlows: { date: Date; amount: number }[]): number {
  if (cashFlows.length < 2) return 0;

  // Filter out zero amount cash flows
  const activeFlows = cashFlows.filter(cf => Math.abs(cf.amount) > 1e-4);
  if (activeFlows.length < 2) return 0;

  // Sort cash flows by date ascending
  const sorted = [...activeFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();

  // Convert dates to fractional years since t0
  const years = sorted.map(cf => (cf.date.getTime() - t0) / (1000 * 60 * 60 * 24 * 365));
  const amounts = sorted.map(cf => cf.amount);

  // IRR NPV Function: f(r) = sum( amount_i / (1 + r)^t_i )
  const f = (r: number) => {
    let sum = 0;
    for (let i = 0; i < amounts.length; i++) {
      // Avoid division by zero or negative base with decimal exponents
      if (1 + r <= 0) {
        sum += amounts[i] * Math.pow(Math.abs(1 + r), -years[i]) * (Math.floor(years[i]) % 2 === 0 ? 1 : -1);
      } else {
        sum += amounts[i] / Math.pow(1 + r, years[i]);
      }
    }
    return sum;
  };

  // Derivative: f'(r) = sum( -t_i * amount_i / (1 + r)^(t_i + 1) )
  const df = (r: number) => {
    let sum = 0;
    for (let i = 0; i < amounts.length; i++) {
      if (1 + r <= 0) continue;
      sum += -years[i] * amounts[i] / Math.pow(1 + r, years[i] + 1);
    }
    return sum;
  };

  // Initial guesses covering standard ranges
  const guesses = [0.1, 0.05, -0.05, 0.2, 0.5, -0.2, -0.5, 0.9];
  
  for (let guess of guesses) {
    let r = guess;
    const maxIterations = 80;
    const tolerance = 1e-6;
    let converged = false;

    for (let i = 0; i < maxIterations; i++) {
      const fr = f(r);
      const dfr = df(r);
      if (Math.abs(dfr) < 1e-12) break; // avoid flat derivative
      const nextR = r - fr / dfr;
      if (isNaN(nextR) || !isFinite(nextR)) break;
      if (Math.abs(nextR - r) < tolerance) {
        if (!isNaN(nextR) && isFinite(nextR) && Math.abs(f(nextR)) < 1e-2) {
          return nextR; // Success
        }
      }
      r = nextR;
    }
  }

  // Fallback to average return if XIRR solver doesn't converge
  return 0;
}

// Forward fill missing daily close prices (standard ffill)
export function forwardFillPrices(
  allDates: string[],
  tickersData: Record<string, DailyPrice[]>
): Record<string, Record<string, number>> {
  const filled: Record<string, Record<string, number>> = {};

  for (const ticker of Object.keys(tickersData)) {
    filled[ticker] = {};
    const dailyList = tickersData[ticker] || [];
    const priceMap = new Map(dailyList.map(item => [item.date, item.price]));

    let lastPrice = 0;
    const firstAvailable = dailyList.find(item => item.price !== undefined && item.price !== null);
    if (firstAvailable) {
      lastPrice = firstAvailable.price;
    }

    for (const date of allDates) {
      if (priceMap.has(date)) {
        const price = priceMap.get(date)!;
        if (price !== null && price !== undefined) {
          lastPrice = price;
        }
      }
      filled[ticker][date] = lastPrice;
    }
  }
  return filled;
}

// core calculation analytics
export function analyzePortfolio(
  rawHoldings: Holding[],
  tickersData: Record<string, DailyPrice[]>,
  benchmarkTicker: string,
  riskFreeRate: number, // e.g., 4.0 for 4%
  inflationRate: number // e.g., 2.5 for 2.5%
): { dailyData: DailyDataPoint[]; metrics: PortfolioMetrics; resolvedHoldings: Holding[] } | null {
  if (rawHoldings.length === 0) return null;

  // 1. Gather all calendar days (aligned trading days)
  const allDatesSet = new Set<string>();
  Object.values(tickersData).forEach(dataList => {
    dataList.forEach(dp => allDatesSet.add(dp.date));
  });
  if (allDatesSet.size === 0) return null;

  const allDates = Array.from(allDatesSet).sort();

  // 2. Forward-filled prices
  const filledPrices = forwardFillPrices(allDates, tickersData);

  // Auto-resolve purchase prices from historical data
  const holdings = rawHoldings.map(h => {
    const tickerPrices = filledPrices[h.ticker];
    let resolvedPrice = h.purchasePrice;
    
    // Find the first trading date in allDates on or after purchaseDate
    const effectivePurchaseDate = allDates.find(d => d >= h.purchaseDate) || h.purchaseDate;
    
    if (tickerPrices) {
      // First try to get the price on the effective purchase date (which is a trading day)
      const exactPrice = tickerPrices[effectivePurchaseDate];
      if (exactPrice !== undefined && exactPrice !== null && exactPrice > 0) {
        resolvedPrice = exactPrice;
      } else {
        // Fallback to absolute closest date in case of any issues
        const dateList = Object.keys(tickerPrices).sort();
        const closestDate = dateList.find(d => d >= h.purchaseDate) || dateList[0];
        if (closestDate && tickerPrices[closestDate]) {
          resolvedPrice = tickerPrices[closestDate];
        }
      }
    }
    return {
      ...h,
      purchasePrice: resolvedPrice > 0 ? resolvedPrice : 1,
      effectivePurchaseDate,
    };
  });

  // Verify that the benchmark data is present
  const benchmarkFilled = filledPrices[benchmarkTicker];
  if (!benchmarkFilled) return null;

  // 3. Compute Portfolio values on each date
  let totalInvestedCapital = 0;
  holdings.forEach(h => {
    totalInvestedCapital += h.quantity * h.purchasePrice;
  });

  const dailyPoints: { date: string; portfolioValue: number; benchmarkPrice: number }[] = [];

  for (const date of allDates) {
    let dailyPortfolioValue = 0;
    let dailySoldCash = 0;

    for (const holding of holdings) {
      const tickerPrices = filledPrices[holding.ticker];
      if (!tickerPrices) continue;

      const currentPrice = tickerPrices[date] || 0;
      const effDate = (holding as any).effectivePurchaseDate || holding.purchaseDate;

      // Has the asset been purchased yet on this date?
      if (date >= effDate) {
        // Has the asset been sold?
        if (holding.hasSaleDate && holding.saleDate && date > holding.saleDate) {
          // Add closed cash from sale (using sale date close price)
          const salePrice = tickerPrices[holding.saleDate] || holding.purchasePrice;
          dailySoldCash += holding.quantity * salePrice;
        } else {
          // Stock shares still in hand
          dailyPortfolioValue += holding.quantity * currentPrice;
        }
      }
    }

    const portfolioTotal = dailyPortfolioValue + dailySoldCash;
    const benchmarkPrice = benchmarkFilled[date] || 1;

    dailyPoints.push({
      date,
      portfolioValue: portfolioTotal,
      benchmarkPrice,
    });
  }

  if (dailyPoints.length === 0) return null;

  // Get all unique stock tickers
  const uniqueTickers = Array.from(new Set(holdings.map(h => h.ticker.toUpperCase())));

  // Pre-calculate base prices for each unique ticker
  const tickerBaseInfo = uniqueTickers.map(ticker => {
    const tickerHoldings = holdings.filter(h => h.ticker.toUpperCase() === ticker);
    const earliestDate = tickerHoldings.reduce((earliest, cur) => {
      const curEff = (cur as any).effectivePurchaseDate || cur.purchaseDate;
      return curEff < earliest ? curEff : earliest;
    }, (tickerHoldings[0] as any).effectivePurchaseDate || tickerHoldings[0].purchaseDate);
    
    const lastSaleDateObj = tickerHoldings.find(h => !h.hasSaleDate) 
      ? null 
      : tickerHoldings.map(h => h.saleDate).sort().pop();
    
    const actualStartDate = allDates.find(d => d >= earliestDate) || earliestDate;
    const tickerPrices = filledPrices[ticker];
    const basePrice = tickerPrices ? (tickerPrices[actualStartDate] || tickerPrices[allDates[0]] || 1) : 1;

    return {
      ticker,
      earliestDate,
      lastSaleDate: lastSaleDateObj || null,
      basePrice: basePrice > 0 ? basePrice : 1,
    };
  });

  // 4. Calculate Daily Returns & Compounded Cumulative Curves (Using NAV Unitization Method)
  const dailyData: DailyDataPoint[] = [];
  let bmPreviousPrice = dailyPoints[0].benchmarkPrice;

  let bmCumulativeProduct = 1;
  let pfCumulativeProduct = 1;

  // NAV Unitization Variables
  let totalUnits = 0;
  let currentNav = 100;
  let previousNav = 100;

  // Peak tracking for Drawdowns
  let pfMaxPeak = 0;
  let bmMaxPeak = dailyPoints[0].benchmarkPrice;

  for (let i = 0; i < dailyPoints.length; i++) {
    const pt = dailyPoints[i];
    
    // Calculate cash inflow on this day (new asset purchases)
    // Align inflow amounts with historical split-adjusted close prices to eliminate split or manual price input discrepancies
    let dailyCashInflow = 0;
    for (const holding of holdings) {
      const effDate = (holding as any).effectivePurchaseDate || holding.purchaseDate;
      if (pt.date === effDate) {
        const tickerPrices = filledPrices[holding.ticker];
        const purchaseDatePrice = tickerPrices ? (tickerPrices[pt.date] || holding.purchasePrice) : holding.purchasePrice;
        dailyCashInflow += holding.quantity * purchaseDatePrice;
      }
    }

    if (dailyCashInflow > 0) {
      if (totalUnits === 0) {
        // 1. Initialize the Portfolio (First Deposit):
        const initialNav = 100;
        totalUnits = dailyCashInflow / initialNav;
        previousNav = initialNav;
        currentNav = initialNav;
      } else {
        // 3. Handling New Capital Inflows (Subsequent Deposits):
        // Capture portfolio's NAV immediately BEFORE the new cash is added.
        // We find the current value of pre-existing assets today (at today's closing prices)
        // prior to adding the new cash.
        let preDepositValue = 0;
        for (const holding of holdings) {
          const effDate = (holding as any).effectivePurchaseDate || holding.purchaseDate;
          if (pt.date > effDate) {
            const tickerPrices = filledPrices[holding.ticker];
            if (!tickerPrices) continue;
            const currentPrice = tickerPrices[pt.date] || 0;
            if (holding.hasSaleDate && holding.saleDate && pt.date > holding.saleDate) {
              const salePrice = tickerPrices[holding.saleDate] || holding.purchasePrice;
              preDepositValue += holding.quantity * salePrice;
            } else {
              preDepositValue += holding.quantity * currentPrice;
            }
          }
        }

        const preDepositNav = totalUnits > 0 ? preDepositValue / totalUnits : previousNav;
        const newUnits = dailyCashInflow / (preDepositNav || 1);
        totalUnits += newUnits;
      }
    }

    // 2. Daily tracking (Between Deposits):
    if (totalUnits > 0) {
      currentNav = pt.portfolioValue / totalUnits;
    } else {
      currentNav = 100;
    }

    pfCumulativeProduct = currentNav / 100;

    const portfolioCumulativeReturn = ((currentNav / 100) - 1) * 100;
    const portfolioDailyReturn = i === 0 ? 0 : (previousNav > 0 ? (currentNav - previousNav) / previousNav : 0);

    const benchmarkDailyReturn = i === 0 ? 0 : (pt.benchmarkPrice - bmPreviousPrice) / (bmPreviousPrice || 1);

    bmPreviousPrice = pt.benchmarkPrice;
    previousNav = currentNav;

    // Compounding index
    bmCumulativeProduct *= (1 + benchmarkDailyReturn);
    const benchmarkCumulativeReturn = (bmCumulativeProduct - 1) * 100;

    // Peak levels for drawdowns
    if (pt.portfolioValue > pfMaxPeak) pfMaxPeak = pt.portfolioValue;
    if (pt.benchmarkPrice > bmMaxPeak) bmMaxPeak = pt.benchmarkPrice;

    const drawdown = pfMaxPeak === 0 ? 0 : (pt.portfolioValue - pfMaxPeak) / pfMaxPeak;
    const benchmarkDrawdown = bmMaxPeak === 0 ? 0 : (pt.benchmarkPrice - bmMaxPeak) / bmMaxPeak;

    // Compute rebased individual stock values, raw prices, and daily returns
    const dynamicFields: Record<string, number | undefined> = {};
    for (const info of tickerBaseInfo) {
      if (pt.date >= info.earliestDate) {
        if (info.lastSaleDate && pt.date > info.lastSaleDate) {
          // If past sale date, keep undefined so the line doesn't render
          continue;
        }
        const tickerPrices = filledPrices[info.ticker];
        if (tickerPrices) {
          const currentPrice = tickerPrices[pt.date] !== undefined ? tickerPrices[pt.date] : 0;
          dynamicFields[`rebased_${info.ticker}`] = (currentPrice / info.basePrice) * 100;
          
          // Raw price
          dynamicFields[`price_${info.ticker}`] = currentPrice;
          
          // Daily return
          let stockDailyReturn = 0;
          if (i > 0) {
            const prevDate = dailyPoints[i - 1].date;
            const prevPrice = tickerPrices[prevDate] !== undefined ? tickerPrices[prevDate] : 0;
            if (prevPrice > 0) {
              stockDailyReturn = (currentPrice - prevPrice) / prevPrice;
            }
          }
          dynamicFields[`return_${info.ticker}`] = stockDailyReturn;
        }
      }
    }

    dailyData.push({
      date: pt.date,
      portfolioValue: pt.portfolioValue,
      benchmarkValue: pt.benchmarkPrice,
      portfolioDailyReturn,
      benchmarkDailyReturn,
      portfolioCumulativeReturn,
      benchmarkCumulativeReturn,
      drawdown,
      benchmarkDrawdown,
      currentNav,
      totalUnits,
      ...dynamicFields,
    });
  }

  // 5. Aggregate Mathematical Metrics
  const lastPoint = dailyData[dailyData.length - 1];
  const currentValue = lastPoint.portfolioValue;

  const absoluteReturn = ((currentValue - totalInvestedCapital) / (totalInvestedCapital || 1)) * 100;

  // Annualization timeframe (Earliest buy to latest day)
  const d0 = new Date(dailyData[0].date);
  const dN = new Date(dailyData[dailyData.length - 1].date);
  const diffDays = Math.max(1, (dN.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24));
  const yearsFraction = diffDays / 365.25;

  const cagr = (Math.pow((currentValue / (totalInvestedCapital || 1)), (1 / (yearsFraction || 1))) - 1) * 100;
  const benchmarkCagr = (Math.pow((lastPoint.benchmarkValue / (dailyData[0].benchmarkValue || 1)), (1 / (yearsFraction || 1))) - 1) * 100;

  // Time-Weighted Return (Compounded TWR)
  const twr = (pfCumulativeProduct - 1) * 100;

  // Money-Weighted Return / XIRR
  const cashFlows: { date: Date; amount: number }[] = [];
  holdings.forEach(h => {
    // Buy transaction (negative cash outflow)
    const effDate = (h as any).effectivePurchaseDate || h.purchaseDate;
    cashFlows.push({ date: new Date(effDate), amount: -(h.quantity * h.purchasePrice) });
    // Sell transaction if active
    if (h.hasSaleDate && h.saleDate) {
      const tickerPrices = filledPrices[h.ticker];
      const sPrice = tickerPrices ? (tickerPrices[h.saleDate] || h.purchasePrice) : h.purchasePrice;
      cashFlows.push({ date: new Date(h.saleDate), amount: (h.quantity * sPrice) });
    }
  });

  // Today (positive cash inflow equivalent to liquidation value)
  // Liquidate all remaining active shares at the final day's price, plus any sold proceeds holding as cash
  let currentActiveEquityValue = 0;
  let accumulatedSoldProceeds = 0;
  
  holdings.forEach(h => {
    const tickerPrices = filledPrices[h.ticker];
    const latestPrice = tickerPrices ? (tickerPrices[lastPoint.date] || h.purchasePrice) : h.purchasePrice;
    
    if (h.hasSaleDate && h.saleDate) {
      // Sold asset converted to cash already
      const sPrice = tickerPrices ? (tickerPrices[h.saleDate] || h.purchasePrice) : h.purchasePrice;
      accumulatedSoldProceeds += h.quantity * sPrice;
    } else {
      // Still holding
      currentActiveEquityValue += h.quantity * latestPrice;
    }
  });

  cashFlows.push({ date: dN, amount: currentActiveEquityValue + accumulatedSoldProceeds });

  const mwrXirr = calculateXIRR(cashFlows) * 100;

  // Real Return: Real = (1 + Nominal) / (1 + Inflation) - 1
  const nominalDecimal = twr / 100;
  const inflationDecimal = inflationRate / 100;
  const realReturn = (((1 + nominalDecimal) / (1 + inflationDecimal)) - 1) * 100;

  // Volatilities & Beta / Alpha
  const pfReturns = dailyData.map(d => d.portfolioDailyReturn);
  const bmReturns = dailyData.map(d => d.benchmarkDailyReturn);

  const meanPf = pfReturns.reduce((a, b) => a + b, 0) / (pfReturns.length || 1);
  const meanBm = bmReturns.reduce((a, b) => a + b, 0) / (bmReturns.length || 1);

  // Variance & Volatility (Annualized)
  let pfVarSum = 0;
  let bmVarSum = 0;
  let covSum = 0;

  for (let i = 0; i < pfReturns.length; i++) {
    const dPf = pfReturns[i] - meanPf;
    const dBm = bmReturns[i] - meanBm;
    pfVarSum += dPf * dPf;
    bmVarSum += dBm * dBm;
    covSum += dPf * dBm;
  }

  const divider = pfReturns.length > 1 ? pfReturns.length - 1 : 1;
  const pfVariance = pfVarSum / divider;
  const bmVariance = bmVarSum / divider;
  const covariance = covSum / divider;

  const dailyVolatility = Math.sqrt(pfVariance);
  const bmDailyVolatility = Math.sqrt(bmVariance);

  const annualizedVolatility = dailyVolatility * Math.sqrt(252);
  const benchmarkVolatility = bmDailyVolatility * Math.sqrt(252);

  // Sharpe Ratio
  const riskFreeDecimal = riskFreeRate / 100;
  const annualizedVolatilityPercent = annualizedVolatility * 100;
  const sharpeRatio = annualizedVolatilityPercent > 0 
    ? (cagr - riskFreeRate) / annualizedVolatilityPercent 
    : 0;

  // Sortino Ratio
  let downsideDailyVarSum = 0;
  for (let i = 0; i < pfReturns.length; i++) {
    // only count negative returns
    const r = pfReturns[i];
    if (r < 0) {
      downsideDailyVarSum += r * r;
    }
  }
  const downsideDailyVolatility = Math.sqrt(downsideDailyVarSum / divider);
  const annualizedDownsideVolatility = downsideDailyVolatility * Math.sqrt(252);
  const sortinoRatio = (annualizedDownsideVolatility * 100) > 0
    ? (cagr - riskFreeRate) / (annualizedDownsideVolatility * 100)
    : 0;

  // Max Drawdown
  const drawdowns = dailyData.map(d => d.drawdown);
  const maxDrawdown = drawdowns.length > 0 ? Math.min(...drawdowns) : 0;

  const benchmarkDrawdowns = dailyData.map(d => d.benchmarkDrawdown);
  const benchmarkMaxDrawdown = benchmarkDrawdowns.length > 0 ? Math.min(...benchmarkDrawdowns) : 0;

  // Benchmark Sharpe Ratio
  const benchmarkVolPercent = benchmarkVolatility * 100;
  const benchmarkSharpe = benchmarkVolPercent > 0
    ? (benchmarkCagr - riskFreeRate) / benchmarkVolPercent
    : 0;

  // Beta & Alpha
  const beta = bmVariance > 0 ? covariance / bmVariance : 1;
  
  // Alpha = Portfolio_CAGR - [rf + Beta * (Benchmark_CAGR - rf)]
  const alpha = (cagr / 100) - (riskFreeDecimal + beta * ((benchmarkCagr / 100) - riskFreeDecimal));

  // Modigliani-squared metrics
  // M2 Return = RiskFreeRate + SharpeRatio * BenchmarkVolatilityPercent
  const m2 = riskFreeRate + (sharpeRatio * benchmarkVolPercent);
  const m2Alpha = m2 - benchmarkCagr;

  return {
    dailyData,
    metrics: {
      currentValue,
      totalInvested: totalInvestedCapital,
      absoluteReturn,
      cagr,
      twr,
      mwrXirr,
      realReturn,
      annualizedVolatility,
      sharpeRatio,
      sortinoRatio,
      maxDrawdown,
      beta,
      alpha,
      benchmarkCagr,
      benchmarkVolatility,
      benchmarkSharpe,
      benchmarkMaxDrawdown,
      m2,
      m2Alpha,
    },
    resolvedHoldings: holdings,
  };
}

// Helpers for bar chart annual performance reports
export interface AnnualReturnPoint {
  year: string;
  portfolioReturn: number; // e.g. 15.4 for 15.4%
  benchmarkReturn: number;
}

export function computeAnnualReturns(dailyData: DailyDataPoint[]): AnnualReturnPoint[] {
  if (dailyData.length === 0) return [];

  const grouped: Record<string, DailyDataPoint[]> = {};
  for (const point of dailyData) {
    const year = point.date.substring(0, 4);
    if (!grouped[year]) {
      grouped[year] = [];
    }
    grouped[year].push(point);
  }

  const annualPoints: AnnualReturnPoint[] = [];

  for (const [year, points] of Object.entries(grouped)) {
    let pfCompounded = 1;
    let bmCompounded = 1;

    for (const point of points) {
      pfCompounded *= (1 + point.portfolioDailyReturn);
      bmCompounded *= (1 + point.benchmarkDailyReturn);
    }

    annualPoints.push({
      year,
      portfolioReturn: (pfCompounded - 1) * 100,
      benchmarkReturn: (bmCompounded - 1) * 100,
    });
  }

  return annualPoints.sort((a, b) => a.year.localeCompare(b.year));
}

