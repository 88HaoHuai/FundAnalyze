import { TrendingUp, TrendingDown, PieChart } from 'lucide-react';

export function FundCard({ fund, prevChange, analysis, onRemove, onOpenPerspective }) {
    const isPositive = Number(fund.estChange) >= 0;
    const ChangeIcon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? 'text-danger' : 'text-success'; // Red Up, Green Down

    return (
        <div className="card" style={{ padding: 'var(--spacing-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-4)' }}>
            {/* 1. Basic Info */}
            <div style={{ flex: 1, minWidth: 0, paddingRight: 'var(--spacing-2)' }}>
                <h3 className="truncate" style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>{fund.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Fund Code & Type */}
                    <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>{fund.code}</span>
                    <span style={{
                        fontSize: '10px',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        backgroundColor: (fund.code.startsWith('51') || fund.code.startsWith('15')) ? '#3b82f6' : '#64748b',
                        color: 'white',
                        fontWeight: 600
                    }}>
                        {(fund.code.startsWith('51') || fund.code.startsWith('15')) ? '场内' : '场外'}
                    </span>

                    {/* Drawdown */}
                    {analysis && (
                        <>
                            <span style={{
                                fontSize: '11px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: analysis.maxDrawdown < -15 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                color: analysis.maxDrawdown < -15 ? '#86efac' : '#cbd5e1',
                                border: analysis.maxDrawdown < -15 ? '1px solid rgba(74, 222, 128, 0.4)' : '1px solid #475569',
                                fontWeight: 500
                            }}>
                                距高点 {analysis.maxDrawdown}%
                            </span>

                            {/* RSI & Sentiment */}
                            {analysis.rsi !== null && (
                                <span style={{
                                    fontSize: '11px',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    // RSI > 70 (Hot/Risk) -> Red/Orange
                                    // RSI < 30 (Cold/Opp) -> Blue/Cyan
                                    backgroundColor: analysis.rsi > 70 ? 'rgba(239, 68, 68, 0.2)' : (analysis.rsi < 30 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)'),
                                    color: analysis.rsi > 70 ? '#fca5a5' : (analysis.rsi < 30 ? '#93c5fd' : '#94a3b8'),
                                    border: `1px solid ${analysis.rsi > 70 ? 'rgba(239, 68, 68, 0.4)' : (analysis.rsi < 30 ? 'rgba(59, 130, 246, 0.4)' : '#334155')}`,
                                }}>
                                    RSI {analysis.rsi} {analysis.rsi > 70 ? '🔥' : (analysis.rsi < 30 ? '❄️' : '')}
                                </span>
                            )}

                            {/* Volatility Alert logic? Only show if High Volatility? */}
                            {/* Let's show it if it's notably high, e.g. > 2.0% daily roughly implies heavy movement */}
                            {analysis.volatility > 2.5 && (
                                <span title="High Volatility" style={{ fontSize: '12px' }}>🌪️</span>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 2. Previous Day Change - Middle/Right */}
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

            {/* 3. Change % - Prominent */}
            <div className={`flex-center ${colorClass}`} style={{ flex: '0 0 100px', justifyContent: 'flex-end', fontWeight: 'bold', fontSize: 'var(--font-size-lg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span>{isPositive ? '+' : ''}{fund.estChange}%</span>
                    <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#666' }}>Real-time</span>
                </div>
            </div>

            {/* 4. Perspective Button - Icon only on mobile maybe? Text on desktop. */}
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
