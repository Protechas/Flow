"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedMetricProps {
  value: string | number;
  className?: string;
  duration?: number;
}

function parseMetric(value: string | number) {
  const raw = String(value);
  const match = raw.match(/^(-?[\d.]+)(.*)$/);
  const numeric = match ? parseFloat(match[1]) : NaN;
  const suffix = match?.[2] ?? "";
  const isNumeric = !Number.isNaN(numeric);
  return { raw, numeric, suffix, isNumeric };
}

function formatMetric(n: number) {
  return n % 1 !== 0 ? n.toFixed(1) : String(Math.round(n));
}

export function AnimatedMetric({ value, className, duration = 700 }: AnimatedMetricProps) {
  const { raw, numeric, suffix, isNumeric } = parseMetric(value);
  const [display, setDisplay] = useState(() => (isNumeric ? formatMetric(numeric) : raw));
  const isFirst = useRef(true);

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(raw);
      return;
    }

    if (isFirst.current) {
      isFirst.current = false;
      setDisplay(formatMetric(numeric));
      return;
    }

    const target = numeric;
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(formatMetric(eased * target));
      if (t < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, raw, numeric, isNumeric, duration]);

  return (
    <span className={cn("tabular-nums", className)}>
      {display}
      {suffix}
    </span>
  );
}
