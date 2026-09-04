"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Scroll } from "./Icon";

/**
 * 悬浮按钮 + 按需加载抽屉。
 *
 * 不打开抽屉时，所有 framer-motion / drawer 代码都在另一个 chunk 里，
 * 不影响 about / disclaimer / index-64 等静态页的首屏体积。
 */

const HistoryDrawer = dynamic(() => import("./HistoryDrawer").then((m) => m.HistoryDrawer), {
  ssr: false,
});

export function HistoryFab() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(true)}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-gold-500/30 px-3 text-gold-200 transition hover:border-gold-300/60"
        aria-label="打开历史卦签"
        aria-haspopup="dialog"
        aria-expanded={open}
        type="button"
      >
        <Scroll size={20} />
        <span className="text-xs">历史</span>
      </button>
      {open && createPortal(<HistoryDrawer open={open} onClose={close} />, document.body)}
    </>
  );
}
