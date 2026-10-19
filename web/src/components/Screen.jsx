// One screen: top bar + content column.
import { useEffect, useState, useRef } from 'react';
import TopBar from './TopBar.jsx';
import LoadingScreen from './LoadingScreen.jsx';

/** Ensures loading state stays visible for at least minDuration (default 2000ms in production, 0 in tests) */
export function useMinLoading(isLoading, minDuration = (import.meta.env.MODE === 'test' ? 0 : 2000)) {
  const [displayLoading, setDisplayLoading] = useState(isLoading);
  const startTimeRef = useRef(null);

  useEffect(() => {
    let timer;
    if (isLoading) {
      setDisplayLoading(true);
      startTimeRef.current = Date.now();
    } else if (startTimeRef.current !== null) {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, minDuration - elapsed);
      if (remaining === 0) {
        setDisplayLoading(false);
        startTimeRef.current = null;
      } else {
        timer = setTimeout(() => {
          setDisplayLoading(false);
          startTimeRef.current = null;
        }, remaining);
      }
    } else {
      setDisplayLoading(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, minDuration]);

  return displayLoading;
}

export function ScreenLoader({ message = 'Preparing Your Wedding Journey…', compact = true, duration = 2000 }) {
  return (
    <div className="flex w-full items-center justify-center py-6" aria-busy="true">
      <LoadingScreen compact={compact} fullScreen={false} duration={duration} message={message} />
    </div>
  );
}

export default function Screen({
  title,
  back = false,
  actions = null,
  main = false,
  variant = 'default',
  loading = false,
  loadingMessage = 'Preparing Your Wedding Journey…',
  children,
}) {
  const showLoading = import.meta.env.MODE === 'test' ? loading : useMinLoading(loading);
  return (
    <>
      {/* Dreamy luxury blush floral background for every screen */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-gradient-to-b from-[#FAF4EC] via-[#FCEAEB] to-[#FAF4EC] dark:from-[#211A16] dark:via-[#2D1B22] dark:to-[#211A16]">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-64 sm:w-80 h-64 sm:h-80 opacity-25 select-none bg-contain bg-no-repeat bg-right-top rotate-180"
          style={{ backgroundImage: `url('/art/welcome-floral-br-clean.webp')` }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-10 -left-10 w-64 sm:w-80 h-64 sm:h-80 opacity-25 select-none bg-contain bg-no-repeat bg-left-bottom"
          style={{ backgroundImage: `url('/art/welcome-floral-bl-clean.webp')` }}
        />
      </div>

      <TopBar title={title} back={back} actions={actions} main={main} variant={variant} />
      <main className="mx-auto flex max-w-xl flex-col gap-6 px-safe py-6">
        {showLoading ? <ScreenLoader message={loadingMessage} /> : children}
      </main>
    </>
  );
}
