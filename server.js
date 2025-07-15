import express from 'express';
import bodyParser from 'body-parser';
import { createConfig, deleteConfig, listConfigs, getConfig, reloadNginx, validateNginx } from './nginx-manager.js';
import { nginxConfigSchema } from './schema.js';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/configs', async (req, res) => {
  try {
    console.log('Zod parse start');
console.log(req.body);
const validated = nginxConfigSchema.parse(req.body);
console.log('Zod parse OK');

    const result = await createConfig(validated);
    res.status(201).json(result);
  } catch (err) {
  console.error('💥 Zod parse error:', err);
  if (err.errors) {
    return res.status(400).json({ error: err.errors.map(e => `${e.path.join('.')} → ${e.message}`) });
  }
  return res.status(500).json({ error: err.message || 'Unexpected error' });
}

});

app.get('/configs', async (req, res) => {
  try {
    const full = req.query.full === 'true';
    const result = await listConfigs(full);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

import { validateConfigByName } from './nginx-manager.js';

app.get('/check/:name', async (req, res) => {
  try {
    await validateConfigByName(req.params.name);
    res.json({ valid: true });
  } catch (err) {
    res.status(400).json({ valid: false, error: err.message });
  }
});

app.get('/configs/:name', async (req, res) => {
  try {
    const result = await getConfig(req.params.name);
    res.send(result);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.delete('/configs/:name', async (req, res) => {
  try {
    await deleteConfig(req.params.name);
    res.status(204).end();
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/reload', async (_req, res) => {
  try {
    await reloadNginx();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/validate', async (_req, res) => {
  try {
    const output = await validateNginx();
    res.json({ valid: true, output });
  } catch (err) {
    res.status(400).json({ valid: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🔧 NGINX sidecar API listening on port ${PORT}`);
});
