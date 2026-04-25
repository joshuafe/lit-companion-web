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
        // Jewel-tone accents — used very sparingly: streak chip (emerald),
        // 'new since' badge (sapphire), pin-burst glint (topaz). Each is
        // desaturated to fit the warm-cream base.
        jewel: {
          emerald: "#3F6E55",
          sapphire: "#3B557F",
          amethyst: "#6B4D78",
          topaz: "#A8853A",
          ruby: "#8C3F4C",
        },
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
      keyframes: {
        "pin-burst": {
          "0%":   { transform: "scale(1)" },
          "30%":  { transform: "scale(1.45) rotate(-8deg)" },
          "60%":  { transform: "scale(0.9) rotate(4deg)" },
          "100%": { transform: "scale(1) rotate(0)" },
        },
      },
      animation: {
        "pin-burst": "pin-burst 0.65s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
