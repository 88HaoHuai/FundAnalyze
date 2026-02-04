
import { useState, useEffect } from 'react'
import { FundSearch } from './components/FundSearch';
import { FundCard } from './components/FundCard';
import { FundPerspective } from './components/FundPerspective';
import { FundManager } from './components/FundManager';
import { fundApi } from './services/fundApi';
import initialFundGroups from './config/funds.json';

const STORAGE_KEY = 'fundTrackerGroups';

function App() {
  // 初始化 groups: 优先使用 localStorage,否则使用默认配置
  const getInitialGroups = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load from localStorage', e);
    }
    return initialFundGroups;
  };

  // funds is now a list of all retrieved fund data objects (flat list of details)
  const [funds, setFunds] = useState([]);
  // groups holds the structure: [{name: '支付宝', codes: [...]}, ...]
  const [groups, setGroups] = useState(getInitialGroups);
  const [activeTab, setActiveTab] = useState(() => {
    const initial = getInitialGroups();
    return initial[0]?.name || '默认';
  });

  const [selectedFund, setSelectedFund] = useState(null);
  const [showManager, setShowManager] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load initial funds from config on mount
  useEffect(() => {
    if (initialized) return;

    const loadInitialFunds = async () => {
      try {
        // Flatten all codes from all groups
        const allCodes = groups.flatMap(g => g.codes);
        // Deduplicate
        const uniqueCodes = [...new Set(allCodes)];

        // Fetch initial data for all configured funds
        const data = await fundApi.getRealTimeEstimates(uniqueCodes);
        setFunds(data);
      } catch (e) {
        console.error("Failed to load initial funds", e);
      } finally {
        setInitialized(true);
      }
    };

    loadInitialFunds();
  }, [initialized, groups]); // We only run this once on mount/init, and when groups change initially

  // Persist changes to localStorage
  const persistGroups = (newGroups) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newGroups));
      console.log('[LocalStorage] Saved groups');
    } catch (e) {
      console.error('[LocalStorage] Failed to save', e);
    }
  };

  const handleAddFund = (newFund) => {
    // Add to CURRENT active group
    const currentGroupIndex = groups.findIndex(g => g.name === activeTab);
    if (currentGroupIndex === -1) return;

    const currentGroup = groups[currentGroupIndex];
    if (currentGroup.codes.includes(newFund.code)) return; // Already in this group

    const updatedGroups = [...groups];
    updatedGroups[currentGroupIndex] = {
      ...currentGroup,
      codes: [...currentGroup.codes, newFund.code]
    };

    setGroups(updatedGroups);
    setFunds(prev => {
      if (prev.find(f => f.code === newFund.code)) return prev;
      return [...prev, newFund];
    });

    persistGroups(updatedGroups);
  };

  const handleRemove = (code) => {
    // Remove from CURRENT active group
    const currentGroupIndex = groups.findIndex(g => g.name === activeTab);
    if (currentGroupIndex === -1) return;

    const updatedGroups = [...groups];
    updatedGroups[currentGroupIndex] = {
      ...updatedGroups[currentGroupIndex],
      codes: updatedGroups[currentGroupIndex].codes.filter(c => c !== code)
    };

    setGroups(updatedGroups);
    // We don't necessarily remove the fund data from `funds` state as it might be in another group, 
    // but for simplicity/memory we could cleanup if no group uses it. 
    // For now, keeping it cached in `funds` is fine.

    persistGroups(updatedGroups);
  };

  const handleUpdateFromManager = async (newGroups) => {
    try {
      setGroups(newGroups);
      const allCodes = newGroups.flatMap(g => g.codes);
      const uniqueCodes = [...new Set(allCodes)];
      const data = await fundApi.getRealTimeEstimates(uniqueCodes);
      setFunds(data);
      persistGroups(newGroups);
    } catch (e) {
      console.error("Failed to update from manager", e);
    }
  };

  // Poll for real-time updates
  useEffect(() => {
    if (funds.length === 0) return;

    const fetchUpdates = async () => {
      // Refresh all current funds
      const codes = funds.map(f => f.code);
      try {
        const updates = await fundApi.getRealTimeEstimates(codes);
        setFunds(currentFunds => {
          return currentFunds.map(fund => {
            const update = updates.find(u => u.code === fund.code);
            return update ? { ...fund, ...update } : fund;
          });
        });
      } catch (error) {
        console.error("Failed to fetch updates", error);
      }
    };

    const interval = setInterval(fetchUpdates, 10000);
    return () => clearInterval(interval);
  }, [funds.length]);

  // Sync selected fund with latest data
  const activeFundData = selectedFund ? funds.find(f => f.code === selectedFund.code) || selectedFund : null;

  // Additional state for Previous Day Changes
  const [prevChanges, setPrevChanges] = useState({});

  // Fetch previous day changes once we have funds
  useEffect(() => {
    // Avoid fetching if already have data for most funds
    if (funds.length === 0) return;

    const missingCodes = funds
      .map(f => f.code)
      .filter(code => prevChanges[code] === undefined);

    if (missingCodes.length === 0) return;

    const fetchPrev = async () => {
      const results = await fundApi.getBatchPreviousDayChange(missingCodes);
      setPrevChanges(prev => {
        const next = { ...prev };
        results.forEach(r => { next[r.code] = r; });
        return next;
      });
    };

    fetchPrev();
  }, [funds.length]); // Depend on funds length to trigger when new funds added

  // Filter funds for current tab
  const activeGroup = groups.find(g => g.name === activeTab);
  let visibleFunds = activeGroup ? activeGroup.codes.map(code => funds.find(f => f.code === code)).filter(Boolean) : [];

  // Sort by estChange descending (Highest gain to lowest loss)
  visibleFunds.sort((a, b) => {
    const valA = parseFloat(a.estChange || 0);
    const valB = parseFloat(b.estChange || 0);
    return valB - valA;
  });

  return (
    <div className="container" style={{ paddingTop: '2rem', paddingBottom: '2rem' }}>
      <header className="flex-between" style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold' }}>
          Fund<span style={{ color: 'var(--color-accent)' }}>Tracker</span>
        </h1>
        <button className="btn btn-secondary" onClick={() => setShowManager(true)}>
          Settings
        </button>
      </header>

      <main>
        <div style={{ maxWidth: '100%', margin: '0 auto' }}>
          {/* Group Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--spacing-4)', overflowX: 'auto', paddingBottom: '4px' }}>
            {groups.map(group => (
              <button
                key={group.name}
                onClick={() => setActiveTab(group.name)}
                className={activeTab === group.name ? 'btn' : 'btn-secondary'}
                style={{ whiteSpace: 'nowrap' }}
              >
                {group.name}
              </button>
            ))}
          </div>

          <FundSearch onAddFund={handleAddFund} existingCodes={activeGroup?.codes || []} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
            {visibleFunds.length === 0 ? (
              <div className="card">
                <p className="text-secondary" style={{ textAlign: 'center' }}>
                  No funds in this group. Add one to track.
                </p>
              </div>
            ) : (
              // Calculate Totals for this group
              <>
                <div className="card flex-between" style={{ padding: 'var(--spacing-3)', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <span className="text-secondary">Group Count</span>
                  <span style={{ fontWeight: 'bold' }}>{visibleFunds.length}</span>
                </div>

                {visibleFunds.map(fund => (
                  <FundCard
                    key={fund.code}
                    fund={fund}
                    prevChange={prevChanges[fund.code]}
                    onRemove={() => handleRemove(fund.code)}
                    onOpenPerspective={() => setSelectedFund(fund)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </main>

      {activeFundData && (
        <FundPerspective fund={activeFundData} onClose={() => setSelectedFund(null)} />
      )}

      {showManager && (
        <FundManager
          groups={groups}
          onUpdate={handleUpdateFromManager}
          onClose={() => setShowManager(false)}
        />
      )}
    </div>
  )
}

export default App
