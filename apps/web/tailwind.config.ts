import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0f7f4',
          100: '#dceee5',
          200: '#bbded0',
          300: '#8ec5b3',
          400: '#5da792',
          500: '#3c8b76',
          600: '#2d6f5f',
          700: '#25594d',
          800: '#1e483f',
          900: '#14382f',
          950: '#0c241e',
        },
        sage: {
          50: '#f6f9f7',
          100: '#eaf2ec',
          200: '#d5e4d9',
          300: '#b4cfbc',
          400: '#8cb397',
          500: '#699675',
          600: '#51795c',
          700: '#41614b',
          800: '#364e3e',
          900: '#2d4134',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
        serif: ['Merriweather', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
