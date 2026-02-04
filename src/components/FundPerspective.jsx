import { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, Loader } from 'lucide-react';
import { fundApi } from '../services/fundApi';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function FundPerspective({ fund, onClose }) {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('3m'); // 7d, 1m, 3m, 6m, 1y, all

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

    // Filter and Normalize Data (Calculate Percentage Yield)
    const processData = (data, range) => {
        if (!data) return [];
        const now = Date.now();
        const cutoff = new Date();
        switch (range) {
            case '7d': cutoff.setDate(cutoff.getDate() - 7); break;
            case '1m': cutoff.setMonth(cutoff.getMonth() - 1); break;
            case '3m': cutoff.setMonth(cutoff.getMonth() - 3); break;
            case '6m': cutoff.setMonth(cutoff.getMonth() - 6); break;
            case '1y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
            default: // all
        }
        const cutoffTime = cutoff.getTime();
        let filtered = data.filter(d => d.time >= cutoffTime);

        if (filtered.length === 0) filtered = data.slice(-30);

        // Normalize to percentage change
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

    // Use Cumulative Trend (ACWorth)
    const chartData = history ? processData(history.acTrend, range) : [];

    const isPositive = Number(fund.estChange) >= 0;
    const ChangeIcon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? 'text-danger' : 'text-success';

    // Determine chart color based on overall trend in current view? 
    // Or just always use a neutral or theme color. 
    // Let's use Red for general line if it's profitable, Green if loss? 
    // Simpler: Use a bright Blue/Purple for the line to stand out against dark bg.
    const chartColor = "#3b82f6"; // Blue-500

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--spacing-4)'
        }} onClick={onClose}>
            <div
                className="card"
                style={{ width: '100%', maxWidth: '800px', height: '90vh', maxHeight: '600px', display: 'flex', flexDirection: 'column', backgroundColor: '#1e1e1e' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex-between" style={{ marginBottom: 'var(--spacing-4)', borderBottom: '1px solid #333', paddingBottom: 'var(--spacing-4)' }}>
                    <div>
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', color: '#fff' }}>{fund.name}</h2>
                        <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '8px', color: '#aaa' }}>
                            <span className="badge" style={{ background: '#333', color: '#ccc' }}>{fund.code}</span>
                            <span>NAV: <strong style={{ color: '#fff' }}>{fund.nav}</strong></span>
                            <span>({fund.navDate})</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn-secondary" style={{ padding: 'var(--spacing-2)', color: '#fff' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)', minHeight: 0 }}>
                    {/* Current Status */}
                    <div className="flex-between" style={{ padding: 'var(--spacing-4)', background: '#252525', borderRadius: 'var(--radius-lg)' }}>
                        <div>
                            <p className="text-secondary" style={{ color: '#888' }}>Real-time Estimate</p>
                            <div className={`flex-center ${colorClass}`} style={{ justifyContent: 'flex-start', gap: '4px' }}>
                                <ChangeIcon size={24} />
                                <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold' }}>
                                    {isPositive ? '+' : ''}{fund.estChange}%
                                </span>
                            </div>
                            <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', color: '#666' }}>{fund.estTime}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p className="text-secondary" style={{ color: '#888' }}>Valuation</p>
                            <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', color: '#fff' }}>{fund.valuation}</p>
                        </div>
                    </div>

                    {/* Chart Controls */}
                    <div className="flex-center" style={{ gap: '8px', background: '#252525', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                        {['7d', '1m', '3m', '6m', '1y', 'all'].map(r => (
                            <button
                                key={r}
                                className={range === r ? 'btn' : 'btn-ghost'}
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    backgroundColor: range === r ? '#3b82f6' : 'transparent',
                                    color: range === r ? '#fff' : '#aaa'
                                }}
                                onClick={() => setRange(r)}
                            >
                                {r.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* Chart Area */}
                    <div style={{ flex: 1, minHeight: '200px', width: '100%' }}>
                        {loading ? (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Loader className="spin" size={32} color="#3b82f6" />
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
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        minTickGap={50}
                                        tick={{ fill: '#888', fontSize: 10 }}
                                        stroke="#333"
                                    />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        tick={{ fill: '#888', fontSize: 10 }}
                                        stroke="#333"
                                        width={40}
                                        tickFormatter={(val) => `${val}%`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                        labelStyle={{ color: '#888', marginBottom: '4px' }}
                                        formatter={(val) => [`${val}%`, 'Return']}
                                    />
                                    {/* Reference line at 0% */}
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
            </div>
        </div>
    );
}
