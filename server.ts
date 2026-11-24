import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'gbstudy.json');

interface AppCatalogRecord {
  id: string;
  name: string;
  label: string;
  description: string;
  logo_url: string | null;
  app_url: string | null;
  app_url_2: string | null;
  app_url_3: string | null;
  app_url_4: string | null;
  tone: string;
  sort_order: number;
  vip_text: string;
  open_text: string;
  is_active: boolean;
  created_at: string;
}

interface SliderPhotoRecord {
  id: string;
  image_data: string;
  sort_order: number;
  created_at: string;
}

interface DbSchema {
  site_branding: {
    header_title: string;
    updated_at: string;
  };
  app_catalog: AppCatalogRecord[];
  app_link_counters: Record<string, [number, number, number, number]>;
  slider_photos: SliderPhotoRecord[];
  social_links: {
    telegram: string;
    youtube: string;
    whatsapp: string;
    instagram: string;
  };
}

function createInitialDb(): DbSchema {
  const now = new Date().toISOString();
  return {
    site_branding: {
      header_title: '𝐆𝐁 𝐒𝐓𝐔𝐃𝐘',
      updated_at: now,
    },
    app_catalog: [],
    app_link_counters: {},
    slider_photos: [],
    social_links: {
      telegram: 'https://t.me/gbstudy',
      youtube: 'https://youtube.com/@gbstudy',
      whatsapp: 'https://wa.me/919999999999',
      instagram: 'https://instagram.com/gbstudy',
    },
  };
}

let cachedDb: DbSchema | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function writeDb(db: DbSchema): void {
  ensureDataDir();
  cachedDb = db;
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_PATH);
}

function readDb(): DbSchema {
  if (cachedDb) return cachedDb;
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    const initial = createInitialDb();
    writeDb(initial);
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<DbSchema>;
  const defaults = createInitialDb();
  const normalized: DbSchema = {
    site_branding: parsed.site_branding ?? defaults.site_branding,
    app_catalog: Array.isArray(parsed.app_catalog) ? parsed.app_catalog : defaults.app_catalog,
    app_link_counters: parsed.app_link_counters ?? {},
    slider_photos: Array.isArray(parsed.slider_photos)
      ? parsed.slider_photos
      : defaults.slider_photos,
    social_links: parsed.social_links ?? defaults.social_links,
  };
  cachedDb = normalized;
  return normalized;
}

// ---------------- SSE LIVE UPDATES ----------------

const sseClients = new Set<express.Response>();

