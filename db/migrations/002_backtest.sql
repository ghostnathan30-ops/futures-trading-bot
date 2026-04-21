-- Migration 002: Backtesting tables
-- Apply: docker exec -i <postgres-container> psql -U <user> -d <db> < db/migrations/002_backtest.sql

CREATE TABLE IF NOT EXISTS backtest_runs (
  id              BIGSERIAL PRIMARY KEY,
  run_id          VARCHAR(36) UNIQUE NOT NULL,
  instrument      VARCHAR(10) NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  initial_equity  NUMERIC(18,2) NOT NULL,
  final_equity    NUMERIC(18,2),
  total_return    NUMERIC(10,4),
  sharpe          NUMERIC(8,4),
  sortino         NUMERIC(8,4),
  max_drawdown    NUMERIC(8,4),
  calmar          NUMERIC(8,4),
  profit_factor   NUMERIC(8,4),
  total_trades    INTEGER,
  wins            INTEGER,
  losses          INTEGER,
  win_rate        NUMERIC(5,4),
  avg_win         NUMERIC(12,2),
  avg_loss        NUMERIC(12,2),
  expectancy      NUMERIC(12,2),
  parameters      JSONB,
  status          VARCHAR(20) DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backtest_trades (
  id              BIGSERIAL PRIMARY KEY,
  backtest_run_id INTEGER REFERENCES backtest_runs(id) ON DELETE CASCADE,
  instrument      VARCHAR(10) NOT NULL,
  side            VARCHAR(5)  NOT NULL,
  quantity        INTEGER     NOT NULL DEFAULT 1,
  entry_ts        TIMESTAMPTZ NOT NULL,
  exit_ts         TIMESTAMPTZ,
  entry_price     NUMERIC(12,4),
  exit_price      NUMERIC(12,4),
  pnl             NUMERIC(12,2),
  pnl_pct         NUMERIC(8,4),
  confluence_score INTEGER,
  ml_confidence   NUMERIC(5,4),
  regime_state    VARCHAR(20),
  exit_reason     VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS backtest_equity_curve (
  id              BIGSERIAL PRIMARY KEY,
  backtest_run_id INTEGER REFERENCES backtest_runs(id) ON DELETE CASCADE,
  ts              TIMESTAMPTZ NOT NULL,
  equity          NUMERIC(18,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_backtest_runs_run_id ON backtest_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_backtest_trades_run  ON backtest_trades(backtest_run_id);
CREATE INDEX IF NOT EXISTS idx_backtest_equity_run  ON backtest_equity_curve(backtest_run_id);
