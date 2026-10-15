"use client";

import { useEffect } from "react";

export function SessionCachePrimer() {
  useEffect(() => {
    const controller = new AbortController();

    function primeSessionCache(forceFresh = false) {
      const suffix = forceFresh ? "?disableCookieCache=true" : "";
      void fetch(`/api/auth/get-session${suffix}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      }).catch(() => undefined);
    }

    primeSessionCache();
    const refreshTimer = window.setInterval(() => primeSessionCache(true), 4 * 60 * 1000);

    return () => {
      window.clearInterval(refreshTimer);
      controller.abort();
    };
  }, []);

  return null;
}
