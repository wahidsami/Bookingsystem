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
          DEFAULT: "#8B5ADF",
          50: "#F3EDFF",
          100: "#E8DBFF",
          200: "#D4C2FF",
          300: "#B89CFF",
          400: "#9C78F2",
          500: "#8B5ADF",
          600: "#7447D0",
          700: "#5D35B2",
          800: "#47278E",
          900: "#321A61",
        },
        secondary: {
          DEFAULT: "#FE01AB",
          50: "#FFF0F9",
          100: "#FFD9F0",
          200: "#FFB5E0",
          300: "#FF88CF",
          400: "#FF56BC",
          500: "#FE01AB",
          600: "#E60097",
          700: "#C50080",
          800: "#9C0066",
          900: "#710049",
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

