/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./user/**/*.html",
    "./user/**/*.js",
    "./mechanic/**/*.html",
    "./mechanic/**/*.js",
    "./shared/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e7ff",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
