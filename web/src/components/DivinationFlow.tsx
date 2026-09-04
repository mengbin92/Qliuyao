"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState, useRef, type ReactNode } from "react";
import Link from "next/link";
import { QuantumCircuit } from "./QuantumCircuit";
import { HexagramCard } from "./HexagramCard";
import { StructureAnalysis } from "./StructureAnalysis";
import { DerivedHexagrams } from "./DerivedHexagrams";
import { Interpretation } from "./Interpretation";
import { saveHistory } from "@/lib/history";
import { ArrowRight, ArrowLeft, Copy, Check, Taiji } from "./Icon";
import { Reveal } from "./Reveal";
import { POSITION_NAME } from "@/lib/analysis";
import type { Yao } from "@/lib/quantum";
import type { DivineResult } from "@/lib/types";

type Phase = "ask" | "casting" | "results";

interface DivinationFlowProps {
  onPhaseChange?: (phase: Phase) => void;
}

const SUGGESTIONS = [
  "我是不是该接这个新的工作机会？",
  "这段感情还要继续走下去吗？",
  "现在是不是搬家的好时机？",
];

function waitForReveal(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function DivinationFlow({ onPhaseChange }: DivinationFlowProps) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [question, setQuestion] = useState("");
  const [step, setStep] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const [currentMeasure, setCurrentMeasure] = useState<string | null>(null);
  const [revealedYaos, setRevealedYaos] = useState<Yao[]>([]);
  const [result, setResult] = useState<DivineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const castRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);
  const reduce = useReducedMotion();
  const focusPhase = useCallback((node: HTMLDivElement | null) => {
    if (!node || !startedRef.current) return;
    node.focus({ preventScroll: true });
    node.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
  }, [reduce]);

  useEffect(() => () => castRef.current?.abort(), []);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  const cast = async () => {
    if (!question.trim() || castRef.current) return;
    const ctrl = new AbortController();
    castRef.current = ctrl;
    startedRef.current = true;
    setError(null);
    setPhase("casting");
    setStep(0);
    setCurrentMeasure(null);
    setResult(null);
    setRevealedYaos([]);

    // 先拿到 API 返回（含真实测量结果），再做"逐爻揭示"动画
    try {
      const r = await fetch("/api/divine", { method: "POST", signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as DivineResult;
      ctrl.signal.throwIfAborted();

      // 用真实结果做六次"测量动画"——视觉上是一爻一爻揭开
      for (let i = 0; !reduce && i < 6; i++) {
        setStep(i + 1);
        setMeasuring(true);
        setCurrentMeasure(null);
        await waitForReveal(320, ctrl.signal);
        // 把这一爻的真实 bitstring 放进电路图
        setCurrentMeasure(data.yaos[i].bitstring);
        setMeasuring(false);
        // 加入到已揭示爻列表
        setRevealedYaos((prev) => [...prev, data.yaos[i]]);
        await waitForReveal(240, ctrl.signal);
      }

      setResult(data);
      setPhase("results");
      saveHistory({
        id: data.castAt,
        castAt: data.castAt,
        question,
        benName: data.ben.hex.name,
        benSymbol: data.ben.hex.symbol,
        benBinary: data.ben.binary,
        bianName: data.bian?.hex.name,
        bianBinary: data.bian?.binary,
        moving: data.moving,
      });
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setError(e instanceof Error ? e.message : "起卦失败");
        setPhase("ask");
      }
    } finally {
      if (castRef.current === ctrl) castRef.current = null;
    }
  };

  const reset = () => {
    setPhase("ask");
    setQuestion("");
    setResult(null);
    setStep(0);
    setCurrentMeasure(null);
    setRevealedYaos([]);
    setError(null);
  };

  const cancelCast = () => {
    castRef.current?.abort();
    castRef.current = null;
    setPhase("ask");
    setStep(0);
    setCurrentMeasure(null);
    setRevealedYaos([]);
  };

  return (
    <div>
      <AnimatePresence mode="wait">
        {phase === "ask" && (
          <motion.div
            key="ask"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto max-w-3xl scroll-mt-24"
            ref={focusPhase}
            tabIndex={-1}
            aria-label="填写求问内容"
          >
            <AskCard
              question={question}
              setQuestion={setQuestion}
              onCast={cast}
              error={error}
            />
          </motion.div>
        )}

        {phase === "casting" && (
          <motion.div
            key="casting"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-auto max-w-4xl scroll-mt-24"
            ref={focusPhase}
            tabIndex={-1}
            aria-label="摇卦中"
          >
            <CastingCard
              question={question}
              step={step}
              measuring={measuring}
              measure={currentMeasure}
              revealedYaos={revealedYaos}
              onCancel={cancelCast}
            />
          </motion.div>
        )}

        {phase === "results" && result && (
          <motion.div
            key="results"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6 scroll-mt-24"
            ref={focusPhase}
            tabIndex={-1}
            aria-label="起卦结果"
          >
            <ResultsHeader question={question} onReset={reset} result={result} />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] lg:items-start">
              <div className="order-2 min-w-0 lg:order-1">
                <Reveal>
                  <Interpretation
                    question={question}
                    yaos={result.yaos}
                    benBin={result.ben.binary}
                    bianBin={result.bian?.binary || result.ben.binary}
                    autoStart
                  />
                </Reveal>
              </div>

              <aside className="result-summary order-1 grid min-w-0 grid-cols-2 gap-4 lg:order-2 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:grid-cols-1 lg:overflow-y-auto lg:p-1" aria-label="本卦与变卦摘要">
                <HexagramCard
                  binary={result.ben.binary}
                  hex={result.ben.hex}
                  lower={result.ben.lower}
                  upper={result.ben.upper}
                  changing={result.moving}
                  variant="ben"
                  compact
                />
                {result.bian ? (
                  <HexagramCard
                    binary={result.bian.binary}
                    hex={result.bian.hex}
                    lower={result.bian.lower}
                    upper={result.bian.upper}
                    changing={[]}
                    variant="bian"
                    compact
                  />
                ) : (
                  <NoChangeCard rule={result.rule} />
                )}
                <p className="col-span-full px-1 text-[11px] leading-relaxed text-ink-400">
                  先看 AI 解读，再按需展开经文与结构依据。
                </p>
              </aside>
            </div>

            <Reveal delay={0.025}>
              <DetailPanel
                title="经文原文"
                subtitle="卦辞 · 彖传 · 大象传 · 六爻爻辞"
                desc="完整保留本卦与变卦的经典文本，按需展开阅读。"
              >
                <div className={`grid gap-5 ${result.bian ? "lg:grid-cols-2" : ""}`}>
                  <HexagramCard
                    binary={result.ben.binary}
                    hex={result.ben.hex}
                    lower={result.ben.lower}
                    upper={result.ben.upper}
                    changing={result.moving}
                    variant="ben"
                    animate={false}
                  />
                  {result.bian ? (
                    <HexagramCard
                      binary={result.bian.binary}
                      hex={result.bian.hex}
                      lower={result.bian.lower}
                      upper={result.bian.upper}
                      changing={[]}
                      variant="bian"
                      animate={false}
                    />
                  ) : null}
                </div>
              </DetailPanel>
            </Reveal>

            <Reveal delay={0.05}>
              <DetailPanel
                title="卦象解析"
                subtitle="当位 · 中正 · 应位 · 承乘"
                desc="易学家用来判断卦象内在结构的几个关键概念。动爻有特别标记。"
              >
                <StructureAnalysis analysis={result.ben.analysis} changing={result.moving} />
              </DetailPanel>
            </Reveal>

            <Reveal delay={0.1}>
              <DetailPanel
                title="衍生卦"
                subtitle="互卦 · 错卦 · 综卦"
                desc="从本卦再演化出三个角度的参照卦。"
              >
                <DerivedHexagrams
                  hu={result.derived.hu}
                  cuo={result.derived.cuo}
                  zong={result.derived.zong}
                />
              </DetailPanel>
            </Reveal>

            <Footer onReset={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AskCard({
  question,
  setQuestion,
  onCast,
  error,
}: {
  question: string;
  setQuestion: (q: string) => void;
  onCast: () => void;
  error: string | null;
}) {
  const len = question.length;
  const max = 200;
  return (
    <div className="scroll-card-elevated stamp-border space-y-4 p-5 md:p-7">
      <div>
        <p className="font-display text-xs tracking-[0.18em] text-cinnabar-400">DIVINATION · 起卦</p>
        <h2 className="mt-2 font-display text-xl text-gold-200 md:text-2xl">
          沉静下来 · 把心里的事写下来
        </h2>
        <p className="mt-2 hidden font-serif text-sm italic leading-relaxed text-ink-300 lg:block">
          《系辞》：「易，无思也，无为也，寂然不动，感而遂通天下之故。」
        </p>
      </div>

      <div className="relative">
        <textarea
          aria-label="求问内容"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, max))}
          placeholder="例如：我应该接这个新项目吗？"
          rows={3}
          className="w-full resize-none rounded-md border border-ink-600/60 bg-ink-900/60 px-4 pt-3 pb-6 font-serif text-base leading-relaxed text-ink-100 placeholder:text-ink-400 focus:border-gold-400/60 focus:outline-none focus:ring-2 focus:ring-gold-500/20"
          maxLength={max}
        />
        <span className="absolute bottom-2 right-3 font-mono text-[10px] text-ink-400">
          {len} / {max}
        </span>
      </div>

      <div>
        <p className="mb-2 text-[11px] tracking-[0.12em] text-ink-400">参考问句</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setQuestion(s)}
              type="button"
              className="min-h-11 rounded-full border border-ink-600/50 bg-ink-900/40 px-3.5 py-1.5 text-[13px] leading-snug text-ink-200 transition hover:border-gold-500/40 hover:bg-ink-800/40 hover:text-gold-200 focus-visible:border-gold-500/60"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col-reverse items-center justify-between gap-3 border-t border-ink-700/40 pt-4 sm:flex-row">
        <p className="hidden text-[11px] text-ink-400 sm:block">
          量子电路 · 6 次 H<sup>⊗3</sup> + 单 shot 测量
        </p>
        <button
          type="button"
          className="btn-primary group w-full sm:w-auto"
          onClick={onCast}
          disabled={!question.trim()}
        >
          <span>开始起卦</span>
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
        </button>
      </div>

      <p className="text-xs leading-relaxed text-ink-400">
        仅供娱乐与文化反思，不作为重大决策依据。
        <Link href="/disclaimer" className="text-gold-300 underline underline-offset-2">免责声明</Link>
      </p>

      {error && (
        <div className="rounded-md border border-cinnabar-500/40 bg-cinnabar-700/15 px-4 py-3 text-sm text-cinnabar-300">
          {error}
        </div>
      )}
    </div>
  );
}

