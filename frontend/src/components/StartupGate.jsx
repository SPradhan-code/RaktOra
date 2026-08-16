import React, { useState, useEffect, useRef, useCallback } from 'react';
import RaktOraLogo from './RaktOraLogo';
import { RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';

/**
 * Resolves the canonical readiness URL depending on deployment configuration.
 * Handles both relative '/api' (same-origin / Render unified deployment)
 * and absolute 'https://api.example.com/api' cross-origin deployments.
 */
function getReadinessUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || envUrl === '/api') {
    return '/ready';
  }
  // Remove trailing /api or / from configured baseURL to hit /ready
  const normalized = envUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  return `${normalized}/ready`;
}

/**
 * Computes backoff delay (in ms) given the current attempt number.
 * Attempt 1: 1000ms, Attempt 2: 2000ms, Attempt 3: 3000ms, Attempt 4: 4000ms, Max: 5000ms
 */
function getBackoffDelay(attempt) {
  const delaySec = Math.min(attempt, 5);
  return delaySec * 1000;
}

const MAX_WAIT_TIME_MS = 75000; // 75 seconds overall maximum timeout
const PER_REQUEST_TIMEOUT_MS = 5000; // 5 seconds per probe

export default function StartupGate({ children }) {
  const [isReady, setIsReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isProbing, setIsProbing] = useState(false);

  const isReadyRef = useRef(false);
  const attemptCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const activeAbortControllerRef = useRef(null);
  const timerRef = useRef(null);
  const tickIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Status message strictly based on elapsed waiting time (honest, no fake internal telemetry)
  const getStatusMessage = (seconds) => {
    if (seconds < 10) {
      return 'Connecting to secure services...';
    } else if (seconds < 30) {
      return 'Our services are starting up...';
    } else {
      return 'Still starting. Thanks for your patience...';
    }
  };

  const cleanup = useCallback(() => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickIntervalRef.current) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  const probeReadiness = useCallback(async () => {
    if (!isMountedRef.current || isReadyRef.current) return;

    // Check if max overall timeout has been exceeded
    const totalElapsed = Date.now() - startTimeRef.current;
    if (totalElapsed >= MAX_WAIT_TIME_MS) {
      cleanup();
      if (isMountedRef.current) {
        setHasTimedOut(true);
        setIsProbing(false);
      }
      return;
    }

    // Cancel any previous in-flight request
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    // Set timeout to abort this individual attempt
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, PER_REQUEST_TIMEOUT_MS);

    setIsProbing(true);
    attemptCountRef.current += 1;

    try {
      const url = getReadinessUrl();
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!isMountedRef.current) return;

      if (response.status === 200) {
        const data = await response.json().catch(() => ({}));
        if (data.status === 'ready' || data.status === 'ok') {
          cleanup();
          isReadyRef.current = true;
          setIsReady(true);
          return;
        }
      }

      // Backend responded but not yet ready (e.g. 503 or waking up)
      scheduleNextProbe();
    } catch (err) {
      clearTimeout(timeoutId);
      if (!isMountedRef.current) return;

      // Network error, connection refused, or aborted probe -> retry with backoff
      scheduleNextProbe();
    }
  }, [cleanup]);

  const scheduleNextProbe = useCallback(() => {
    if (!isMountedRef.current || isReadyRef.current) return;

    const delay = getBackoffDelay(attemptCountRef.current);
    timerRef.current = setTimeout(() => {
      probeReadiness();
    }, delay);
  }, [probeReadiness]);

  const startReadinessSequence = useCallback(() => {
    cleanup();
    isReadyRef.current = false;
    setIsReady(false);
    setHasTimedOut(false);
    setElapsedSeconds(0);
    attemptCountRef.current = 0;
    startTimeRef.current = Date.now();

    // Start 1-second interval ticker for UI elapsed time tracking
    tickIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);

      if (Date.now() - startTimeRef.current >= MAX_WAIT_TIME_MS) {
        cleanup();
        setHasTimedOut(true);
        setIsProbing(false);
      }
    }, 1000);

    // Initial immediate probe
    probeReadiness();
  }, [cleanup, probeReadiness]);

  useEffect(() => {
    isMountedRef.current = true;
    startReadinessSequence();

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [startReadinessSequence, cleanup]);

  // If backend is verified ready, render the application
  if (isReady) {
    return <>{children}</>;
  }

  // If timeout occurred, show user-friendly recovery UI
  if (hasTimedOut) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center p-4 selection:bg-red-500 selection:text-white">
        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl text-center">
          <div className="mx-auto w-16 h-16 bg-red-950/60 border border-red-800/60 rounded-2xl flex items-center justify-center mb-6 text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold text-slate-100 mb-2 tracking-tight">
            Connection Timeout
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            We're having trouble connecting to RaktOra right now. Please try again.
          </p>

          <button
            onClick={startReadinessSequence}
            className="w-full inline-flex items-center justify-center space-x-2 py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-900/30 active:scale-[0.98] transition duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  // Branded RaktOra Startup & Cold-Start Screen
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Subtle Background Glow Elements */}
      <div className="absolute w-96 h-96 bg-red-600/10 rounded-full blur-3xl -top-20 -left-20 pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute w-96 h-96 bg-rose-600/10 rounded-full blur-3xl -bottom-20 -right-20 pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />

      <div className="max-w-md w-full flex flex-col items-center text-center relative z-10">
        {/* Animated Brand Logo with Pulsing Halo */}
        <div className="relative mb-8 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-red-600/20 blur-xl scale-125 motion-safe:animate-ping" style={{ animationDuration: '3s' }} />
          <div className="relative p-3 bg-slate-900/90 border border-slate-800/80 rounded-3xl shadow-2xl backdrop-blur-md">
            <RaktOraLogo size={72} showText={false} />
          </div>
        </div>

        {/* Brand Name */}
        <div className="mb-6">
          <span className="text-3xl font-black tracking-tight text-white inline-flex items-center">
            Rakt<span className="text-red-500">Ora</span>
          </span>
          <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mt-1">
            National Voluntary Blood Network
          </div>
        </div>

        {/* Primary Heading */}
        <h1 className="text-xl md:text-2xl font-bold text-slate-100 mb-2.5 tracking-tight">
          Starting RaktOra securely...
        </h1>

        {/* Supporting Text */}
        <p className="text-slate-400 text-sm leading-relaxed max-w-sm mb-8">
          Our services are waking up. This can take a moment on the first visit.
        </p>

        {/* Accessible Dynamic Status Message */}
        <div
          role="status"
          aria-live="polite"
          className="w-full bg-slate-900/70 border border-slate-800 rounded-xl py-3 px-4 flex items-center justify-center space-x-3 shadow-inner"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 motion-safe:animate-pulse" />
          <span className="text-sm font-medium text-slate-300">
            {getStatusMessage(elapsedSeconds)}
          </span>
        </div>

        {/* Security & Reliability Badge */}
        <div className="mt-12 flex items-center space-x-1.5 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-500/80" />
          <span>Encrypted Session & FEFO Blood Inventory Engine</span>
        </div>
      </div>
    </div>
  );
}
