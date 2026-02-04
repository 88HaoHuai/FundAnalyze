import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Loader } from 'lucide-react';
import { fundApi } from '../services/fundApi';
import { AreaChart, Area, Line, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
        if (!data || data.length === 0) return { processedData: [], signals: null };

        // 1. Calculate MAs over the ENTIRE dataset first (to have valid MAs even at the start of the view)
        const withIndicators = data.map((item, index, array) => {
            const getMA = (days) => {
                if (index < days - 1) return null;
                const slice = array.slice(index - days + 1, index + 1);
                const sum = slice.reduce((a, b) => a + b.value, 0);
                return sum / days;
            };
            return {
                ...item,
                ma20: getMA(20),
                ma60: getMA(60)
            };
        });

        // 2. Filter for View Range
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

        // We need the data points to be consistent with the view
        let filtered = withIndicators.filter(d => d.time >= cutoffTime);
        if (filtered.length === 0 && withIndicators.length > 0) filtered = withIndicators.slice(-10);

        if (filtered.length === 0) return { processedData: [], signals: null };

        // 3. Normalize values for Chart (Percentage change relative to Start of View)
        // Note: MAs also need to be normalized relative to the SAME start value to plot correctly on % scale
        // OR, we plot everything on absolute scale? 
        // Current chart uses %, which is good for "Return".
        // But MAs are Price levels.
        // Solution: Calculate "Percentage Return" for Matrix too.

        const startValue = filtered[0].value;
        const normalize = (val) => val ? Number(((val - startValue) / startValue * 100).toFixed(2)) : null;

        const finalData = filtered.map(p => ({
            date: new Date(p.time).toLocaleDateString(),
            value: normalize(p.value),
            ma20: normalize(p.ma20),
            ma60: normalize(p.ma60),
            originalValue: p.value,
            time: p.time
        }));

        // 4. Calculate Signals (based on LATEST data)
        const last = withIndicators[withIndicators.length - 1];
        // Support/Resistance (Last 60 days)
        const last60 = withIndicators.slice(-60);
        const max60 = Math.max(...last60.map(d => d.value));
        const min60 = Math.min(...last60.map(d => d.value));

        const currentNav = last.value;
        const distToSupport = ((currentNav - min60) / min60 * 100).toFixed(1);
        const distToResist = ((currentNav - max60) / max60 * 100).toFixed(1);

        // Trend
        const isBullish = last.ma20 && last.ma60 && last.ma20 > last.ma60;
        const trend = isBullish ? 'Bullish (看多)' : 'Bearish (看空)';

        return {
            processedData: finalData,
            signals: {
                trend,
                isBullish,
                support: min60,
                resistance: max60,
                normSupport: normalize(min60),
                normResistance: normalize(max60),
                distToSupport, // "2.5" means 2.5% above support
                distToResist,  // "-5.0" means 5% below resistance
                currentNav
            }
        };
    };

    const { processedData: chartData, signals } = history ? processData(history.acTrend, range) : { processedData: [], signals: null };
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
                style={{ width: '100%', maxWidth: '900px', height: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '0' }}
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
                                决策
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

                            {/* 💡 Signal Panel */}
                            {signals && (
                                <div style={{
                                    display: 'flex', gap: '12px', marginBottom: '16px',
                                    background: '#0f172a', padding: '12px', borderRadius: '8px',
                                    borderLeft: `4px solid ${signals.isBullish ? '#22c55e' : '#ef4444'}`
                                }}>
                                    {/* Trend Block */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: '#94a3b8', fontSize: '12px' }}>趋势信号</div>
                                        <div style={{ color: signals.isBullish ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                                            {signals.isBullish ? '📈 多头排列 (金叉/向上)' : '📉 空头排列 (死叉/向下)'}
                                        </div>
                                    </div>

                                    {/* Support Block */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ color: '#94a3b8', fontSize: '12px' }}>支撑位 (Low 60d)</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: '#f8fafc', fontWeight: 500 }}>{signals.support}</span>
                                            <span style={{
                                                fontSize: '11px',
                                                padding: '2px 6px', borderRadius: '4px',
                                                background: parseFloat(signals.distToSupport) < 3 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                                                color: parseFloat(signals.distToSupport) < 3 ? '#22c55e' : '#94a3b8'
                                            }}>
                                                距支撑 +{signals.distToSupport}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Advice Block */}
                                    <div style={{ flex: 1.5, borderLeft: '1px solid #334155', paddingLeft: '12px' }}>
                                        <div style={{ color: '#94a3b8', fontSize: '12px' }}>智能操作建议</div>
                                        <div style={{ color: '#f8fafc', fontSize: '13px' }}>
                                            {parseFloat(signals.distToSupport) < 2
                                                ? <span style={{ color: '#22c55e' }}>🟢 接近支撑位，建议分批买入 (Low Risk)</span>
                                                : (parseFloat(signals.distToResist) > -2
                                                    ? <span style={{ color: '#ef4444' }}>🔴 接近压力位，建议止盈/减仓</span>
                                                    : <span style={{ color: '#94a3b8' }}>⚪ 趋势中继，持有观望</span>)
                                            }
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Controls */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '10px' }}>
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
                                                domain={['auto', 'auto']}
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                                itemStyle={{ color: '#f8fafc' }}
                                                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                                formatter={(val, name) => {
                                                    if (name === 'value') return [`${val}%`, '收益率'];
                                                    if (name === 'ma20') return [`${val}%`, 'MA20'];
                                                    if (name === 'ma60') return [`${val}%`, 'MA60'];
                                                    return [val, name];
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="value"
                                                stroke={chartColor}
                                                fillOpacity={1}
                                                fill="url(#colorValue)"
                                                strokeWidth={2}
                                                name="value"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="ma20"
                                                stroke="#fbbf24"
                                                strokeWidth={1}
                                                dot={false}
                                                name="ma20"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="ma60"
                                                stroke="#a855f7"
                                                strokeWidth={1}
                                                dot={false}
                                                name="ma60"
                                            />
                                            {signals && chartData.length > 0 && (
                                                <>
                                                    <ReferenceLine
                                                        y={signals.normSupport}
                                                        stroke="#22c55e"
                                                        strokeDasharray="3 3"
                                                        label={{ value: `支撑: ${signals.support}`, position: 'insideBottomLeft', fill: '#22c55e', fontSize: 10 }}
                                                    />
                                                    <ReferenceLine
                                                        y={signals.normResistance}
                                                        stroke="#ef4444"
                                                        strokeDasharray="3 3"
                                                        label={{ value: `压力: ${signals.resistance}`, position: 'insideTopLeft', fill: '#ef4444', fontSize: 10 }}
                                                    />
                                                </>
                                            )}
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
