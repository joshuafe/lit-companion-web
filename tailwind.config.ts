import type { Config } from "tailwindcss";

// Warm cream palette mirrors the Figma LitCompanion Tokens + SwiftUI Theme.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#FBF8F1",   // cream
          card: "#F4EDDD",      // warm beige
        },
        text: {
          primary: "#2E2A24",
          secondary: "#7D7266",
        },
        accent: "#B86E4C",      // muted terracotta
        relevance: {
          high: "#5C7A55",
          mid: "#998F7F",
          low: "#C7BDAE",
        },
        warn: { bg: "#F4E8CD" },
        stroke: "#E8DFCB",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        eyebrow: ["11px", { lineHeight: "14px", letterSpacing: "0.04em" }],
        caption: ["13px", { lineHeight: "18px" }],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
} satisfies Config;
