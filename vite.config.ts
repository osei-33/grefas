import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  const vitePaystackPublicKey = env.VITE_PAYSTACK_PUBLIC_KEY || env.PAYSTACK_PUBLIC_KEY || '';
  const paystackPublicKey = env.PAYSTACK_PUBLIC_KEY || env.VITE_PAYSTACK_PUBLIC_KEY || '';
  const paystackSecretKey = env.PAYSTACK_SECRET_KEY || '';

  // Audit and log critical environment variables for deployment verification
  console.log('====================================================');
  console.log('[Vite Build Config] Critical Environment Variables Audit:');
  console.log(`  - VITE_PAYSTACK_PUBLIC_KEY: ${env.VITE_PAYSTACK_PUBLIC_KEY ? `Loaded (${env.VITE_PAYSTACK_PUBLIC_KEY.slice(0, 8)}...${env.VITE_PAYSTACK_PUBLIC_KEY.slice(-4)})` : 'NOT FOUND'}`);
  console.log(`  - PAYSTACK_PUBLIC_KEY:      ${env.PAYSTACK_PUBLIC_KEY ? `Loaded (${env.PAYSTACK_PUBLIC_KEY.slice(0, 8)}...${env.PAYSTACK_PUBLIC_KEY.slice(-4)})` : 'NOT FOUND'}`);
  console.log(`  - PAYSTACK_SECRET_KEY:      ${paystackSecretKey ? `Loaded (${paystackSecretKey.slice(0, 8)}...${paystackSecretKey.slice(-4)})` : 'NOT FOUND'}`);
  console.log(`  - Effective Client Key:     ${vitePaystackPublicKey ? `Resolved (${vitePaystackPublicKey.slice(0, 8)}...${vitePaystackPublicKey.slice(-4)})` : 'EMPTY'}`);
  console.log('====================================================');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_PAYSTACK_PUBLIC_KEY': JSON.stringify(vitePaystackPublicKey),
      'process.env.PAYSTACK_PUBLIC_KEY': JSON.stringify(paystackPublicKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: [
        'react',
        'react-dom',
        'react-router',
        'react-router-dom',
        'react-helmet-async',
        'motion',
        'firebase',
        '@firebase/app',
        '@firebase/auth',
        '@firebase/component',
        '@firebase/firestore',
        '@firebase/storage'
      ],
    },
    esbuild: {
      target: 'es2022',
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router',
        'react-router-dom',
        'react-helmet-async',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/storage',
        '@paystack/inline-js',
        'class-variance-authority',
        'clsx',
        'date-fns',
        'jspdf',
        'lucide-react',
        'motion/react',
        'next-themes',
        'react-day-picker',
        'recharts',
        'sonner',
        'tailwind-merge'
      ],
      esbuildOptions: {
        target: 'es2022',
      },
    },
    build: {
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router', 'react-router-dom', 'react-helmet-async'],
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
            'vendor-icons': ['lucide-react'],
            'vendor-motion': ['motion/react'],
            'vendor-charts': ['recharts'],
          },
        },
      },
      chunkSizeWarningLimit: 1500,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
