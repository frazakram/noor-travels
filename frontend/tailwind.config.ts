import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        noor: {
          50: "#f0f7f4",
          100: "#dceee5",
          200: "#b9ddd0",
          300: "#8bc5b3",
          400: "#5da892",
          500: "#3d8c78",
          600: "#2d7060",
          700: "#255a4e",
          800: "#1f4840",
          900: "#1a3c36",
          950: "#0d221f",
        },
        sand: {
          50: "#faf8f5",
          100: "#f3efe8",
          200: "#e6ddd0",
        },
        gold: {
          400: "#d4a853",
          500: "#c49a3c",
        },
      },
      fontFamily: {
        arabic: ["Amiri", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
