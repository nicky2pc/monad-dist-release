// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { Plugin } from 'vite';

const appVersion = Date.now(); 

function fcFrameMeta(): Plugin {
  return {
    name: 'inject-fc-frame-meta',
    transformIndexHtml(html: string) {
      const config = {
        version: 'next',
        imageUrl: 'http://monad-dist-release.vercel.app/logo_2.png',
        button: {
          title: 'Play!',
          action: {
            type: 'launch_frame',
            name: 'Monagayanimals',
            url: `http://monad-dist-release.vercel.app/?v=${appVersion}`, 
            splashImageUrl: 'http://monad-dist-release.vercel.app/logo_2.png',
            splashBackgroundColor: '#8366eb',
          },
        },
      };

      const metaTag = `<meta name="fc:frame" content='${JSON.stringify(config)}'>`;
      return html.replace('</head>', `${metaTag}\n</head>`);
    },
  };
}

export default defineConfig({
  plugins: [react(), fcFrameMeta()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    port: 3000,
    allowedHosts: [
      'monad-mobile-phi.vercel.app',
      '314f7f20912e.ngrok.app',
      'monagaynanimals.xyz',
      'e38637b40d99.ngrok.app'
    ],
    headers: {
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': 'frame-ancestors *',
    },
  },
});
