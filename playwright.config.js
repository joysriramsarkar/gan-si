const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3123',
    channel: 'chrome',
    headless: true,
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required']
    }
  },
  webServer: {
    command: 'node server.js',
    port: 3123,
    env: { PORT: '3123' },
    reuseExistingServer: true
  }
});
