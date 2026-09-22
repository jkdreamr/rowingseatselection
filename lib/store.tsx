'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  emptyData,
  loadClipboard,
  loadCoach,
  LocalStorageAdapter,
  saveClipboard,
  saveCoach,
  type LineupClipboard,
} from './storage';
import { uid } from './ids';
import { lineupReducer, type Action, type HistoryState } from './reducer';
import type { Coach } from './types';

export { lineupReducer, type Action };

const initialHistory: HistoryState = { present: emptyData(), past: [], future: [] };

interface StoreContextValue extends HistoryState {
  loaded: boolean;
  dispatch: React.Dispatch<Action>;
  canUndo: boolean;
  canRedo: boolean;
  /** Local identity used to key private notes. Always present once loaded. */
  coach: Coach;
  setCoachName: (name: string) => void;
  clipboard: LineupClipboard | null;
  setClipboard: (clipboard: LineupClipboard | null) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const placeholderCoach: Coach = { id: 'coach-local', name: '' };

export function LineupStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(lineupReducer, initialHistory);
  const [loaded, setLoaded] = useState(false);
  const [coach, setCoach] = useState<Coach>(placeholderCoach);
  const [clipboard, setClipboardState] = useState<LineupClipboard | null>(null);
  const adapter = useMemo(() => new LocalStorageAdapter(), []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    adapter.load().then((data) => {
      dispatch({ type: 'INIT', data });
      const stored = loadCoach() ?? { id: uid('coach'), name: '' };
      if (!loadCoach()) saveCoach(stored);
      setCoach(stored);
      setClipboardState(loadClipboard());
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

  const setCoachName = useCallback((name: string) => {
    setCoach((current) => {
      const next = { ...current, name };
      saveCoach(next);
      return next;
    });
  }, []);

  const setClipboard = useCallback((next: LineupClipboard | null) => {
    saveClipboard(next);
    setClipboardState(next);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      loaded,
      dispatch,
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      coach,
      setCoachName,
      clipboard,
      setClipboard,
    }),
    [state, loaded, coach, setCoachName, clipboard, setClipboard],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useLineupStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useLineupStore must be used inside LineupStoreProvider');
  return context;
}
