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
          100: "#fdfefd",
          200: "#e7ece9", 
          300: "#c1d7ca",
          400: "#9dbbac",
          500: "#3b503c",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
