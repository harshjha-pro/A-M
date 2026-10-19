// LoadingScreen.jsx — Luxury A&M Wedding Planner loading screen.
// Features the royal groom on a decorated white horse, golden lotus divider,
// smooth animated progress bar, floating rose petals and Cormorant Garamond typography.
import { useState, useEffect } from 'react';

export default function LoadingScreen({
  message = 'Preparing Your Wedding Journey…',
  progress = null, // null for automatic smooth progression, or 0-100 for tracked
  duration = 2000, // target duration in ms (default 2000ms = 2s)
  fullScreen = true,
  compact = false,
  fadeOut = false,
  className = '',
}) {
  const [autoProgress, setAutoProgress] = useState(progress !== null ? progress : 0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (progress !== null || import.meta.env.MODE === 'test') {
      setAutoProgress(progress !== null ? progress : 100);
      return undefined;
    }

    let frameId;
    let startTime = performance.now();
    let faded = false;
    const fadeLeadTime = fadeOut ? 280 : 0;
    const fillDuration = Math.max(300, duration - fadeLeadTime);

    const step = (now) => {
      let elapsed = now - startTime;

      // In continuous loop mode (preview), reset cycle after 100% pause
      if (!fadeOut && elapsed > duration + 600) {
        startTime = now;
        elapsed = 0;
      }

      // Smooth progress curve: ease-out
      const progressRatio = Math.min(1, elapsed / fillDuration);
      const eased = 1 - Math.pow(1 - progressRatio, 2.2);
      const pct = Math.min(100, Math.round(eased * 100));
      setAutoProgress(pct);

      // Trigger smooth fade out in the final stretch if requested
      if (fadeOut && !faded && elapsed >= duration - fadeLeadTime) {
        faded = true;
        setIsFadingOut(true);
      }

      frameId = requestAnimationFrame(step);
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [progress, duration, fadeOut]);

  const currentPercent = progress !== null ? Math.min(100, Math.max(0, progress)) : autoProgress;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={`relative flex flex-col items-center justify-center select-none overflow-hidden bg-[#FBF7F0] dark:bg-[#17120F] transition-all duration-300 ${
        isFadingOut ? 'opacity-0 scale-[0.99] pointer-events-none' : 'opacity-100 scale-100'
      } ${
        fullScreen ? 'fixed inset-0 z-50 min-h-dvh w-full' : 'w-full py-12'
      } ${className}`}
    >
      {/* Subtle ambient luxury backdrop glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle at 50% 45%, rgba(232, 163, 23, 0.18) 0%, rgba(138, 28, 43, 0.05) 45%, transparent 70%)',
        }}
      />

      {/* Floating subtle rose petals */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[
          { top: '34%', left: '32%', delay: '0s', dur: '4.2s', size: 10 },
          { top: '38%', left: '68%', delay: '1.2s', dur: '4.8s', size: 8 },
          { top: '48%', left: '26%', delay: '0.6s', dur: '3.9s', size: 11 },
          { top: '44%', left: '72%', delay: '2.1s', dur: '5.1s', size: 9 },
          { top: '52%', left: '38%', delay: '1.8s', dur: '4.4s', size: 7 },
          { top: '50%', left: '62%', delay: '2.7s', dur: '4.0s', size: 10 },
        ].map((p, i) => (
          <span
            key={i}
            className="absolute rounded-full opacity-0 am-petal-drift"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size * 0.7,
              backgroundColor: '#A32A3E',
              boxShadow: '0 0 6px rgba(163, 42, 62, 0.4)',
              animationDelay: p.delay,
              animationDuration: p.dur,
              transform: 'rotate(-25deg)',
            }}
          />
        ))}
      </div>

      <div className={`relative z-10 flex flex-col items-center px-6 ${compact ? 'scale-85' : 'max-w-md w-full'}`}>
        {/* 1. A&M Monogram with Floral Wreath */}
        <div className="mb-3 flex flex-col items-center">
          <img
            src="/art/loading-monogram.png"
            alt="A&M Monogram"
            width={130}
            height={68}
            className="h-14 w-auto object-contain drop-shadow-[0_2px_8px_rgba(201,168,106,0.25)] transition-transform duration-700 hover:scale-105"
            onError={(e) => {
              // Graceful fallback if image is loading
              e.currentTarget.style.display = 'none';
              if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{ display: 'none' }} className="flex-col items-center">
            <span className="font-display text-2xl tracking-widest text-[#8A1C2B] dark:text-[#F2A7AF]">A&amp;M</span>
            <div className="mt-1 h-[1px] w-12 bg-gradient-to-r from-transparent via-[#C9A86A] to-transparent" />
          </div>
        </div>

        {/* 2. Royal Groom on White Horse with Gentle Trot Animation */}
        <div className="relative my-2 flex items-center justify-center">
          {/* Subtle pulsating golden halo */}
          <div
            className="pointer-events-none absolute h-52 w-52 rounded-full opacity-30 blur-2xl dark:opacity-20"
            style={{
              background: 'radial-gradient(circle, rgba(201, 168, 106, 0.5) 0%, rgba(138, 28, 43, 0.2) 60%, transparent 80%)',
            }}
          />

          {/* Horse + Groom Image container with trot keyframe */}
          <div className="am-royal-trot relative">
            <img
              src="/art/loading-horse.webp"
              alt="Royal groom on decorated white horse"
              width={340}
              height={245}
              className="relative z-10 h-auto max-h-[220px] w-auto max-w-[320px] object-contain drop-shadow-[0_12px_24px_rgba(42,31,26,0.14)]"
            />
          </div>

          {/* Dynamic horse ground shadow */}
          <div
            className="am-horse-shadow absolute bottom-1 h-3.5 w-48 rounded-full"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(42, 31, 26, 0.22) 0%, rgba(42, 31, 26, 0.05) 60%, transparent 85%)',
            }}
          />
        </div>

        {/* 3. Golden Lotus Divider */}
        <div className="my-3 flex w-full max-w-[280px] items-center justify-center gap-3">
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-[#C9A86A] to-[#C9A86A]/80" />
          <svg
            width="22"
            height="16"
            viewBox="0 0 24 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-[#C9A86A] drop-shadow-[0_1px_3px_rgba(201,168,106,0.4)]"
          >
            {/* Elegant Lotus Center Petal */}
            <path
              d="M12 2C12 2 10 7 10 11C10 13.5 11 15 12 15C13 15 14 13.5 14 11C14 7 12 2 12 2Z"
              fill="currentColor"
            />
            {/* Left Petal */}
            <path
              d="M10.5 6C10.5 6 6.5 9 6.5 12.5C6.5 14.5 8 15.5 9.5 15C10.5 14.6 11 13.5 11.2 12C11 10 10.5 6 10.5 6Z"
              fill="currentColor"
              opacity="0.9"
            />
            {/* Right Petal */}
            <path
              d="M13.5 6C13.5 6 17.5 9 17.5 12.5C17.5 14.5 16 15.5 14.5 15C13.5 14.6 13 13.5 12.8 12C13 10 13.5 6 13.5 6Z"
              fill="currentColor"
              opacity="0.9"
            />
            {/* Outer Left Leaf */}
            <path
              d="M7 10.5C7 10.5 3 12 3 14C3 15.5 4.5 16 6 15.5C7.2 15 8 13.8 8.2 13C7.5 12 7 10.5 7 10.5Z"
              fill="currentColor"
              opacity="0.75"
            />
            {/* Outer Right Leaf */}
            <path
              d="M17 10.5C17 10.5 21 12 21 14C21 15.5 19.5 16 18 15.5C16.8 15 16 13.8 15.8 13C16.5 12 17 10.5 17 10.5Z"
              fill="currentColor"
              opacity="0.75"
            />
          </svg>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-[#C9A86A] to-[#C9A86A]/80" />
        </div>

        {/* 4. Luxury Golden Rounded Progress Bar */}
        <div className="relative mt-1 mb-4 w-full max-w-[270px]">
          {/* Progress Bar Container with Champagne Gold Border */}
          <div
            className="relative h-3 w-full overflow-hidden rounded-full p-[1.5px]"
            style={{
              background: 'linear-gradient(135deg, #D4AF37 0%, #E8D3A2 40%, #B89230 70%, #E2C275 100%)',
              boxShadow: '0 2px 8px rgba(201, 168, 106, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.5)',
            }}
          >
            {/* Inner track */}
            <div className="relative h-full w-full overflow-hidden rounded-full bg-[#FAF5EC] dark:bg-[#201815]">
              {/* Fill bar with deep burgundy to royal crimson gradient */}
              <div
                className="h-full rounded-full transition-all duration-75 ease-out"
                style={{
                  width: `${currentPercent}%`,
                  background: 'linear-gradient(90deg, #6B1522 0%, #8A1C2B 55%, #B3263E 90%, #C9A86A 100%)',
                  boxShadow: '0 0 10px rgba(138, 28, 43, 0.6)',
                }}
              >
                {/* Shimmer light traversing the progress fill */}
                <div
                  className="am-progress-shimmer absolute inset-0 rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.45) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Golden Particle Glint at the Progress Tip */}
          {currentPercent > 5 && currentPercent < 98 && (
            <div
              className="pointer-events-none absolute top-1/2 -translate-y-1/2"
              style={{
                left: `calc(${currentPercent}% - 6px)`,
                transition: 'left 75ms ease-out',
              }}
            >
              <span className="block h-3 w-3 rounded-full bg-white opacity-90 blur-[1px] shadow-[0_0_8px_#E8A317]" />
            </div>
          )}
        </div>

        {/* 5. Elegant Typography: "Preparing Your Wedding Journey…" */}
        <p
          className="font-display text-lg tracking-[0.04em] text-[#8A1C2B] dark:text-[#F2A7AF] sm:text-xl transition-colors"
          style={{
            textShadow: '0 1px 2px rgba(138, 28, 43, 0.08)',
          }}
        >
          {message}
        </p>

        {/* Subtle decorative dot flourish */}
        <div className="mt-2 flex items-center justify-center gap-1.5 opacity-60">
          <span className="h-1 w-1 rounded-full bg-[#C9A86A]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#8A1C2B] dark:bg-[#F2A7AF]" />
          <span className="h-1 w-1 rounded-full bg-[#C9A86A]" />
        </div>
      </div>
    </div>
  );
}
