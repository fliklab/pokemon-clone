/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        menuPurple: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
          text: '#ffffff',
        },
        menuPurpleSoft: {
          DEFAULT: '#c4b5fd',
          hover: '#a78bfa',
          text: '#1f2937',
        },
      },
    },
  },
  plugins: [],
}
