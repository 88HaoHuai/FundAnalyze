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

    // Fetch Real-time Stock Quotes (Tencent/Gtimg API)
    fetchStockQuotes: async (codes) => {
        if (!codes || codes.length === 0) return {};

        // 1. Convert to Tencent format
        // 6xxxxx -> sh6xxxxx
        // 0xxxxx -> sz0xxxxx
        // 3xxxxx -> sz3xxxxx
        // 8xxxxx -> bj8xxxxx
        // 4xxxxx -> bj4xxxxx
        const qtCodes = codes.map(c => {
            if (c.startsWith('6')) return `sh${c}`;
            if (c.startsWith('0')) return `sz${c}`;
            if (c.startsWith('3')) return `sz${c}`;
            if (c.startsWith('8')) return `bj${c}`;
            if (c.startsWith('4')) return `bj${c}`;
            return `sz${c}`;
        });

        try {
            // Call proxy: /api/stock?q=sh600519,sz000001
            const listParam = qtCodes.join(',');
            const res = await fetch(`/api/stock?q=${listParam}`);
            const text = await res.text();

            // Parse response: v_sh600519="1~Moutai~600519~1500.00~1490.00~...";
            const map = {};

            qtCodes.forEach((qc, idx) => {
                const originalCode = codes[idx];
                const match = text.match(new RegExp(`v_${qc}="([^"]+)";`));
                if (match && match[1]) {
                    const parts = match[1].split('~');
                    if (parts.length > 30) {
                        const name = parts[1];
                        const price = parseFloat(parts[3]);
                        const prevClose = parseFloat(parts[4]);

                        let change = 0;
                        if (prevClose > 0 && price > 0) {
                            change = ((price - prevClose) / prevClose) * 100;
                        }
                        if (price === 0) change = 0; // Suspended

                        map[originalCode] = {
                            name: name,
                            price: price,
                            change: parseFloat(change.toFixed(2))
                        };
                    }
                }
            });

            return map;
        } catch (e) {
            console.error('Failed to fetch stock quotes', e);
            return {};
        }
    }
};
