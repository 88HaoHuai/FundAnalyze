import { TrendingUp, TrendingDown, PieChart, Clock } from 'lucide-react';

export function FundCard({ fund, industryLabel, prevChange, analysis, onRemove, onOpenPerspective }) {
    // ── noData 卡片（QDII 等无盘中估值基金）——展示历史数据 ──────
    if (fund.noData) {
        const pdChange = fund.prevDayChange != null ? parseFloat(fund.prevDayChange) : null;
        const pdIsPositive = pdChange != null ? pdChange >= 0 : null;

        return (
            <div className="card" style={{ padding: 'var(--spacing-3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 顶部：标题 + 徽章区 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3 style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {fund.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>{fund.code}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#475569', color: 'white' }}>
                            历史数据
                        </span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: (fund.code.startsWith('51') || fund.code.startsWith('15')) ? '#3b82f6' : '#2563eb', color: 'white' }}>
                            {(fund.code.startsWith('51') || fund.code.startsWith('15')) ? '场内' : '场外'}
                        </span>
                        {industryLabel && (
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#8b5cf6', color: 'white' }}>
                                {industryLabel}
                            </span>
                        )}
                        {analysis && (
                            <>
                                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid #334155' }}>
                                    距高点 {analysis.maxDrawdown}%
                                </span>
                                {analysis.rsi !== null && (
                                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        RSI {analysis.rsi} {analysis.rsi > 70 ? '🔥' : (analysis.rsi < 30 ? '❄️' : '')}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* 底部：数据网格 */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        {pdChange != null ? (
                            <>
                                <span className={pdIsPositive ? 'text-danger' : 'text-success'} style={{ fontWeight: '600', fontSize: '15px' }}>
                                    {pdIsPositive ? '+' : ''}{pdChange.toFixed(2)}%
                                </span>
                                <span className="text-secondary" style={{ fontSize: '10px' }}>Previous Day</span>
                            </>
                        ) : (
                            <span className="text-secondary" style={{ fontSize: '12px' }}>--</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        {fund.nav ? (
                            <>
                                <span style={{ fontWeight: '600', color: '#e2e8f0', fontSize: '15px' }}>{fund.nav}</span>
                                <span className="text-secondary" style={{ fontSize: '10px' }}>{fund.navDate || '净值'}</span>
                            </>
                        ) : (
                            <span className="text-secondary" style={{ fontSize: '12px' }}>--</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); onOpenPerspective(); }} style={{ padding: '4px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: 'rgba(255,255,255,0.05)' }} title="Perspective">
                            <PieChart size={14} /> 透视
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── 正常卡片 ──────────────────────────────────────────────────
    const isPositive = Number(fund.estChange) >= 0;
    const colorClass = isPositive ? 'text-danger' : 'text-success';

    return (
        <div className="card" style={{ padding: 'var(--spacing-3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 顶部：标题 + 徽章区 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {fund.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>{fund.code}</span>
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: (fund.code.startsWith('51') || fund.code.startsWith('15')) ? '#3b82f6' : '#2563eb', color: 'white' }}>
                        {(fund.code.startsWith('51') || fund.code.startsWith('15')) ? '场内' : '场外'}
                    </span>
                    {industryLabel && (
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#8b5cf6', color: 'white' }}>
                            {industryLabel}
                        </span>
                    )}
                    {analysis && (
                        <>
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid #334155' }}>
                                距高点 {analysis.maxDrawdown}%
                            </span>
                            {analysis.rsi !== null && (
                                <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    RSI {analysis.rsi} {analysis.rsi > 70 ? '🔥' : (analysis.rsi < 30 ? '❄️' : '')}
                                </span>
                            )}
                            {analysis.volatility > 2.5 && <span style={{ fontSize: '12px' }}>🌪️</span>}
                        </>
                    )}
                </div>
            </div>

            {/* 底部：数据网格 */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    {prevChange ? (
                        <>
                            <span className={Number(prevChange.prevChange) >= 0 ? 'text-danger' : 'text-success'} style={{ fontWeight: '600', fontSize: '15px' }}>
                                {Number(prevChange.prevChange) >= 0 ? '+' : ''}{prevChange.prevChange}%
                            </span>
                            <span className="text-secondary" style={{ fontSize: '10px' }}>Previous Day</span>
                        </>
                    ) : (
                        <span className="text-secondary" style={{ fontSize: '12px' }}>--</span>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span className={colorClass} style={{ fontWeight: '600', fontSize: '15px' }}>
                        {isPositive ? '+' : ''}{fund.estChange}%
                    </span>
                    <span className="text-secondary" style={{ fontSize: '10px' }}>Real-time Return</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); onOpenPerspective(); }} style={{ padding: '4px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', border: 'none', backgroundColor: 'rgba(255,255,255,0.05)' }} title="Perspective">
                        <PieChart size={14} /> 透视
                    </button>
                </div>
            </div>
        </div>
    );
}
