/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cricket: {
          green: '#1a4e2b',
          lightGreen: '#2e7a44',
          dark: '#0a0a0a',
          card: '#141414',
          accent: '#cfa62e',
        }
      }
    },
  },
  plugins: [],
}
