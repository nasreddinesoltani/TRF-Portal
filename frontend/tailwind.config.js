/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#000000",
        "primary-foreground": "#ffffff",
        background: "#ffffff",
        foreground: "#000000",
        border: "#e5e7eb",
        ring: "#000000",
      },
    },
  },
  plugins: [],
};
