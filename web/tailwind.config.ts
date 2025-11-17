import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['SF Mono', 'SFMono-Regular', 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Consolas', 'Monaco', 'monospace'],
        sans: ['SF Mono', 'SFMono-Regular', 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'Consolas', 'Monaco', 'monospace']
      },
      colors: {
        discord: {
          dark: '#1e1f22',
          darker: '#141517',
          gray: '#2b2d31',
          'gray-light': '#383a40',
          'gray-lighter': '#4e5058',
          'text': '#dbdee1',
          'text-muted': '#949ba4',
          'text-link': '#00a8fc',
          accent: '#5865f2',
          'accent-hover': '#4752c4',
          green: '#23a559',
          red: '#f23f43',
          yellow: '#f0b232'
        }
      }
    }
  },
  plugins: []
} satisfies Config;

