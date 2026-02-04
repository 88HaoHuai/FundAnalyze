export default async function handler(req, res) {
    const { q } = req.query;
    // Target: http://qt.gtimg.cn/q=sh600519,sz000001
    const targetUrl = `http://qt.gtimg.cn/q=${q}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                // Tencnet doesn't require specific referer usually, but let's be safe
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Tencent returns GBK. Convert to UTF-8.
        const decoder = new TextDecoder('gbk');
        const text = decoder.decode(buffer);

        // Cache for 5 seconds
        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.status(200).send(text);
    } catch (error) {
        console.error('Stock Proxy error:', error);
        res.status(500).send('Internal Server Error');
    }
}
