import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#6537C0", // Canonical BARSPA Brand Purple
          50: "#FAF7FD",
          100: "#F3EDFC",
          200: "#E7DDFC",
          300: "#D0BFF8",
          400: "#A379E2",
          500: "#6537C0",
          600: "#5527B0",
          700: "#451C90",
          800: "#1D035F",
          900: "#12023F",
          950: "#0A0124",
        },
        brand: {
          50: "#FAF7FD",
          100: "#F3EDFC",
          200: "#E7DDFC",
          300: "#D0BFF8",
          400: "#A379E2",
          500: "#6537C0",
          600: "#5527B0",
          700: "#451C90",
          800: "#1D035F",
          900: "#12023F",
          950: "#0A0124",
        },
        barspa: {
          primary: "#6537C0",
          deep: "#1D035F",
          soft: "#A379E2",
          light: "#E7DDFC",
          lavender: "#F3EDFC",
        },
        dark: {
          DEFAULT: "#0F172A", // Slate 900
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

