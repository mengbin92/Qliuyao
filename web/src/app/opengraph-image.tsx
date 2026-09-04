import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { Taiji } from "@/components/Icon";

export const alt = "量子六爻 · 把铜钱换成量子比特，让 AI 替你解卦";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  const sans = await readFile(
    join(process.cwd(), "public/fonts/noto-sans-sc-regular.ttf")
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(ellipse at center top, #1c1c1e 0%, #000000 100%)",
          color: "#f5f5f7",
          
          padding: 80,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 16,
              border: "2px solid rgba(10,132,255,0.35)",
              background:
                "linear-gradient(135deg, rgba(94,92,230,0.35), rgba(26,26,66,0.5))",
            }}
          >
            <Taiji size={64} style={{ color: "#64a9ff" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 80, color: "#d6eaff", letterSpacing: 6 }}>
              量子六爻
            </div>
            <div
              style={{
                fontSize: 22,
                color: "#98989d",
                letterSpacing: 8,
                marginTop: 8,
              }}
            >
              QUANTUM · LIUYAO
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 32,
            color: "#f5f5f7",
            textAlign: "center",
            marginTop: 40,
          }}
        >
          把铜钱换成量子比特，让 AI 替你解卦
        </div>

        <div
          style={{
            fontSize: 20,
            color: "#6e6e73",
            marginTop: 60,
            display: "flex",
            gap: 24,
            
          }}
        >
          <span>邵雍</span>
          <span style={{ color: "#2c2c2e" }}>→</span>
          <span>莱布尼茨</span>
          <span style={{ color: "#2c2c2e" }}>→</span>
          <span style={{ color: "#a6abff" }}>量子比特</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "sans", data: sans, style: "normal" }],
    }
  );
}
