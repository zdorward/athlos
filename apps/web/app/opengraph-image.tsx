import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Athlos"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #09090b 60%, #0e2a30 100%)",
          gap: 56,
          position: "relative",
        }}
      >
        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "15%",
            right: "15%",
            height: 4,
            borderRadius: 2,
            background:
              "linear-gradient(90deg, transparent, #06b6d4, transparent)",
          }}
        />

        {/* 3-block mark */}
        <div
          style={{
            display: "flex",
            width: 130,
            height: 130,
            position: "relative",
            flexShrink: 0,
          }}
        >
          {/* top-right */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 58,
              height: 58,
              borderRadius: 10,
              background: "#06b6d4",
            }}
          />
          {/* bottom-left */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: 58,
              height: 58,
              borderRadius: 10,
              background: "rgba(6, 182, 212, 0.8)",
            }}
          />
          {/* bottom-right */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 58,
              height: 58,
              borderRadius: 10,
              background: "rgba(6, 182, 212, 0.55)",
            }}
          />
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 148,
            background: "rgba(6, 182, 212, 0.3)",
          }}
        />

        {/* Wordmark + tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 112,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-4px",
              lineHeight: 1,
            }}
          >
            Athlos
          </span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.5)",
              lineHeight: 1,
            }}
          >
            Data driven marathon training.
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
