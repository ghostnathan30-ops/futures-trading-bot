import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "#0D1117",
          panel:     "#1A1D24",
          card:      "#21262D",
          border:    "#30363D",
        },
        accent: {
          blue:      "#2E7D9E",
          silver:    "#A8B2C1",
        },
        pnl: {
          positive:  "#00FF88",
          negative:  "#FF4444",
          warning:   "#F0A500",
        },
        text: {
          primary:   "#E6EDF3",
          secondary: "#8B949E",
          muted:     "#484F58",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        sans: ["Inter", "SF Pro Display", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "4px",
        sm: "2px",
        md: "4px",
        lg: "6px",
      },
    },
  },
  plugins: [],
};
export default config;
