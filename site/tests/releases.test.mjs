import assert from 'node:assert/strict';
import { detectOS, classifyAssets, pickPrimary, formatSize, formatDate, fetchLatest } from '../src/lib/releases.js';

const assets = [
  'SankaQueueManager-Setup-1.2.0.exe', 'SankaQueueManager-Portable-1.2.0.exe', 'SankaQueueManager-Setup-1.2.0.exe.blockmap',
  'SankaQueueManager-1.2.0-mac-arm64.dmg', 'SankaQueueManager-1.2.0-mac-x64.dmg', 'SankaQueueManager-1.2.0-mac-arm64.zip',
  'SankaQueueManager-1.2.0-linux-x86_64.AppImage', 'latest.yml', 'latest-mac.yml', 'latest-linux.yml',
].map((name, i) => ({ name, size: 90_000_000 + i, browser_download_url: `https://example.com/${name}` }));

const items = classifyAssets(assets);
assert.deepEqual(items.map((i) => i.id), ['win-setup', 'win-portable', 'mac-arm64', 'mac-x64', 'linux']);
assert.equal(items.find((i) => i.id === 'win-setup').name, 'SankaQueueManager-Setup-1.2.0.exe');
assert.equal(pickPrimary('win', items).id, 'win-setup');
assert.equal(pickPrimary('linux', items).id, 'linux');
assert.equal(pickPrimary('mac', items), null);
assert.equal(pickPrimary('win', []), null);

assert.equal(detectOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Windows'), 'win');
assert.equal(detectOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel'), 'mac');
assert.equal(detectOS('Mozilla/5.0 (X11; Linux x86_64)', 'Linux x86_64'), 'linux');
assert.equal(detectOS('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l'), 'other');
assert.equal(detectOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone'), 'other');
assert.equal(detectOS('', ''), 'other');

assert.equal(formatSize(0), ''); assert.equal(formatSize(5.5 * 1024 * 1024), '5.5 MB'); assert.equal(formatSize(120 * 1024 * 1024), '120 MB');
assert.equal(formatDate('2026-10-25T10:00:00Z'), '2026年10月25日'); assert.equal(formatDate('x'), '');

const ok = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const rel = await fetchLatest('a/b', ok(200, { tag_name: 'v1.2.0', published_at: '2026-10-25T00:00:00Z', html_url: 'https://github.com/a/b/releases/tag/v1.2.0', assets }));
assert.equal(rel.version, '1.2.0'); assert.equal(rel.items.length, 5);
assert.equal(await fetchLatest('a/b', ok(404, {})), null);
await assert.rejects(() => fetchLatest('a/b', ok(403, {})), /403/);
console.log('releases tests passed');
