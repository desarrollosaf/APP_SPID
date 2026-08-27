import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'mx.congresoedomex.spid',
  appName: 'SPID',
  webDir: 'www',
  plugins: {
    StatusBar: {
      style: 'DARK',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'ionic',
    },
  },
};

export default config;
