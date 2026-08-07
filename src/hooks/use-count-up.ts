import { useEffect, useState, useRef } from "react";

interface CountUpOptions {
  /** Target number to count up to */
  end: number;
  /** Duration in milliseconds (default: 1200) */
  duration?: number;
  /** Start counting from this value (default: 0) */
  start?: number;
  /** Delay before starting (ms, default: 0) */
  delay?: number;
  /** Number of decimal places (default: 0) */
  decimals?: number;
  /** Whether to start counting immediately or wait for trigger */
  autoStart?: boolean;
  /** Formatter function */
  formatter?: (value: number) => string;
}

/**
 * Animated number counter that counts up from start to end.
 * Uses requestAnimationFrame for smooth animation.
 */
export function useCountUp({
  end,
  duration = 1200,
  start = 0,
  delay = 0,
  decimals = 0,
  autoStart = true,
  formatter,
}: CountUpOptions) {
  const [value, setValue] = useState(start);
  const [started, setStarted] = useState(autoStart);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!started) return;

    // Respect reduced motion — skip animation
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setValue(end);
      return;
    }

    const delayTimer = setTimeout(() => {
      startTimeRef.current = undefined;

      function animate(timestamp: number) {
        if (startTimeRef.current === undefined) {
          startTimeRef.current = timestamp;
        }

        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = start + (end - start) * eased;

        setValue(currentValue);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setValue(end);
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(delayTimer);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [end, start, duration, delay, started]);

  const startAnimation = () => setStarted(true);
  const reset = () => {
    setStarted(false);
    setValue(start);
  };

  const formatted = formatter ? formatter(value) : value.toFixed(decimals);

  return {
    value,
    formatted,
    startAnimation,
    reset,
    isAnimating: value < end,
  };
}

/**
 * Counter hook that watches for element visibility before starting.
 */
export function useVisibilityCountUp(options: CountUpOptions & { threshold?: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: options.threshold ?? 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options.threshold]);

  const counter = useCountUp({ ...options, autoStart: visible });

  return { ref, ...counter };
}
