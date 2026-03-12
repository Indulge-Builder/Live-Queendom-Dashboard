"use client";

import { motion } from "framer-motion";
import { Users } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";

interface GoldPillProps {
  count: number;
  delay?: number;
}

export default function GoldPill({ count, delay = 0 }: GoldPillProps) {
  return (
    <motion.div
      className="flex items-center gap-2.5 rounded-full select-none flex-shrink-0"
      style={{
        padding: "clamp(6px,0.55vw,10px) clamp(18px,2vw,36px)",
        background: "rgba(14, 11, 8, 0.82)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1.5px solid rgba(201,168,76,0.55)",
        boxShadow:
          "0 0 18px rgba(201,168,76,0.28), 0 0 48px rgba(201,168,76,0.10), inset 0 0 20px rgba(201,168,76,0.05)",
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay }}
    >
      <Users
        style={{
          width: "clamp(14px,1.3vw,22px)",
          height: "clamp(14px,1.3vw,22px)",
          color: "rgba(201,168,76,0.75)",
          flexShrink: 0,
        }}
        strokeWidth={2}
      />
      <AnimatedCounter
        value={count}
        className="font-baskerville text-[clamp(1.3rem,2vw,3rem)] leading-none tabular-nums gold-glow"
        style={{ color: "#ECC96A" }}
        delay={delay * 1000 + 400}
      />
    </motion.div>
  );
}
