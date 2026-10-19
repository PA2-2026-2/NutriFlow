const appModule = require('../src/app');
const originalCreateApp = appModule.createApp;
const apps = new Set();

appModule.createApp = (...args) => {
  const app = originalCreateApp(...args);
  apps.add(app);
  return app;
};

afterAll(async () => {
  await Promise.all([...apps].map((app) => app.stop()));
});