function CastingCard({
  question,
  step,
  measuring,
  measure,
  revealedYaos,
  onCancel,
}: {
  question: string;
  step: number;
  measuring: boolean;
  measure: string | null;
  revealedYaos: Yao[];
  onCancel: () => void;
}) {
  // 用已揭示的爻 + 还没揭示的占位，构造目前可见的卦象
  const visible = Array.from({ length: 6 }, (_, i) => revealedYaos[i] ?? null);
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5 md:order-1 order-2">
        <div className="scroll-card p-5">
          <p className="text-xs text-ink-300">求问</p>
          <p className="mt-1 break-words font-serif text-base text-ink-100">{question}</p>
        </div>

        <QuantumCircuit step={step} result={measure} measuring={measuring} />

        <div className="rounded-md border border-quantum-700/30 bg-quantum-900/20 p-5">
          <p className="font-display text-sm text-quantum-200">摇卦中 · 第 {step} / 6 次电路</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-300">
            每爻独立：3 个量子比特经 Hadamard 门进入 (|0⟩+|1⟩)/√2 的叠加态。
            三比特张量积形成 8 种本征态等概率叠加，单次测量后波函数坍缩。
            按 1 的个数对应「老阴 / 少阳 / 少阴 / 老阳」—— 与传统三铜钱卦法概率分布完全一致。
          </p>
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-8 rounded-full transition-all ${
                  i < revealedYaos.length
                    ? "bg-gold-400"
                    : i === step - 1 && measuring
                      ? "animate-pulse bg-gold-400"
                      : "bg-ink-700"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="scroll-card-elevated stamp-border order-1 flex flex-col items-center justify-start gap-4 p-6 md:order-2">
        <p className="font-display text-xs tracking-[0.18em] text-gold-300">CAST IN PROGRESS</p>
        <p className="text-[10px] text-ink-300">自下而上 · 初爻 → 上爻</p>

        <div className="my-2 flex w-full flex-col-reverse gap-1.5">
          {visible.map((y, i) => (
            <YaoSlot key={i} yao={y} index={i} pending={step <= i} />
          ))}
        </div>

        <p className="text-center text-[11px] text-ink-300">
          {revealedYaos.length === 6
            ? "✓ 卦象已成，正在分析…"
            : `已成 ${revealedYaos.length} / 6 爻`}
        </p>
        <button type="button" className="btn-ghost btn-sm w-full" onClick={onCancel}>
          中止起卦
        </button>
      </div>
    </div>
  );
}

