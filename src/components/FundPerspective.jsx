import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Loader } from 'lucide-react';
import { fundApi } from '../services/fundApi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function FundPerspective({ fund, onClose }) {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('3m'); // 7d, 1m, 3m, 6m, 1y, all
    const [activeTab, setActiveTab] = useState('trend'); // trend, holdings
    const [holdings, setHoldings] = useState([]);
    const [quotes, setQuotes] = useState({});
    const [holdingsLoading, setHoldingsLoading] = useState(false);

    // Load History
    useEffect(() => {
        let mounted = true;
        const loadData = async () => {
            setLoading(true);
            const data = await fundApi.fetchFundHistory(fund.code);
            if (mounted) {
                setHistory(data);
                setLoading(false);
            }
        };
        loadData();
        return () => { mounted = false; };
    }, [fund.code]);

    // Load Holdings when tab changes
    useEffect(() => {
        if (activeTab === 'holdings' && holdings.length === 0) {
            const loadHoldings = async () => {
                setHoldingsLoading(true);
                const data = await fundApi.fetchFundHoldings(fund.code);
                setHoldings(data);

                // Fetch real-time quotes for these stocks
                if (data && data.length > 0) {
                    const codes = data.map(s => s.code);
                    const qData = await fundApi.fetchStockQuotes(codes);
                    setQuotes(qData);
                }

                setHoldingsLoading(false);
            };
            loadHoldings();
        }
    }, [activeTab, fund.code]);

    // Data Processing for Chart
    const processData = (data, range) => {
        if (!data) return [];
        const cutoff = new Date();
        switch (range) {
            case '7d': cutoff.setDate(cutoff.getDate() - 7); break;
            case '1m': cutoff.setMonth(cutoff.getMonth() - 1); break;
            case '3m': cutoff.setMonth(cutoff.getMonth() - 3); break;
            case '6m': cutoff.setMonth(cutoff.getMonth() - 6); break;
            case '1y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
            default: // all
        }
        if (range === 'all') cutoff.setFullYear(2000);

        const cutoffTime = cutoff.getTime();
        let filtered = data.filter(d => d.time >= cutoffTime);

        if (filtered.length === 0 && data.length > 0) filtered = data.slice(-10);

        if (filtered.length > 0) {
            const startValue = filtered[0].value;
            return filtered.map(p => ({
                date: new Date(p.time).toLocaleDateString(),
                value: Number(((p.value - startValue) / startValue * 100).toFixed(2)),
                originalValue: p.value,
                time: p.time
            }));
        }
        return [];
    };

    const chartData = history ? processData(history.acTrend, range) : [];
    const chartColor = "#3b82f6";

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
        }} onClick={onClose}>
            <div
                className="card"
                style={{ width: '100%', maxWidth: '900px', height: '85vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '0' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-between" style={{ padding: '20px', borderBottom: '1px solid #334155' }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#f8fafc', fontSize: '1.25rem' }}>{fund.name}</h2>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '4px', color: '#94a3b8', fontSize: '0.875rem' }}>
                            <span>{fund.code}</span>
                            <span>NAV: {fund.nav}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Tabs */}
                        <div style={{ display: 'flex', backgroundColor: '#0f172a', padding: '4px', borderRadius: '8px' }}>
                            <button
                                onClick={() => setActiveTab('trend')}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: activeTab === 'trend' ? '#3b82f6' : 'transparent',
                                    color: activeTab === 'trend' ? 'white' : '#94a3b8',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                走势
                            </button>
                            <button
                                onClick={() => setActiveTab('holdings')}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: activeTab === 'holdings' ? '#3b82f6' : 'transparent',
                                    color: activeTab === 'holdings' ? 'white' : '#94a3b8',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                持仓
                            </button>
                        </div>

                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {activeTab === 'trend' ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
                            {/* Controls */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '20px' }}>
                                {['7d', '1m', '3m', '6m', '1y', 'all'].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRange(r)}
                                        style={{
                                            padding: '4px 12px',
                                            borderRadius: '4px',
                                            border: '1px solid ' + (range === r ? '#3b82f6' : '#334155'),
                                            background: range === r ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                            color: range === r ? '#3b82f6' : '#94a3b8',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        {r.toUpperCase()}
                                    </button>
                                ))}
                            </div>

                            {/* Chart */}
                            <div style={{ flex: 1, minHeight: 0 }}>
                                {loading ? (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                        <Loader className="spin" size={32} />
                                    </div>
                                ) : (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                                stroke="#334155"
                                                minTickGap={50}
                                            />
                                            <YAxis
                                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                                stroke="#334155"
                                                tickFormatter={(val) => `${val}%`}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                                itemStyle={{ color: '#f8fafc' }}
                                                formatter={(val) => [`${val}%`, '收益率']}
                                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke={chartColor}
                                                fillOpacity={1}
                                                fill="url(#colorValue)"
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
                            {holdingsLoading ? (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 }}>
                                        <tr style={{ borderBottom: '1px solid #334155' }}>
                                            <th style={{ padding: '16px', textAlign: 'left', fontWeight: 500, color: '#94a3b8' }}>股票名称</th>
                                            <th style={{ padding: '16px', textAlign: 'left', fontWeight: 500, color: '#94a3b8' }}>代码</th>
                                            <th style={{ padding: '16px', textAlign: 'right', fontWeight: 500, color: '#94a3b8' }}>最新涨跌</th>
                                            <th style={{ padding: '16px', textAlign: 'right', fontWeight: 500, color: '#94a3b8' }}>持仓占比</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {holdings.length > 0 ? holdings.map((stock, i) => {
                                            const quote = quotes[stock.code];
                                            const change = quote ? parseFloat(quote.change) : 0;
                                            const changeColor = change > 0 ? '#ef4444' : (change < 0 ? '#22c55e' : '#94a3b8');

                                            return (
                                                <tr key={stock.code + i} style={{ borderBottom: '1px solid #334155' }}>
                                                    <td style={{ padding: '16px', fontWeight: 500 }}>{stock.name}</td>
                                                    <td style={{ padding: '16px', color: '#94a3b8', fontFamily: 'monospace' }}>{stock.code}</td>
                                                    <td style={{ padding: '16px', textAlign: 'right', color: changeColor, fontWeight: 600 }}>
                                                        {quote ? (change > 0 ? `+${change}%` : `${change}%`) : '--'}
                                                    </td>
                                                    <td style={{ padding: '16px', textAlign: 'right', color: '#cbd5e1', fontWeight: 500 }}>{stock.percent}%</td>
                                                </tr>
                                            );
                                        }) : (
                                            <tr>
                                                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                                    暂无持仓数据
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
