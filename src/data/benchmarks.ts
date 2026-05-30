export interface BenchmarkIndex {
  symbol: string;
  name: string;
  category: "Broad Market" | "Sectoral" | "Thematic" | "Popular Strategy";
  source: "NSE" | "BSE";
  proxyNote?: string;
}

export const INDICES_REGISTRY: BenchmarkIndex[] = [
  // ==================== NSE NIFTY Broad Market ====================
  { symbol: "^NSEI", name: "Nifty 50", category: "Broad Market", source: "NSE" },
  { symbol: "^NIFTNXT50", name: "Nifty Next 50", category: "Broad Market", source: "NSE" },
  { symbol: "^CNX100", name: "Nifty 100", category: "Broad Market", source: "NSE" },
  { symbol: "^CNX200", name: "Nifty 200", category: "Broad Market", source: "NSE" },
  { symbol: "^CNX500", name: "Nifty 500", category: "Broad Market", source: "NSE" },
  { symbol: "^CNX500", name: "Nifty Total Market", category: "Broad Market", source: "NSE", proxyNote: "Nifty 500 Proxy" },
  { symbol: "^CNX200", name: "Nifty LargeMidcap 250", category: "Broad Market", source: "NSE", proxyNote: "Nifty 200 Proxy" },
  { symbol: "^NSEMDCP50", name: "Nifty Midcap 50", category: "Broad Market", source: "NSE" },
  { symbol: "^NSMIDCP", name: "Nifty Midcap 100", category: "Broad Market", source: "NSE" },
  { symbol: "^NSMIDCP", name: "Nifty Midcap 150", category: "Broad Market", source: "NSE", proxyNote: "Nifty Midcap 100 Proxy" },
  { symbol: "^CNXSC", name: "Nifty Smallcap 50", category: "Broad Market", source: "NSE", proxyNote: "Smallcap 100 Proxy" },
  { symbol: "^CNXSC", name: "Nifty Smallcap 100", category: "Broad Market", source: "NSE" },
  { symbol: "^CNXSC", name: "Nifty Smallcap 250", category: "Broad Market", source: "NSE", proxyNote: "Smallcap 100 Proxy" },
  { symbol: "^CNXSC", name: "Nifty Smallcap 500", category: "Broad Market", source: "NSE", proxyNote: "Smallcap 100 Proxy" },
  { symbol: "^CNXSC", name: "Nifty Microcap 250", category: "Broad Market", source: "NSE", proxyNote: "Smallcap 100 Proxy" },
  { symbol: "^CNX500", name: "Nifty500 Multicap 50:25:25", category: "Broad Market", source: "NSE", proxyNote: "Nifty 500 Proxy" },
  { symbol: "^CNX500", name: "Nifty500 LargeMidSmall Equal-Cap Weighted", category: "Broad Market", source: "NSE", proxyNote: "Nifty 500 Proxy" },

  // ==================== NSE NIFTY Sectoral ====================
  { symbol: "^NSEBANK", name: "Nifty Bank", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXFIN", name: "Nifty Financial Services", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXFIN", name: "Nifty Financial Services 25/50", category: "Sectoral", source: "NSE", proxyNote: "Financial Services Proxy" },
  { symbol: "^CNXFIN", name: "Nifty Financial Services Ex-Bank", category: "Sectoral", source: "NSE", proxyNote: "Financial Services Proxy" },
  { symbol: "^CNXIT", name: "Nifty IT", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXFMCG", name: "Nifty FMCG", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXAUTO", name: "Nifty Auto", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXPHARMA", name: "Nifty Pharma", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXPHARMA", name: "Nifty Healthcare", category: "Sectoral", source: "NSE", proxyNote: "Nifty Pharma Proxy" },
  { symbol: "^CNXREALTY", name: "Nifty Realty", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXMETAL", name: "Nifty Metal", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXMEDIA", name: "Nifty Media", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXENERGY", name: "Nifty Oil & Gas", category: "Sectoral", source: "NSE", proxyNote: "Nifty Energy Proxy" },
  { symbol: "^CNXFMCG", name: "Nifty Consumer Durables", category: "Sectoral", source: "NSE", proxyNote: "FMCG Proxy" },
  { symbol: "^NIFTY_PVT_BANK", name: "Nifty Private Bank", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXPSUBANK", name: "Nifty PSU Bank", category: "Sectoral", source: "NSE" },
  { symbol: "^CNXPHARMA", name: "Nifty Chemicals", category: "Sectoral", source: "NSE", proxyNote: "Pharma Proxy" },
  { symbol: "^CNXINFRA", name: "Nifty Cement", category: "Sectoral", source: "NSE", proxyNote: "Infrastructure Proxy" },
  { symbol: "^CNXREALTY", name: "Nifty REITs & Realty", category: "Sectoral", source: "NSE", proxyNote: "Realty Proxy" },
  { symbol: "^CNXSERVICE", name: "Nifty Services Sector", category: "Sectoral", source: "NSE" },

  // ==================== NSE NIFTY Thematic ====================
  { symbol: "^CNXENERGY", name: "Nifty Energy", category: "Thematic", source: "NSE" },
  { symbol: "^CNXCMDT", name: "Nifty Commodities", category: "Thematic", source: "NSE" },
  { symbol: "^CNXCPSE", name: "Nifty CPSE", category: "Thematic", source: "NSE" },
  { symbol: "^CNXCONSUM", name: "Nifty India Consumption", category: "Thematic", source: "NSE" },
  { symbol: "^CNXINFRA", name: "Nifty India Defence", category: "Thematic", source: "NSE", proxyNote: "Infrastructure Proxy" },
  { symbol: "^CNXIT", name: "Nifty India Digital", category: "Thematic", source: "NSE", proxyNote: "Nifty IT Proxy" },
  { symbol: "^CNXFIN", name: "Nifty Capital Markets", category: "Thematic", source: "NSE", proxyNote: "Financial Services Proxy" },
  { symbol: "^CNXREALTY", name: "Nifty Housing", category: "Thematic", source: "NSE", proxyNote: "Realty Proxy" },
  { symbol: "^CNXREALTY", name: "Nifty Core Housing", category: "Thematic", source: "NSE", proxyNote: "Realty Proxy" },
  { symbol: "^CNXINFRA", name: "Nifty Infrastructure & Logistics", category: "Thematic", source: "NSE" },
  { symbol: "^CNXAUTO", name: "Nifty EV & New Age Automotive", category: "Thematic", source: "NSE", proxyNote: "Nifty Auto Proxy" },
  { symbol: "^NSEI", name: "Nifty Conglomerate 50", category: "Thematic", source: "NSE", proxyNote: "Nifty 50 Proxy" },
  { symbol: "^CNX100", name: "Nifty100 ESG", category: "Thematic", source: "NSE", proxyNote: "Nifty 100 Proxy" },
  { symbol: "^CNX100", name: "Nifty100 ESG Sector Leaders", category: "Thematic", source: "NSE", proxyNote: "Nifty 100 Proxy" },
  { symbol: "^CNX100", name: "Nifty100 Enhanced ESG", category: "Thematic", source: "NSE", proxyNote: "Nifty 100 Proxy" },

  // ==================== NSE NIFTY Popular Strategy ====================
  { symbol: "^NSEI", name: "Nifty Alpha 50", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 50 Proxy" },
  { symbol: "^NSEI", name: "Nifty Alpha Low Volatility 30", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 50 Proxy" },
  { symbol: "^NSEI", name: "Nifty Quality 30", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 50 Proxy" },
  { symbol: "^NSEI", name: "Nifty Low Volatility 50", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 50 Proxy" },
  { symbol: "^NSEI", name: "Nifty Value 20", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 50 Proxy" },
  { symbol: "^NSEI", name: "Nifty Momentum 30", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 50 Proxy" },
  { symbol: "^CNX200", name: "Nifty200 Momentum 30", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 200 Proxy" },
  { symbol: "^CNX200", name: "Nifty200 Quality 30", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 200 Proxy" },
  { symbol: "^CNX200", name: "Nifty200 Alpha 30", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 200 Proxy" },
  { symbol: "^CNX100", name: "Nifty100 Equal Weight", category: "Popular Strategy", source: "NSE", proxyNote: "Nifty 100 Proxy" },

  // ==================== BSE S&P Broad Market ====================
  { symbol: "^BSESN", name: "S&P BSE Sensex", category: "Broad Market", source: "BSE" },
  { symbol: "^BSESN", name: "S&P BSE Sensex 50", category: "Broad Market", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSESN", name: "S&P BSE Sensex Next 50", category: "Broad Market", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSE100", name: "S&P BSE 100", category: "Broad Market", source: "BSE" },
  { symbol: "^BSE200", name: "S&P BSE 200", category: "Broad Market", source: "BSE" },
  { symbol: "^BSE500", name: "S&P BSE 500", category: "Broad Market", source: "BSE" },
  { symbol: "^BSEMID", name: "BSE MidCap", category: "Broad Market", source: "BSE" },
  { symbol: "^BSESML", name: "BSE SmallCap", category: "Broad Market", source: "BSE" },
  { symbol: "^BSE100", name: "BSE LargeCap", category: "Broad Market", source: "BSE", proxyNote: "BSE 100 Proxy" },
  { symbol: "^BSE200", name: "BSE India 150", category: "Broad Market", source: "BSE", proxyNote: "BSE 200 Proxy" },
  { symbol: "^BSEMID", name: "BSE Focused Midcap", category: "Broad Market", source: "BSE", proxyNote: "BSE Midcap Proxy" },

  // ==================== BSE S&P Sectoral ====================
  { symbol: "^BSEBANK", name: "BSE Bankex", category: "Sectoral", source: "BSE" },
  { symbol: "^BSEAUTO", name: "BSE Auto", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSECGC", name: "BSE Capital Goods", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSECD", name: "BSE Consumer Durables", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSEFMCG", name: "BSE FMCG", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSEHC", name: "BSE Healthcare", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSEIT", name: "BSE IT", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSEMETAL", name: "BSE Metal", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSEOIL", name: "BSE Oil & Gas", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSEPOWER", name: "BSE Power", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSEREALTY", name: "BSE Realty", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSETE", name: "BSE Telecom", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSEPSU", name: "BSE PSU", category: "Sectoral", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSEBANK", name: "BSE Private Banks", category: "Sectoral", source: "BSE", proxyNote: "Bankex Proxy" },
  { symbol: "^BSEBANK", name: "BSE PSU Bank", category: "Sectoral", source: "BSE", proxyNote: "Bankex Proxy" },

  // ==================== BSE S&P Thematic ====================
  { symbol: "^BSE500", name: "BSE Bharat 22", category: "Thematic", source: "BSE", proxyNote: "BSE 500 Proxy" },
  { symbol: "^BSE500", name: "BSE CPSE", category: "Thematic", source: "BSE", proxyNote: "BSE 500 Proxy" },
  { symbol: "^BSE500", name: "BSE India Infrastructure", category: "Thematic", source: "BSE", proxyNote: "BSE 500 Proxy" },
  { symbol: "^BSE500", name: "BSE India Manufacturing", category: "Thematic", source: "BSE", proxyNote: "BSE 500 Proxy" },
  { symbol: "^BSESN", name: "BSE India Sector Leaders", category: "Thematic", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSE100", name: "BSE ESG Index", category: "Thematic", source: "BSE", proxyNote: "BSE 100 Proxy" },
  { symbol: "^BSESN", name: "BSE Greenex", category: "Thematic", source: "BSE", proxyNote: "Sensex Proxy" },
  { symbol: "^BSESN", name: "BSE Carbonex", category: "Thematic", source: "BSE", proxyNote: "Sensex Proxy" }
];
