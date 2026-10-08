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
        // Brand blue. `accent` reads well as text on the dark surfaces, `accent-dark`
        // is the fill for solid buttons (white text passes contrast on it).
        accent: "#3B82F6",
        "accent-dark": "#2563EB",
        "accent-deep": "#1D4ED8",
        "accent-light": "#60A5FA",
        // Green is reserved for good news: success messages, money, healthy metrics.
        success: "#25A865",
        "success-light": "#3DD68C",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.5)",
        glow: "0 0 0 1px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.1)",
      },
      backgroundImage: {
        "gradient-card": "linear-gradient(135deg, #161B22 0%, #1C2128 100%)",
        "gradient-accent": "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
      },
    },
  },
  plugins: [],
};
