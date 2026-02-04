// Real data service using Eastmoney API via local proxy

export const fundApi = {
    // Parsing JSONP format: jsonpgz({...});
    parseJsonp: (jsonpStr) => {
        try {
            const match = jsonpStr.match(/jsonpgz\((.*)\);/);
            if (match && match[1]) {
                return JSON.parse(match[1]);
            }
            return null;
        } catch (e) {
            console.error('Failed to parse JSONP', e);
            return null;
        }
    },

    // Fetch a single fund info
    fetchFundInfo: async (code) => {
        try {
            const response = await fetch(`/api/fund/${code}.js?rt=${Date.now()}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const text = await response.text();
            const data = fundApi.parseJsonp(text);
            if (!data) throw new Error('Invalid data format');

            return {
                code: data.fundcode,
                name: data.name,
                nav: data.dwjz, // Unit Net Value (Yesterday's close)
                navDate: data.jzrq, // NAV Date
                estChange: data.gszzl, // Estimated Growth Rate (Today)
                estTime: data.gztime, // Estimation Time
                valuation: data.gsz, // Estimated Value
                holdings: []
            };
        } catch (error) {
            console.error(`Error fetching fund ${code}:`, error);
            throw error;
        }
    },

    // Fetch full history and details (for Perspective)
    fetchFundHistory: async (code) => {
        try {
            const response = await fetch(`/api/pingzhong/${code}.js?rt=${Date.now()}`);
            if (!response.ok) throw new Error('Network response was not ok');
            const text = await response.text();

            // Data_ACWorthTrend = [[timestamp, value], ...] (Cumulative Net Worth Trend)
            // Data_netWorthTrend = [{x: timestamp, y: value, ...}] (Net Worth Trend)

            const acTrendMatch = text.match(/var Data_ACWorthTrend\s*=\s*(\[.*?\]);/s);
            const netTrendMatch = text.match(/var Data_netWorthTrend\s*=\s*(\[.*?\]);/s);

            const acTrend = acTrendMatch ? JSON.parse(acTrendMatch[1]) : [];
            const netTrend = netTrendMatch ? JSON.parse(netTrendMatch[1]) : [];

            return {
                acTrend: acTrend.map(pt => ({ time: pt[0], value: pt[1] })),
                netTrend: netTrend
            };
        } catch (e) {
            console.error("Failed to fetch history", e);
            return { acTrend: [], netTrend: [] };
        }
    },

    // Search a fund - In this context, it's just fetching the info using the code
    searchFund: async (code) => {
        return await fundApi.fetchFundInfo(code);
    },

    // Get estimates for multiple funds (Throttled fetch)
    getRealTimeEstimates: async (codes) => {
        const BATCH_SIZE = 5;
        const results = [];

        // Chunk the codes
        for (let i = 0; i < codes.length; i += BATCH_SIZE) {
            const chunk = codes.slice(i, i + BATCH_SIZE);
            try {
                const chunkPromises = chunk.map(code =>
                    fundApi.fetchFundInfo(code).catch(e => {
                        console.warn(`Failed to fetch ${code}:`, e);
                        return null;
                    })
                );
                const chunkResults = await Promise.all(chunkPromises);
                results.push(...chunkResults);

                // Small delay between chunks to be nice
                if (i + BATCH_SIZE < codes.length) {
                    await new Promise(r => setTimeout(r, 100)); // 100ms delay
                }
            } catch (error) {
                console.error("Batch fetch chunk failed", error);
            }
        }

        return results.filter(item => item !== null);
    },

    // Save updated fund list to server (file)
    saveFunds: async (codes) => {
        try {
            await fetch('/api/funds/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(codes)
            });
        } catch (e) {
            console.error("Failed to save funds", e);
        }
    },

    // Fetch previous day's change (JZZZL) from F10 API
    fetchPreviousDayChange: async (code) => {
        try {
            // ?fundCode=001632&pageIndex=1&pageSize=1
            const response = await fetch(`/api/f10/lsjz?fundCode=${code}&pageIndex=1&pageSize=1`);
            if (!response.ok) return null;
            const json = await response.json();
            if (json && json.Data && json.Data.LSJZList && json.Data.LSJZList.length > 0) {
                const item = json.Data.LSJZList[0];
                // item.JZZZL is the growth rate (e.g., "0.34" means 0.34%)
                return {
                    code: code,
                    prevDate: item.FSRQ,
                    prevChange: item.JZZZL // String, e.g. "0.34" or "-1.20"
                };
            }
            return null;
        } catch (e) {
            console.error(`Failed to fetch prev change for ${code}`, e);
            return null;
        }
    },

    // Batch fetch previous day changes
    getBatchPreviousDayChange: async (codes) => {
        const BATCH_SIZE = 5;
        const results = [];

        for (let i = 0; i < codes.length; i += BATCH_SIZE) {
            const chunk = codes.slice(i, i + BATCH_SIZE);
            const promises = chunk.map(code => fundApi.fetchPreviousDayChange(code));
            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults.filter(Boolean));
            if (i + BATCH_SIZE < codes.length) {
                await new Promise(r => setTimeout(r, 100));
            }
        }
        return results;
    },

    // Fetch analysis data (Drawdown, etc.) with caching
    // Returns: { maxDrawdown: -15.2, yearHigh: 1.2345, lastUpdated: timestamp }
    fetchAnalysisData: async (code) => {
        const today = new Date().toISOString().split('T')[0];
        const cacheKey = `fund_analysis_v2_${code}_${today}`;

        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            // Ignore cache errors
        }

        // Fetch history if not cached
        const history = await fundApi.fetchFundHistory(code);
        if (!history || !history.acTrend || history.acTrend.length === 0) {
            return null;
        }

        // Calculate 1 Year stats
        // Default to all data if less than 1 year, or filter last 250 points roughly
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
        const recentData = history.acTrend.filter(pt => pt.time >= oneYearAgo);

        if (recentData.length === 0) return null;

        // --- 1. Drawdown Calculation ---
        let yearHigh = -Infinity;
        recentData.forEach(pt => {
            if (pt.value > yearHigh) yearHigh = pt.value;
        });

        const currentVal = recentData[recentData.length - 1].value;
        const drawdown = ((currentVal - yearHigh) / yearHigh) * 100;

        // --- 2. RSI Calculation (14-day) ---
        const rsi = fundApi.calculateRSI(recentData, 14);

        // --- 3. Volatility Calculation (20-day StdDev of % changes) ---
        const volatility = fundApi.calculateVolatility(recentData, 20);

        const result = {
            maxDrawdown: parseFloat(drawdown.toFixed(2)),
            yearHigh: yearHigh,
            currentVal: currentVal,
            rsi: rsi !== null ? parseFloat(rsi.toFixed(1)) : null,
            volatility: volatility !== null ? parseFloat(volatility.toFixed(2)) : null,
            lastUpdated: Date.now()
        };

        try {
            localStorage.setItem(cacheKey, JSON.stringify(result));
            // Optional: Cleanup old keys? Maybe lazily.
        } catch (e) { }

        return result;
    },

    // --- Helper Algorithms ---
    calculateRSI: (data, period = 14) => {
        if (data.length < period + 1) return null;

        // Use simple SMA method for robustness over short history slices
        let gains = 0;
        let losses = 0;

        // Calculate initial RSI
        for (let i = 1; i <= period; i++) {
            const change = data[data.length - period - 1 + i].value - data[data.length - period - 1 + i - 1].value;
            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }

        if (losses === 0) return 100;
        if (gains === 0) return 0;

        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    },

    calculateVolatility: (data, period = 20) => {
        if (data.length < period + 1) return null;

        const recent = data.slice(-period - 1);
        const changes = [];
        for (let i = 1; i < recent.length; i++) {
            changes.push((recent[i].value - recent[i - 1].value) / recent[i - 1].value);
        }

        const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
        const variance = changes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / changes.length;

        // Annualized Volatility? Standard is usually daily sigma.
        // Let's return Daily Sigma * 100 (percentage)
        return Math.sqrt(variance) * 100;
    },

    // Fetch Top 10 Holdings (Stock Positions)
    fetchFundHoldings: async (code) => {
        try {
            // Using the new proxy logic for FundArchivesDatas.aspx
            const res = await fetch(`/api/f10/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10`);
            const text = await res.text();

            // The response is a weird JS variable assignment: "var apidata={...}" or just HTML inside.
            // Actually based on curl it returns HTML directly inside document.write or similar?
            // Wait, the curl output was: "var apidata = { content: '...<table>...</table>', ... }"
            // Or directly HTML?
            // The curl output showed: "<div class='box'>...<table>...</table>"
            // Wait, the curl output I saw earlier (step 648) was pure HTML content starting with regex matching.
            // Let's assume it returns the HTML snippet directly or inside a JS string.
            // Actually the browser usually loads this via script tag.
            // If we fetch it as text, we might get `var apidata = { content:"...", ... }`
            // Let's rely on Regex to find the table rows.

            const stocks = [];

            // Regex to find stock rows: 
            // <td><a href='...'>688981</a></td><td class='tol'><a href='...'>中芯国际</a>...<td class='tor'>9.15%</td>
            // We need 1. Code, 2. Name, 3. Percent

            // Matches: href='...'>Code</a> ... >Name</a> ... >Percent%</td>
            const rowRegex = /href='[^']*'>(\d{6})<\/a>.*?<td class='tol'><a href='[^']*'>([^<]+)<\/a>.*?<td class='tor'>([\d\.]+)%<\/td>/g;

            let match;
            while ((match = rowRegex.exec(text)) !== null) {
                stocks.push({
                    code: match[1],
                    name: match[2],
                    percent: parseFloat(match[3])
                });
            }

            // Limit to top 10 just in case
            return stocks.slice(0, 10);
        } catch (e) {
            console.error('Failed to fetch holdings', e);
            return [];
        }
    },

    // Batch fetch analysis
    // Batch fetch analysis
    getBatchAnalysis: async (codes) => {
        // Process in chunks of 5 to avoid overwhelming
        const results = {};
        for (let i = 0; i < codes.length; i += 5) {
            const chunk = codes.slice(i, i + 5);
            const chunkResults = await Promise.all(chunk.map(code => fundApi.fetchAnalysisData(code)));
            chunk.forEach((code, idx) => {
                if (chunkResults[idx]) {
                    results[code] = chunkResults[idx];
                }
            });
            // Small delay
            if (i + 5 < codes.length) await new Promise(r => setTimeout(r, 100));
        }
        return results;
    },

    // Fetch Real-time Stock Quotes (Eastmoney API)
    fetchStockQuotes: async (codes) => {
        if (!codes || codes.length === 0) return {};

        // 1. Convert to Eastmoney format
        // 6xxxxx -> 1.6xxxxx (SH)
        // 0xxxxx -> 0.0xxxxx (SZ)
        // 3xxxxx -> 0.3xxxxx (SZ)
        // 8xxxxx -> 0.8xxxxx (BJ)
        // 4xxxxx -> 0.4xxxxx (BJ)
        const emCodes = codes.map(c => {
            if (c.startsWith('6')) return `1.${c}`;
            return `0.${c}`; // 0, 3, 8, 4 all map to 0. prefix usually for SZ/BJ in push2?
            // Correction: 
            // 0.xxxxxx for SZ
            // 0.xxxxxx for BJ? Actually BJ is 0.8xxxxx usually.
            // Let's stick to 0. for non-SH for now as it covers most.
            // Actually let's be more precise if needed, but 0. works for SZ (0/3).
            // Beijing (8/4) also works with 0. prefix in Eastmoney? 
            // Yes, strict mapping: 1 for SH, 0 for everything else usually.
        });

        try {
            // Call proxy: /api/stock?fields=f12,f14,f2,f3&secids=1.600519,0.000001
            const idParam = emCodes.join(',');
            const res = await fetch(`/api/stock?invt=2&fltt=2&fields=f12,f14,f2,f3&secids=${idParam}`);
            const json = await res.json();

            // Parse response: { data: { diff: [{ f12: "600519", f14: "Moutai", f2: 1500, f3: 1.23 }, ...] } }
            const map = {};

            if (json && json.data && json.data.diff) {
                // diff can be an array or object? Usually array for ulist.get
                // Wait, ulist.get returns array.
                const list = Array.isArray(json.data.diff) ? json.data.diff : Object.values(json.data.diff);

                list.forEach(item => {
                    // item.f12 is code, item.f14 is name
                    // item.f2 is price (number), item.f3 is change% (number)
                    // item.f3 might be "-" if suspended

                    const code = item.f12;
                    let change = item.f3;
                    let price = item.f2;

                    // Handle invalid data
                    if (change === '-') change = 0;
                    if (price === '-') price = 0;

                    map[code] = {
                        name: item.f14,
                        price: price,
                        change: typeof change === 'number' ? change.toFixed(2) : change
                    };
                });
            }

            return map;
        } catch (e) {
            console.error('Failed to fetch stock quotes', e);
            return {};
        }
    }
};
