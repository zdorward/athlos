import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#09090b",
          position: "relative",
        }}
      >
        {/* top-right */}
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            width: 60,
            height: 60,
            borderRadius: 11,
            background: "rgba(6, 182, 212, 0.55)",
          }}
        />
        {/* bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            width: 60,
            height: 60,
            borderRadius: 11,
            background: "rgba(6, 182, 212, 0.8)",
          }}
        />
        {/* bottom-right */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            width: 60,
            height: 60,
            borderRadius: 11,
            background: "#06b6d4",
          }}
        />
      </div>
    ),
    { ...size }
  )
}
