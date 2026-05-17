-- ============================================================
-- FundAnalyze PostgreSQL schema
-- Source of truth: server/models/*.py
-- Usage:
--   psql "postgresql://USER:PASSWORD@HOST:PORT/DBNAME" -f server/migrations/init.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- users 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- admin_users 后台管理员
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username            VARCHAR NOT NULL UNIQUE,
    hashed_password     VARCHAR NOT NULL,
    is_active           BOOLEAN DEFAULT true,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_admin_users_username
    ON admin_users(username);

-- ============================================================
-- fund_groups 基金分组
-- ============================================================
CREATE TABLE IF NOT EXISTS fund_groups (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    is_market       BOOLEAN NOT NULL DEFAULT false,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fund_groups_user
    ON fund_groups(user_id);

-- ============================================================
-- group_funds 分组基金持仓
-- ============================================================
CREATE TABLE IF NOT EXISTS group_funds (
    id                      SERIAL PRIMARY KEY,
    group_id                INTEGER NOT NULL REFERENCES fund_groups(id) ON DELETE CASCADE,
    fund_code               VARCHAR(20) NOT NULL,
    fund_name               VARCHAR(100),
    fund_type               VARCHAR(50),
    fund_keywords           VARCHAR(500),
    sort_order              INTEGER NOT NULL DEFAULT 0,
    amount                  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_auto_invest          BOOLEAN NOT NULL DEFAULT false,
    auto_invest_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0,
    last_auto_invest_date   DATE,
    CONSTRAINT uq_group_funds_group_code UNIQUE (group_id, fund_code)
);

CREATE INDEX IF NOT EXISTS idx_group_funds_group
    ON group_funds(group_id);

CREATE INDEX IF NOT EXISTS idx_group_funds_code
    ON group_funds(fund_code);

-- ============================================================
-- market_funds 市场风向标基金配置
-- ============================================================
CREATE TABLE IF NOT EXISTS market_funds (
    id              SERIAL PRIMARY KEY,
    fund_code       VARCHAR(20) NOT NULL UNIQUE,
    fund_name       VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    sort_order      INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- user_alert_config 用户预警配置
-- ============================================================
CREATE TABLE IF NOT EXISTS user_alert_config (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    is_enabled      BOOLEAN NOT NULL DEFAULT true,
    threshold       NUMERIC(5, 2) NOT NULL DEFAULT 2.0,
    email_receiver  VARCHAR(255),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- alert_history 预警发送历史
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_history (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fund_code       VARCHAR(20) NOT NULL,
    change_val      NUMERIC(8, 4),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_history_user_fund
    ON alert_history(user_id, fund_code, sent_at);

-- ============================================================
-- auto_invest_logs 定投/持仓更新日志
-- ============================================================
CREATE TABLE IF NOT EXISTS auto_invest_logs (
    id              SERIAL PRIMARY KEY,
    group_id        INTEGER REFERENCES fund_groups(id) ON DELETE SET NULL,
    fund_code       VARCHAR(20) NOT NULL,
    date            DATE NOT NULL,
    old_amount      NUMERIC(15, 2),
    amount_added    NUMERIC(15, 2),
    invest_amount   NUMERIC(15, 2) DEFAULT 0,
    total_amount    NUMERIC(15, 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invest_logs_fund
    ON auto_invest_logs(fund_code, date);

-- ============================================================
-- cron_logs 定时任务执行日志
-- ============================================================
CREATE TABLE IF NOT EXISTS cron_logs (
    id              SERIAL PRIMARY KEY,
    task_name       VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL,
    message         VARCHAR,
    details         JSONB,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_task
    ON cron_logs(task_name, executed_at DESC);

-- ============================================================
-- scheduled_tasks 可配置定时任务
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id                  SERIAL PRIMARY KEY,
    task_key            VARCHAR(50) NOT NULL UNIQUE,
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    cron_expression     VARCHAR(100) NOT NULL,
    is_enabled          BOOLEAN NOT NULL DEFAULT true,
    last_run_at         TIMESTAMPTZ,
    last_run_status     VARCHAR(20),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_task_key
    ON scheduled_tasks(task_key);