function YaoSlot({
  yao,
  index,
  pending,
}: {
  yao: Yao | null;
  index: number;
  pending: boolean;
}) {
  const posName = POSITION_NAME[index];
  if (!yao) {
    return (
      <div
        className={`flex items-center gap-3 rounded-md border border-ink-700/40 bg-ink-900/30 px-3 py-2 text-xs ${
          pending ? "opacity-30" : "opacity-100"
        }`}
      >
        <span className="w-6 text-ink-400">{posName}</span>
        <span className="font-mono text-ink-500">| ? ⟩</span>
        <span className="ml-auto text-ink-500">未测</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45 }}
      className={`flex items-center gap-3 rounded-md border px-3 py-2 text-xs ${
        yao.isChanging
          ? "border-cinnabar-500/40 bg-cinnabar-700/15"
          : "border-gold-500/30 bg-gold-700/10"
      }`}
    >
      <span className="w-6 font-display text-gold-300">{posName}</span>
      <span className="font-mono text-quantum-200">|{yao.bitstring}⟩</span>
      <span className="font-display text-gold-200">{yao.name}</span>
      {yao.isChanging && (
        <span className="ml-auto rounded border border-cinnabar-500/40 px-1.5 py-0.5 font-display text-[9px] text-cinnabar-400">
          动爻
        </span>
      )}
    </motion.div>
  );
}

