"use client";

import { useState } from "react";
import { DivinationFlow } from "@/components/DivinationFlow";
import { Hero } from "@/components/Hero";
import { Atom, Book, Sparkles, Flask, Grid, Globe } from "@/components/Icon";

type FlowPhase = "ask" | "casting" | "results";

export default function HomePage() {
  const [phase, setPhase] = useState<FlowPhase>("ask");

  return (
    <div className="relative">
      <div
        className={`mx-auto max-w-7xl px-5 pb-16 pt-4 md:pb-20 md:pt-8 ${
          phase === "ask" ? "grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-center lg:gap-12" : ""
        }`}
      >
        {phase === "ask" && <Hero compact />}
        <section className="min-w-0">
          <DivinationFlow onPhaseChange={setPhase} />
        </section>
      </div>
      {phase === "ask" && <FeatureGrid />}
    </div>
  );
}

function FeatureGrid() {
  const features = [
    {
      Icon: Atom,
      title: "真量子电路",
      desc: "pyqpanda3 三比特 Hadamard 叠加，每爻独立电路实例 + 单 shot 测量。Web 端用 crypto API 等价复刻同一份数学。",
      tag: "QUANTUM",
      tone: "quantum" as const,
    },
    {
      Icon: Book,
      title: "完整经学知识库",
      desc: "64 卦卦辞 + 384 爻爻辞 + 64 彖传 + 64 大象传 + 互错综衍生卦 + 八卦象意，全部进入 AI prompt。",
      tag: "CLASSICS",
      tone: "gold" as const,
    },
    {
      Icon: Sparkles,
      title: "AI 结构化解卦",
      desc: "OpenAI 兼容大模型 + 强结构化 prompt：辨象 → 取辞 → 观结构 → 看动向 → 参互错综 → 综合，每步引用原文。",
      tag: "LLM",
      tone: "gold" as const,
    },
    {
      Icon: Flask,
      title: "可证伪",
      desc: "10000 次卡方检验：χ² ≈ 4.4，p ≈ 0.73。8 种本征态分布与均匀分布无显著差异。",
      tag: "TESTABLE",
      tone: "quantum" as const,
    },
    {
      Icon: Grid,
      title: "卦象解析可视化",
      desc: "当位、中正、有应、敌应、承乘 —— 三千年的爻位术语，做成一组直观的位结构图，初学者也能看懂。",
      tag: "ANALYSIS",
      tone: "gold" as const,
    },
    {
      Icon: Globe,
      title: "前后端完整",
      desc: "Next.js + Edge Runtime + 流式 SSE，部署在 Vercel。开箱即用，无需本地配置。",
      tag: "WEB",
      tone: "quantum" as const,
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 pb-20">
      <div className="text-center">
        <p className="font-display text-[11px] tracking-[0.2em] text-gold-400">FEATURES</p>
        <h2 className="mt-2 font-display text-2xl text-gold-200 md:text-3xl">
          为什么这个项目和别的占卜小工具不一样
        </h2>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const tone =
            f.tone === "quantum"
              ? "border-quantum-500/30 text-quantum-300"
              : "border-gold-500/30 text-gold-300";
          return (
            <article
              key={f.title}
              className="scroll-card group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/40 hover:shadow-glow-gold"
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-md border ${tone} bg-ink-900/50 transition group-hover:scale-110`}
                >
                  <f.Icon size={22} />
                </span>
                <span className="font-mono text-[11px] tracking-[0.18em] text-ink-400">{f.tag}</span>
              </div>
              <h3 className="font-display text-base text-gold-200">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-200">{f.desc}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
