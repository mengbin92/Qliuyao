import type { Config } from "tailwindcss";

/**
 * 设计令牌对齐 micro-one-api Web 端（Apple HIG 风格）：
 *
 *   - 背景      #000000 / 卡片 #1C1C1E / 次级 #2C2C2E
 *   - 主色      #0A84FF（Apple systemBlue dark）
 *   - 中性文字  #F5F5F7 / #98989D / #6E6E73
 *   - 圆角      0.25 / 0.375 / 0.5 / 0.75 / 1rem
 *   - 字体      Noto Sans SC（正文 + 标题）
 *
 * ink/gold/cinnabar/quantum 语义色板保留同名工具类，
 * 取值改为新中性灰阶 + 蓝（gold）、红（cinnabar）、靛（quantum）点缀色，
 * 这样既有 TSX 无需逐处改写即可获得一致的 Apple 风观感。
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* 中性灰阶（Apple dark 色谱，深→浅） */
        ink: {
          50: "#ffffff",
          100: "#f5f5f7",
          200: "#d2d2d7",
          300: "#aeaeb2",
          400: "#98989d",
          500: "#6e6e73",
          600: "#48484a",
          700: "#3a3a3c",
          800: "#2c2c2e",
          900: "#1c1c1e",
          950: "#000000",
        },
        /* 主题蓝（Apple systemBlue） */
        gold: {
          50: "#eef6ff",
          100: "#d6eaff",
          200: "#a8d1ff",
          300: "#64a9ff",
          400: "#409cff",
          500: "#0a84ff",
          600: "#0066cc",
          700: "#004c99",
          800: "#12324f",
          900: "#0d1f30",
        },
        /* 强调红（Apple systemRed dark） */
        cinnabar: {
          50: "#fff1f0",
          100: "#ffd9d6",
          200: "#ffb3ad",
          300: "#ff8a81",
          400: "#ff6961",
          500: "#ff453a",
          600: "#d70015",
          700: "#8e000e",
          800: "#4d0008",
          900: "#2a0a0c",
        },
        /* 次强调靛（Apple systemIndigo dark） */
        quantum: {
          50: "#eef0ff",
          100: "#dde1ff",
          200: "#c2c8ff",
          300: "#a6abff",
          400: "#948fff",
          500: "#7d7aff",
          600: "#5e5ce6",
          700: "#4846b8",
          800: "#2c2b70",
          900: "#1a1a42",
        },
      },
      fontFamily: {
        sans: [
          "Noto Sans SC Variable",
          "PingFang SC",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: ["JetBrains Mono Variable", "ui-monospace", "SF Mono", "monospace"],
        /* display/serif 统一回落到无衬线标题字，保持组件类名兼容 */
        display: [
          "Noto Sans SC Variable",
          "PingFang SC",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        serif: [
          "Noto Sans SC Variable",
          "PingFang SC",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
      },
      borderRadius: {
        sm: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        "glow-gold": "0 0 32px rgba(10,132,255,0.25)",
      },
    },
  },
  plugins: [],
} satisfies Config;
