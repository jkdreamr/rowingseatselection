'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { emptyData, LocalStorageAdapter } from './storage';
import { lineupReducer, type Action, type HistoryState } from './reducer';

export { lineupReducer, type Action };

const initialHistory: HistoryState = { present: emptyData(), past: [], future: [] };

interface StoreContextValue extends HistoryState {
  loaded: boolean;
  dispatch: React.Dispatch<Action>;
  canUndo: boolean;
  canRedo: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function LineupStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(lineupReducer, initialHistory);
  const [loaded, setLoaded] = useState(false);
  const adapter = useMemo(() => new LocalStorageAdapter(), []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    adapter.load().then((data) => {
      dispatch({ type: 'INIT', data });
      setLoaded(true);
    });
  }, [adapter]);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void adapter.save(state.present), 300);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [adapter, loaded, state.present]);

  const value = useMemo(
    () => ({
      ...state,
      loaded,
      dispatch,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
    }),
    [state, loaded],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useLineupStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useLineupStore must be used inside LineupStoreProvider');
  return context;
}
