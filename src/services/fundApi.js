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
    }
};
