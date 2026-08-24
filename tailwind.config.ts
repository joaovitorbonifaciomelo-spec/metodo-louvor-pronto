import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#0a0a0b",
          900: "#0f0f11",
          850: "#141417",
          800: "#1a1a1e",
          700: "#26262b",
          600: "#3a3a41",
          500: "#57575f",
          400: "#82828c",
          300: "#a8a8b3",
          200: "#cfcfd6",
          100: "#e9e9ee",
          50: "#f7f7f9",
        },
        // Identidade Método Louvor Pronto: preto/grafite + dourado accent.
        accent: {
          DEFAULT: "#D4AF37",
          light: "#E7C765",
          muted: "#9C7A1F",
          fg: "#1A1408",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
