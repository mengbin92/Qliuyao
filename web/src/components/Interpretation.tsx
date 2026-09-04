"use client";

import { motion, useReducedMotion } from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Yao } from "@/lib/quantum";
import { readSSEData } from "@/lib/sse";

interface Props {
  question: string;
  yaos: Yao[];
  benBin: string;
  bianBin: string;
  /** 自动开始流式获取 */
  autoStart?: boolean;
}

interface Section {
  title: string;
  body: string;
}

/**
 * 把流式累积的 Markdown 文本切成四段。
 *
 * 容忍：
 *   - `## 一、卦象大意` / `## 一、 卦象大意` 都识别
 *   - 还没出现首个 `##` 时返回 trailing（前奏）
 */
function parseSections(raw: string): { sections: Section[]; trailing: string } {
  if (!raw) return { sections: [], trailing: "" };
  const headingRe = /(?:^|\n)[ \t]*##[ \t]+(.+?)(?=\n|$)/g;
  type Match = { idx: number; len: number; title: string };
  const matches: Match[] = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(raw)) !== null) {
    matches.push({ idx: m.index, len: m[0].length, title: m[1].trim() });
  }
  if (matches.length === 0) return { sections: [], trailing: raw.trim() };

  const sections: Section[] = matches.map((cur, i) => {
    const bodyStart = cur.idx + cur.len;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].idx : raw.length;
    return { title: cur.title, body: raw.slice(bodyStart, bodyEnd).trim() };
  });
  return { sections, trailing: raw.slice(0, matches[0].idx).trim() };
}

/** 简化 Markdown → React 节点，避免 dangerouslySetInnerHTML。 */
function bodyToNodes(body: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = (key: number) => {
    if (listBuf.length === 0) return;
    out.push(
      <ol key={`l-${key}`} className="my-1 list-decimal pl-5 marker:text-gold-400">
        {listBuf.map((item, i) => (
          <li key={i} className="my-1">
            {renderInline(item)}
          </li>
        ))}
      </ol>
    );
    listBuf = [];
  };

  body.split("\n").forEach((line, i) => {
    const ordered = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (ordered) {
      listBuf.push(ordered[2]);
      return;
    }
    flushList(i);
    if (line.trim() === "") {
      out.push(<div key={`s-${i}`} className="h-1.5" />);
    } else {
      out.push(
        <p key={`p-${i}`} className="my-1 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  });
  flushList(-1);
  return out;
}

/** 行内 markdown：**bold**、_italic_。 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_\n]+?_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(
        <strong key={key++} className="text-gold-200">
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <em key={key++} className="not-italic text-cinnabar-400">
          {tok.slice(1, -1)}
        </em>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : text;
}

export function Interpretation({ question, yaos, benBin, bianBin, autoStart = true }: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "stopped" | "error">("idle");
  const running = status === "running";
  const done = status === "done";
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async () => {
    if (abortRef.current) return;
    setStatus("running");
    setError(null);
    setText("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, yaos, benBin, bianBin }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(typeof errBody?.error === "string" ? errBody.error : `HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("无响应流");

      let completed = false;
      let received = "";
      for await (const payload of readSSEData(res.body)) {
        if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
        if (payload === "[DONE]") {
          completed = true;
          break;
        }
        const parsed = JSON.parse(payload) as { text?: unknown; error?: unknown } | null;
        if (typeof parsed?.error === "string") throw new Error(parsed.error);
        if (typeof parsed?.text === "string") {
          received += parsed.text;
          setText(received);
        }
      }
      if (ctrl.signal.aborted || abortRef.current !== ctrl) return;
      if (!completed) throw new Error("连接提前结束，解读未完成，请重试。");
      if (!received.trim()) throw new Error("未收到解读内容，请重试。");
      setStatus("done");
    } catch (e) {
      if (abortRef.current !== ctrl) return;
      if (ctrl.signal.aborted) {
        setStatus("stopped");
      } else {
        setError(e instanceof Error ? e.message : "未知错误");
        setStatus("error");
      }
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }, [question, yaos, benBin, bianBin]);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("stopped");
  };

  useEffect(() => {
    if (autoStart) start();
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [autoStart, start]);

  const { sections, trailing } = useMemo(() => parseSections(text), [text]);

  return (
    <section id="interpretation" aria-label="AI 解读" className="scroll-card-elevated relative min-w-0 scroll-mt-24 break-words p-5 md:p-7">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-gold-200">AI 解读</h2>
          <p role="status" className="mt-2 text-sm text-ink-200">
            {running ? "解卦师正在落笔" : done ? "解读已完成" : status === "stopped" ? "已中止，可重新解读" : status === "error" ? "解读暂未完成" : "等待开始解读"}
          </p>
          <p className="mt-1 text-xs text-ink-300">
            DeepSeek + 周易·十翼 经学知识库 · 朱子断卦法
          </p>
        </div>
        {!running && (
          <button onClick={start} className="btn-ghost btn-sm" type="button">
            {status === "idle" ? "开始解读" : "重新解卦"}
          </button>
        )}
        {running && (
          <button onClick={stop} className="btn-ghost btn-sm" type="button">
            中止
          </button>
        )}
      </header>

      {error && (
        <div role="alert" className="rounded-md border border-cinnabar-500/40 bg-cinnabar-700/15 px-4 py-3 text-sm text-cinnabar-300">
          解卦失败：{error}
          <button type="button" onClick={start} className="ml-3 min-h-11 underline">
            重试
          </button>
        </div>
      )}

      {trailing && (
        <div className="prose-custom whitespace-pre-wrap text-sm">{bodyToNodes(trailing)}</div>
      )}

      {running && sections.length === 0 && !trailing && (
        <SkeletonInterpretation />
      )}

      {sections.length > 0 && (
        <div className="space-y-4">
          {sections.map((s, i) => (
            <SectionCard key={i} index={i} section={s} streaming={running && i === sections.length - 1} />
          ))}
        </div>
      )}

      {done && (
        <p className="mt-6 text-center text-[11px] text-ink-400">
          ✦ 解读由 AI 生成，仅供参考与反思。 ✦
        </p>
      )}
    </section>
  );
}

const SECTION_ICON = ["☰", "★", "☷", "✦"];

const SectionCard = memo(function SectionCard({
  section,
  index,
  streaming,
}: {
  section: Section;
  index: number;
  streaming: boolean;
}) {
  const nodes = useMemo(() => bodyToNodes(section.body), [section.body]);
  const reduce = useReducedMotion();
  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="scroll-card border border-gold-500/15 p-4"
    >
      <header className="mb-2 flex items-center gap-2">
        <span className="font-display text-lg text-cinnabar-400">{SECTION_ICON[index] ?? "❉"}</span>
        <h3 className="font-display text-base text-gold-200">{section.title}</h3>
      </header>
      <div className="prose-custom text-sm">{nodes}</div>
      {streaming && <span className="mt-2 inline-block h-3 w-2 animate-pulse bg-gold-400" />}
    </motion.article>
  );
});

function SkeletonInterpretation() {
  return (
    <div className="space-y-4">
      <p className="shimmer-text font-display text-sm tracking-[0.12em]">研墨 · 落笔 · 推演 ...</p>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-md border border-ink-700/40 bg-ink-900/30 p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-gradient-to-r from-ink-700 to-ink-800" />
            <div className="h-2.5 w-full animate-pulse rounded bg-ink-800/70" />
            <div className="h-2.5 w-5/6 animate-pulse rounded bg-ink-800/70" />
            <div className="h-2.5 w-4/6 animate-pulse rounded bg-ink-800/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
