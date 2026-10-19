import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, ServerCrash, Database } from 'lucide-react';

export const ServiceStatusContext = createContext({
  isLive: false,
  isReady: false,
  isChecking: false,
  checkFailed: false,
  statusMessage: '',
  retryCheck: () => {}
});

export const useServiceStatus = () => useContext(ServiceStatusContext);

function getEndpointUrl(endpoint) {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || envUrl === '/api') {
    return endpoint;
  }
  const normalized = envUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  return `${normalized}${endpoint}`;
}

const MAX_PROBE_ATTEMPTS = 4;
const BASE_DELAYS = [1000, 2000, 4000, 8000];

export default function StartupGate({ children }) {
  const [isLive, setIsLive] = useState(true); // Optimistic: Shell renders immediately
  const [isReady, setIsReady] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Connecting to RaktOra services...');
  const [showBanner, setShowBanner] = useState(false);

  const attemptRef = useRef(0);
  const timerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const performCheck = useCallback(async () => {
    if (!isMountedRef.current) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsChecking(true);

    try {
      // 1. Distinct Liveness Probe (Does Express process respond?)
      const healthUrl = getEndpointUrl('/health');
      const healthRes = await fetch(healthUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      }).catch(() => null);

      if (!isMountedRef.current) return;

      if (!healthRes || !healthRes.ok) {
        // Backend process is completely unreachable
        setIsLive(false);
        setIsReady(false);
        setStatusMessage('Backend service offline or unreachable. Informational pages remain accessible.');
        setShowBanner(true);
        scheduleNextProbe();
        return;
      }

      setIsLive(true);

      // 2. Distinct Readiness Probe (Is database connection ready?)
      const readyUrl = getEndpointUrl('/ready');
      const readyRes = await fetch(readyUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      }).catch(() => null);

      if (!isMountedRef.current) return;

      if (readyRes && readyRes.ok) {
        const data = await readyRes.json().catch(() => ({}));
        if (data.status === 'ready' || data.status === 'ok') {
          setIsReady(true);
          setShowBanner(false);
          setIsChecking(false);
          setCheckFailed(false);
          cleanup();
          return;
        }
      }

      // Live but database unready (e.g. 503 during cold-start or connection wait)
      setIsReady(false);
      setStatusMessage('Backend online, but database connection is initializing.');
      setShowBanner(true);
      scheduleNextProbe();

    } catch (err) {
      if (!isMountedRef.current) return;
      setIsLive(false);
      setIsReady(false);
      setStatusMessage('Unable to connect to backend service.');
      setShowBanner(true);
      scheduleNextProbe();
    }
  }, [cleanup]);

  const scheduleNextProbe = useCallback(() => {
    if (!isMountedRef.current) return;

    attemptRef.current += 1;
    if (attemptRef.current >= MAX_PROBE_ATTEMPTS) {
      setIsChecking(false);
      setCheckFailed(true);
      cleanup();
      return;
    }

    const delay = BASE_DELAYS[attemptRef.current - 1] || 8000;
    timerRef.current = setTimeout(() => {
      performCheck();
    }, delay);
  }, [cleanup, performCheck]);

  const retryCheck = useCallback(() => {
    cleanup();
    attemptRef.current = 0;
    setCheckFailed(false);
    setIsChecking(true);
    performCheck();
  }, [cleanup, performCheck]);

  useEffect(() => {
    isMountedRef.current = true;
    performCheck();

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [performCheck, cleanup]);

  return (
    <ServiceStatusContext.Provider
      value={{
        isLive,
        isReady,
        isChecking,
        checkFailed,
        statusMessage,
        retryCheck
      }}
    >
      {/* Non-blocking Connection Notice Banner */}
      {showBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`w-full text-xs font-semibold px-4 py-2.5 flex items-center justify-between border-b transition-colors ${
            !isLive
              ? 'bg-amber-950 text-amber-200 border-amber-800'
              : 'bg-slate-900 text-slate-200 border-slate-800'
          }`}
        >
          <div className="flex items-center space-x-2 max-w-4xl mx-auto flex-1">
            {!isLive ? (
              <ServerCrash className="w-4 h-4 text-amber-400 flex-shrink-0" />
            ) : (
              <Database className="w-4 h-4 text-sky-400 flex-shrink-0" />
            )}
            <span className="truncate">{statusMessage}</span>
            {isChecking && (
              <span className="inline-flex items-center text-slate-400 text-[11px] ml-2">
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                Connecting...
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
            <button
              onClick={retryCheck}
              disabled={isChecking}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
            <button
              onClick={() => setShowBanner(false)}
              className="px-2 py-0.5 text-slate-400 hover:text-white text-xs"
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* The Application Shell Renders Immediately without being blocked */}
      {children}
    </ServiceStatusContext.Provider>
  );
}
