export default async function handler(req, res) {
    const { path } = req.query;
    const targetUrl = `http://fund.eastmoney.com/pingzhongdata/${path}`;

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

        const data = await response.text();
        // Cache for 1 hour
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.status(200).send(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).send('Internal Server Error');
    }
}
