/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: { '2xl': '1rem' },
      boxShadow: { card: '0 4px 24px rgba(0,0,0,0.08)' },
    },
  },
  plugins: [],
};
