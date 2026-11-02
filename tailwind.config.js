/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: '#f4f2ee',
        'paper-soft': '#edecea',
        ink: '#1f1f1f',
        muted: '#6f6b66',
        faint: '#a8a29a',
        line: '#e6e2dc',
      },
      fontFamily: {
        sans: ['ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      fontSize: {
        greeting: ['clamp(32px,5vw,44px)', { lineHeight: '1.08', letterSpacing: '-0.032em' }],
        sub: ['17px', { lineHeight: '1.55' }],
      },
      borderRadius: { '2xl': '1rem', '3xl': '22px' },
      boxShadow: {
        card: '0 1px 2px rgba(27,28,30,0.04), 0 10px 30px rgba(27,28,30,0.06)',
        composer: '0 1px 2px rgba(0,0,0,0.05), 0 18px 50px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};

