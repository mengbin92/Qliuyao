"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HexagramGlyph } from "./HexagramGlyph";
import type { Hexagram } from "@/lib/hexagrams";
import type { Trigram } from "@/lib/trigrams";

type Variant = "ben" | "bian" | "plain";

interface Props {
  binary: string;
  hex: Hexagram;
  lower: Trigram;
  upper: Trigram;
  changing?: number[];
  variant?: Variant;
  compact?: boolean;
  animate?: boolean;
}

const VARIANT_TAG: Record<Variant, { label: string; classes: string } | null> = {
  ben: {
    label: "本卦",
    classes: "from-gold-600/40 to-gold-800/40 text-gold-200 border-gold-500/40",
  },
  bian: {
    label: "变卦",
    classes: "from-quantum-700/40 to-quantum-900/40 text-quantum-200 border-quantum-500/40",
  },
  plain: null,
};

export function HexagramCard({
  binary,
  hex,
  lower,
  upper,
  changing = [],
  variant = "ben",
  compact = false,
  animate = true,
}: Props) {
  const variantTag = VARIANT_TAG[variant];
  const reduce = useReducedMotion();
  const shouldAnimate = animate && !reduce;

  return (
    <motion.div
      className={`scroll-card-elevated stamp-border relative min-w-0 flex flex-col gap-3 ${compact ? "p-3 lg:p-5" : "p-4 sm:p-6"}`}
      initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {variantTag && (
        <span
          className={`self-start rounded-md border bg-gradient-to-br px-3 py-1 font-display text-xs tracking-[0.18em] ${variantTag.classes}`}
        >
          {variantTag.label}
        </span>
      )}

      {compact ? (
        <CompactContent
          binary={binary}
          hex={hex}
          lower={lower}
          upper={upper}
          changing={changing}
        />
      ) : (
        <FullContent binary={binary} hex={hex} lower={lower} upper={upper} changing={changing} animate={shouldAnimate} />
      )}
    </motion.div>
  );
}

function CompactContent({
  binary,
  hex,
  lower,
  upper,
  changing = [],
}: Omit<Props, "variant" | "compact" | "animate">) {
  const changingLines = [...hex.lines].reverse().filter((_, revIdx) => changing.includes(5 - revIdx));

  return (
    <>
      <div className="mt-1 flex items-center justify-between gap-1 lg:gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl text-gold-100 lg:text-2xl">{hex.name}</span>
          </div>
          <p className="mt-1 truncate text-xs text-ink-300">
            <span className="font-mono">No.{hex.num}</span>
            <span className="mx-1.5 text-ink-500">·</span>
            <span className="italic">{hex.pinyin}</span>
          </p>
        </div>
        <div className="shrink-0 [&_svg]:h-[58px] [&_svg]:w-12 lg:[&_svg]:h-24 lg:[&_svg]:w-20">
          <HexagramGlyph binary={binary} changing={changing} size="sm" />
        </div>
      </div>

      <div className="rounded-md border border-gold-500/20 bg-ink-900/40 p-2.5 lg:px-3.5 lg:py-3">
        <p className="mb-1 font-display text-[11px] tracking-[0.12em] text-gold-400">卦辞</p>
        <p className="font-serif text-sm leading-relaxed text-ink-100">{hex.judgment}</p>
      </div>

      <p className="text-[11px] text-ink-400">
        上{upper.name} {upper.symbol} · 下{lower.name} {lower.symbol}
      </p>

      {changingLines.length > 0 && (
        <details className="rounded-md border border-cinnabar-500/30 bg-cinnabar-700/10 px-2.5">
          <summary className="min-h-11 cursor-pointer py-3 font-display text-xs text-cinnabar-400">动爻（{changingLines.length}）</summary>
          <ul className="space-y-1 pb-3 font-serif text-xs leading-relaxed text-ink-100">
            {changingLines.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}
          </ul>
        </details>
      )}
    </>
  );
}

function FullContent({
  binary,
  hex,
  lower,
  upper,
  changing = [],
  animate,
}: Omit<Props, "variant" | "compact">) {
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-5xl text-gold-200">{hex.symbol}</span>
            <span className="font-display text-3xl text-gold-100">{hex.name}</span>
          </div>
          <p className="mt-1 text-sm text-ink-300">
            <span className="font-mono">No.{hex.num}</span>
            <span className="mx-2 text-ink-400">·</span>
            <span className="italic">{hex.pinyin}</span>
            <span className="mx-2 text-ink-400">·</span>
            <span>
              上{upper.name}
              <span className="mx-1 text-ink-400">{upper.symbol}</span>下{lower.name}
              <span className="mx-1 text-ink-400">{lower.symbol}</span>
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-400">
            {upper.element}/{upper.attribute} · {lower.element}/{lower.attribute}
          </p>
        </div>
        <HexagramGlyph binary={binary} changing={changing} size="md" animate={animate} />
      </div>

      <div className="rounded-md border border-gold-500/20 bg-ink-900/40 px-4 py-3">
        <p className="mb-1 font-display text-xs tracking-[0.12em] text-gold-400">卦辞</p>
        <p className="font-serif text-base leading-relaxed text-ink-100">{hex.judgment}</p>
      </div>

      {hex.tuan && (
        <div className="rounded-md border border-ink-700/60 bg-ink-900/30 px-4 py-3">
          <p className="mb-1 font-display text-xs tracking-[0.12em] text-gold-400">彖传</p>
          <p className="font-serif text-sm leading-relaxed text-ink-200">{hex.tuan}</p>
        </div>
      )}

      {hex.daXiang && (
        <div className="rounded-md border border-ink-700/60 bg-ink-900/30 px-4 py-3">
          <p className="mb-1 font-display text-xs tracking-[0.12em] text-gold-400">大象传</p>
          <p className="font-serif text-sm leading-relaxed text-ink-200">{hex.daXiang}</p>
        </div>
      )}

      <div>
        <p className="mb-2 font-display text-xs tracking-[0.12em] text-gold-400">六爻爻辞</p>
        <ul className="space-y-1.5 font-serif text-sm leading-relaxed">
          {[...hex.lines].reverse().map((line, revIdx) => {
            const idx = 5 - revIdx; // 自上而下显示
            const isChanging = changing.includes(idx);
            return (
              <li
                key={idx}
                className={`flex gap-2 rounded px-2 py-1.5 ${
                  isChanging
                    ? "bg-cinnabar-700/15 ring-1 ring-cinnabar-500/30 text-ink-100"
                    : "text-ink-200"
                }`}
              >
                <span className="shrink-0 text-cinnabar-400">{isChanging ? "★" : "·"}</span>
                <span>{line}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {hex.extra && (
        <div className="rounded-md border border-cinnabar-500/30 bg-cinnabar-700/10 px-4 py-3">
          <p className="mb-1 font-display text-xs tracking-[0.12em] text-cinnabar-400">用</p>
          <p className="font-serif text-sm leading-relaxed text-ink-100">{hex.extra}</p>
        </div>
      )}
    </>
  );
}
