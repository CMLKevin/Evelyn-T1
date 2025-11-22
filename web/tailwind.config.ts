import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'Courier New', 'monospace'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif']
      },
      colors: {
        // Terminal color palette - sharp blacks and grays
        terminal: {
          black: '#000000',
          dark: '#0a0a0a',
          900: '#1a1a1a',
          800: '#262626',
          700: '#404040',
          600: '#525252',
          500: '#737373',
          400: '#a3a3a3',
          300: '#d4d4d4',
        },
        // Terminal accent colors
        orange: {
          DEFAULT: '#ff6b35',
          dark: '#e55a2b',
          light: '#ff7f50',
        },
        // Keep some legacy colors for compatibility
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
      },
      backgroundImage: {
        // Remove gradients - use solid colors
        'terminal-bg': 'solid #000000',
      },
      boxShadow: {
        // Terminal-style shadows with orange glow
        'orange-sm': '0 1px 2px 0 rgba(255, 107, 53, 0.1)',
        'orange-md': '0 2px 4px 0 rgba(255, 107, 53, 0.2)',
        'orange-lg': '0 4px 8px 0 rgba(255, 107, 53, 0.3)',
        'orange-glow': '0 0 10px rgba(255, 107, 53, 0.3)',
        'orange-glow-strong': '0 0 20px rgba(255, 107, 53, 0.5)',
        'terminal': '0 2px 4px 0 rgba(0, 0, 0, 0.9)',
      },
      borderRadius: {
        // NO ROUNDED CORNERS - Terminal/boxy style
        'none': '0',
        'sm': '0',
        'md': '0',
        'lg': '0',
        'xl': '0',
        '2xl': '0',
        '3xl': '0',
        'full': '0',
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
      },
      keyframes: {
        // Entrance animations
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Terminal cursor blink
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        // Typing indicator
        'typing-bounce': {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-10px)' },
        },
        // Shimmer for skeletons
        'shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-in-up': 'fade-in-up 0.3s ease-out',
        'fade-in-down': 'fade-in-down 0.2s ease-out',
        'cursor-blink': 'cursor-blink 1s ease-in-out infinite',
        'typing-bounce': 'typing-bounce 1.4s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite linear',
      },
    }
  },
  plugins: []
} satisfies Config;

