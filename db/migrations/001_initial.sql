-- Account snapshots
CREATE TABLE IF NOT EXISTS account_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  net_liq         NUMERIC(18,2),
  cash_balance    NUMERIC(18,2),
  buying_power    NUMERIC(18,2),
  excess_liq      NUMERIC(18,2),
  init_margin     NUMERIC(18,2),
  maint_margin    NUMERIC(18,2),
  unrealized_pnl  NUMERIC(18,2),
  realized_pnl_today NUMERIC(18,2)
);

-- Positions (open and closed)
CREATE TABLE IF NOT EXISTS positions (
  id              BIGSERIAL PRIMARY KEY,
  instrument      VARCHAR(10) NOT NULL,
  contract        VARCHAR(10) NOT NULL,
  side            VARCHAR(5)  NOT NULL,
  quantity        INTEGER     NOT NULL,
  entry_price     NUMERIC(12,4),
  entry_ts        TIMESTAMPTZ,
  mark_price      NUMERIC(12,4),
  unrealized_pnl  NUMERIC(12,2),
  realized_pnl    NUMERIC(12,2),
  init_margin     NUMERIC(12,2),
  is_overnight    BOOLEAN DEFAULT FALSE,
  stop_loss       NUMERIC(12,4),
  take_profit     NUMERIC(12,4),
  status          VARCHAR(10) DEFAULT 'OPEN',
  closed_ts       TIMESTAMPTZ
);

-- Completed trades
CREATE TABLE IF NOT EXISTS trades (
  id                    BIGSERIAL PRIMARY KEY,
  instrument            VARCHAR(10) NOT NULL,
  contract              VARCHAR(10) NOT NULL,
  side                  VARCHAR(5)  NOT NULL,
  quantity              INTEGER     NOT NULL,
  entry_price           NUMERIC(12,4),
  exit_price            NUMERIC(12,4),
  entry_ts              TIMESTAMPTZ,
  exit_ts               TIMESTAMPTZ,
  pnl                   NUMERIC(12,2),
  pnl_pct               NUMERIC(8,4),
  commission            NUMERIC(8,2),
  exit_reason           VARCHAR(30),
  confluence_score      INTEGER,
  ml_confidence         NUMERIC(5,4),
  regime_state          VARCHAR(20),
  delta_at_entry        NUMERIC(12,2),
  vwap_at_entry         NUMERIC(12,4),
  atr_at_entry          NUMERIC(12,4),
  kelly_fraction        NUMERIC(6,4)
);

-- Generated signals
CREATE TABLE IF NOT EXISTS signals (
  id                BIGSERIAL PRIMARY KEY,
  ts                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  instrument        VARCHAR(10) NOT NULL,
  direction         VARCHAR(5)  NOT NULL,
  ema_signal        BOOLEAN,
  macd_signal       BOOLEAN,
  rsi_signal        BOOLEAN,
  vwap_signal       BOOLEAN,
  delta_signal      BOOLEAN,
  zscore_signal     BOOLEAN,
  regime_state      VARCHAR(20),
  confluence_score  INTEGER,
  ml_confidence     NUMERIC(5,4),
  fired             BOOLEAN,
  skip_reason       VARCHAR(150)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id              BIGSERIAL PRIMARY KEY,
  ibkr_order_id   INTEGER,
  instrument      VARCHAR(10),
  order_type      VARCHAR(20),
  side            VARCHAR(5),
  quantity        INTEGER,
  limit_price     NUMERIC(12,4),
  stop_price      NUMERIC(12,4),
  status          VARCHAR(20),
  fill_price      NUMERIC(12,4),
  commission      NUMERIC(8,2),
  ts_submitted    TIMESTAMPTZ,
  ts_filled       TIMESTAMPTZ,
  tif             VARCHAR(5)
);

-- Bot state (singleton)
CREATE TABLE IF NOT EXISTS bot_state (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  is_running      BOOLEAN DEFAULT FALSE,
  strategy        VARCHAR(30) DEFAULT 'TREND_FOLLOWING',
  es_enabled      BOOLEAN DEFAULT TRUE,
  nq_enabled      BOOLEAN DEFAULT TRUE,
  gc_enabled      BOOLEAN DEFAULT TRUE,
  risk_pct        NUMERIC(4,2) DEFAULT 1.0,
  daily_kill_pct  NUMERIC(4,2) DEFAULT 3.0,
  kill_switch_on  BOOLEAN DEFAULT FALSE,
  ml_enabled      BOOLEAN DEFAULT TRUE,
  ml_min_confidence NUMERIC(4,2) DEFAULT 0.65,
  last_updated    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO bot_state (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Daily performance
CREATE TABLE IF NOT EXISTS performance_daily (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE UNIQUE NOT NULL,
  net_pnl         NUMERIC(12,2),
  trades_taken    INTEGER,
  wins            INTEGER,
  losses          INTEGER,
  win_rate        NUMERIC(5,2),
  sharpe          NUMERIC(8,4),
  sortino         NUMERIC(8,4),
  max_drawdown    NUMERIC(8,4),
  profit_factor   NUMERIC(8,4),
  starting_equity NUMERIC(18,2),
  ending_equity   NUMERIC(18,2)
);

-- ML model metadata
CREATE TABLE IF NOT EXISTS ml_models (
  id              BIGSERIAL PRIMARY KEY,
  instrument      VARCHAR(10) NOT NULL,
  trained_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accuracy        NUMERIC(5,4),
  precision_score NUMERIC(5,4),
  recall_score    NUMERIC(5,4),
  f1_score        NUMERIC(5,4),
  sharpe_backtest NUMERIC(8,4),
  n_features      INTEGER,
  n_samples       INTEGER,
  model_path      VARCHAR(200)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trades_instrument ON trades(instrument);
CREATE INDEX IF NOT EXISTS idx_trades_entry_ts ON trades(entry_ts);
CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(ts);
CREATE INDEX IF NOT EXISTS idx_account_snapshots_ts ON account_snapshots(ts);
