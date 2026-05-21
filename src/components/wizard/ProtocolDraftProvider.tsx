"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createEmptyDraft, rehydrateDraft } from "@/lib/protocol/draft";
import type { ProtocolDraft } from "@/lib/protocol/types";

const STORAGE_KEY = "nexo.protocol-draft.v1";
const DEBOUNCE_MS = 350;

interface ProtocolDraftContextValue {
  draft: ProtocolDraft;
  /** Replace the entire draft (used by reset and full-import flows). */
  setDraft: (next: ProtocolDraft) => void;
  /** Apply a functional update to the current draft. */
  updateDraft: (updater: (current: ProtocolDraft) => ProtocolDraft) => void;
  /** Wipe the draft and the persisted copy. */
  resetDraft: () => void;
  /** True until the first localStorage read finishes. Useful for SSR guards. */
  hydrated: boolean;
  /**
   * Tick that increments every time the draft is persisted. UI can subscribe
   * to display a "saved" indicator.
   */
  savedAt: number | null;
}

const ProtocolDraftContext = createContext<ProtocolDraftContextValue | null>(null);

function readDraftFromStorage(): ProtocolDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return rehydrateDraft(parsed);
  } catch {
    /* fall through: corrupt draft is discarded */
  }
  return null;
}

export function ProtocolDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<ProtocolDraft>(() => createEmptyDraft());
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read once on mount. We start with an empty draft on the server to avoid
  // hydration mismatches; if storage has a draft we swap it in client-side.
  useEffect(() => {
    const persisted = readDraftFromStorage();
    if (persisted) {
      setDraftState(persisted);
      setSavedAt(Date.now());
    }
    setHydrated(true);
  }, []);

  // Debounced persistence. Skips until the first read finishes so we don't
  // overwrite the persisted draft with the empty initial value.
  useEffect(() => {
    if (!hydrated) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        setSavedAt(Date.now());
      } catch {
        /* quota or private-mode browser: silent fail is fine here */
      }
    }, DEBOUNCE_MS);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [draft, hydrated]);

  const setDraft = useCallback((next: ProtocolDraft) => {
    setDraftState(next);
  }, []);

  const updateDraft = useCallback((updater: (current: ProtocolDraft) => ProtocolDraft) => {
    setDraftState((current) => updater(current));
  }, []);

  const resetDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setDraftState(createEmptyDraft());
    setSavedAt(null);
  }, []);

  const value = useMemo<ProtocolDraftContextValue>(
    () => ({ draft, setDraft, updateDraft, resetDraft, hydrated, savedAt }),
    [draft, setDraft, updateDraft, resetDraft, hydrated, savedAt]
  );

  return <ProtocolDraftContext.Provider value={value}>{children}</ProtocolDraftContext.Provider>;
}

export function useProtocolDraft(): ProtocolDraftContextValue {
  const value = useContext(ProtocolDraftContext);
  if (!value) {
    throw new Error("useProtocolDraft must be used inside <ProtocolDraftProvider>");
  }
  return value;
}
