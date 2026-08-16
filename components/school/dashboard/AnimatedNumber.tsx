"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  format = (n) => n.toLocaleString("id-ID"),
  durationMs = 700,
  className = "",
}: AnimatedNumberProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => format(latest));
  const [displayVal, setDisplayVal] = useState<string>(format(value));

  useEffect(() => {
    const controls = animate(count, value, {
      duration: durationMs / 1000,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplayVal(format(latest));
      },
    });
    return () => controls.stop();
  }, [value, durationMs, count, format]);

  return <span className={className}>{displayVal}</span>;
}
