import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { configApi, tradesApi } from '../api';
import Loading from '../components/Loading';

const ConfigContext = createContext(null);

// Loads the platform fee % from GET /api/config and the trades with their
// fair minimum rates from GET /api/trades (stored in MongoDB, editable by the
// admin), so the client never hardcodes values the server enforces.
//
// - trades:    active trades, in the admin's order (dropdowns, filters, home page)
// - getTrade:  look up any trade by slug, including inactive ones, so old jobs
//              and workers in a switched-off trade still show its name
// - reloadTrades: called by the admin Trades tab after a change
export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [allTrades, setAllTrades] = useState(null);
  const [error, setError] = useState(false);

  const reloadTrades = useCallback(() => tradesApi.list({ all: true }).then((res) => setAllTrades(res.trades)), []);

  const load = useCallback(() => {
    setError(false);
    Promise.all([configApi.get(), tradesApi.list({ all: true })])
      .then(([cfg, tradeRes]) => {
        setConfig(cfg);
        setAllTrades(tradeRes.trades);
      })
      .catch(() => setError(true));
  }, []);
  useEffect(load, [load]);

  if (error) {
    return (
      <div className="container py-5" style={{ maxWidth: 560 }}>
        <div className="alert alert-danger">
          <p className="fw-semibold mb-1">Cannot reach the SIMSAR server.</p>
          <p className="small mb-2">Make sure the API is running (<code>npm run dev</code> from the project root) and MongoDB is started.</p>
          <button type="button" className="btn btn-sm btn-outline-dark" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }
  if (!config || !allTrades) return <Loading label="Loading trades and rates…" />;

  const trades = allTrades.filter((t) => t.active);
  const getTrade = (slug) => allTrades.find((t) => t.slug === slug);
  return (
    <ConfigContext.Provider value={{ ...config, trades, allTrades, getTrade, reloadTrades }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}

// Shorthand for components that only need the trade list.
export function useTrades() {
  const { trades, allTrades, getTrade, reloadTrades } = useConfig();
  return { trades, allTrades, getTrade, reloadTrades };
}
