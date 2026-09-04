import { ImageResponse } from "next/og";
import { Taiji } from "@/components/Icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * 动态 favicon —— 太极 + 量子轨道融合的极简版本。
 * 64×64 输出，浏览器下采样到 32 / 16 仍可辨。
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #000000 0%, #2c2c2e 100%)",
          borderRadius: 8,
        }}
      >
        <Taiji size={48} style={{ color: "#64a9ff" }} />
      </div>
    ),
    { ...size }
  );
}
