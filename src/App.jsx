import { useState, useEffect } from 'react'
import { FundSearch } from './components/FundSearch';
import { FundCard } from './components/FundCard';
import { FundPerspective } from './components/FundPerspective';
import { FundManager } from './components/FundManager';
import { MarketCompass } from './components/MarketCompass';
import { NewsBoard } from './components/NewsBoard';
import { fundApi } from './services/fundApi';
import { supabase } from './services/supabaseClient';
import { fetchGroups, fetchMarketFunds, addFundToGroup, removeFundFromGroup } from './services/supabaseHelpers';
import { AuthPage } from './pages/AuthPage';
import { LogOut, Settings } from 'lucide-react';

function App() {
  // Auth 状态
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 数据状态
  const [funds, setFunds] = useState([]);
  const [groups, setGroups] = useState([]);
  const [marketFundsData, setMarketFundsData] = useState({ codes: [], shortNames: {} });
  const [activeTab, setActiveTab] = useState(null);

  const [selectedFund, setSelectedFund] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const [prevChanges, setPrevChanges] = useState({});
  const [analysisData, setAnalysisData] = useState({});

  // ─── 监听 Supabase Auth 状态 ──────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ─── 加载数据（登录后触发）──────────────────────────────
  const loadAllData = async () => {
    try {
      // 并发请求两个独立数据源
      const [loadedGroups, loadedMarket] = await Promise.all([
        fetchGroups(),
        fetchMarketFunds(),
      ]);

      // 把市场风向标数据注入到市场分组里，组成前端兼容结构
      const enrichedGroups = loadedGroups.map(g => {
        if (g.isMarket) {
          return {
            ...g,
            codes: loadedMarket.codes,
            shortNames: loadedMarket.shortNames,
          };
        }
        return g;
      });

      setGroups(enrichedGroups);
      setMarketFundsData(loadedMarket);

      // 初始化 activeTab 为第一个分组
      if (enrichedGroups.length > 0 && !activeTab) {
        setActiveTab(enrichedGroups[0].name);
      }

      // 批量拉取所有基金实时数据
      const allCodes = [
        ...loadedGroups.filter(g => !g.isMarket).flatMap(g => g.codes),
        ...loadedMarket.codes,
      ];
      const uniqueCodes = [...new Set(allCodes)];
      if (uniqueCodes.length > 0) {
        const fundsData = await fundApi.getRealTimeEstimates(uniqueCodes);
        setFunds(fundsData);
      }
    } catch (e) {
      console.error('[App] 加载数据失败', e);
    }
  };

  useEffect(() => {
    if (session) {
      loadAllData();
    } else {
      // 退出登录时清空数据
      setGroups([]);
      setFunds([]);
      setMarketFundsData({ codes: [], shortNames: {} });
      setActiveTab(null);
    }
  }, [session]);

  // ─── 退出登录 ─────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // ─── 添加基金到当前分组 ────────────────────────────────────
  const handleAddFund = async (newFund) => {
    const currentGroup = groups.find(g => g.name === activeTab);
    if (!currentGroup || currentGroup.isMarket) return;
    if (currentGroup.codes.includes(newFund.code)) return;

    try {
      await addFundToGroup(currentGroup.id, newFund.code, currentGroup.codes.length);
      setGroups(prev => prev.map(g =>
        g.id === currentGroup.id
          ? { ...g, codes: [...g.codes, newFund.code] }
          : g
      ));
      setFunds(prev => prev.find(f => f.code === newFund.code) ? prev : [...prev, newFund]);
    } catch (e) {
      console.error('添加基金失败', e);
    }
  };

  // ─── 从当前分组移除基金 ────────────────────────────────────
  const handleRemove = async (code) => {
    const currentGroup = groups.find(g => g.name === activeTab);
    if (!currentGroup) return;

    try {
      await removeFundFromGroup(currentGroup.id, code);
      setGroups(prev => prev.map(g =>
        g.id === currentGroup.id
          ? { ...g, codes: g.codes.filter(c => c !== code) }
          : g
      ));
    } catch (e) {
      console.error('移除基金失败', e);
    }
  };

  // ─── 10 秒轮询当前 Tab ────────────────────────────────────
  useEffect(() => {
    const activeGroup = groups.find(g => g.name === activeTab);
    if (!activeGroup || !activeGroup.codes || activeGroup.codes.length === 0) return;

    const fetchUpdates = async () => {
      try {
        const updates = await fundApi.getRealTimeEstimates(activeGroup.codes);
        setFunds(cur => cur.map(fund => {
          const u = updates.find(u => u.code === fund.code);
          return u ? { ...fund, ...u } : fund;
        }));
      } catch (e) {
        console.error('轮询更新失败', e);
      }
    };

    const interval = setInterval(fetchUpdates, 10000);
    return () => clearInterval(interval);
  }, [activeTab, groups]);

  // ─── 批量获取昨日涨跌幅 + 分析数据 ──────────────────────
  useEffect(() => {
    if (funds.length === 0) return;

    const missingPrev = funds.map(f => f.code).filter(c => prevChanges[c] === undefined);
    if (missingPrev.length > 0) {
      fundApi.getBatchPreviousDayChange(missingPrev).then(results => {
        setPrevChanges(prev => {
          const next = { ...prev };
          results.forEach(r => { next[r.code] = r; });
          return next;
        });
      });
    }

    const missingAnalysis = funds.map(f => f.code).filter(c => analysisData[c] === undefined);
    if (missingAnalysis.length > 0) {
      fundApi.getBatchAnalysis(missingAnalysis).then(results => {
        setAnalysisData(prev => ({ ...prev, ...results }));
      });
    }
  }, [funds.length]);

  // ─── 渲染：未初始化 ───────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0f172a', color: '#64748b', fontSize: '14px', gap: '10px',
      }}>
        <div className="spin" style={{
          width: '20px', height: '20px',
          border: '2px solid #334155', borderTopColor: '#4f46e5',
          borderRadius: '50%',
        }} />
        正在加载...
      </div>
    );
  }

  // ─── 渲染：未登录 → 跳转到登录页 ────────────────────────
  if (!session) {
    return <AuthPage />;
  }

  // ─── 渲染：已登录，正常主界面 ────────────────────────────
  const activeGroup = groups.find(g => g.name === activeTab);
  let visibleFunds = activeGroup
    ? activeGroup.codes.map(code => funds.find(f => f.code === code)).filter(Boolean)
    : [];

  visibleFunds.sort((a, b) => parseFloat(b.estChange || 0) - parseFloat(a.estChange || 0));

  const activeFundData = selectedFund
    ? funds.find(f => f.code === selectedFund.code) || selectedFund
    : null;

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
      <header className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold' }}>
          Fund<span style={{ color: 'var(--color-accent)' }}>Tracker</span>
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>{session.user.email}</span>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setShowManager(true)}>
            <Settings size={15} /> 配置
          </button>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', borderColor: '#ef444433' }}
            onClick={handleSignOut}>
            <LogOut size={15} /> 退出
          </button>
        </div>
      </header>

      <main>
        {/* Tab 导航 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--spacing-4)', overflowX: 'auto', paddingBottom: '4px' }}>
          {groups.map(group => (
            <button
              key={group.id || group.name}
              onClick={() => setActiveTab(group.name)}
              className={activeTab === group.name ? 'btn' : 'btn-secondary'}
              style={{ whiteSpace: 'nowrap' }}
            >
              {group.isMarket ? '📊 ' : ''}{group.name}
            </button>
          ))}
          <button
            onClick={() => setActiveTab('实时快讯')}
            className={activeTab === '实时快讯' ? 'btn' : 'btn-secondary'}
            style={{ whiteSpace: 'nowrap', border: '1px solid #4f46e5' }}
          >
            🔥 实时快讯
          </button>
          <button
            onClick={() => setActiveTab('财联社电报')}
            className={activeTab === '财联社电报' ? 'btn' : 'btn-secondary'}
            style={{ whiteSpace: 'nowrap', border: '1px solid #ef4444' }}
          >
            🗞️ 财联社电报
          </button>
        </div>

        {/* 内容区 */}
        {activeTab === '实时快讯' ? (
          <NewsBoard source="em" groups={groups} />
        ) : activeTab === '财联社电报' ? (
          <NewsBoard source="cls" groups={groups} />
        ) : (
          <>
            {/* 非市场风向标分组才显示搜索框 */}
            {!activeGroup?.isMarket && (
              <FundSearch onAddFund={handleAddFund} existingCodes={activeGroup?.codes || []} />
            )}

            {/* 市场风向标特殊展示 */}
            {activeGroup?.isMarket && (
              <MarketCompass funds={activeGroup.codes} shortNames={activeGroup.shortNames} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              {visibleFunds.length === 0 ? (
                <div className="card">
                  <p className="text-secondary" style={{ textAlign: 'center' }}>
                    该分组暂无基金，使用顶部搜索框添加。
                  </p>
                </div>
              ) : (
                <>
                  {!activeGroup?.isMarket && (
                    <div className="card flex-between" style={{ padding: 'var(--spacing-3)', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <span className="text-secondary">持仓总数</span>
                      <span style={{ fontWeight: 'bold' }}>{visibleFunds.length}</span>
                    </div>
                  )}
                  {visibleFunds.map(fund => (
                    <FundCard
                      key={fund.code}
                      fund={fund}
                      industryLabel={activeGroup?.shortNames?.[fund.code]}
                      prevChange={prevChanges[fund.code]}
                      analysis={analysisData[fund.code]}
                      onRemove={() => handleRemove(fund.code)}
                      onOpenPerspective={() => setSelectedFund(fund)}
                    />
                  ))}
                </>
              )}
            </div>
          </>
        )}

        {/* 图例 */}
        <div style={{
          marginTop: '20px', padding: '10px', borderRadius: '8px',
          backgroundColor: '#1e293b', border: '1px solid #334155',
          fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '16px', flexWrap: 'wrap',
        }}>
          <span>🔥 <b>RSI{'>'}70 (过热)</b>: 追高风险</span>
          <span>❄️ <b>RSI{'<'}30 (冰点)</b>: 反弹机会</span>
          <span>🌪️ <b>High Vol</b>: 剧烈波动</span>
        </div>
      </main>

      {/* 弹窗 */}
      {activeFundData && (
        <FundPerspective fund={activeFundData} onClose={() => setSelectedFund(null)} />
      )}

      {showManager && (
        <FundManager
          groups={groups}
          marketFundsData={marketFundsData}
          onUpdate={async () => {
            await loadAllData();
          }}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  );
}

export default App;
