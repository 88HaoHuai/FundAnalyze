import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    },
    configureServer(server) {
      server.middlewares.use('/api/funds/save', async (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const funds = JSON.parse(body);
              const filePath = path.resolve(__dirname, 'src/config/funds.json');
              console.log(`[Funds Save] Saving to ${filePath}`);
              fs.writeFileSync(filePath, JSON.stringify(funds, null, 2));
              console.log(`[Funds Save] Success!`);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (e) {
              console.error('Failed to write funds file', e);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: 'Failed to write file' }));
            }
          });
        } else {
          next();
        }
      });
    }
  },
})
