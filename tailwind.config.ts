import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class', // enable class-based dark mode
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "bg-primary": "var(--bg-primary)",
        "bg-secondary": "var(--bg-secondary)",
        "border-color": "var(--border-color)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "sage": {
          100: "rgb(253, 254, 253)",
          200: "rgb(231, 236, 233)", 
          300: "rgb(193, 215, 202)",
          400: "rgb(157, 187, 172)",
          500: "rgb(59, 80, 60)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
