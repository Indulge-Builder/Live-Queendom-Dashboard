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
      className="flex items-center gap-2.5 bg-gradient-to-r from-yellow-600 to-yellow-400 text-black font-bold rounded-full px-7 py-2 xl:px-9 xl:py-2.5 shadow-[0_0_28px_rgba(234,179,8,0.45)] select-none flex-shrink-0"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20, delay }}
    >
      <Users className="w-[20px] h-[20px] xl:w-[26px] xl:h-[26px]" strokeWidth={2.5} />
      <AnimatedCounter
        value={count}
        className="font-baskerville text-[clamp(1.2rem,1.8vw,2.6rem)] leading-none tabular-nums"
        delay={delay * 1000 + 400}
      />
    </motion.div>
  );
}
