import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
            },
            fontFamily: {
                sans: ['Cairo', 'sans-serif'],
                arabic: ['Cairo', 'sans-serif'],
            },
        },
    },
    plugins: [
        require("tailwindcss-animate"),
        // RTL support plugin
        function({ addUtilities }: { addUtilities: any }) {
            addUtilities({
                '.flip-x': {
                    transform: 'scaleX(-1)',
                },
                '.start-0': {
                    insetInlineStart: '0',
                },
                '.end-0': {
                    insetInlineEnd: '0',
                },
                '.ms-auto': {
                    marginInlineStart: 'auto',
                },
                '.me-auto': {
                    marginInlineEnd: 'auto',
                },
                '.ps-4': {
                    paddingInlineStart: '1rem',
                },
                '.pe-4': {
                    paddingInlineEnd: '1rem',
                },
                '.text-start': {
                    textAlign: 'start',
                },
                '.text-end': {
                    textAlign: 'end',
                },
            });
        },
    ],
};
export default config;
