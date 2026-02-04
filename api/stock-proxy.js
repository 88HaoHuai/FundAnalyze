export default async function handler(req, res) {
    const { list } = req.query;

    if (!list) {
        return res.status(400).send('Missing list parameter');
    }

    const targetUrl = `http://hq.sinajs.cn/list=${list}`;

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'Referer': 'https://finance.sina.com.cn/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
        }

        // Sina returns GBK encoding effectively, but usually browser handles it if charset is unspecified or we need to decode manually?
        // Actually fetch() might decode it as UTF-8 by default which corrupts GBK strings.
        // For stock names (Chinese), this is critical.
        // But Node.js fetch might return buffer.

        // Simpler approach: Return ArrayBuffer and set header for client to decode,
        // OR try to decode here if we know it's GBK.
        // Since Vercel Edge/Serverless might be limited, let's just pass the buffer 
        // and let the browser (client) handle the decoding if possible, 
        // OR convert to UTF-8 here.

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Sina uses GBK. We need to convert to UTF-8 for modern web.
        // We can use TextDecoder if available, or iconv-lite (but we don't have it installed).
        // Standard TextDecoder supports 'gbk'.

        const decoder = new TextDecoder('gbk');
        const text = decoder.decode(buffer);

        res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.status(200).send(text);
    } catch (error) {
        console.error('Stock Proxy error:', error);
        res.status(500).send('Internal Server Error');
    }
}
