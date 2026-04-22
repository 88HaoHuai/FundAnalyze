import { supabase } from './supabaseClient';

// ============================================================
// fund_groups 相关操作
// ============================================================

/**
 * 获取当前用户的所有分组（附带每组的基金代码列表）
 * 返回格式兼容原 funds.json 的数组结构
 */
export async function fetchGroups() {
  // 拉取所有分组
  const { data: groups, error: groupsError } = await supabase
    .from('fund_groups')
    .select('id, name, is_market, sort_order')
    .order('sort_order', { ascending: true });

  if (groupsError) throw groupsError;
  if (!groups || groups.length === 0) return [];

  // 拉取所有分组的基金代码
  const groupIds = groups.map(g => g.id);
  const { data: gFunds, error: gFundsError } = await supabase
    .from('group_funds')
    .select('group_id, fund_code, sort_order')
    .in('group_id', groupIds)
    .order('sort_order', { ascending: true });

  if (gFundsError) throw gFundsError;

  // 拼装成兼容前端的格式
  return groups.map(g => ({
    id: g.id,
    name: g.name,
    isMarket: g.is_market,
    sort_order: g.sort_order,
    codes: (gFunds || [])
      .filter(f => f.group_id === g.id)
      .map(f => f.fund_code),
  }));
}

/**
 * 创建新分组
 */
export async function createGroup(name, isMarket = false, sortOrder = 0) {
  // 获取当前登录用户的 UID，满足 RLS WITH CHECK 校验
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录，无法创建分组');

  const { data, error } = await supabase
    .from('fund_groups')
    .insert({ user_id: user.id, name, is_market: isMarket, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * 删除分组（级联删除 group_funds）
 */
export async function deleteGroup(groupId) {
  const { error } = await supabase
    .from('fund_groups')
    .delete()
    .eq('id', groupId);
  if (error) throw error;
}

/**
 * 更新分组名称
 */
export async function renameGroup(groupId, newName) {
  const { error } = await supabase
    .from('fund_groups')
    .update({ name: newName })
    .eq('id', groupId);
  if (error) throw error;
}

// ============================================================
// group_funds 相关操作
// ============================================================

/**
 * 向指定分组添加一支基金
 */
export async function addFundToGroup(groupId, fundCode, sortOrder = 0) {
  const { error } = await supabase
    .from('group_funds')
    .insert({ group_id: groupId, fund_code: fundCode, sort_order: sortOrder });
  if (error) throw error;
}

/**
 * 从指定分组移除一支基金
 */
export async function removeFundFromGroup(groupId, fundCode) {
  const { error } = await supabase
    .from('group_funds')
    .delete()
    .eq('group_id', groupId)
    .eq('fund_code', fundCode);
  if (error) throw error;
}

// ============================================================
// market_funds 相关操作
// ============================================================

/**
 * 获取当前用户的市场风向标板块列表
 * 返回格式：{ codes: [], shortNames: { code: name } }
 */
export async function fetchMarketFunds() {
  const { data, error } = await supabase
    .from('market_funds')
    .select('fund_code, short_name, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw error;

  const codes = (data || []).map(m => m.fund_code);
  const shortNames = {};
  (data || []).forEach(m => { shortNames[m.fund_code] = m.short_name; });

  return { codes, shortNames };
}

/**
 * 向市场风向标添加板块
 */
export async function addMarketFund(fundCode, shortName, sortOrder = 0) {
  // 获取当前登录用户的 UID，满足 RLS WITH CHECK 校验
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录，无法添加板块');

  const { error } = await supabase
    .from('market_funds')
    .insert({ user_id: user.id, fund_code: fundCode, short_name: shortName, sort_order: sortOrder });
  if (error) throw error;
}

/**
 * 从市场风向标移除板块
 */
export async function removeMarketFund(fundCode) {
  const { error } = await supabase
    .from('market_funds')
    .delete()
    .eq('fund_code', fundCode);
  if (error) throw error;
}

/**
 * 修改板块的短名称
 */
export async function renameMarketFund(fundCode, newShortName) {
  const { error } = await supabase
    .from('market_funds')
    .update({ short_name: newShortName })
    .eq('fund_code', fundCode);
  if (error) throw error;
}

// ============================================================
// user_alert_config 相关操作
// ============================================================

/**
 * 获取当前用户的提醒配置
 */
export async function fetchAlertConfig() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_alert_config')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // 如果没有配置，返回默认值（不报错，方便前端处理）
  if (error && error.code === 'PGRST116') {
    return {
      user_id: user.id,
      is_enabled: true,
      threshold: 2.0,
      email_receiver: ''
    };
  }

  if (error) throw error;
  return data;
}

/**
 * 更新或创建提醒配置
 */
export async function updateAlertConfig(config) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const { error } = await supabase
    .from('user_alert_config')
    .upsert({
      user_id: user.id,
      ...config,
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

