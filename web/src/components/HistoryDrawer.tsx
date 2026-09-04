"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadHistory, clearHistory, type HistoryEntry } from "@/lib/history";
import { HexagramGlyph } from "./HexagramGlyph";
import { Close } from "./Icon";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * 历史抽屉：从右侧滑出，展示过去 30 次卦象。
 *
 * 父组件（HistoryFab）控制打开/关闭，本组件只负责渲染。
 * dynamic import 时只在第一次打开后才加载。
 */
export function HistoryDrawer({ open, onClose }: Props) {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setItems(loadHistory());
    const dialog = dialogRef.current;
    const overflow = document.body.style.overflow;
    if (dialog && !dialog.open) dialog.showModal();
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const onClear = () => {
    if (confirm("确认清空所有历史？此操作不可撤销。")) {
      clearHistory();
      setItems([]);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="history-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], [tabindex='0']"))
          .filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 h-[85dvh] max-h-none w-full max-w-none flex-col rounded-t-2xl border border-ink-700 bg-ink-950 p-0 text-ink-100 open:flex backdrop:bg-black/60 backdrop:backdrop-blur-sm md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:w-[420px] md:rounded-none"
    >
    <header className="flex items-center justify-between border-b border-ink-700/50 px-5 py-4">
      <div>
        <h2 id="history-title" className="font-display text-base text-gold-200">我的卦签集</h2>
        <p className="text-[11px] text-ink-300">仅保存在你的浏览器本地</p>
      </div>
      <button
        ref={closeButtonRef}
        onClick={onClose}
        className="grid h-11 w-11 place-items-center rounded-md border border-ink-700 text-gold-200 transition hover:bg-ink-800"
        aria-label="关闭历史抽屉"
        type="button"
      >
        <Close size={18} />
      </button>
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      {items.length === 0 ? (
        <div className="grid h-full place-items-center text-center text-sm text-ink-300">
          <div>
            <span className="text-3xl text-ink-500">☷</span>
            <p className="mt-3">还没有卦签</p>
            <p className="mt-1 text-[12px] text-ink-400">起一卦后会自动保存到这里</p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id}>
              <Link
                href={`/index-64/${it.benBinary}`}
                onClick={onClose}
                className="flex items-start gap-3 rounded-md border border-ink-700/50 bg-ink-900/40 p-3 transition hover:border-gold-500/30"
              >
                <HexagramGlyph binary={it.benBinary} size="sm" changing={it.moving} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-sm text-ink-100">{it.question}</p>
                  <p className="mt-1 text-xs text-gold-300">
                    {it.benSymbol} {it.benName}
                    {it.bianName && (
                      <>
                        <span className="mx-1.5 text-ink-400">→</span>
                        {it.bianName}
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-ink-400">
                    {new Date(it.castAt).toLocaleString("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {it.moving.length > 0 && (
                      <span className="ml-2 text-cinnabar-400">
                        动 {it.moving.map((i) => i + 1).join(",")} 爻
                      </span>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>

    {items.length > 0 && (
      <footer className="border-t border-ink-700/50 px-5 py-3">
        <button
          onClick={onClear}
          type="button"
          className="min-h-11 text-xs text-cinnabar-400 hover:text-cinnabar-300"
        >
          清空历史
        </button>
      </footer>
    )}
    </dialog>
  );
}
