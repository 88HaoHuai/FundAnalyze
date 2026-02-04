export default async function handler(req, res) {
    // Explicitly extract only needed parameters
    const { path } = req.query;
    const { fundCode, pageIndex, pageSize } = req.query;

    const queryParams = new URLSearchParams();
    if (fundCode) queryParams.append('fundCode', fundCode);
    if (pageIndex) queryParams.append('pageIndex', pageIndex);
    if (pageSize) queryParams.append('pageSize', pageSize);

    const targetUrl = `http://api.fund.eastmoney.com/f10/${path}?${queryParams.toString()}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Referer': 'http://fund.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
        }

        const data = await response.json();
        // Cache for 10 minutes
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
        res.status(200).json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Internal Server Error');
    }
}
