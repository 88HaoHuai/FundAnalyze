import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-python-api-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith('/api/news')) {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const keyword = urlObj.searchParams.get('keyword') || '';

            console.log(`[News Fetch] Keyword: ${keyword}`);
            const scriptPath = path.resolve(__dirname, 'src/services/fetch_news.py');
            const cmd = `python3 "${scriptPath}" "${keyword}"`;

            exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              if (error) {
                console.error("[News Fetch] Error:", error);
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: error.message }));
                return;
              }
              res.statusCode = 200;
              res.end(stdout);
            });
          } else if (req.url.startsWith('/api/ai') && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const title = payload.title || '';
                const content = payload.content || '';
                const fundSectors = payload.fundSectors || '';

                console.log(`[AI Analysis] Processing: ${title}`);
                const scriptPath = path.resolve(__dirname, 'src/services/fetch_ai.py');

                // 将 title 和 content 使用 Base64 或安全的引号包裹传给 Python
                // 为简便此处的 exec 安全性，使用包裹双引号，并替换文内双引号
                const safeTitle = title.replace(/"/g, '\\"').replace(/\n/g, ' ');
                const safeContent = content.replace(/"/g, '\\"').replace(/\n/g, ' ');
                const safeSectors = fundSectors.replace(/"/g, '\\"').replace(/\n/g, ' ');
                const cmd = `python3 "${scriptPath}" "${safeTitle}" "${safeContent}" "${safeSectors}"`;

                exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  if (error) {
                    console.error("[AI Analysis] Error:", error);
                    console.error(stderr);
                    res.statusCode = 500;
                    res.end(JSON.stringify({ success: false, error: error.message }));
                    return;
                  }
                  res.statusCode = 200;
                  res.end(stdout);
                });
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: 'Invalid Payload' }));
              }
            });
          } else {
            next();
          }
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.startsWith('/api/news')) {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const keyword = urlObj.searchParams.get('keyword') || '';

            console.log(`[Preview News Fetch] Keyword: ${keyword}`);
            const scriptPath = path.resolve(__dirname, 'src/services/fetch_news.py');
            const cmd = `python3 "${scriptPath}" "${keyword}"`;

            exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              if (error) {
                console.error("[Preview News Fetch] Error:", error);
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: error.message }));
                return;
              }
              res.statusCode = 200;
              res.end(stdout);
            });
          } else if (req.url.startsWith('/api/ai') && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                const payload = JSON.parse(body);
                const title = payload.title || '';
                const content = payload.content || '';
                const fundSectors = payload.fundSectors || '';

                console.log(`[Preview AI Analysis] Processing: ${title}`);
                const scriptPath = path.resolve(__dirname, 'src/services/fetch_ai.py');
                const safeTitle = title.replace(/"/g, '\\"').replace(/\n/g, ' ');
                const safeContent = content.replace(/"/g, '\\"').replace(/\n/g, ' ');
                const safeSectors = fundSectors.replace(/"/g, '\\"').replace(/\n/g, ' ');
                const cmd = `python3 "${scriptPath}" "${safeTitle}" "${safeContent}" "${safeSectors}"`;

                exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                  res.setHeader('Content-Type', 'application/json; charset=utf-8');
                  if (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ success: false, error: error.message }));
                    return;
                  }
                  res.statusCode = 200;
                  res.end(stdout);
                });
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: 'Invalid Payload' }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ],
  server: {
    proxy: {
      '/api/fund': {
        target: 'http://fundgz.1234567.com.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fund/, '/js'),
      },
      '/api/pingzhong': {
        target: 'http://fund.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pingzhong/, '/pingzhongdata'),
        headers: {
          'Referer': 'http://fund.eastmoney.com/'
        }
      },
      '/api/f10/FundArchivesDatas.aspx': {
        target: 'http://fundf10.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/f10/, ''),
        headers: {
          'Referer': 'http://fund.eastmoney.com/'
        }
      },
      '/api/f10': {
        target: 'http://api.fund.eastmoney.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/f10/, '/f10'),
        headers: {
          'Referer': 'http://fund.eastmoney.com/'
        }
      },
      '/api/stock': {
        target: 'http://qt.gtimg.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stock/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      },
    }
  }
})
