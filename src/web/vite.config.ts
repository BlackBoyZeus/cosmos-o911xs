// External imports
import { defineConfig } from 'vite'; // ^5.0.0
import react from '@vitejs/plugin-react'; // ^4.2.0
import tsconfigPaths from 'vite-tsconfig-paths'; // ^4.2.0

// Internal imports
import { apiConfig } from './src/config/api';

// Environment variable types
interface EnvConfig {
  VITE_API_BASE_URL: string;
  VITE_MODEL_VERSION: string;
  VITE_GPU_TYPE: string;
  VITE_GPU_MEMORY: string;
  VITE_ENABLE_GPU_METRICS: string;
}

export default defineConfig({
  plugins: [
    react({
      // React-specific optimizations for ML components
      babel: {
        plugins: [
          ['@babel/plugin-transform-runtime'],
          ['@emotion/babel-plugin']
        ]
      },
      // Fast refresh optimization for ML model development
      fastRefresh: true
    }),
    tsconfigPaths()
  ],

  server: {
    port: 3000,
    // GPU-aware proxy configuration
    proxy: {
      '/api': {
        target: apiConfig.baseURL,
        changeOrigin: true,
        secure: false,
        headers: {
          'X-GPU-Required': 'true',
          'X-Model-Version': '${VITE_MODEL_VERSION}',
          'X-Request-ID': crypto.randomUUID()
        }
      },
      '/gpu': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        secure: false,
        headers: {
          'X-GPU-Type': '${VITE_GPU_TYPE}',
          'X-GPU-Memory': '${VITE_GPU_MEMORY}',
          'X-GPU-Metrics-Enabled': '${VITE_ENABLE_GPU_METRICS}'
        }
      }
    },
    // CORS configuration for ML endpoints
    cors: {
      origin: [
        'http://localhost:3000',
        'https://cosmos-wfm.ai'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-GPU-Required',
        'X-Model-Version',
        'X-Request-ID'
      ]
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: true,
    target: 'esnext',
    // Optimized build configuration for ML models
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor dependencies
          'vendor-core': [
            'react',
            'react-dom',
            'react-router-dom'
          ],
          // Visualization dependencies
          'vendor-viz': [
            'chart.js',
            'react-chartjs-2',
            '@nivo/core',
            '@nivo/line'
          ],
          // UI component dependencies
          'vendor-ui': [
            '@mui/material',
            '@emotion/react',
            '@emotion/styled'
          ],
          // ML-specific dependencies
          'ml-core': [
            '@tensorflow/tfjs',
            '@pytorch/serve'
          ],
          // Model chunks with size optimization
          'ml-models': {
            include: [/models\/.+/],
            maxSize: 50000000 // 50MB chunks for models
          }
        }
      }
    },
    // Asset optimization settings
    assetsInlineLimit: 10000,
    chunkSizeWarningLimit: 2000,
    cssCodeSplit: true,
    reportCompressedSize: true
  },

  // Environment variable configuration
  envPrefix: 'VITE_',
  define: {
    __GPU_ENABLED__: true,
    __MODEL_VERSION__: JSON.stringify(process.env.VITE_MODEL_VERSION),
    __API_BASE_URL__: JSON.stringify(process.env.VITE_API_BASE_URL)
  },

  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@emotion/react',
      '@mui/material',
      '@tensorflow/tfjs'
    ],
    exclude: [
      '@pytorch/serve' // Exclude PyTorch.js from optimization
    ]
  },

  // Worker configuration for ML processing
  worker: {
    format: 'es',
    plugins: [
      // Worker-specific plugins
    ]
  },

  // Source map configuration for debugging
  css: {
    devSourcemap: true
  },

  // Preview server configuration
  preview: {
    port: 3000,
    host: true
  }
});