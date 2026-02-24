import typography from '@tailwindcss/typography'

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
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            color: theme('colors.slate.100'),
            a: {
              color: theme('colors.sky.300'),
              '&:hover': { color: theme('colors.sky.200') },
            },
            strong: { color: theme('colors.white') },
            h1: { color: theme('colors.white') },
            h2: { color: theme('colors.white') },
            h3: { color: theme('colors.white') },
            h4: { color: theme('colors.white') },
            code: { color: theme('colors.white') },
          },
        },
      }),
    },
  },
  plugins: [typography],
}
