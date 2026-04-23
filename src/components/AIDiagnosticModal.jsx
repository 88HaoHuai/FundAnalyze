import { X, Loader, BrainCircuit } from 'lucide-react';

export function AIDiagnosticModal({ diagnostic, onClose }) {
    if (!diagnostic) return null;

    const { loading, fund, result, error } = diagnostic;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
        }} onClick={onClose}>
            <div
                className="card"
                style={{ width: '100%', maxWidth: '400px', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '20px', borderRadius: '12px' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex-between" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <BrainCircuit color="#3b82f6" />
                        <h3 style={{ margin: 0, color: '#f8fafc' }}>AI 智能诊断</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: '16px', color: '#cbd5e1', fontSize: '14px' }}>
                    诊断标的：<strong style={{ color: '#f8fafc' }}>{fund.name}</strong>
                </div>

                {loading ? (
                    <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
                        <Loader className="spin" size={32} color="#3b82f6" />
                        <span style={{ fontSize: '13px' }}>深度分析中，请稍候...</span>
                    </div>
                ) : error ? (
                    <div style={{ padding: '20px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderRadius: '8px', fontSize: '14px' }}>
                        诊断失败：{error}
                    </div>
                ) : result ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>建议操作</div>
                                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#60a5fa' }}>{result.action}</div>
                            </div>
                            <div style={{ flex: 1, backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>信心指数</div>
                                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fbbf24' }}>{result.confidence} / 100</div>
                            </div>
                        </div>
                        <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>深度逻辑分析</div>
                            <div style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6' }}>
                                {result.reasoning}
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
