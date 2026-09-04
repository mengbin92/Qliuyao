"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Atom, Alert, Taiji, TaijiSeal } from "./Icon";
import { cn } from "@/lib/utils";

/**
 * 首页英雄区。克制路线：
 *
 *   - 中央太极印章一次性入场（缩放+淡入）
 *   - 背后一层极淡的暖色辉光，不重复呼吸
 *   - 没有粒子、没有罗盘、没有干涉条纹
 *   - 标题与 CTA 错峰浮入
 */
export function Hero({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <header
      className={cn(
        "relative overflow-hidden",
        compact ? "py-1 lg:py-8" : "pb-12 pt-14 md:pb-20 md:pt-24"
      )}
    >
      <Backdrop />
      <div className={cn("relative z-10", !compact && "mx-auto max-w-6xl px-5")}>
        <div className={cn("flex flex-col", compact ? "items-start text-left" : "items-center text-center")}>
          <motion.div
            initial={reduce ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className={cn("relative", compact ? "mb-4 hidden lg:block" : "mb-8")}
          >
            <Seal compact={compact} />
          </motion.div>

          <motion.p
            initial={reduce ? false : { y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.55 }}
            className="font-display text-[11px] tracking-[0.2em] text-gold-400 md:text-xs"
          >
            QUANTUM · LIUYAO · 量子六爻
          </motion.p>

          <motion.h1
            initial={reduce ? false : { y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.65 }}
            className={cn(
              "mt-3 font-display leading-[1.05] tracking-wide text-gold-100",
              compact ? "text-2xl leading-tight sm:text-3xl lg:text-5xl" : "text-5xl md:text-7xl"
            )}
          >
            <span className="block">把铜钱换成<span className="text-quantum-gradient">量子比特</span></span>
            <span className={cn("mt-2 block text-gold-200", compact ? "text-xl lg:text-3xl" : "text-3xl md:mt-3 md:text-5xl")}>
              让 AI 替你<span className="text-gold-gradient">解卦</span>
            </span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.65 }}
            className={cn(
              "mt-4 max-w-xl text-sm leading-relaxed text-ink-200 md:text-base",
              !compact && "mx-auto mt-6"
            )}
          >
            一个量子计算与《周易》的跨界实验。以六爻为起点，结合经典经文，获得一段白话解读。
          </motion.p>

          <motion.div
            initial={reduce ? false : { y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.78, duration: 0.65 }}
            className={cn(
              "mt-5 flex flex-wrap gap-2.5 text-[13px]",
              compact ? "hidden justify-start lg:flex" : "items-center justify-center"
            )}
          >
            <Link href="/quantum" className="hero-chip hero-chip-quantum">
              <Atom size={14} />
              <span>量子电路</span>
            </Link>
            <Link href="/about" className="hero-chip hero-chip-gold">
              <Taiji size={14} />
              <span>项目缘起</span>
            </Link>
            <Link href="/disclaimer" className="hero-chip hero-chip-cinnabar">
              <Alert size={14} />
              <span>免责声明</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </header>
  );
}

/**
 * 中央印章 —— 一层极淡的暖色辉光 + 太极图。无脉动、无旋转。
 */
function Seal({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("relative grid place-items-center", compact ? "h-20 w-20 md:h-24 md:w-24" : "h-28 w-28 md:h-32 md:w-32")}>
      <span
        aria-hidden
        className="absolute -inset-6 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(10,132,255,0.16) 0%, rgba(10,132,255,0) 65%)",
        }}
      />
      <div className="relative grid h-full w-full place-items-center text-gold-200">
        <TaijiSeal size={compact ? 84 : 112} />
      </div>
    </div>
  );
}

/**
 * 背景：一层极淡的金色径向晕染，把内容区从纯黑底中托起来。
 * 不动、不闪、不显眼。
 */
function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-0"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(10,132,255,0.07) 0%, rgba(10,132,255,0) 70%)",
      }}
    />
  );
}