function ResultsHeader({
  question,
  onReset,
  result,
}: {
  question: string;
  onReset: () => void;
  result: DivineResult;
}) {
  const [copied, setCopied] = useState(false);

  const summary = () => {
    const parts: string[] = [];
    parts.push(`【量子六爻】`);
    parts.push(`求问：${question}`);
    parts.push(`本卦：${result.ben.hex.symbol} ${result.ben.hex.name}（${result.ben.hex.pinyin}）`);
    if (result.bian) {
      parts.push(`变卦：${result.bian.hex.symbol} ${result.bian.hex.name}（${result.bian.hex.pinyin}）`);
    }
    parts.push(
      `动爻：${
        result.moving.length === 0 ? "无" : result.moving.map((i) => `第${i + 1}爻`).join("、")
      }`
    );
    parts.push(`卦辞：${result.ben.hex.judgment}`);
    parts.push(`时间：${new Date(result.castAt).toLocaleString("zh-CN")}`);
    return parts.join("\n");
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* silent */
    }
  };

  return (
    <div className="scroll-card-elevated stamp-border flex flex-col gap-3 p-6 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] tracking-[0.18em] text-cinnabar-400">YOUR HEXAGRAM</p>
        <h1 className="mt-1 break-words font-serif text-base text-ink-200">{question}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-display text-gold-200">
            {result.ben.hex.symbol} {result.ben.hex.name}
            {result.bian && (
              <>
                <span className="mx-2 text-ink-400">→</span>
                {result.bian.hex.symbol} {result.bian.hex.name}
              </>
            )}
          </span>
          <span className="rounded-md border border-ink-600/60 bg-ink-900/40 px-2.5 py-1 font-mono text-[11px] text-ink-200">
            动爻：{result.moving.length === 0 ? "无" : result.moving.map((i) => `第${i + 1}爻`).join(" · ")}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-ink-400">{result.rule}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 self-start md:self-center">
        <a href="#interpretation" className="btn-ghost btn-sm lg:hidden">查看解读</a>
        <button onClick={onCopy} type="button" className="btn-ghost btn-sm" aria-label="复制卦象摘要">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "已复制" : "复制摘要"}</span>
        </button>
        <button onClick={onReset} type="button" className="btn-ghost btn-sm">
          <ArrowLeft size={14} />
          <span>再起一卦</span>
        </button>
      </div>
    </div>
  );
}

