import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(process.env.NEXA_DELIVERY_DIR || join(root, 'dist', 'nexa-delivery'));

function endpoint(name) {
  const value = String(process.env[name] || '').trim().replace(/\/+$/, '');
  if (!value) throw new Error(`${name} is required`);
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`${name} must be a valid URL`); }
  const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !local) throw new Error(`${name} must use HTTPS unless it is loopback`);
  return value;
}

function copy(relativePath) {
  const source = join(root, relativePath);
  const target = join(output, relativePath);
  if (!existsSync(source)) throw new Error(`delivery source missing: ${relativePath}`);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}

function injectConfig(relativePath, marker) {
  const target = join(output, relativePath);
  const html = readFileSync(target, 'utf8');
  if (!html.includes(marker)) throw new Error(`runtime config marker not found: ${relativePath}`);
  writeFileSync(target, html.replace(marker, `<script src="./runtime-config.js"></script>${marker}`));
}

const customerApi = endpoint('NEXA_PUBLIC_API_ORIGIN');
const operationsApi = endpoint('NEXA_OPS_API_ORIGIN');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

copy('customer-ui.js');

const corporate = [
  'index.html', 'about.html', 'services.html', 'industries.html', 'cases.html', 'playbook.html', 'contact.html',
  'styles.css', 'styles-100.css', 'clarity.css', 'app.js'
];
for (const file of corporate) copy(`nexa-tech-service/${file}`);
writeFileSync(join(output, 'nexa-tech-service', 'runtime-config.js'), `window.NEXA_INQUIRY_ENDPOINT=${JSON.stringify(customerApi)};\n`);
for (const page of ['index.html','about.html','services.html','industries.html','cases.html','playbook.html','contact.html']) injectConfig(`nexa-tech-service/${page}`, '<script src="./app.js"></script>');

for (const file of ['index.html','styles.css','portal-actions.css','app.js']) copy(`nexa-service-domain/${file}`);
writeFileSync(join(output, 'nexa-service-domain', 'runtime-config.js'), `window.NEXA_CUSTOMER_PORTAL_ENDPOINT=${JSON.stringify(customerApi)};\n`);
injectConfig('nexa-service-domain/index.html', '<script src="./app.js"></script>');

for (const file of ['index.html','styles.css','responsive-100.css','delivery-100.css','customer-actions.css','app.js','remote-app.mjs','inquiry-desk.mjs','team-admin.mjs']) copy(`field-service-ops/${file}`);
writeFileSync(join(output, 'field-service-ops', 'runtime-config.js'), `window.NEXA_OPS_CONFIG=Object.freeze({endpoint:${JSON.stringify(operationsApi)}});\n`);
injectConfig('field-service-ops/index.html', '<script type="module" src="./app.js"></script>');

const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  customerApi,
  operationsApi,
  surfaces: ['nexa-tech-service', 'nexa-service-domain', 'field-service-ops'],
  excluded: ['server source', 'tests', 'demo-delivery-app.mjs', 'demo-app.mjs', 'credentials']
};
writeFileSync(join(output, 'delivery-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`NEXA delivery web bundle: ${output}`);
