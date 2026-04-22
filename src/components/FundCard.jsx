import { TrendingUp, TrendingDown, PieChart, Clock } from 'lucide-react';

export function FundCard({ fund, industryLabel, prevChange, analysis, onRemove, onOpenPerspective }) {
    // ── noData 卡片（QDII 等无盘中估值基金）——展示历史数据 ──────
    if (fund.noData) {
        const pdChange = fund.prevDayChange != null ? parseFloat(fund.prevDayChange) : null;
        const pdIsPositive = pdChange != null ? pdChange >= 0 : null;

        return (
            <div className="card" style={{
                padding: 'var(--spacing-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 'var(--spacing-4)',
            }}>
                {/* 1. 基本信息 */}
                <div style={{ flex: 1, minWidth: 0, paddingRight: 'var(--spacing-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <h3 className="truncate" style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                            {fund.name}
                        </h3>
                        <span style={{
                            fontSize: '10px', padding: '1px 5px', borderRadius: '3px',
                            background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
                            border: '1px solid rgba(245,158,11,0.3)', whiteSpace: 'nowrap',
                        }}>
                            历史数据
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>{fund.code}</span>
                        <span style={{
                            fontSize: '10px', padding: '1px 4px', borderRadius: '3px',
                            backgroundColor: (fund.code.startsWith('51') || fund.code.startsWith('15')) ? '#3b82f6' : '#64748b',
                            color: 'white', fontWeight: 600
                        }}>
                            {(fund.code.startsWith('51') || fund.code.startsWith('15')) ? '场内' : '场外'}
                        </span>
                        {industryLabel && (
                            <span style={{
                                fontSize: '10px', padding: '1px 4px', borderRadius: '3px',
                                backgroundColor: '#8b5cf6', color: 'white', fontWeight: 600
                            }}>{industryLabel}</span>
                        )}

                        {/* 分析数据照常展示 */}
                        {analysis && (
                            <>
                                <span style={{
                                    fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                                    backgroundColor: analysis.maxDrawdown < -15 ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.1)',
                                    color: analysis.maxDrawdown < -15 ? '#86efac' : '#cbd5e1',
                                    border: analysis.maxDrawdown < -15 ? '1px solid rgba(74,222,128,0.4)' : '1px solid #475569',
                                    fontWeight: 500
                                }}>
                                    距高点 {analysis.maxDrawdown}%
                                </span>
                                {analysis.rsi !== null && (
                                    <span style={{
                                        fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                                        backgroundColor: analysis.rsi > 70 ? 'rgba(239,68,68,0.2)' : (analysis.rsi < 30 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)'),
                                        color: analysis.rsi > 70 ? '#fca5a5' : (analysis.rsi < 30 ? '#93c5fd' : '#94a3b8'),
                                        border: `1px solid ${analysis.rsi > 70 ? 'rgba(239,68,68,0.4)' : (analysis.rsi < 30 ? 'rgba(59,130,246,0.4)' : '#334155')}`,
                                    }}>
                                        RSI {analysis.rsi} {analysis.rsi > 70 ? '🔥' : (analysis.rsi < 30 ? '❄️' : '')}
                                    </span>
                                )}
                                {analysis.volatility > 2.5 && <span style={{ fontSize: '12px' }}>🌪️</span>}
                            </>
                        )}
                    </div>
                </div>

                {/* 2. 昨日净值 */}
                <div style={{ flex: '0 0 80px', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {fund.nav ? (
                        <>
                            <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{fund.nav}</span>
                            <span className="text-secondary" style={{ fontSize: '10px' }}>{fund.navDate || '昨日净值'}</span>
                        </>
                    ) : (
                        <span className="text-secondary" style={{ fontSize: '12px' }}>--</span>
                    )}
                </div>

                {/* 3. 昨日涨幅（替代实时涨幅列）*/}
                <div style={{
                    flex: '0 0 100px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                    fontWeight: 'bold', fontSize: 'var(--font-size-lg)',
                }}>
                    {pdChange != null ? (
                        <>
                            <span style={{ color: pdIsPositive ? 'var(--color-danger)' : 'var(--color-success)' }}>
                                {pdIsPositive ? '+' : ''}{pdChange.toFixed(2)}%
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#666', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Clock size={9} /> 昨日涨幅
                            </span>
                        </>
                    ) : (
                        <>
                            <span style={{ color: '#475569', fontSize: '14px' }}>--</span>
                            <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#475569' }}>无盘中估值</span>
                        </>
                    )}
                </div>

                {/* 4. 透视按钮 */}
                <button
                    className="btn-secondary"
                    onClick={(e) => { e.stopPropagation(); onOpenPerspective(); }}
                    style={{ padding: 'var(--spacing-2)', flex: '0 0 auto' }}
                    title="Perspective"
                >
                    <PieChart size={18} />
                </button>
            </div>
        );
    }

    // ── 正常卡片 ──────────────────────────────────────────────────
    const isPositive = Number(fund.estChange) >= 0;
    const colorClass = isPositive ? 'text-danger' : 'text-success';

    return (
        <div className="card fund-card-mobile-stack" style={{ padding: 'var(--spacing-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-4)' }}>
            {/* 1. Basic Info */}
            <div style={{ flex: 1, minWidth: 0, paddingRight: 'var(--spacing-2)' }}>
                <h3 className="truncate" style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>{fund.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>{fund.code}</span>
                    <span style={{
                        fontSize: '10px', padding: '1px 4px', borderRadius: '3px',
                        backgroundColor: (fund.code.startsWith('51') || fund.code.startsWith('15')) ? '#3b82f6' : '#64748b',
                        color: 'white', fontWeight: 600
                    }}>
                        {(fund.code.startsWith('51') || fund.code.startsWith('15')) ? '场内' : '场外'}
                    </span>
                    {industryLabel && (
                        <span style={{
                            fontSize: '10px', padding: '1px 4px', borderRadius: '3px',
                            backgroundColor: '#8b5cf6', color: 'white', fontWeight: 600
                        }}>{industryLabel}</span>
                    )}
                    {analysis && (
                        <>
                            <span style={{
                                fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                                backgroundColor: analysis.maxDrawdown < -15 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                color: analysis.maxDrawdown < -15 ? '#86efac' : '#cbd5e1',
                                border: analysis.maxDrawdown < -15 ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid #475569',
                                fontWeight: 500
                            }}>
                                距高点 {analysis.maxDrawdown}%
                            </span>
                            {analysis.rsi !== null && (
                                <span style={{
                                    fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                                    backgroundColor: analysis.rsi > 70 ? 'rgba(239, 68, 68, 0.2)' : (analysis.rsi < 30 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)'),
                                    color: analysis.rsi > 70 ? '#fca5a5' : (analysis.rsi < 30 ? '#93c5fd' : '#94a3b8'),
                                    border: `1px solid ${analysis.rsi > 70 ? 'rgba(239, 68, 68, 0.4)' : (analysis.rsi < 30 ? 'rgba(59, 130, 246, 0.4)' : '#334155')}`,
                                }}>
                                    RSI {analysis.rsi} {analysis.rsi > 70 ? '🔥' : (analysis.rsi < 30 ? '❄️' : '')}
                                </span>
                            )}
                            {analysis.volatility > 2.5 && (
                                <span title="High Volatility" style={{ fontSize: '12px' }}>🌪️</span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 2. Previous Day Change */}
            <div style={{ flex: '0 0 80px', textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {prevChange ? (
                    <>
                        <span className={Number(prevChange.prevChange) >= 0 ? 'text-danger' : 'text-success'} style={{ fontWeight: '600' }}>
                            {Number(prevChange.prevChange) >= 0 ? '+' : ''}{prevChange.prevChange}%
                        </span>
                        <span className="text-secondary" style={{ fontSize: '10px' }}>Previous Day</span>
                    </>
                ) : (
                    <span className="text-secondary" style={{ fontSize: '12px' }}>--</span>
                )}
            </div>

            {/* 3. Realtime Change % */}
            <div className={`flex-center ${colorClass}`} style={{ flex: '0 0 100px', justifyContent: 'flex-end', fontWeight: 'bold', fontSize: 'var(--font-size-lg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span>{isPositive ? '+' : ''}{fund.estChange}%</span>
                    <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#666' }}>Real-time</span>
                </div>
            </div>

            {/* 4. Perspective Button */}
            <button
                className="btn-secondary"
                onClick={(e) => { e.stopPropagation(); onOpenPerspective(); }}
                style={{ padding: 'var(--spacing-2)', flex: '0 0 auto' }}
                title="Perspective"
            >
                <PieChart size={18} />
            </button>
        </div>
    );
}
