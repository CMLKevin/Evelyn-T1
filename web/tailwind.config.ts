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
        // Surface elevation colors for layered depth
        surface: {
          0: '#000000',
          1: '#0a0a0a',
          2: '#121212',
          3: '#1a1a1a',
          4: '#242424',
        },
        // Glass backgrounds for glassmorphism
        glass: {
          dark: 'rgba(10, 10, 10, 0.85)',
          medium: 'rgba(26, 26, 26, 0.8)',
          light: 'rgba(38, 38, 38, 0.75)',
          card: 'rgba(20, 20, 20, 0.9)',
          overlay: 'rgba(0, 0, 0, 0.6)',
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
        // Base shadows - softer, more depth
        'sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        // Glass shadows for glassmorphism
        'glass': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.5)',
        // Accent glows (preserved orange theme)
        'orange-sm': '0 0 8px rgba(255, 107, 53, 0.2)',
        'orange-md': '0 0 16px rgba(255, 107, 53, 0.3)',
        'orange-glow': '0 0 24px rgba(255, 107, 53, 0.4)',
        'orange-glow-strong': '0 0 32px rgba(255, 107, 53, 0.5)',
        'cyan-glow': '0 0 20px rgba(0, 255, 255, 0.25)',
        // Inset shadows for depth
        'inner-sm': 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
        'inner-md': 'inset 0 4px 8px rgba(0, 0, 0, 0.4)',
        // Legacy
        'terminal': '0 2px 4px 0 rgba(0, 0, 0, 0.9)',
      },
      borderRadius: {
        // Modern rounded corners scale
        'none': '0',
        'xs': '2px',      // Subtle rounding for small elements
        'sm': '4px',      // Inputs, badges, small buttons
        'md': '6px',      // Cards, standard buttons
        'lg': '8px',      // Larger cards, panels
        'xl': '12px',     // Modal containers, major panels
        '2xl': '16px',    // Hero cards, feature sections
        '3xl': '24px',    // Full-width panels, main container
        'full': '9999px', // Pills, circular elements
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

