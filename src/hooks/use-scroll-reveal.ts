import { useEffect, useRef, useState, useCallback } from "react";

interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.1,
  rootMargin = "0px 0px -40px 0px",
  triggerOnce = true,
}: ScrollRevealOptions = {}) {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          if (triggerOnce) observer.unobserve(el);
        } else if (!triggerOnce) {
          setRevealed(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return { ref, revealed };
}

/**
 * Animate a single element fade-up when it enters the viewport.
 * Usage: <div ref={ref} className={revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}>
 */
export function useFadeInUp<T extends HTMLElement = HTMLDivElement>(options?: ScrollRevealOptions) {
  const { ref, revealed } = useScrollReveal<T>(options);
  return { ref, revealed };
}

/**
 * Staggered children reveal hook. Returns a container ref and a `revealed` boolean.
 * When the container enters view, all children get the `revealed` class.
 */
export function useStaggeredReveal<T extends HTMLElement = HTMLDivElement>(
  options?: ScrollRevealOptions,
) {
  const { ref, revealed } = useScrollReveal<T>(options);
  return { ref, revealed };
}

/**
 * CSS-only staggered reveal. Returns a function to generate className with stagger delay.
 */
export function useStaggeredDelay(index: number, baseDelay = 50) {
  const delay = baseDelay * index;
  return useCallback((baseClass: string) => `${baseClass}`, [index]);
}