function NoChangeCard({ rule }: { rule: string }) {
  return (
    <div className="scroll-card relative flex flex-col items-center justify-center gap-3 p-4 text-center">
      <span className="rounded-md border border-quantum-500/40 px-3 py-1 font-display text-xs text-quantum-200">
        无变卦
      </span>
      <span className="grid h-12 w-12 place-items-center rounded-full border border-gold-500/30 bg-ink-900/60 text-gold-300">
        <Taiji size={32} />
      </span>
      <h3 className="font-display text-xl text-gold-200">六爻皆静</h3>
      <p className="max-w-sm text-sm leading-relaxed text-ink-200">
        本次起卦没有动爻，势态稳定。{rule}
      </p>
    </div>
  );
}

function DetailPanel({
  title,
  subtitle,
  desc,
  children,
}: {
  title: string;
  subtitle: string;
  desc: string;
  children: ReactNode;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;
    let previousOpen: boolean | undefined;
    const beforePrint = () => {
      previousOpen ??= details.open;
      details.open = true;
    };
    const afterPrint = () => {
      if (previousOpen !== undefined) details.open = previousOpen;
      previousOpen = undefined;
    };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => {
      window.removeEventListener("beforeprint", beforePrint);
      window.removeEventListener("afterprint", afterPrint);
    };
  }, []);
  return (
    <details ref={detailsRef} className="result-details scroll-card group">
      <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl text-gold-200">{title}</h2>
            <p className="text-[12px] tracking-wide text-ink-300">{subtitle}</p>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-400">{desc}</p>
          </div>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink-700 text-ink-300 transition-transform group-open:rotate-180" aria-hidden>
            ↓
          </span>
        </div>
      </summary>
      <div className="border-t border-ink-700/50 px-5 py-5">{children}</div>
    </details>
  );
}

function Footer({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-6">
      <p className="max-w-md text-center text-[12px] leading-relaxed text-ink-400">
        AI 给的是基于卦辞文本的合理引申，不是先知预言。
        <a href="/disclaimer" className="ml-1 text-cinnabar-400 underline-offset-2 hover:underline">
          请勿用于重大决策
        </a>
        。
      </p>
      <button onClick={onReset} type="button" className="btn-primary">
        <span>再起一卦</span>
      </button>
    </div>
  );
}