function broadcastUpdate(): void {
  const payload = `event: update\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// ---------------- ADMIN AUTH ----------------

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@gbstudy.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'gbstudy123';
const SECRET_PATH = path.join(DATA_DIR, '.session_secret');
const COOKIE_NAME = 'gb_admin_session';

function getSessionSecret(): string {
  if (process.env.ADMIN_SESSION_SECRET) return process.env.ADMIN_SESSION_SECRET;
  ensureDataDir();
  if (fs.existsSync(SECRET_PATH)) {
    const existing = fs.readFileSync(SECRET_PATH, 'utf-8').trim();
    if (existing.length >= 32) return existing;
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_PATH, generated, 'utf-8');
  return generated;
}

const SESSION_SECRET = getSessionSecret();

function signSession(email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySession(token: string | undefined): { email: string } | null {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      email?: string;
      exp?: number;
    };
    if (!parsed.email || !parsed.exp || parsed.exp < Date.now()) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function extractSessionToken(req: express.Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const bearer = auth.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME];
}

function isHttpsRequest(req: express.Request): boolean {
  const forwarded = req.headers['x-forwarded-proto'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim().toLowerCase() === 'https';
  }
  return Boolean(req.secure);
}

function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const session = verifySession(extractSessionToken(req));
  if (!session) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Ensure DB exists at boot
  readDb();

  // ---------------- PUBLIC APIs ----------------

  app.get('/api/public/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  app.get('/api/public/bootstrap', (_req, res) => {
    const db = readDb();
    const apps = [...db.app_catalog].sort((a, b) => a.sort_order - b.sort_order);
    const sliderPhotos = [...db.slider_photos].sort((a, b) => a.sort_order - b.sort_order);
    res.json({
      branding: db.site_branding,
      apps,
      sliderPhotos,
      socialLinks: db.social_links,
    });
  });

  app.get('/api/public/apps/:id', (req, res) => {
    const db = readDb();
    const item = db.app_catalog.find((a) => a.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    res.json({ app: item });
  });

  app.post('/api/public/apps/:id/assign-link', (req, res) => {
    const db = readDb();
    const item = db.app_catalog.find((a) => a.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    const availableSlots: number[] = [];
    if (item.app_url?.trim()) availableSlots.push(1);
    if (item.app_url_2?.trim()) availableSlots.push(2);
    if (item.app_url_3?.trim()) availableSlots.push(3);
    if (item.app_url_4?.trim()) availableSlots.push(4);

    if (availableSlots.length === 0) {
      res.json({ slot: 1 });
      return;
    }

    const counts = db.app_link_counters[item.id] ?? [0, 0, 0, 0];
    let chosenSlot = availableSlots[0];
    let minCount = counts[chosenSlot - 1] ?? 0;

    for (const slot of availableSlots) {
      const c = counts[slot - 1] ?? 0;
      if (c < minCount) {
        minCount = c;
        chosenSlot = slot;
      }
    }

    counts[chosenSlot - 1] = (counts[chosenSlot - 1] ?? 0) + 1;
    db.app_link_counters[item.id] = counts;
    writeDb(db);

    res.json({ slot: chosenSlot });
  });

  // ---------------- ADMIN AUTH ----------------

  app.get('/api/admin/session', (req, res) => {
    const session = verifySession(extractSessionToken(req));
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, email: session.email });
  });

  app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');

    if (cleanEmail !== ADMIN_EMAIL.toLowerCase() || cleanPass !== ADMIN_PASSWORD) {
      res.status(401).json({ error: 'Email ya password sahi nahi hai. Dobara try karein.' });
      return;
    }

    const token = signSession(cleanEmail);
    const sameSite = isHttpsRequest(req) ? 'SameSite=None; Secure' : 'SameSite=Lax';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${sameSite}; Max-Age=${30 * 24 * 60 * 60}`
    );
    res.json({ ok: true, email: cleanEmail, token });
  });

  app.post('/api/admin/logout', (req, res) => {
    const sameSite = isHttpsRequest(req) ? 'SameSite=None; Secure' : 'SameSite=Lax';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE_NAME}=; Path=/; HttpOnly; ${sameSite}; Max-Age=0`
    );
    res.json({ ok: true });
  });

  // ---------------- ADMIN DASHBOARD & MUTATIONS ----------------

  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    const db = readDb();
    res.json({
      apps: [...db.app_catalog].sort((a, b) => a.sort_order - b.sort_order),
      linkCounters: db.app_link_counters,
      branding: db.site_branding,
      sliderPhotos: [...db.slider_photos].sort((a, b) => a.sort_order - b.sort_order),
      socialLinks: db.social_links,
    });
  });

  app.post('/api/admin/apps', requireAdmin, (req, res) => {
    const db = readDb();
    const body = req.body as Partial<AppCatalogRecord>;
    const name = String(body.name || '').trim();
    if (!name) {
      res.status(400).json({ error: 'App name is required.' });
      return;
    }
    const maxSort = db.app_catalog.reduce((acc, item) => Math.max(acc, item.sort_order), 0);
    const created: AppCatalogRecord = {
      id: crypto.randomUUID(),
      name,
      label: String(body.label || '').trim(),
      description: String(body.description || '').trim(),
      logo_url: body.logo_url && body.logo_url !== '/favicon.png' ? body.logo_url : null,
      app_url: body.app_url?.trim() || null,
      app_url_2: body.app_url_2?.trim() || null,
      app_url_3: body.app_url_3?.trim() || null,
      app_url_4: body.app_url_4?.trim() || null,
      tone: body.tone || 'app-card-amber',
      sort_order: maxSort + 1,
      vip_text: body.vip_text?.trim() || 'VIP',
      open_text: body.open_text?.trim() || 'OPEN THIS APP',
      is_active: Boolean(body.is_active),
      created_at: new Date().toISOString(),
    };
    db.app_catalog.push(created);
    writeDb(db);
    broadcastUpdate();
    res.json({ app: created });
  });

  app.put('/api/admin/apps/:id', requireAdmin, (req, res) => {
    const db = readDb();
    const idx = db.app_catalog.findIndex((a) => a.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'App not found.' });
      return;
    }
    const body = req.body as Partial<AppCatalogRecord>;
    const existing = db.app_catalog[idx];
    const updated: AppCatalogRecord = {
      ...existing,
      name: body.name !== undefined ? String(body.name).trim() : existing.name,
      label: body.label !== undefined ? String(body.label).trim() : existing.label,
      description:
        body.description !== undefined ? String(body.description).trim() : existing.description,
      logo_url:
        body.logo_url !== undefined
          ? body.logo_url && body.logo_url !== '/favicon.png'
            ? body.logo_url
            : null
          : existing.logo_url,
      app_url: body.app_url !== undefined ? body.app_url?.trim() || null : existing.app_url,
      app_url_2:
        body.app_url_2 !== undefined ? body.app_url_2?.trim() || null : existing.app_url_2,
      app_url_3:
        body.app_url_3 !== undefined ? body.app_url_3?.trim() || null : existing.app_url_3,
      app_url_4:
        body.app_url_4 !== undefined ? body.app_url_4?.trim() || null : existing.app_url_4,
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : existing.is_active,
    };
    db.app_catalog[idx] = updated;
    writeDb(db);
    broadcastUpdate();
    res.json({ app: updated });
  });

  app.delete('/api/admin/apps/:id', requireAdmin, (req, res) => {
    const db = readDb();
    db.app_catalog = db.app_catalog.filter((a) => a.id !== req.params.id);
    delete db.app_link_counters[req.params.id];
    writeDb(db);
    broadcastUpdate();
    res.json({ ok: true });
  });

  app.put('/api/admin/branding', requireAdmin, (req, res) => {
    const db = readDb();
    const { header_title } = req.body as { header_title?: string };
    db.site_branding = {
      header_title: String(header_title || '').trim() || '𝐆𝐁 𝐒𝐓𝐔𝐃𝐘',
      updated_at: new Date().toISOString(),
    };
    writeDb(db);
    broadcastUpdate();
    res.json({ branding: db.site_branding });
  });

  app.post('/api/admin/slider', requireAdmin, (req, res) => {
    const db = readDb();
    const { images } = req.body as { images?: string[] };
    const list = Array.isArray(images) ? images.filter(Boolean) : [];
    let maxOrder = db.slider_photos.reduce((acc, s) => Math.max(acc, s.sort_order), 0);
    const now = new Date().toISOString();
    for (const img of list) {
      maxOrder += 1;
      db.slider_photos.push({
        id: crypto.randomUUID(),
        image_data: img,
        sort_order: maxOrder,
        created_at: now,
      });
    }
    writeDb(db);
    broadcastUpdate();
    res.json({ sliderPhotos: [...db.slider_photos].sort((a, b) => a.sort_order - b.sort_order) });
  });

  app.put('/api/admin/slider/:id', requireAdmin, (req, res) => {
    const db = readDb();
    const { image_data } = req.body as { image_data?: string };
    const item = db.slider_photos.find((s) => s.id === req.params.id);
    if (!item || !image_data) {
      res.status(404).json({ error: 'Slide not found.' });
      return;
    }
    item.image_data = image_data;
    writeDb(db);
    broadcastUpdate();
    res.json({ sliderPhotos: [...db.slider_photos].sort((a, b) => a.sort_order - b.sort_order) });
  });

  app.post('/api/admin/slider/reorder', requireAdmin, (req, res) => {
    const db = readDb();
    const { idA, idB } = req.body as { idA?: string; idB?: string };
    const a = db.slider_photos.find((s) => s.id === idA);
    const b = db.slider_photos.find((s) => s.id === idB);
    if (a && b) {
      const tmp = a.sort_order;
      a.sort_order = b.sort_order;
      b.sort_order = tmp;
      writeDb(db);
      broadcastUpdate();
    }
    res.json({ sliderPhotos: [...db.slider_photos].sort((a, b) => a.sort_order - b.sort_order) });
  });

  app.delete('/api/admin/slider/:id', requireAdmin, (req, res) => {
    const db = readDb();
    db.slider_photos = db.slider_photos.filter((s) => s.id !== req.params.id);
    writeDb(db);
    broadcastUpdate();
    res.json({ sliderPhotos: [...db.slider_photos].sort((a, b) => a.sort_order - b.sort_order) });
  });

  app.put('/api/admin/social-links', requireAdmin, (req, res) => {
    const db = readDb();
    const { telegram, youtube, whatsapp, instagram } = req.body as Partial<
      DbSchema['social_links']
    >;
    db.social_links = {
      telegram: String(telegram || '').trim(),
      youtube: String(youtube || '').trim(),
      whatsapp: String(whatsapp || '').trim(),
      instagram: String(instagram || '').trim(),
    };
    writeDb(db);
    broadcastUpdate();
    res.json({ socialLinks: db.social_links });
  });

  // ---------------- CLOUDFLARE PAGES ZIP EXPORT ----------------

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function buildZipBuffer(entries: Array<{ name: string; data: Buffer }>): Buffer {
    const localParts: Buffer[] = [];
    const centralParts: Buffer[] = [];
    let offset = 0;

    for (const entry of entries) {
      const nameBuf = Buffer.from(entry.name, 'utf-8');
      const compressed = zlib.deflateRawSync(entry.data);
      const crc = crc32(entry.data);

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4); // version needed
      localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
      localHeader.writeUInt16LE(8, 8); // deflate compression
      localHeader.writeUInt16LE(0, 10);
      localHeader.writeUInt16LE(0, 12);
      localHeader.writeUInt32LE(crc, 14);
      localHeader.writeUInt32LE(compressed.length, 18);
      localHeader.writeUInt32LE(entry.data.length, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);

      localParts.push(localHeader, nameBuf, compressed);

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8);
      centralHeader.writeUInt16LE(8, 10);
      centralHeader.writeUInt16LE(0, 12);
      centralHeader.writeUInt16LE(0, 14);
      centralHeader.writeUInt32LE(crc, 16);
      centralHeader.writeUInt32LE(compressed.length, 20);
      centralHeader.writeUInt32LE(entry.data.length, 24);
      centralHeader.writeUInt16LE(nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(offset, 42);

      centralParts.push(centralHeader, nameBuf);
      offset += localHeader.length + nameBuf.length + compressed.length;
    }

    const centralSize = centralParts.reduce((sum, b) => sum + b.length, 0);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralSize, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, ...centralParts, eocd]);
  }

  function collectDistFiles(dir: string, baseDir: string): Array<{ name: string; data: Buffer }> {
    const results: Array<{ name: string; data: Buffer }> = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      if (rel.startsWith('assets/aistudio/') || item.name === '.DS_Store' || item.name.endsWith('.map')) {
        continue;
      }
      if (item.isDirectory()) {
        results.push(...collectDistFiles(full, baseDir));
      } else if (item.isFile()) {
        results.push({ name: rel, data: fs.readFileSync(full) });
      }
    }
    return results;
  }

  app.get('/api/download/cloudflare-pages.zip', (_req, res) => {
    try {
      const distDir = path.resolve(process.cwd(), 'dist');
      if (!fs.existsSync(path.join(distDir, 'index.html'))) {
        execSync('npx vite build', { cwd: process.cwd(), stdio: 'pipe' });
      }
      const files = collectDistFiles(distDir, distDir).filter((f) => f.name !== 'bootstrap.json');

      const db = readDb();
      const bootstrapPayload = {
        branding: db.site_branding,
        apps: [...db.app_catalog].sort((a, b) => a.sort_order - b.sort_order),
        sliderPhotos: [...db.slider_photos].sort((a, b) => a.sort_order - b.sort_order),
        socialLinks: db.social_links,
      };
      files.push({
        name: 'bootstrap.json',
        data: Buffer.from(JSON.stringify(bootstrapPayload), 'utf-8'),
      });

      if (!files.some((f) => f.name === '_redirects')) {
        files.push({ name: '_redirects', data: Buffer.from('/* /index.html 200\n', 'utf-8') });
      }

      const zipBuf = buildZipBuffer(files);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="gb-study-cloudflare-pages.zip"');
      res.setHeader('Content-Length', String(zipBuf.length));
      res.send(zipBuf);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'ZIP build failed.',
      });
    }
  });

  // ---------------- VITE / STATIC SERVING ----------------

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GB STUDY server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
