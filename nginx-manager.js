import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import ejs from 'ejs';
import { nginxTemplate } from './nginx-template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = process.env.NGINX_CONF_DIR || '/etc/nginx/conf.d';
const TMP_DIR = process.env.NGINX_TMP_DIR || '/tmp';

export async function createConfig(config) {
  const { name } = config;
  if (!name) throw new Error('Missing config name');

  const tempPath = path.join(TMP_DIR, `nginx-test-${name}-${Date.now()}.conf`);
  const finalPath = path.join(CONFIG_DIR, `${name}.conf`);

  const content = nginxTemplate(config);
  await fs.writeFile(tempPath, content);

  try {
    await execPromise(`nginx -t -c ${tempPath}`);
    await fs.rename(tempPath, finalPath); // seulement si valide
    return { name, path: finalPath };
  } catch (err) {
    await fs.unlink(tempPath).catch(() => {});
    throw new Error(`Invalid config: ${err.message}`);
  }
}

export async function listConfigs(verbose = false) {
  const files = (await fs.readdir(CONFIG_DIR)).filter(f => f.endsWith('.conf'));

  if (!verbose) return files;

  const results = [];
  for (const file of files) {
    const content = await fs.readFile(path.join(CONFIG_DIR, file), 'utf-8');
    results.push({ name: file, content });
  }
  return results;
}

export async function getConfig(name) {
  const filepath = path.join(CONFIG_DIR, `${name}.conf`);
  return await fs.readFile(filepath, 'utf-8');
}

export async function deleteConfig(name) {
  const filepath = path.join(CONFIG_DIR, `${name}.conf`);
  await fs.unlink(filepath);
}

export function reloadNginx() {
  return execPromise('nginx -s reload');
}

export function validateNginx() {
  return execPromise('nginx -t');
}

export async function validateConfigByName(name) {
  const filepath = path.join(CONFIG_DIR, `${name}.conf`);
  const tempPath = path.join(TMP_DIR, `nginx-check-${name}-${Date.now()}.conf`);
  try {
    await fs.access(filepath);
    await fs.copyFile(filepath, tempPath);
    await execPromise(`nginx -t -c ${tempPath}`);
    await fs.unlink(tempPath);
    return true;
  } catch (err) {
    throw new Error(`Invalid config: ${err.message}`);
  }
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr.trim()));
      resolve(stdout.trim());
    });
  });
}
