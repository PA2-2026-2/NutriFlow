require('dotenv/config');

const { createApp } = require('./app');

const app = createApp();

app.start();

function shutdown(signal) {
  console.log(`Encerrando NutriFlow (${signal})...`);

  app.stop()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Falha ao encerrar a aplicacao:', error);
      process.exit(1);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
