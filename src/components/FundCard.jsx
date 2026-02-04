import { TrendingUp, TrendingDown, PieChart } from 'lucide-react';

export function FundCard({ fund, prevChange, onRemove, onOpenPerspective }) {
    const isPositive = Number(fund.estChange) >= 0;
    const ChangeIcon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? 'text-danger' : 'text-success'; // Red Up, Green Down

    return (
        <div className="card" style={{ padding: 'var(--spacing-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-4)' }}>
            {/* 1. Name and Code - Left aligned */}
            <div style={{ flex: '1 1 auto', minWidth: '0' }}> {/* minWidth 0 for text truncate */}
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fund.name}</h3>
                <span className="text-secondary" style={{ fontSize: 'var(--font-size-sm)' }}>{fund.code}</span>
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
