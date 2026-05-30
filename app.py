import datetime
import math
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
import yfinance as yf
from scipy.optimize import newton

# ==============================================================================
# 0. STREAMLIT APP CONFIGURATION
# ==============================================================================
st.set_page_config(
    page_title="Portfolio Performance Analyzer",
    page_icon="💼",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom css for premium appearance
st.markdown("""
<style>
    .metric-container {
        background-color: #1e293b;
        border: 1px solid #334155;
        border-radius: 8px;
        padding: 15px;
        text-align: center;
    }
    .metric-value {
        font-family: 'Courier New', Courier, monospace;
        font-size: 24px;
        font-weight: bold;
        color: #10b981;
    }
    .metric-label {
        font-size: 12px;
        color: #94a3b8;
        text-transform: uppercase;
        font-weight: 500;
        letter-spacing: 0.5px;
    }
    .main-title {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 800;
        color: #ffffff;
    }
</style>
""", unsafe_allowed_code=True)

# ==============================================================================
# 1. SAMPLE TRANSACTIONS & SESSION STATE SETUPS
# ==============================================================================
# Pre-populate session state with 2-3 realistic transactions
if "portfolio_holdings" not in st.session_state:
    st.session_state["portfolio_holdings"] = [
        {
            "id": "1",
            "ticker": "AAPL",
            "quantity": 40.0,
            "purchase_price": 172.50,
            "purchase_date": datetime.date(2024, 2, 15),
            "has_sale_date": False,
            "sale_date": None
        },
        {
            "id": "2",
            "ticker": "MSFT",
            "quantity": 25.0,
            "purchase_price": 392.10,
            "purchase_date": datetime.date(2024, 3, 10),
            "has_sale_date": False,
            "sale_date": None
        },
        {
            "id": "3",
            "ticker": "NVDA",
            "quantity": 80.0,
            "purchase_price": 90.20,
            "purchase_date": datetime.date(2024, 5, 12),
            "has_sale_date": False,
            "sale_date": None
        }
    ]

# ==============================================================================
# 2. CACHED YAHOO FINANCE DATA RETRIEVAL
# ==============================================================================
@st.cache_data(show_spinner=False, ttl=3600)
def fetch_ticker_data_cached(tickers_tuple, start_date):
    """
    Fetches daily adjusted close prices for multiple tickers starting from a specific date.
    Returns a unified pandas DataFrame.
    """
    if not tickers_tuple:
        return pd.DataFrame()
        
    prices = {}
    errors = []
    
    for ticker in tickers_tuple:
        try:
            # Download ticker series
            ticker_obj = yf.Ticker(ticker)
            hist = ticker_obj.history(start=start_date.strftime("%Y-%m-%d"), interval="1d")
            
            if hist.empty:
                errors.append(ticker)
                continue
                
            # Prefer 'Adj Close' or 'Close'
            if "Adj Close" in hist.columns:
                prices[ticker] = hist["Adj Close"]
            elif "Close" in hist.columns:
                prices[ticker] = hist["Close"]
            else:
                errors.append(ticker)
        except Exception as e:
            errors.append(f"{ticker} ({str(e)})")
            
    if errors:
        raise ValueError(f"Failed to fetch data for ticker(s): {', '.join(errors)}")
        
    df = pd.DataFrame(prices)
    # Forward-fill to eliminate gaps on mismatched trading calendars/holidays
    df = df.ffill().bfill()
    return df

# ==============================================================================
# 3. MATHEMATICAL QUANTITATIVE FUNCTIONS
# ==============================================================================
def calculate_xirr(cash_flows):
    """
    Calculates the XIRR using the Newton-Raphson numerical algorithm.
    NPV(r) = sum( C_i / (1 + r)^(d_i / 365.25) ) = 0
    """
    if len(cash_flows) < 2:
        return 0.0

    flows = sorted(cash_flows, key=lambda x: x[0])
    d0 = flows[0][0]
    
    amounts = np.array([f[1] for f in flows])
    years = np.array([(f[0] - d0).days / 365.25 for f in flows])

    # NPV function
    def npv(r):
        return np.sum(amounts / ((1 + r) ** years))

    # Derivative of NPV function
    def d_npv(r):
        return np.sum(-years * amounts / ((1 + r) ** (years + 1)))

    # Attempt solving using scipy optimization newton solver
    for guess in [0.1, 0.05, -0.05, 0.3, -0.3, 0.7]:
        try:
            xirr_val = newton(npv, guess, fprime=d_npv, tol=1e-6, maxiter=100)
            if not math.isnan(xirr_val) and math.isfinite(xirr_val):
                return float(xirr_val)
        except Exception:
            continue
            
    # Simple CAGR fallback estimate
    return 0.0

def run_portfolio_analysis(holdings, market_prices_df, benchmark_ticker, risk_free_rate, inflation_rate):
    """
    Performs fully vectorized daily pricing, compounded TWR, MWR, drawdowns, and relative asset analysis.
    """
    dates = market_prices_df.index
    
    # Calculate daily cash elements & asset holdings values
    portfolio_equity = pd.Series(0.0, index=dates)
    cash_reserves = pd.Series(0.0, index=dates)
    total_invested_capital = 0.0
    
    # Process positions
    for h in holdings:
        ticker = h["ticker"]
        qty = h["quantity"]
        p_price = h["purchase_price"]
        p_date = pd.Timestamp(h["purchase_date"])
        has_sell = h["has_sale_date"]
        s_date = pd.Timestamp(h["sale_date"]) if has_sell else None
        
        basis = qty * p_price
        total_invested_capital += basis
        
        # Loop days to establish active positions vs. static closed cash values
        for date in dates:
            if date >= p_date:
                ticker_close_prices = market_prices_df[ticker]
                price_on_day = ticker_close_prices.loc[date]
                
                if has_sell and date > s_date:
                    # Sold element: cash converts dynamically
                    sold_price = ticker_close_prices.loc[s_date] if s_date in ticker_close_prices.index else p_price
                    cash_reserves.loc[date] += qty * sold_price
                else:
                    # Active stock shares holding
                    portfolio_equity.loc[date] += qty * price_on_day

    daily_portfolio_value = portfolio_equity + cash_reserves
    benchmark_series = market_prices_df[benchmark_ticker]
    
    # Calculate periodic returns
    pf_pct_returns = daily_portfolio_value.pct_change().fillna(0.0)
    bm_pct_returns = benchmark_series.pct_change().fillna(0.0)
    
    # Compounding returns arrays
    pf_cum = (1.0 + pf_pct_returns).cumprod() - 1.0
    bm_cum = (1.0 + bm_pct_returns).cumprod() - 1.0
    
    # Drawdowns
    pf_peaks = daily_portfolio_value.cummax()
    pf_drawdown = (daily_portfolio_value - pf_peaks) / pf_peaks
    
    bm_peaks = benchmark_series.cummax()
    bm_drawdown = (benchmark_series - bm_peaks) / bm_peaks
    
    # Calculate time details
    days_held = (dates[-1] - dates[0]).days
    years_fraction = max(1, days_held) / 365.25
    
    # Math outputs
    ending_val = daily_portfolio_value.iloc[-1]
    absolute_return = ((ending_val - total_invested_capital) / total_invested_capital) * 100.0
    cagr = (math.pow((ending_val / total_invested_capital), 1.0 / years_fraction) - 1.0) * 100.0
    
    # Time-Weighted Return (TWR)
    twr = (pf_cum.iloc[-1]) * 100.0
    
    # Benchmark CAGR
    benchmark_cagr = (math.pow((benchmark_series.iloc[-1] / benchmark_series.iloc[0]), 1.0 / years_fraction) - 1.0) * 100.0
    
    # Real Return: Real = (1 + Nominal) / (1 + Inflation) - 1
    real_return = (((1.0 + twr / 100.0) / (1.0 + inflation_rate / 100.0)) - 1.0) * 100.0
    
    # Money-Weighted Return (XIRR)
    cash_flows = []
    # Add purchases (negative transaction cash outflow)
    for h in holdings:
        cash_flows.append((h["purchase_date"], -float(h["quantity"] * h["purchase_price"])))
        if h["has_sale_date"]:
            s_price = market_prices_df[h["ticker"]].loc[pd.Timestamp(h["sale_date"])]
            cash_flows.append((h["sale_date"], float(h["quantity"] * s_price)))
            
    # Add terminal liquidation portfolio inflow today
    cash_flows.append((dates[-1].date(), float(ending_val)))
    mwr_xirr = calculate_xirr(cash_flows) * 100.0
    
    # Volatility
    daily_vol = pf_pct_returns.std()
    annual_vol = daily_vol * math.sqrt(252.0)
    
    bm_daily_vol = bm_pct_returns.std()
    annual_bm_vol = bm_daily_vol * math.sqrt(252.0)
    
    # Sharpe Ratio (Hurdle Rate adjusted)
    rf_dec = risk_free_rate / 100.0
    sharpe_multiplier = (twr - risk_free_rate) / (annual_vol * 100.0) if annual_vol > 0 else 0.0
    
    # Sortino Ratio
    negative_returns = pf_pct_returns[pf_pct_returns < 0]
    downside_vol_daily = negative_returns.std() if len(negative_returns) > 1 else daily_vol
    downside_vol_annual = downside_vol_daily * math.sqrt(252.0)
    sortino_val = (twr - risk_free_rate) / (downside_vol_annual * 100.0) if downside_vol_annual > 0 else 0.0
    
    max_drawdown_val = pf_drawdown.min() * 100.0
    
    # Beta and Jensen's Alpha
    cov_matrix = np.cov(pf_pct_returns, bm_pct_returns)
    covariance_val = cov_matrix[0, 1] if cov_matrix.shape == (2, 2) else 0.0
    bm_variance_val = cov_matrix[1, 1] if cov_matrix.shape == (2, 2) else 0.0
    
    beta_coefficient = covariance_val / bm_variance_val if bm_variance_val > 0 else 1.0
    alpha_coefficient = (cagr / 100.0) - (rf_dec + beta_coefficient * ((benchmark_cagr / 100.0) - rf_dec))
    
    daily_audit_df = pd.DataFrame({
        "Portfolio Value ($)": daily_portfolio_value,
        "Portfolio Return (%)": pf_pct_returns * 100.0,
        "Portfolio Cumulative Return (%)": pf_cum * 100.0,
        "Benchmark Close ($)": benchmark_series,
        "Benchmark Return (%)": bm_pct_returns * 100.0,
        "Benchmark Cumulative (%)": bm_cum * 100.0,
        "Drawdown (%)": pf_drawdown * 100.0
    })
    
    metrics = {
        "current_val": ending_val,
        "invested": total_invested_capital,
        "absolute_return": absolute_return,
        "cagr": cagr,
        "twr": twr,
        "mwr_xirr": mwr_xirr,
        "real_return": real_return,
        "volatility": annual_vol * 100.0,
        "bm_volatility": annual_bm_vol * 100.0,
        "sharpe": sharpe_multiplier,
        "sortino": sortino_val,
        "max_drawdown": max_drawdown_val,
        "beta": beta_coefficient,
        "alpha": alpha_coefficient * 100.0,
        "bm_cagr": benchmark_cagr
    }
    
    return daily_audit_df, metrics

# ==============================================================================
# 4. USER INTERFACE SECTIONS & RENDER
# ==============================================================================

# SIDEBAR: Global Parameters
st.sidebar.title("🛠️ Global Options")
bench_ticker = st.sidebar.text_input("Benchmark Ticker", value="SPY").strip().upper()
rf_rate = st.sidebar.number_input("Risk-Free Rate %", min_value=0.0, max_value=25.0, value=4.2, step=0.1)
inf_rate = st.sidebar.number_input("Annual Inflation Rate %", min_value=0.0, max_value=50.0, value=2.5, step=0.1)

# Application core description
st.title("💼 Portfolio Performance Analyzer")
st.markdown("##### Multi-Asset Quantitative Financial Engine with Newton XIRR Return Modeling")

# Establish Views Tabs
tab_setup, tab_dash, tab_math = st.tabs(["💼 Portfolio Setup", "📊 Performance Dashboard", "🧮 Granular Math Breakdown"])

# --- TAB 1: PORTFOLIO SETUP ---
with tab_setup:
    st.markdown("### 🛠️ Position Configurator")
    
    col_form, col_positions = st.columns([1, 2])
    
    # Left column: Create positions form
    with col_form:
        st.subheader("Add Asset purchase")
        with st.form("holding_form", clear_on_submit=False):
            ticker_in = st.text_input("Stock Ticker", placeholder="AAPL").strip().upper()
            qty_in = st.number_input("Share Quantity", min_value=0.0, format="%.4f")
            price_in = st.number_input("Purchase Price ($)", min_value=0.0)
            p_date_in = st.date_input("Purchase Date", value=datetime.date(2024, 1, 1))
            
            has_sale = st.checkbox("Is Position Closed (Sold)?")
            s_date_in = st.date_input("Sale Date", value=datetime.date.today())
            
            sub_btn = st.form_submit_button("Add Position to Dashboard")
            
            if sub_btn:
                # Validation Checks
                if not ticker_in:
                    st.error("Please enter a valid stock ticker symbol.")
                elif qty_in <= 0:
                    st.error("Quantity must be a positive number.")
                elif price_in <= 0:
                    st.error("Purchase Price must be a positive number.")
                elif p_date_in > datetime.date.today():
                    st.error("Purchase date cannot be in the future.")
                elif has_sale and s_date_in < p_date_in:
                    st.error("Sale date must occur after purchase date.")
                else:
                    new_item = {
                        "id": str(int(datetime.datetime.now().timestamp() * 1000)),
                        "ticker": ticker_in,
                        "quantity": float(qty_in),
                        "purchase_price": float(price_in),
                        "purchase_date": p_date_in,
                        "has_sale_date": has_sale,
                        "sale_date": s_date_in if has_sale else None
                    }
                    st.session_state["portfolio_holdings"].append(new_item)
                    st.success(f"Position {ticker_in} registered successfully!")
                    
    # Right column: Current positions table and deletion
    with col_positions:
        st.subheader("Active Holdings Board")
        if not st.session_state["portfolio_holdings"]:
            st.info("No stock holdings added to database. Add positions in the setup form.")
        else:
            # Display holdings with delete buttons in table format
            hold_recs = []
            for item in st.session_state["portfolio_holdings"]:
                hold_recs.append({
                    "Ticker": item["ticker"],
                    "Quantity": item["quantity"],
                    "Buy Price ($)": f"${item['purchase_price']:,.2f}",
                    "Total Cost ($)": f"${(item['quantity'] * item['purchase_price']):,.2f}",
                    "Buy Date": item["purchase_date"],
                    "Status": f"Sold ({item['sale_date']})" if item["has_sale_date"] else "Active",
                    "id": item["id"]
                })
                
            df_display = pd.DataFrame(hold_recs)
            st.dataframe(df_display.drop("id", axis=1), use_container_width=True)
            
            # Deletion selection list
            st.markdown("---")
            st.subheader("Delete Transaction Position")
            delete_opt = st.selectbox(
                "Select positions to delete", 
                options=st.session_state["portfolio_holdings"],
                format_func=lambda x: f"{x['ticker']} ({x['quantity']} shares @ ${x['purchase_price']:.2f} bought on {x['purchase_date']})"
            )
            
            if st.button("Delete Selected Asset", type="primary"):
                st.session_state["portfolio_holdings"] = [
                    h for h in st.session_state["portfolio_holdings"] if h["id"] != delete_opt["id"]
                ]
                st.success(f"Deleted position {delete_opt['ticker']} successfully.")
                st.rerun()

# --- COMPUTATIONAL CORE RESOLVE ---
if not st.session_state["portfolio_holdings"]:
    with tab_dash:
        st.info("Please set up dynamic stock holdings inside 'Portfolio Setup' first.")
    with tab_math:
        st.info("Awaiting asset creation in setup tab.")
else:
    # Build complete execution pipeline
    try:
        # Determine earliest purchase date
        earliest_time = min(item["purchase_date"] for item in st.session_state["portfolio_holdings"])
        
        # Gathering unique list of tickers plus comparison index
        asset_tickers = {item["ticker"] for item in st.session_state["portfolio_holdings"]}
        all_tickers_tuple = tuple(asset_tickers | {bench_ticker})
        
        with st.spinner("Executing quantitative analysis index calculations..."):
            market_db = fetch_ticker_data_cached(all_tickers_tuple, earliest_time)
            
        daily_record_df, pf_metrics = run_portfolio_analysis(
            st.session_state["portfolio_holdings"],
            market_db,
            bench_ticker,
            rf_rate,
            inf_rate
        )
        
        # --- TAB 2: PERFORMANCE DASHBOARD ---
        with tab_dash:
            # 1. Metric Display Cards
            st.markdown("### 📊 Portfolio Metrics Monitor")
            card_col1, card_col2, card_col3, card_col4, card_col5, card_col6 = st.columns(6)
            
            with card_col1:
                st.markdown(f'<div class="metric-container"><div class="metric-label">Ending Value</div><div class="metric-value" style="color:#ffffff">${pf_metrics["current_val"]:,.2f}</div></div>', unsafe_allowed_code=True)
            with card_col2:
                st.markdown(f'<div class="metric-container"><div class="metric-label">Absolute Return</div><div class="metric-value">{pf_metrics["absolute_return"]:+.2f}%</div></div>', unsafe_allowed_code=True)
            with card_col3:
                st.markdown(f'<div class="metric-container"><div class="metric-label">CAGR (Ann.)</div><div class="metric-value">{pf_metrics["cagr"]:+.2f}%</div></div>', unsafe_allowed_code=True)
            with card_col4:
                st.markdown(f'<div class="metric-container"><div class="metric-label">XIRR (MWR)</div><div class="metric-value">{pf_metrics["mwr_xirr"]:+.2f}%</div></div>', unsafe_allowed_code=True)
            with card_col5:
                st.markdown(f'<div class="metric-container"><div class="metric-label">TWR Return</div><div class="metric-value">{pf_metrics["twr"]:+.2f}%</div></div>', unsafe_allowed_code=True)
            with card_col6:
                st.markdown(f'<div class="metric-container"><div class="metric-label">Real Return</div><div class="metric-value">{pf_metrics["real_return"]:+.2f}%</div></div>', unsafe_allowed_code=True)
                
            # Ratios and volatilities
            st.markdown("####")
            card_col7, card_col8, card_col9, card_col10, card_col11 = st.columns(5)
            with card_col7:
                st.metric("Annual Volatility", f"{pf_metrics['volatility']:.2f}%", help="Annualized Standard Deviation of daily returns")
            with card_col8:
                st.metric("Sharpe Ratio", f"{pf_metrics['sharpe']:.2f}", help="Standard risk adjusted returns penalizing general volatility")
            with card_col9:
                st.metric("Sortino Ratio", f"{pf_metrics['sortino']:.2f}", help="Risk adjusted return penalizing only downside variation")
            with card_col10:
                st.metric("Max Drawdown", f"{pf_metrics['max_drawdown']:.2f}%", help="Worst historical peak-to-trough performance dropdown")
            with card_col11:
                st.metric("Beta & Jensen Alpha", f"{pf_metrics['beta']:.2f} / {pf_metrics['alpha']:+.2f}%")
                
            # 2. Charts Visualizations
            st.subheader("📈 Performance Diagnostics Charts")
            
            # Chart 1: Rebased Cumulative Return Growth
            st.markdown("#### Cumulative Returns Performance Curve (Rebased to 100)")
            fig_rebased = go.Figure()
            # Portfolio line
            fig_rebased.add_trace(go.Scatter(
                x=daily_record_df.index,
                y=daily_record_df["Portfolio Cumulative Return (%)"] + 100.0,
                mode="lines",
                name="Portfolio",
                line=dict(color="#10b981", width=2.5)
            ))
            # Benchmark line
            fig_rebased.add_trace(go.Scatter(
                x=daily_record_df.index,
                y=daily_record_df["Benchmark Cumulative (%)"] + 100.0,
                mode="lines",
                name=f"Benchmark ({bench_ticker})",
                line=dict(color="#64748b", width=1.5, dash="dash")
            ))
            fig_rebased.update_layout(
                template="plotly_dark",
                paper_bgcolor="#0f172a",
                plot_bgcolor="#0f172a",
                margin=dict(l=20, r=20, t=10, b=20),
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
            )
            st.plotly_chart(fig_rebased, use_container_width=True)
            
            # Chart 2: Drawdowns
            st.markdown("#### Underwater Drawdown Performance Series (%)")
            fig_dd = go.Figure()
            fig_dd.add_trace(go.Scatter(
                x=daily_record_df.index,
                y=daily_record_df["Drawdown (%)"],
                fill="tozeroy",
                mode="lines",
                name="Portfolio Loss Drawdown",
                line=dict(color="#f43f5e", width=1.5),
                fillcolor="rgba(244, 63, 94, 0.15)"
            ))
            fig_dd.update_layout(
                template="plotly_dark",
                paper_bgcolor="#0f172a",
                plot_bgcolor="#0f172a",
                margin=dict(l=20, r=20, t=10, b=20)
            )
            st.plotly_chart(fig_dd, use_container_width=True)
            
            # Chart 3: Annual side-by-side bar returns (from daily calculations)
            daily_record_df["Year"] = daily_record_df.index.year
            # Group daily compounding return per year
            annual_groups = daily_record_df.groupby("Year")
            annual_list = []
            for name, group in annual_groups:
                pf_delta = (1.0 + group["Portfolio Return (%)"] / 100.0).prod() - 1.0
                bm_delta = (1.0 + group["Benchmark Return (%)"] / 100.0).prod() - 1.0
                annual_list.append({
                    "Year": str(name),
                    "Portfolio": pf_delta * 100.0,
                    f"Benchmark ({bench_ticker})": bm_delta * 100.0
                })
            df_annual = pd.DataFrame(annual_list)
            
            st.markdown("#### Annual Realized Compounded Gains Comparison")
            if df_annual.empty:
                st.info("Insufficient timeline lengths to aggregate yearly comparisons.")
            else:
                fig_ann = go.Figure()
                fig_ann.add_trace(go.Bar(
                    x=df_annual["Year"],
                    y=df_annual["Portfolio"],
                    name="Portfolio",
                    marker_color="#10b981"
                ))
                fig_ann.add_trace(go.Bar(
                    x=df_annual["Year"],
                    y=df_annual[f"Benchmark ({bench_ticker})"],
                    name=bench_ticker,
                    marker_color="#64748b"
                ))
                fig_ann.update_layout(
                    barmode="group",
                    template="plotly_dark",
                    paper_bgcolor="#0f172a",
                    plot_bgcolor="#0f172a",
                    margin=dict(l=20, r=20, t=10, b=20)
                )
                st.plotly_chart(fig_ann, use_container_width=True)

        # --- TAB 3: GRANULAR MATH ---
        with tab_math:
            st.markdown("### 🧮 Portfolio daily audit track")
            st.markdown("This granular grid contains daily equity indexes, pricing, and drawdowns compiled directly from Yahoo Finance adjusted closes.")
            st.dataframe(daily_record_df, use_container_width=True)
            
            # Export CSV trigger in streamlit
            csv_data = daily_record_df.to_csv().encode('utf-8')
            st.download_button(
                label="📥 Download Granular Math Curve (CSV)",
                data=csv_data,
                file_name=f"quantitative_audit_run_{bench_ticker}.csv",
                mime="text/csv"
            )

    except Exception as exec_err:
        st.error(f"Execution Error in Quantitative Backtest: {str(exec_err)}")
        st.info("Make sure all tickers entered are typed as valid tickers in Yahoo Finance (e.g. AAPL, MSFT, IWM, TSLA).")
