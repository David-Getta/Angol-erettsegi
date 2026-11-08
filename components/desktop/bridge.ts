"use client";

import { useEffect, useState } from "react";
import type { DesktopApi, DesktopInfo, UpdateState } from "@/desktop/shared";

/** The Electron bridge, or null in a plain browser (and during server rendering). */
export function getDesktop(): DesktopApi | null {
  return typeof window !== "undefined" && window.desktop ? window.desktop : null;
}

/** Same as getDesktop(), but only after hydration so server and client markup agree. */
export function useDesktop(): DesktopApi | null {
  const [api, setApi] = useState<DesktopApi | null>(null);
  useEffect(() => {
    setApi(getDesktop());
  }, []);
  return api;
}

export function useDesktopInfo(): { api: DesktopApi | null; info: DesktopInfo | null; refresh: () => void } {
  const api = useDesktop();
  const [info, setInfo] = useState<DesktopInfo | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!api) return;
    let alive = true;
    api
      .info()
      .then((i) => alive && setInfo(i))
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, [api, tick]);
  return { api, info, refresh: () => setTick((n) => n + 1) };
}

/** Live update state pushed by the main process; null outside the desktop app. */
export function useUpdateState(): UpdateState | null {
  const api = useDesktop();
  const [state, setState] = useState<UpdateState | null>(null);
  useEffect(() => {
    if (!api) return;
    let alive = true;
    api.update
      .state()
      .then((s) => alive && setState(s))
      .catch(() => {});
    const off = api.update.onState((s) => alive && setState(s));
    return () => {
      alive = false;
      off();
    };
  }, [api]);
  return state;
}

/** Bytes → whole megabytes for the banner text (null when unknown). */
export function megabytes(size: number | null | undefined): number | null {
  return size && size > 0 ? Math.max(1, Math.round(size / (1024 * 1024))) : null;
}
