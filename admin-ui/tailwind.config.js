/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0D1117",
        surface: "#161B22",
        surface2: "#21262D",
        border: "#30363D",
        muted: "#8B949E",
        accent: "#25A865",
        "accent-dark": "#1A7A4A",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
