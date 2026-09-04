"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";

interface Props {
  /** 6 位字符串 '1' 阳 '0' 阴，第 0 位为初爻（最下） */
  binary: string;
  /** 动爻位（0..5） */
  changing?: number[];
  size?: "sm" | "md" | "lg";
  /** 显示动画绘制 */
  animate?: boolean;
}

/**
 * 静态卦象图：自下而上六根爻线，阳爻为整线，阴爻为间断线，动爻有标记。
 */
export function HexagramGlyph({ binary, changing = [], size = "md", animate = false }: Props) {
  const id = useId();
  const reduce = useReducedMotion();
  const shouldAnimate = animate && !reduce;
  const gradient = `yao-${id}`;
  const movingGradient = `yao-changing-${id}`;
  const widths = { sm: 80, md: 120, lg: 180 };
  const heights = { sm: 96, md: 144, lg: 216 };
  const w = widths[size];
  const h = heights[size];
  const lineH = h / 13;
  const gap = h / 26;
  const padX = w * 0.1;

  // 自下而上绘制（i=0 在底）
  const yaos = [...binary];

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 text-gold-300"
      role="img"
      aria-label="卦象图"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a84ff" />
          <stop offset="50%" stopColor="#64a9ff" />
          <stop offset="100%" stopColor="#0a84ff" />
        </linearGradient>
        <linearGradient id={movingGradient} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d70015" />
          <stop offset="50%" stopColor="#ff6961" />
          <stop offset="100%" stopColor="#d70015" />
        </linearGradient>
      </defs>

      {yaos.map((c, i) => {
        const isYang = c === "1";
        const isChanging = changing.includes(i);
        // 自下而上：i=0 在底部，所以 y 计算时反一下
        const yPos = h - (i + 1) * (lineH + gap) + gap / 2;
        const fill = isChanging
          ? `url(#${movingGradient})`
          : `url(#${gradient})`;

        const animProps = shouldAnimate
          ? {
              initial: { opacity: 0, scale: 0.7 },
              animate: { opacity: 1, scale: 1 },
              transition: { delay: i * 0.15, duration: 0.5, ease: "easeOut" as const },
            }
          : {};

        if (isYang) {
          return (
            <motion.rect
              key={i}
              x={padX}
              y={yPos}
              width={w - padX * 2}
              height={lineH}
              rx={lineH / 4}
              fill={fill}
              {...animProps}
            />
          );
        } else {
          // 阴爻：两段
          const half = (w - padX * 2 - w * 0.06) / 2;
          return (
            <g key={i}>
              <motion.rect
                x={padX}
                y={yPos}
                width={half}
                height={lineH}
                rx={lineH / 4}
                fill={fill}
                {...animProps}
              />
              <motion.rect
                x={padX + half + w * 0.06}
                y={yPos}
                width={half}
                height={lineH}
                rx={lineH / 4}
                fill={fill}
                {...animProps}
              />
            </g>
          );
        }
      })}

      {/* 动爻标记：右侧朱砂圆点 */}
      {changing.map((i) => {
        const yPos = h - (i + 1) * (lineH + gap) + gap / 2 + lineH / 2;
        return (
          <motion.circle
            key={`mark-${i}`}
            cx={w - padX / 2}
            cy={yPos}
            r={lineH / 2.5}
            fill="#ff453a"
            stroke="#4d0008"
            strokeWidth={1}
            initial={shouldAnimate ? { scale: 0 } : false}
            animate={{ scale: 1 }}
            transition={{ delay: 6 * 0.15 + 0.2, type: "spring", stiffness: 300 }}
          />
        );
      })}
    </svg>
  );
}
