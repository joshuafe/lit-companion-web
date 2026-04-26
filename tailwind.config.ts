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
        // Jewel tones with topaz + emerald promoted to lead roles:
        // - emerald: tier-1 marks, "verified" / saved-state, primary trust
        // - topaz:   stars (★), pin-active glint, headline-tier accent
        // - sapphire: "new since" badges, secondary trust
        // - amethyst: wildcards, surprise picks
        // - ruby: alerts / errors only
        jewel: {
          emerald: "#3F7A5C",   // slightly more saturated, used widely
          "emerald-soft": "#E8F0EA",
          sapphire: "#3B557F",
          amethyst: "#6B4D78",
          topaz: "#B89039",     // slightly more golden, used widely
          "topaz-soft": "#F5ECD3",
          ruby: "#8C3F4C",
        },
        relevance: {
          high: "#3F7A5C",      // emerald — strong match
          mid:  "#B89039",      // topaz — worth a look
          low:  "#C7BDAE",      // taupe — discovery / muted
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
