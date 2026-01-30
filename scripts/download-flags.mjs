import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CONSTANTS_PATH = path.join(ROOT, 'constants.ts');
const OUTPUT_DIR = path.join(ROOT, 'public', 'flags');

const RESTCOUNTRIES_ALPHA_URL = 'https://restcountries.com/v3.1/alpha';
const REQUEST_TIMEOUT_MS = 20000;
const RETRIES = 3;
const CODES_PER_CHUNK = 25;

const getCountryCodesFromConstants = (source) => {
  const codes = new Set();
  const re = /code:\s*\"([A-Z]{2})\"/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    codes.add(match[1]);
  }
  return [...codes].sort();
};

const fetchWithTimeout = async (url, { signal } = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fetchJsonWithRetries = async (url) => {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (e) {
      lastError = e;
      await sleep(500 * attempt);
    }
  }
  throw lastError;
};

const download = async (url) => {
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const downloadWithRetries = async (url) => {
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      return await download(url);
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastError;
};

const getFlagUrlByCode = async (codes) => {
  const map = new Map();
  const chunks = chunk(codes, CODES_PER_CHUNK);

  for (const part of chunks) {
    const codesParam = encodeURIComponent(part.join(','));
    const url = `${RESTCOUNTRIES_ALPHA_URL}?codes=${codesParam}&fields=cca2,flags`;

    let data;
    try {
      data = /** @type {Array<{ cca2?: string, flags?: { svg?: string } }>} */ (await fetchJsonWithRetries(url));
    } catch (e) {
      console.error(`Failed to load chunk from restcountries (${part.join(', ')}):`, e?.message || e);
      continue;
    }

    for (const item of data) {
      const code = item?.cca2;
      const svg = item?.flags?.svg;
      if (!code || !svg) continue;
      map.set(code.toUpperCase(), svg);
    }
  }

  return map;
};

const main = async () => {
  const src = await fs.readFile(CONSTANTS_PATH, 'utf8');
  const codes = getCountryCodesFromConstants(src);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let flagUrlByCode;
  try {
    flagUrlByCode = await getFlagUrlByCode(codes);
  } catch (e) {
    console.error('Failed to load flag URLs from restcountries.com.');
    console.error('Check your internet/VPN/firewall and try again.');
    console.error(e?.message || e);
    process.exitCode = 1;
    return;
  }

  let ok = 0;
  let failed = 0;

  for (const code of codes) {
    const fileName = `${code.toLowerCase()}.svg`;
    const outPath = path.join(OUTPUT_DIR, fileName);

    try {
      await fs.access(outPath);
      ok += 1;
      continue;
    } catch {
      // continue to download
    }

    const url = flagUrlByCode.get(code);
    if (!url) {
      failed += 1;
      console.error(`Failed ${code}: no flag URL from restcountries`);
      continue;
    }
    try {
      const bytes = await downloadWithRetries(url);
      await fs.writeFile(outPath, bytes);
      ok += 1;
    } catch (e) {
      failed += 1;
      console.error(`Failed ${code}:`, e?.message || e);
    }
  }

  console.log(`Done. Saved/exists: ${ok}. Failed: ${failed}. Output: ${OUTPUT_DIR}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
};

await main();
