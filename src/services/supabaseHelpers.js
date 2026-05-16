import { apiClient } from './apiClient';

// ============================================================
// fund_groups 相关操作
// ============================================================

export async function fetchGroups() {
  // 从新后端获取分组和持仓
  return await apiClient.get('/api/groups/');
}

export async function createGroup(name, isMarket = false, sortOrder = 0) {
  return await apiClient.post('/api/groups/', { name, is_market: isMarket, sort_order: sortOrder });
}

export async function deleteGroup(groupId) {
  return await apiClient.delete(`/api/groups/${groupId}`);
}

export async function renameGroup(groupId, newName) {
  return await apiClient.put(`/api/groups/${groupId}`, { name: newName });
}

// ============================================================
// group_funds 相关操作
// ============================================================

export async function addFundToGroup(groupId, fundCode, sortOrder = 0) {
  return await apiClient.post(`/api/groups/${groupId}/funds`, { 
      fund_code: fundCode, sort_order: sortOrder 
  });
}

export async function removeFundFromGroup(groupId, fundCode) {
  return await apiClient.delete(`/api/groups/${groupId}/funds/${fundCode}`);
}

export async function updateFundPosition(groupId, fundCode, amount, isAutoInvest, autoInvestAmount) {
  return await apiClient.put(`/api/groups/${groupId}/funds/${fundCode}`, {
      amount, is_auto_invest: isAutoInvest, auto_invest_amount: autoInvestAmount
  });
}

// ============================================================
// market_funds 及其他未完全迁移的操作（桩函数，稍后根据需要补充）
// ============================================================

export async function fetchMarketFunds() {
  // 暂时如果后端没单独写 market 路由，可以从 fetchGroups 里抽出 isMarket == true 的数据
  // 但为了兼容，我们通过一个新的 API 或者直接返回空
  try {
      return await apiClient.get('/api/market/');
  } catch (e) {
      return { codes: [], shortNames: {} };
  }
}

export async function addMarketFund(fundCode, shortName, sortOrder = 0) {
    return await apiClient.post('/api/market/', { fund_code: fundCode, short_name: shortName, sort_order: sortOrder });
}

export async function removeMarketFund(fundCode) {
    return await apiClient.delete(`/api/market/${fundCode}`);
}

export async function renameMarketFund(fundCode, newShortName) {
    return await apiClient.put(`/api/market/${fundCode}`, { short_name: newShortName });
}

export async function fetchAlertConfig() {
  try {
      return await apiClient.get('/api/alerts/');
  } catch (e) {
      return { is_enabled: true, threshold: 2.0, email_receiver: '' };
  }
}

export async function updateAlertConfig(config) {
  return await apiClient.put('/api/alerts/', config);
}

export async function fetchAutoInvestLogs(fundCode) {
  try {
      return await apiClient.get(`/api/invest/logs?fund_code=${fundCode}`);
  } catch (e) {
      return [];
  }
}

export async function batchUpdatePositions(updates, todayStr = null) {
  // 不再由前端结算持仓，这个函数将废弃或改为只读调用
  console.warn("batchUpdatePositions 已经被后端定时任务接管");
  return updates.length;
}

export async function insertPositionUpdateLogs(logs) {
  // 废弃
}
