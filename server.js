require('dotenv').config();
const { createApp } = require('./src/server/app');
const { PORT } = require('./src/server/config');

const app = createApp();

app.listen(PORT, () => {
  console.log(`Sur Sadhana Pro running at http://localhost:${PORT}`);
});
