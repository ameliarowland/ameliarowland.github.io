import { execFile } from 'node:child_process';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const portfolioRoot = path.resolve(scriptDirectory, '..');
const slingshotRoot = path.resolve(
  portfolioRoot,
  process.argv[2] ?? '../slingshot',
);
const sourceData = path.join(
  slingshotRoot,
  'app',
  'data',
  'locations.json',
);
const staticBuild = path.join(slingshotRoot, 'dist-static');
const publishedMap = path.join(
  portfolioRoot,
  'public',
  'slingshot-radical-contact-map',
);
const articlePath = path.join(
  portfolioRoot,
  'src',
  'content',
  'maps',
  'slingshot-radical-contact-map.md',
);

const sourceText = await readFile(sourceData, 'utf8');
const directory = JSON.parse(sourceText);

if (!Array.isArray(directory.locations) || directory.locations.length === 0) {
  throw new Error(`No locations found in ${sourceData}`);
}

const ids = new Set();
for (const location of directory.locations) {
  if (
    typeof location.id !== 'string' ||
    !location.id ||
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng)
  ) {
    throw new Error(`Invalid published location: ${location.name ?? 'unknown'}`);
  }
  if (ids.has(location.id)) {
    throw new Error(`Duplicate location id: ${location.id}`);
  }
  ids.add(location.id);
}

if (!process.env.npm_execpath) {
  throw new Error('Run this sync through npm: npm run sync:slingshot');
}

await execFileAsync(
  process.execPath,
  [process.env.npm_execpath, 'run', 'build:static'],
  {
  cwd: slingshotRoot,
  windowsHide: true,
  },
);
await access(path.join(staticBuild, 'index.html'));

const publicRoot = path.join(portfolioRoot, 'public');
if (path.dirname(publishedMap) !== publicRoot) {
  throw new Error(`Unsafe published map path: ${publishedMap}`);
}

await rm(publishedMap, { recursive: true, force: true });
await mkdir(publishedMap, { recursive: true });
await cp(staticBuild, publishedMap, { recursive: true });

const count = directory.locations.length.toLocaleString('en-US');
const article = await readFile(articlePath, 'utf8');
const countSentence =
  /the final dataset contains [\d,]+ locations with source links\./i;

if (!countSentence.test(article)) {
  throw new Error(`Could not find the location count in ${articlePath}`);
}

const updatedArticle = article.replace(
  countSentence,
  `the final dataset contains ${count} locations with source links.`,
);

await writeFile(articlePath, updatedArticle, 'utf8');
console.log(`Synced the Slingshot map and ${count} locations from ${slingshotRoot}`);
