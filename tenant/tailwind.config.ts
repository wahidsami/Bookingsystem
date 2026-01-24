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
          DEFAULT: "#8B4513",
          50: "#F5E6D3",
          100: "#EDD7BE",
          200: "#DDB895",
          300: "#CD9A6C",
          400: "#BD7B43",
          500: "#8B4513",
          600: "#6F370F",
          700: "#53290B",
          800: "#371B07",
          900: "#1B0E04",
        },
        secondary: {
          DEFAULT: "#D4AF37",
          50: "#FAF6E8",
          100: "#F5EDD1",
          200: "#EBDBA3",
          300: "#E1C975",
          400: "#D7B747",
          500: "#D4AF37",
          600: "#A68C2C",
          700: "#796921",
          800: "#4C4616",
          900: "#1F230B",
        },
        accent: {
          DEFAULT: "#CD853F",
          50: "#F9F1E7",
          100: "#F3E3CF",
          200: "#E7C79F",
          300: "#DBAB6F",
          400: "#CF8F3F",
          500: "#CD853F",
          600: "#A46A32",
          700: "#7B5025",
          800: "#523518",
          900: "#291B0C",
        },
        background: "#FAFAF9",
        dark: {
          DEFAULT: "#1E293B",
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
        },
      },
      fontFamily: {
        cairo: ["'Cairo'", "sans-serif"],
        claudion: ["'Claudion'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

