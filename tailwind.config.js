/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pet: {
          bg: "#fff0f5",
          panel: "#ffffff",
          accent: "#ff9eb5",
          text: "#4a3b3f",
        },
      },
      boxShadow: {
        panel: "0 8px 30px rgba(0,0,0,0.18)",
      },
    },
  },
  plugins: [],
};
