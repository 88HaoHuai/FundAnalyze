import { useState, useEffect } from 'react';
import { X, Wallet, History, Loader } from 'lucide-react';
import { fetchAutoInvestLogs } from '../services/supabaseHelpers';

export function PositionModal({ fund, position, onSave, onClose }) {
    const [amount, setAmount] = useState(position?.amount || '');
    const [isAutoInvest, setIsAutoInvest] = useState(position?.isAutoInvest || false);
    const [autoInvestAmount, setAutoInvestAmount] = useState(position?.autoInvestAmount || '');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    
    // 日志状态
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        const loadLogs = async () => {
            setLogsLoading(true);
            try {
                const data = await fetchAutoInvestLogs(fund.code);
                if (mounted) setLogs(data || []);
            } catch (err) {
                console.error("加载定投日志失败", err);
            } finally {
                if (mounted) setLogsLoading(false);
            }
        };
        loadLogs();
        return () => { mounted = false; };
    }, [fund.code]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);
        try {
            await onSave(fund, parseFloat(amount || 0), isAutoInvest, parseFloat(autoInvestAmount || 0));
        } catch (error) {
            console.error(error);
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
        }} onClick={onClose}>
            <div
                className="card"
                style={{ width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#1e293b', border: '1px solid #334155', padding: '24px', borderRadius: '12px' }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex-between" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Wallet color="#3b82f6" />
                        <h3 style={{ margin: 0, color: '#f8fafc' }}>设置持仓</h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: '20px', color: '#94a3b8', fontSize: '14px' }}>
                    正在为 <strong style={{ color: '#f8fafc' }}>{fund.name}</strong> ({fund.code}) 设置持仓信息。
                </div>

                {errorMsg && (
                    <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', borderRadius: '8px', fontSize: '13px', marginBottom: '20px' }}>
                        保存失败：{errorMsg}
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                            (提示：若涉及字段不存在，请确认是否已在 Supabase 数据库中执行过建字段的 SQL)
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>持有总金额 (元)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="输入持仓本金..."
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px',
                                backgroundColor: '#0f172a', border: '1px solid #334155',
                                color: '#f8fafc', fontSize: '14px', outline: 'none'
                            }}
                        />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={isAutoInvest}
                            onChange={e => setIsAutoInvest(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                        />
                        <span style={{ fontSize: '14px', color: '#cbd5e1' }}>该基金正在执行定投计划</span>
                    </label>

                    {isAutoInvest && (
                        <div style={{ marginTop: '-10px' }}>
                            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '8px' }}>每期定投金额 (元)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={autoInvestAmount}
                                onChange={e => setAutoInvestAmount(e.target.value)}
                                placeholder="输入每期定投金额..."
                                style={{
                                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                                    backgroundColor: '#0f172a', border: '1px solid #334155',
                                    color: '#f8fafc', fontSize: '14px', outline: 'none'
                                }}
                            />
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '12px', borderRadius: '8px',
                            backgroundColor: loading ? '#475569' : '#3b82f6',
                            color: 'white', border: 'none', fontWeight: 'bold',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            marginTop: '10px'
                        }}
                    >
                        {loading ? '保存中...' : '保存持仓'}
                    </button>
                </form>

                {/* 定投日志明细区域 */}
                <div style={{ marginTop: '30px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#cbd5e1' }}>
                        <History size={16} />
                        <h4 style={{ margin: 0, fontSize: '14px' }}>持仓更新记录</h4>
                    </div>

                    {logsLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px', color: '#94a3b8' }}>
                            <Loader className="spin" size={20} />
                        </div>
                    ) : logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '13px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                            暂无更新记录
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {logs.map(log => {
                                const oldAmt = log.old_amount;
                                const profit = parseFloat(log.amount_added);
                                const invest = log.invest_amount ? parseFloat(log.invest_amount) : 0;
                                const totalAmt = log.total_amount;
                                const profitColor = profit >= 0 ? '#22c55e' : '#ef4444';

                                // 新格式：原金额 + (收益) + 定投 = 更新后金额
                                const hasDetail = oldAmt != null && oldAmt !== 0;

                                return (
                                    <div key={log.id} style={{ 
                                        backgroundColor: '#0f172a', 
                                        border: '1px solid #334155', 
                                        padding: '12px', 
                                        borderRadius: '8px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        {hasDetail ? (
                                            <>
                                                <div className="flex-between">
                                                    <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
                                                        <span style={{ color: '#f8fafc' }}>{oldAmt}</span>
                                                        <span style={{ color: '#64748b' }}> + </span>
                                                        <span style={{ color: profitColor, fontWeight: '600' }}>({profit >= 0 ? '+' : ''}{profit})</span>
                                                        {invest > 0 && (
                                                            <>
                                                                <span style={{ color: '#64748b' }}> + </span>
                                                                <span style={{ color: '#f59e0b', fontWeight: '600' }}>定投{invest}</span>
                                                            </>
                                                        )}
                                                        <span style={{ color: '#64748b' }}> = </span>
                                                        <strong style={{ color: '#f8fafc' }}>{totalAmt}</strong>
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', marginLeft: '8px' }}>{log.date}</span>
                                                </div>
                                            </>
                                        ) : (
                                            /* 兼容旧格式日志 */
                                            <>
                                                <div className="flex-between">
                                                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>{log.date}</span>
                                                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: profitColor }}>
                                                        {profit >= 0 ? '+' : ''}{profit} 元
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                                                    更新后总额: <strong style={{ color: '#f8fafc' }}>{totalAmt}</strong>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
