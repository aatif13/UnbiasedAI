import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          card: "var(--bg-card)",
        },
        accent: {
          blue: "var(--accent-blue)",
          amber: "var(--accent-amber)",
          red: "var(--accent-red)",
          green: "var(--accent-green)",
        },
        border: "var(--border)",
        muted: "var(--text-muted)",
        foreground: "var(--text-primary)",
      },
      fontFamily: {
        sans: ["var(--font-display)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "serif"],
        mono: ["ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 0 0 1px rgba(31,41,55,0.9), 0 20px 60px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};
export default config;
