/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        primary: '#1E293B',     
        secondary: '#69A5FA',   
        tertiary: '#F59E0B',    
        success: '#059669',     
        danger: '#DC2626',      
        'text-main': '#1A292C', 
        'text-muted': '#666663', 
        'bg-main': '#F0F4F8',   
        'bg-surface': '#FFFFFF',
      },
      spacing: {
        'xs': '4px',   // Ícones e textos
        'sm': '8px',   // Labels e campos
        'md': '16px',  // Entre componentes
        'lg': '24px',  // Entre grupos
        'xl': '32px',  // Entre seções
        'xxl': '48px', // Grandes blocos
      },
      borderRadius: {
        'sm': '8px',   // Inputs e tags
        'md': '12px',  // Cards e modais
        'lg': '16px',  // Botões
      }
    },
  },
  plugins: [],
}