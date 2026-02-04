export default async function handler(req, res) {
    const queryParams = new URLSearchParams(req.query).toString();
    // Target: http://push2.eastmoney.com/api/qt/ulist.get?param1=...
    const targetUrl = `http://push2.eastmoney.com/api/qt/ulist.get?${queryParams}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                // Eastmoney standard headers
                'Referer': 'http://quote.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
        }

        const data = await response.json();

        // Cache for 5 seconds (Real-time data)
        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
        // Vercel/Node fetch returns utf-8 json by default for standard JSON APIs
        res.status(200).json(data);
    } catch (error) {
        console.error('Stock Proxy error:', error);
        res.status(500).send('Internal Server Error');
    }
}
