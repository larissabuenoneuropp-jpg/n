import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Neulis (identidade visual) com fallback geométrico
        display: ["Neulis", "Neulis Sans", "neulis-sans", "Neulis Neue", "neulis-neue", "var(--font-display-fallback)", "sans-serif"],
      },
      colors: {
        // Identidade visual Larissa Bueno — terracota, areia, sálvia, mostarda e azul-água
        brand: {
          50: "#fbf5f1", 100: "#f6e9e0", 200: "#ecd2c1", 300: "#e0b69c",
          400: "#d6a382", 500: "#cd926d", 600: "#9c5f42", 700: "#84503a",
          800: "#6b4130", 900: "#553529",
        },
        sage: {
          50: "#f4f5f0", 100: "#e8eae1", 200: "#d3d7c6", 300: "#b9bea7",
          400: "#a5ab92", 500: "#979d84", 600: "#6f7660", 700: "#5f664f",
        },
        sand: { 50: "#fbf8f3", 100: "#f5eee4", 200: "#e9dccb", 300: "#d2bda0", 400: "#bfa47f" },
        mustard: { 100: "#f8efd6", 300: "#e6c983", 600: "#8a6a1c" },
        teal: { 100: "#e3efef", 300: "#a7cbcb", 600: "#3f7676" },
        ink: { DEFAULT: "#3a3330", soft: "#6e625b", faint: "#8f847b" },
        line: "#ece4da",
        canvas: "#faf7f3",
      },
      boxShadow: {
        card: "0 1px 2px rgba(58,51,48,.04), 0 1px 1px rgba(58,51,48,.03)",
        pop: "0 12px 32px -8px rgba(58,51,48,.18)",
      },
      borderRadius: { xl: "0.875rem" },
    },
  },
  plugins: [],
} satisfies Config;
