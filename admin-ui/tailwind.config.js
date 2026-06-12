/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0D1117",
        surface: "#161B22",
        surface2: "#21262D",
        surface3: "#2D333B",
        border: "#30363D",
        muted: "#8B949E",
        accent: "#25A865",
        "accent-dark": "#1A7A4A",
        "accent-light": "#3DD68C",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.5)",
        glow: "0 0 0 1px rgba(37,168,101,0.3), 0 0 20px rgba(37,168,101,0.1)",
      },
      backgroundImage: {
        "gradient-card": "linear-gradient(135deg, #161B22 0%, #1C2128 100%)",
        "gradient-accent": "linear-gradient(135deg, #25A865 0%, #1A7A4A 100%)",
      },
    },
  },
  plugins: [],
};
