# FundAnalyze - 实时基金追踪分析工具

FundAnalyze 是一个基于 React + Vite 构建的现代化基金追踪 Web 应用，旨在帮助用户实时监控基金表现、分析历史趋势并高效管理自选基金组合。

## ✨ 核心功能

### 1. 🚀 实时数据追踪
- **实时估值**：直观展示基金今日的实时估值涨跌幅 (Real-time Estimate)。
- **实时排序**：基金列表自动按预估涨跌幅降序排列，关注重点一目了然。
- **关键指标**：同时展示上一交易日官方涨跌幅 (Previous Day Change) 及最新净值 (NAV)。

### 2. 📊 交互式趋势分析 (Perspective View)
- **趋势图表**：点击任意基金卡片即可进入详情透视视图。
- **多维度与其**：支持查看 **近7天 (7D)**、1个月、3个月、6个月、1年及历史全部的收益率走势。
- **可视化优化**：使用 Recharts 绘制，展示百分比收益率趋势，涨跌颜色分明。

### 3. 📁 分组管理系统
- **多分组支持**：内置支持按渠道（如"支付宝"、"京东"）或其他自定义逻辑进行分组显示。
- **便捷配置**：支持通过 JSON 配置文件直接管理分组结构。
- **本地持久化**：所有分组配置修改实时保存至浏览器 **LocalStorage**，刷新页面不丢失，无需依赖后端数据库。

### 4. 🎨 现代化 UI/UX
- **暗黑模式**：默认采用极简暗黑风格，护眼且专业。
- **紧凑布局**：优化的单行卡片设计，在有限屏幕空间内展示更多高价值信息。
- **高性能**：采用请求节流 (Throttling) 技术优化 API 调用，确保大量基金数据加载流畅。

## 🛠️ 技术栈

- **前端框架**: [React 18](https://react.dev/)
- **构建工具**: [Vite](https://vitejs.dev/)
- **图表库**: [Recharts](https://recharts.org/)
- **图标库**: [Lucide React](https://lucide.dev/)
- **数据源**: 天天基金网 (Eastmoney) API (通过 Vite Proxy 代理)

## 📦 安装与运行

1. **克隆仓库**
   ```bash
   git clone https://github.com/88HaoHuai/FundAnalyze.git
   cd FundAnalyze
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   访问终端显示的本地地址 (通常是 `http://localhost:5173`) 即可使用。

## 📝 配置说明

- 默认基金配置位于 `src/config/funds.json`。
- 修改前端分组管理器的设置会自动保存在本地浏览器中。如需恢复默认配置，请清除浏览器 LocalStorage 中的 `fundTrackerGroups` 字段。
