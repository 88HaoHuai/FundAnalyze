import { useState, useEffect } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';
import { fundApi } from '../services/fundApi';
import { Loader, Info } from 'lucide-react';

export function MarketCompass({ funds, shortNames = {} }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!funds || funds.length === 0) return;
            setLoading(true);
            try {
                // 1. Fetch Compass Data (Trend, Position)
                const compassData = await fundApi.getMarketCompassData(funds);

                // 2. enrich with names, only keep those present in shortNames
                const validItems = compassData.filter(item => shortNames[item.code]);
                const enrichedData = validItems.map((item) => ({
                    ...item,
                    name: shortNames[item.code]
                }));

                setData(enrichedData);
            } catch (e) {
                console.error("Failed to load compass data", e);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [funds, shortNames]);

    if (loading) {
        return (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                <Loader className="spin" size={32} />
                <span style={{ marginLeft: '10px' }}>分析市场风向中...</span>
            </div>
        );
    }

    // Quadrant Colors
    const COLORS = {
        q1: '#ef4444', // High Trend, High Pos (Risk/Top?) -> or Momentum? Let's say "High Heat"
        q2: '#f59e0b', // Low Trend, High Pos (Correction?)
        q3: '#64748b', // Low Trend, Low Pos (Weak/Value Trap)
        q4: '#22c55e'  // High Trend, Low Pos (Reversal/Gold Pit) -> Best Buy
    };

    // Determine Quadrant for color
    const getColor = (trend, pos) => {
        if (trend > 0 && pos < 50) return COLORS.q4; // Reversal
        if (trend > 0 && pos >= 50) return COLORS.q1; // Momentum
        if (trend <= 0 && pos >= 50) return COLORS.q2; // Correction
        return COLORS.q3; // Weak
    };

    return (
        <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
            <div className="flex-between" style={{ marginBottom: '20px' }}>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🧭 市场风向标 (Market Compass)
                </h2>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.q4 }}></span>
                        黄金坑 (关注)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.q1 }}></span>
                        高景气 (追涨)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.q3 }}></span>
                        弱势 (观望)
                    </span>
                </div>
            </div>

            <div style={{ height: '400px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                            type="number"
                            dataKey="trend"
                            name="趋势强度"
                            unit="%"
                            stroke="#94a3b8"
                            label={{ value: '短期趋势 (20日涨跌)', position: 'bottom', fill: '#94a3b8', fontSize: 12 }}
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                        />
                        <YAxis
                            type="number"
                            dataKey="position"
                            name="估值水位"
                            unit="%"
                            stroke="#94a3b8"
                            domain={[0, 100]}
                            label={{ value: '相对位置 (年内)', angle: -90, position: 'left', fill: '#94a3b8', fontSize: 12 }}
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                        />
                        {/* Quadrant Lines */}
                        <ReferenceLine x={0} stroke="#475569" strokeDasharray="3 3" />
                        <ReferenceLine y={50} stroke="#475569" strokeDasharray="3 3" />

                        {/* Quadrant Labels */}
                        <ReferenceLine y={90} label={{ value: '顶部风险', position: 'insideTopLeft', fill: COLORS.q2, fontSize: 12 }} stroke="none" />
                        <ReferenceLine y={90} x={15} label={{ value: '高景气区', position: 'insideTopRight', fill: COLORS.q1, fontSize: 12 }} stroke="none" />
                        <ReferenceLine y={10} label={{ value: '弱势整理', position: 'insideBottomLeft', fill: COLORS.q3, fontSize: 12 }} stroke="none" />
                        <ReferenceLine y={10} x={15} label={{ value: '底部反转', position: 'insideBottomRight', fill: COLORS.q4, fontSize: 12, fontWeight: 'bold' }} stroke="none" />

                        <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                            formatter={(value, name, props) => {
                                if (name === '趋势强度') return [`${value}%`, name];
                                if (name === '估值水位') return [`${value}%`, name];
                                return [value, name];
                            }}
                            labelFormatter={() => ''}
                        />
                        <Scatter name="Sectors" data={data} fill="#8884d8">
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getColor(entry.trend, entry.position)} />
                            ))}
                            {/* Use Custom Label List */}
                            <LabelList dataKey="name" content={<CustomLabel />} />
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            <div style={{ marginTop: '16px', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
                    <Info size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <div>
                        <strong>策略说明：</strong>
                        <ul style={{ margin: '4px 0 0 20px', listStyleType: 'disc' }}>
                            <li><span style={{ color: COLORS.q4 }}>底部反转区</span>：价格低但趋势向上，是<strong>最佳买点</strong>。</li>
                            <li><span style={{ color: COLORS.q1 }}>高景气区</span>：趋势强但价格高，适合<strong>右侧定投</strong>。</li>
                            <li><span style={{ color: COLORS.q3 }}>弱势整理区</span>：价格低且趋势向下，可能是<strong>价值陷阱</strong>，建议观望。</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Custom Label Component for Scatter
const CustomLabel = (props) => {
    const { x, y, value } = props;
    return (
        <text
            x={x}
            y={y - 12}
            fill="#fff"
            textAnchor="middle"
            fontSize="12px"
            fontWeight="bold"
            style={{
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))'
            }}
        >
            {value}
        </text>
    );
};

// Recharts LabelList expects data or dataKey. 
// If we use 'content' prop, we don't strictly need Recharts' LabelList mapping, 
// but it's easier to use <LabelList dataKey="name" content={<CustomLabel />} />
import { LabelList } from 'recharts';
