/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f172a",
        foreground: "#e2e8f0",
        codex: {
          primary: "#6C5CE7",
          accent: "#8e9bff"
        }
      },
      boxShadow: {
        surface: "0 10px 30px -12px rgba(15, 23, 42, 0.5)",
        inset: "inset 0 0 0 1px rgba(148, 163, 184, 0.1)"
      },
      fontFamily: {
        sans: ["'Inter Variable'", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
