import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
      colors: {
        brand: {
          50: "#f2f5ff", 100: "#e4eaff", 200: "#cbd6ff", 300: "#a6b8fd",
          400: "#7d93f8", 500: "#5b6ef0", 600: "#4651e3", 700: "#3a41c8",
          800: "#3138a1", 900: "#2e357f",
        },
        lilac: {
          50: "#f8f5ff", 100: "#f0eaff", 200: "#e3d8ff", 300: "#cdb9fe",
          400: "#b392fb", 500: "#9a6cf5", 600: "#8650e9",
        },
        ink: { DEFAULT: "#1f2433", soft: "#5b6275", faint: "#8b91a1" },
        line: "#e8eaf0",
        canvas: "#f7f8fb",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,24,40,.04), 0 1px 1px rgba(20,24,40,.03)",
        pop: "0 12px 32px -8px rgba(20,24,40,.18)",
      },
      borderRadius: { xl: "0.875rem" },
    },
  },
  plugins: [],
} satisfies Config;
