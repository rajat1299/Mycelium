import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        shell: "var(--shell)",
        panel: "var(--panel)",
        "panel-line": "var(--panel-line)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)"
      },
      boxShadow: {
        panel: "var(--shadow-panel)"
      },
      fontFamily: {
        serif: ['var(--font-display)', '"Iowan Old Style"', "Georgia", "serif"],
        sans: ['var(--font-body)', '"Instrument Sans"', '"Segoe UI"', "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
