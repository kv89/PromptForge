/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEEDFE",
          500: "#534AB7",
          900: "#26215C",
        },
      },
    },
  },
  plugins: [],
};
