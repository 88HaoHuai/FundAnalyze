import { useState, useEffect } from 'react';
import { fundApi } from '../services/fundApi';
import { Loader, Search, RefreshCw, Clock, AlertCircle, Sparkles, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import fundsConfig from '../config/funds.json';

export function NewsBoard({ source = 'em' }) {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [keyword, setKeyword] = useState('A股');
    const [searchInput, setSearchInput] = useState('');
    const [error, setError] = useState(null);
    const [aiStatus, setAiStatus] = useState({}); // { [idx]: { loading: boolean, data: null | {sentiment, score, summary, impact} } }

    // Parse market fund names for quick chips
    const marketFunds = fundsConfig.find(item => item.isMarket === true);
    const quickSectors = marketFunds && marketFunds.shortNames ? Object.values(marketFunds.shortNames).filter(n => n !== '沪深300' && n !== '上证50' && n !== '恒生指数' && n !== '红利低波') : [];

    const loadNews = async (searchKw = 'A股') => {
        setLoading(true);
        setError(null);
        try {
            const data = source === 'cls'
                ? await fundApi.getClsNews(searchKw)
                : await fundApi.getNews(searchKw);
            setNews(data);
            setAiStatus({}); // reset AI status on new fetch
        } catch (e) {
            setError(source === 'cls' ? '获取财联社电报失败，请检查网络。' : '获取东方财富快讯失败，请检查网络。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNews();
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        const kw = searchInput || 'A股';
        setKeyword(kw);
        loadNews(kw);
    };

    const handleChipClick = (sector) => {
        setSearchInput(sector);
        setKeyword(sector);
        loadNews(sector);
    };

    const handleAITrigger = async (idx, item) => {
        // Init state for this idx
        setAiStatus(prev => ({ ...prev, [idx]: { loading: true, data: null } }));

        try {
            const aiData = await fundApi.fetchAI(item.title, item.content);
            if (aiData) {
                setAiStatus(prev => ({ ...prev, [idx]: { loading: false, data: aiData } }));
            } else {
                setAiStatus(prev => ({ ...prev, [idx]: { loading: false, data: { error: '分析失败，模型无响应。' } } }));
            }
        } catch (e) {
            setAiStatus(prev => ({ ...prev, [idx]: { loading: false, data: { error: '网络出错了，请稍后再试。' } } }));
        }
    };

    const getSentimentColor = (sentiment) => {
        if (sentiment === '利好') return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', icon: <TrendingUp size={16} /> }; // Red for A-share positive
        if (sentiment === '利空') return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', icon: <TrendingDown size={16} /> }; // Green for A-share negative
        return { bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', icon: <Minus size={16} /> }; // Gray neutral
    };

    return (
        <div className="card" style={{ padding: '24px', minHeight: '600px' }}>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {source === 'cls' ? '🗞️ 财联社电报 (滚动直播)' : '📰 实时快讯 (全球视角)'}
                </h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                            <input
                                type="text"
                                placeholder="输入关键词 (如: 降息, 半导体)..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                style={{
                                    background: '#1e293b',
                                    border: '1px solid #334155',
                                    padding: '8px 12px 8px 32px',
                                    borderRadius: '6px',
                                    color: '#f8fafc',
                                    fontSize: '14px',
                                    width: '240px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        <button type="submit" className="btn btn-secondary" disabled={loading}>
                            搜索
                        </button>
                    </form>
                    <button
                        className="btn btn-secondary"
                        onClick={() => loadNews(keyword)}
                        disabled={loading}
                        title="刷新列表"
                    >
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Quick Keyword Chips */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <button
                    onClick={() => handleChipClick('A股')}
                    style={{
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: '1px solid',
                        borderColor: keyword === 'A股' ? '#4f46e5' : '#334155',
                        background: keyword === 'A股' ? 'rgba(79, 70, 229, 0.2)' : '#1e293b',
                        color: keyword === 'A股' ? '#c7d2fe' : '#94a3b8',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontWeight: keyword === 'A股' ? 'bold' : 'normal'
                    }}
                >
                    大盘纵览
                </button>
                {quickSectors.map((sector, sIdx) => (
                    <button
                        key={sIdx}
                        onClick={() => handleChipClick(sector)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: '1px solid',
                            borderColor: keyword === sector ? '#4f46e5' : '#334155',
                            background: keyword === sector ? 'rgba(79, 70, 229, 0.2)' : '#1e293b',
                            color: keyword === sector ? '#c7d2fe' : '#94a3b8',
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontWeight: keyword === sector ? 'bold' : 'normal'
                        }}
                    >
                        {sector}
                    </button>
                ))}
            </div>

            {error && (
                <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {loading && news.length === 0 ? (
                    <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <Loader className="spin" size={32} />
                        <span style={{ marginLeft: '10px' }}>
                            {source === 'cls' ? '正在截获财联社最新电报...' : '正在从东方财富获取最新快讯...'}
                        </span>
                    </div>
                ) : news.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                        未找到相关快讯内容。
                    </div>
                ) : (
                    news.map((item, idx) => (
                        <div key={idx} style={{
                            padding: '16px',
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            transition: 'all 0.2s ease',
                            cursor: 'default'
                        }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#4f46e5'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                                <Clock size={14} />
                                {item.time}
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '8px', lineHeight: '1.4' }}>
                                {item.title || "无标题"}
                            </h3>
                            <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>
                                {item.content}
                            </p>

                            {/* AI Trigger Container */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #334155', paddingTop: '12px', marginTop: '12px' }}>
                                <button
                                    className="btn btn-secondary"
                                    style={{
                                        borderRadius: '20px',
                                        padding: '6px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '13px',
                                        borderColor: aiStatus[idx]?.data ? '#4f46e5' : '#334155',
                                        color: aiStatus[idx]?.data ? '#818cf8' : '#e2e8f0',
                                        background: aiStatus[idx]?.data ? 'rgba(79, 70, 229, 0.1)' : 'transparent'
                                    }}
                                    onClick={() => handleAITrigger(idx, item)}
                                    disabled={aiStatus[idx]?.loading}
                                >
                                    {aiStatus[idx]?.loading ? (
                                        <><Loader size={14} className="spin" /> 正在连线 Kimi 分析...</>
                                    ) : (
                                        <><Sparkles size={14} /> {aiStatus[idx]?.data ? '重新解读' : 'AI 深度解读'}</>
                                    )}
                                </button>
                            </div>

                            {/* AI Result Card */}
                            {aiStatus[idx]?.data && !aiStatus[idx]?.data.error && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '16px',
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    borderRadius: '8px',
                                    border: '1px solid #334155'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                        {/* Sentiment Badge */}
                                        <div style={{
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            background: getSentimentColor(aiStatus[idx].data.sentiment).bg,
                                            color: getSentimentColor(aiStatus[idx].data.sentiment).color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontWeight: 'bold',
                                            fontSize: '13px'
                                        }}>
                                            {getSentimentColor(aiStatus[idx].data.sentiment).icon}
                                            {aiStatus[idx].data.sentiment} ({aiStatus[idx].data.score}分)
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>⚡ 核心摘要</div>
                                        <div style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: '1.5' }}>{aiStatus[idx].data.summary}</div>
                                    </div>

                                    {aiStatus[idx].data.impact && aiStatus[idx].data.impact.length > 0 && (
                                        <div>
                                            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Target size={12} /> 触及您的关注 / 持仓
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {aiStatus[idx].data.impact.map((sector, i) => (
                                                    <span key={i} style={{
                                                        background: '#1e293b',
                                                        border: '1px solid #475569',
                                                        color: '#cbd5e1',
                                                        fontSize: '12px',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px'
                                                    }}>{sector}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* AI Error Fallback */}
                            {aiStatus[idx]?.data?.error && (
                                <div style={{ marginTop: '12px', color: '#ef4444', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertCircle size={14} /> {aiStatus[idx].data.error}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
