import { TrendingUp, TrendingDown, PieChart, Clock } from 'lucide-react';

export function FundCard({ fund, industryLabel, prevChange, analysis, position, onRemove, onOpenPerspective, onAskAI, onSetPosition }) {
    // 解析持仓数据
    const amount = position?.amount || 0;
    const isAutoInvest = position?.isAutoInvest || false;

    // ── noData 卡片（QDII 等无盘中估值基金）——展示历史数据 ──────
    if (fund.noData) {
        const pdChange = fund.prevDayChange != null ? parseFloat(fund.prevDayChange) : null;
        const pdIsPositive = pdChange != null ? pdChange >= 0 : null;
        const profit = amount && pdChange != null ? (amount * pdChange / 100).toFixed(2) : '--';

        return (
            <div className="card" style={{ padding: 'var(--spacing-3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 顶部：标题 + 徽章区 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="flex-between">
                    <h3 style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {fund.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {onOpenPerspective && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onOpenPerspective(); }} 
                                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                            >
                                透视
                            </button>
                        )}
                    </div>
                </div>
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
                        {isAutoInvest && (
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f59e0b', color: 'white' }}>
                                定投
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
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '12px 8px', borderRadius: '8px'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        {pdChange != null ? (
                            <>
                                <span className={pdIsPositive ? 'text-danger' : 'text-success'} style={{ fontWeight: '600', fontSize: '14px' }}>
                                    {pdIsPositive ? '+' : ''}{pdChange.toFixed(2)}%
                                </span>
                                <span className="text-secondary" style={{ fontSize: '9px', textAlign: 'center' }}>Previous Day</span>
                            </>
                        ) : (
                            <span className="text-secondary" style={{ fontSize: '12px' }}>--</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        {fund.nav ? (
                            <>
                                <span style={{ fontWeight: '600', color: '#e2e8f0', fontSize: '14px' }}>{fund.nav}</span>
                                <span className="text-secondary" style={{ fontSize: '9px', textAlign: 'center' }}>{fund.navDate || '净值'}</span>
                            </>
                        ) : (
                            <span className="text-secondary" style={{ fontSize: '12px' }}>--</span>
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); if(onAskAI) onAskAI(fund, position); }}>
                        <span className="text-success" style={{ fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>✨ 诊断</span>
                        <span className="text-secondary" style={{ fontSize: '9px', textAlign: 'center' }}>Confidence</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); if(onSetPosition) onSetPosition(fund, position); }}>
                        <span className={pdIsPositive ? 'text-danger' : 'text-success'} style={{ fontWeight: '600', fontSize: '14px' }}>
                            {profit !== '--' ? `${pdIsPositive ? '+' : ''}${profit}` : '--'}
                        </span>
                        <span className="text-secondary" style={{ fontSize: '9px', textAlign: 'center' }}>Yesterday Profit</span>
                    </div>
                </div>
            </div>
        );
    }

    // ── 正常卡片 ──────────────────────────────────────────────────
    const isPositive = Number(fund.estChange) >= 0;
    const colorClass = isPositive ? 'text-danger' : 'text-success';
    const liveProfit = amount && fund.estChange ? (amount * parseFloat(fund.estChange) / 100).toFixed(2) : '--';

    return (
        <div className="card" style={{ padding: 'var(--spacing-3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 顶部：标题 + 徽章区 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="flex-between">
                    <h3 style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {fund.name}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {onOpenPerspective && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onOpenPerspective(); }} 
                                style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                            >
                                透视
                            </button>
                        )}
                    </div>
                </div>
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
                    {isAutoInvest && (
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f59e0b', color: 'white' }}>
                            定投
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
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '12px 8px', borderRadius: '8px'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    {prevChange ? (
                        <>
                            <span className={Number(prevChange.prevChange) >= 0 ? 'text-danger' : 'text-success'} style={{ fontWeight: '600', fontSize: '14px' }}>
                                {Number(prevChange.prevChange) >= 0 ? '+' : ''}{prevChange.prevChange}%
                            </span>
                            <span className="text-secondary" style={{ fontSize: '9px', textAlign: 'center' }}>Previous Day</span>
                        </>
                    ) : (
                        <span className="text-secondary" style={{ fontSize: '12px' }}>--</span>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span className={colorClass} style={{ fontWeight: '600', fontSize: '14px' }}>
                        {isPositive ? '+' : ''}{fund.estChange}%
                    </span>
                    <span className="text-secondary" style={{ fontSize: '9px', textAlign: 'center' }}>Real-time Return</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); if(onAskAI) onAskAI(fund, position); }}>
                    <span className="text-success" style={{ fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}>✨ 诊断</span>
                    <span className="text-secondary" style={{ fontSize: '9px', textAlign: 'center' }}>Confidence</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); if(onSetPosition) onSetPosition(fund, position); }}>
                    <span className={colorClass} style={{ fontWeight: '600', fontSize: '14px' }}>
                        {liveProfit !== '--' ? `${isPositive ? '+' : ''}${liveProfit}` : '--'}
                    </span>
                    <span className="text-secondary" style={{ fontSize: '9px', textAlign: 'center' }}>Live Profit</span>
                </div>
            </div>
        </div>
    );
}
