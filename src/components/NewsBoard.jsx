import { useState, useEffect } from 'react';
import { fundApi } from '../services/fundApi';
import { Loader, Search, RefreshCw, Clock, AlertCircle } from 'lucide-react';

export function NewsBoard() {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(false);
    const [keyword, setKeyword] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [error, setError] = useState(null);

    const loadNews = async (searchKw = '') => {
        setLoading(true);
        setError(null);
        try {
            const data = await fundApi.fetchNews(searchKw);
            setNews(data);
        } catch (e) {
            setError('获取快讯失败，请检查 Python 及 AkShare 依赖是否安装正常。');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNews();
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        setKeyword(searchInput);
        loadNews(searchInput);
    };

    return (
        <div className="card" style={{ padding: '24px', minHeight: '600px' }}>
            <div className="flex-between" style={{ marginBottom: '24px' }}>
                <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📰 实时快讯 (全球视角)
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
                        <span style={{ marginLeft: '10px' }}>正在从东方财富获取最新快讯...</span>
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
                            <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                {item.content}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
