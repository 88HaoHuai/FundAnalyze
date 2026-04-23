import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check, ChevronRight, Database, Layers, BarChart2 } from 'lucide-react';
import {
  createGroup, deleteGroup, renameGroup,
  addMarketFund, removeMarketFund, renameMarketFund,
  fetchAlertConfig, updateAlertConfig, removeFundFromGroup
} from '../services/supabaseHelpers';
import { Mail, Bell, Settings } from 'lucide-react';

// 通用小标签
function Badge({ children, color = '#4f46e5' }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: '600',
      background: `${color}22`, color: color, border: `1px solid ${color}44`,
    }}>
      {children}
    </span>
  );
}

// 单行可编辑 + 删除
function EditableRow({ label, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(label);

  const commitRename = async () => {
    if (val.trim() && val !== label) {
      await onRename(val.trim());
    }
    setEditing(false);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 12px', borderRadius: '8px',
      background: '#0f172a', border: '1px solid #334155',
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#4f46e5'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#334155'}
    >
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && commitRename()}
          style={{
            flex: 1, background: 'transparent', border: 'none',
            color: '#f8fafc', fontSize: '14px', outline: 'none',
          }}
        />
      ) : (
        <span style={{ flex: 1, fontSize: '14px', color: '#e2e8f0' }}>{label}</span>
      )}

      {onRename && (
        <button
          onClick={() => editing ? commitRename() : setEditing(true)}
          style={{ color: editing ? '#10b981' : '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
        >
          {editing ? <Check size={14} /> : <Edit2 size={14} />}
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export function FundManager({ groups, marketFundsData, onUpdate, onClose }) {
  const [activeSection, setActiveSection] = useState('groups'); // 'groups' | 'market'
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newMarketCode, setNewMarketCode] = useState('');
  const [newMarketName, setNewMarketName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [investing, setInvesting] = useState(false);

  // 提醒配置状态
  const [alertConfig, setAlertConfig] = useState({
    is_enabled: true,
    threshold: 2.0,
    email_receiver: ''
  });

  // 初始化加载提醒配置
  useEffect(() => {
    fetchAlertConfig().then(data => {
      if (data) setAlertConfig(data);
    });
  }, []);

  const handleSaveAlerts = async () => {
    setSaving(true);
    try {
      await updateAlertConfig(alertConfig);
      await onUpdate();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 找到选中的分组对象
  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  // 普通分组（非市场风向标）
  const normalGroups = groups.filter(g => !g.isMarket);
  // 市场风向标分组（只有一个）
  const marketGroup = groups.find(g => g.isMarket);

  const { codes: marketCodes = [], shortNames: marketShortNames = {} } = marketFundsData || {};

  // 手动执行定投结算
  const handleManualInvest = async () => {
    if (!window.confirm('确认手动执行今日的定投本金结算吗？(今日已结算过的基金将自动跳过)')) return;
    setInvesting(true);
    setError(null);
    try {
      const res = await fetch('/api/auto_invest?manual=true', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || '执行失败');
      }
      alert(`结算完成！成功处理了 ${json.processed || 0} 支基金。`);
      await onUpdate();
    } catch (e) {
      setError('手动结算失败: ' + e.message);
    } finally {
      setInvesting(false);
    }
  };

  // 新增分组
  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      await createGroup(name, false, normalGroups.length);
      setNewGroupName('');
      await onUpdate();
    } catch (e) {
      setError(e.message || '创建分组失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除分组
  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('确认删除此分组？分组内的基金关联也将一并删除。')) return;
    setSaving(true);
    try {
      await deleteGroup(groupId);
      if (selectedGroupId === groupId) setSelectedGroupId(null);
      await onUpdate();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 重命名分组
  const handleRenameGroup = async (groupId, newName) => {
    try {
      await renameGroup(groupId, newName);
      await onUpdate();
    } catch (e) {
      setError(e.message);
    }
  };

  // 移除分组内的基金
  const handleDeleteFund = async (groupId, fundCode) => {
    setSaving(true);
    try {
      await removeFundFromGroup(groupId, fundCode);
      await onUpdate();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 新增市场风向标板块
  const handleAddMarket = async () => {
    const code = newMarketCode.trim();
    const name = newMarketName.trim();
    if (!code || !name) return;
    setSaving(true);
    setError(null);
    try {
      await addMarketFund(code, name, marketCodes.length);
      setNewMarketCode('');
      setNewMarketName('');
      await onUpdate();
    } catch (e) {
      setError(e.message || '添加板块失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除市场板块
  const handleDeleteMarket = async (fundCode) => {
    setSaving(true);
    try {
      await removeMarketFund(fundCode);
      await onUpdate();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 重命名市场板块
  const handleRenameMarket = async (fundCode, newName) => {
    try {
      await renameMarketFund(fundCode, newName);
      await onUpdate();
    } catch (e) {
      setError(e.message);
    }
  };

  const sectionBtns = [
    { key: 'groups', label: '基金分组', icon: <Layers size={15} /> },
    { key: 'market', label: '市场风向标', icon: <BarChart2 size={15} /> },
    { key: 'alerts', label: '邮件提醒', icon: <Mail size={15} /> },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
    }} onClick={onClose}>
      <div
        className="mobile-modal"
        style={{
          width: '100%', maxWidth: '680px', maxHeight: '85vh',
          background: '#1e293b', borderRadius: '16px',
          border: '1px solid #334155',
          boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 顶栏 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid #334155',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={20} color="#818cf8" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f8fafc' }}>配置管理</h2>
          </div>
          <button onClick={onClose} style={{
            color: '#475569', background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px', borderRadius: '6px',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Section 切换 */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 24px', borderBottom: '1px solid #334155', flexWrap: 'wrap' }}>
          {sectionBtns.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '500',
              border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: activeSection === s.key ? 'rgba(79,70,229,0.2)' : 'transparent',
              color: activeSection === s.key ? '#a5b4fc' : '#64748b',
            }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* 主体内容 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {/* ========== 基金分组区 ========== */}
          {activeSection === 'groups' && (
            <div className="fund-card-mobile-stack" style={{ display: 'flex', gap: '16px', height: '100%' }}>
              {/* 左侧：分组列表 */}
              <div style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '600', letterSpacing: '0.05em' }}>
                  我的分组
                </div>
                {normalGroups.map(g => (
                  <div key={g.id}
                    onClick={() => setSelectedGroupId(g.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                      border: '1px solid',
                      borderColor: selectedGroupId === g.id ? '#4f46e5' : '#334155',
                      background: selectedGroupId === g.id ? 'rgba(79,70,229,0.15)' : '#0f172a',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#e2e8f0' }}>{g.name}</span>
                      <Badge>{g.codes.length}</Badge>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.id); }}
                        style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                      <ChevronRight size={14} color={selectedGroupId === g.id ? '#818cf8' : '#475569'} />
                    </div>
                  </div>
                ))}

                {/* 新增分组 */}
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                  <input
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
                    placeholder="新分组名称..."
                    style={{
                      flex: 1, padding: '7px 10px',
                      background: '#0f172a', border: '1px solid #334155',
                      borderRadius: '7px', color: '#f8fafc', fontSize: '13px', outline: 'none',
                    }}
                  />
                  <button onClick={handleAddGroup} disabled={saving || !newGroupName.trim()} style={{
                    padding: '7px 10px',
                    background: 'rgba(79,70,229,0.2)', border: '1px solid #4f46e5',
                    borderRadius: '7px', color: '#a5b4fc', cursor: 'pointer',
                  }}>
                    <Plus size={14} />
                  </button>
                </div>

                {/* 手动触发定投 */}
                <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px dashed #334155' }}>
                  <button 
                    onClick={handleManualInvest} 
                    disabled={investing} 
                    style={{
                      width: '100%', padding: '8px', 
                      background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '8px', color: '#10b981', fontSize: '13px', fontWeight: '500',
                      cursor: investing ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                      display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}
                  >
                    {investing ? '结算中...' : '▶ 手动结算今日定投'}
                  </button>
                </div>
              </div>

              {/* 右侧：选中分组的基金列表 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedGroup ? (
                  <>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '600', letterSpacing: '0.05em' }}>
                      「{selectedGroup.name}」的基金列表（{selectedGroup.codes.length} 支）
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '340px' }}>
                      {selectedGroup.codes.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#475569', padding: '40px 0', fontSize: '13px' }}>
                          该分组暂无基金，可在主页搜索添加
                        </div>
                      ) : (
                        selectedGroup.codes.map(code => (
                          <EditableRow
                            key={code}
                            label={code}
                            onDelete={() => handleDeleteFund(selectedGroup.id, code)}
                            onRename={null}
                          />
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#475569', fontSize: '13px', flexDirection: 'column', gap: '8px',
                  }}>
                    <Layers size={28} color="#334155" />
                    <span>← 点击左侧分组查看基金列表</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========== 市场风向标区 ========== */}
          {activeSection === 'market' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', letterSpacing: '0.05em' }}>
                市场风向标板块（{marketCodes.length} 个）
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                {marketCodes.map((code, idx) => (
                  <div key={code} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: '#0f172a', border: '1px solid #334155',
                  }}>
                    <span style={{ fontSize: '11px', color: '#475569', width: '24px', textAlign: 'center' }}>{idx + 1}</span>
                    <span style={{ fontSize: '12px', color: '#64748b', width: '70px', fontFamily: 'monospace' }}>{code}</span>
                    <EditableRow
                      label={marketShortNames[code] || code}
                      onRename={(newName) => handleRenameMarket(code, newName)}
                      onDelete={() => handleDeleteMarket(code)}
                    />
                  </div>
                ))}
              </div>

              {/* 新增板块 */}
              <div style={{
                display: 'flex', gap: '8px', alignItems: 'center',
                padding: '12px', background: '#0f172a',
                borderRadius: '10px', border: '1px dashed #334155',
              }}>
                <input
                  value={newMarketCode}
                  onChange={e => setNewMarketCode(e.target.value)}
                  placeholder="基金代码（6位）"
                  style={{
                    width: '110px', padding: '8px 10px',
                    background: '#1e293b', border: '1px solid #334155',
                    borderRadius: '7px', color: '#f8fafc', fontSize: '13px', outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
                <input
                  value={newMarketName}
                  onChange={e => setNewMarketName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddMarket()}
                  placeholder="板块短名（如：半导体）"
                  style={{
                    flex: 1, padding: '8px 10px',
                    background: '#1e293b', border: '1px solid #334155',
                    borderRadius: '7px', color: '#f8fafc', fontSize: '13px', outline: 'none',
                  }}
                />
                <button
                  onClick={handleAddMarket}
                  disabled={saving || !newMarketCode.trim() || !newMarketName.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '8px 14px',
                    background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
                    border: 'none', borderRadius: '7px',
                    color: 'white', fontSize: '13px', cursor: 'pointer', fontWeight: '500',
                  }}
                >
                  <Plus size={14} /> 添加
                </button>
              </div>
            </div>
          )}

          {/* ========== 邮件提醒设置区 ========== */}
          {activeSection === 'alerts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px', margin: '0 auto', padding: '10px 0' }}>
              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                <div style={{ width: '50px', height: '50px', background: 'rgba(79,70,229,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Bell size={24} color="#818cf8" />
                </div>
                <h3 style={{ fontSize: '16px', color: '#f8fafc', fontWeight: '600' }}>涨跌幅实时提醒</h3>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>当日涨跌达到设定阈值时，自动向您发送提醒邮件</p>
              </div>

              {/* 总开关 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: '#0f172a', borderRadius: '12px', border: '1px solid #334155' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Settings size={18} color="#94a3b8" />
                  <span style={{ fontSize: '14px', color: '#e2e8f0' }}>开启邮件提醒</span>
                </div>
                <div 
                  onClick={() => setAlertConfig({ ...alertConfig, is_enabled: !alertConfig.is_enabled })}
                  style={{
                    width: '44px', height: '22px', borderRadius: '11px', 
                    background: alertConfig.is_enabled ? '#4f46e5' : '#334155',
                    position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    width: '18px', height: '18px', background: 'white', borderRadius: '50%',
                    position: 'absolute', top: '2px', 
                    left: alertConfig.is_enabled ? '24px' : '2px',
                    transition: 'all 0.2s'
                  }} />
                </div>
              </div>

              {/* 阈值设置 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '13px', color: '#94a3b8' }}>触发阈值</label>
                    <span style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 'bold' }}>± {alertConfig.threshold}%</span>
                </div>
                <input 
                    type="range" min="0.5" max="10" step="0.1"
                    value={alertConfig.threshold}
                    onChange={e => setAlertConfig({ ...alertConfig, threshold: parseFloat(e.target.value) })}
                    disabled={!alertConfig.is_enabled}
                    style={{ width: '100%', cursor: 'pointer', accentColor: '#4f46e5' }}
                />
              </div>

              {/* 邮箱设置 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#94a3b8' }}>接收邮箱（选填）</label>
                <input 
                  value={alertConfig.email_receiver}
                  onChange={e => setAlertConfig({ ...alertConfig, email_receiver: e.target.value })}
                  placeholder="留空则发送至您的注册邮箱"
                  disabled={!alertConfig.is_enabled}
                  style={{
                    padding: '10px 14px', background: '#0f172a', border: '1px solid #334155',
                    borderRadius: '8px', color: '#f8fafc', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ padding: '12px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '8px' }}>
                <ul style={{ fontSize: '11px', color: '#d97706', paddingLeft: '16px', margin: 0, lineHeight: '1.6' }}>
                  <li>系统每 10 分钟轮询一次实时估值。</li>
                  <li>同一基金每日限发 2 封提醒邮件。</li>
                  <li>监控范围仅包含您已添加的所有分组基金。</li>
                </ul>
              </div>

              <button 
                onClick={handleSaveAlerts}
                disabled={saving}
                style={{
                  marginTop: '10px', padding: '12px', background: 'linear-gradient(135deg, #4f46e5, #3b82f6)',
                  border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                {saving ? '保存中...' : '保存提醒配置'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
