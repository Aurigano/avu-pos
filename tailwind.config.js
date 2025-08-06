/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'pos-blue': '#5B9BD5',
        'pos-gray': '#F5F5F5',
        'pos-dark-gray': '#666666',
        'pos-light-gray': '#E8E8E8',
        'pos-red': '#E74C3C',
        'pos-green': '#27AE60',
        'pos-orange': '#F39C12',
      },
    },
  },
  plugins: [],
} 