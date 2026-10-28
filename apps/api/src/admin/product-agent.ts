import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { existsSync } from 'node:fs';
import { isIP } from 'node:net';
import { z } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors/app-error.js';
import {
  createBrand,
  createCategory,
  createField,
  createSubcategory,
  readCatalog,
  updateField,
} from './catalog.js';

const inputSchema = z.object({
  model: z.string().trim().min(1).max(80),
  url: z
    .string()
    .trim()
    .max(2_000)
    .default('')
    .refine((value) => value.length === 0 || z.string().url().safeParse(value).success),
});

const proposalSchema = z.object({
  nameHe: z.string().trim().max(200).default(''),
  nameAr: z.string().trim().max(200).default(''),
  brand: z
    .object({
      id: z.string().max(80).default(''),
      name: z.string().trim().max(200).default(''),
      slug: z.string().max(80).default(''),
    })
    .default({ id: '', name: '', slug: '' }),
  category: z
    .object({
      id: z.string().max(80).default(''),
      nameHe: z.string().trim().max(200).default(''),
      nameAr: z.string().trim().max(200).default(''),
      slug: z.string().max(80).default(''),
    })
    .default({ id: '', nameHe: '', nameAr: '', slug: '' }),
  subcategory: z
    .object({
      id: z.string().max(80).default(''),
      nameHe: z.string().trim().max(200).default(''),
      nameAr: z.string().trim().max(200).default(''),
    })
    .default({ id: '', nameHe: '', nameAr: '' }),
  specs: z
    .array(
      z.object({
        fieldId: z.string().max(80).default(''),
        labelHe: z.string().trim().max(200).default(''),
        labelAr: z.string().trim().max(200).default(''),
        type: z.enum(['text', 'number', 'boolean']).default('text'),
        section: z.enum(['spec', 'features', 'info']).default('features'),
        value: z.string().trim().max(4_000).default(''),
        valueAr: z.string().trim().max(4_000).default(''),
      }),
    )
    .max(30)
    .default([]),
});

type Proposal = z.infer<typeof proposalSchema>;
type Catalog = Awaited<ReturnType<typeof readCatalog>>;
type Category = Catalog['categories'][number];
type Field = Category['fields'][number];

export type ProductIntake = {
  draft: {
    nameHe: string;
    nameAr: string;
    brandId: string;
    categoryId: string;
    subcategoryId: string;
    specs: Record<string, string>;
    specsAr: Record<string, string>;
  };
  created: {
    brand: string | null;
    category: string | null;
    subcategory: string | null;
    fields: string[];
  };
};

export async function intakeProduct(body: unknown): Promise<ProductIntake> {
  if (!config.openaiApiKey) throw new AppError(503, 'agent_unconfigured', 'Language model key is missing');
  const input = inputSchema.parse(body);
  const given = input.url ? await readQuiet(input.url) : '';
  const found = await findSpecTexts(input.model, input.url).catch(() => [] as string[]);
  const parts = [...found, given ? `SOURCE ${input.url}\n${given.slice(0, 10_000)}` : ''].filter(Boolean);
  if (parts.length === 0) throw new AppError(422, 'page_unreachable', 'Page could not be read');
  const page = parts.join('\n\n').slice(0, 32_000);
  const catalog = await readCatalog();
  const proposal = await askModel(input.model, input.url, page, catalog);
  return applyProposal(input.model, proposal, catalog);
}

async function readQuiet(url: string): Promise<string> {
  return fetchPage(url).catch(() => '');
}

async function fetchPage(start: string): Promise<string> {
  const direct = await fetchDirect(start);
  if (direct && !isChallenge(direct)) return direct.slice(0, 18_000);
  const browsed = await fetchWithChrome(assertHttp(start));
  if (browsed.length < 40 || isChallenge(browsed)) throw new AppError(422, 'page_unreachable', 'Page could not be read');
  return browsed.slice(0, 18_000);
}

async function fetchDirect(start: string): Promise<string | null> {
  let current = assertHttp(start);
  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublic(current);
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    }).catch(() => null);
    if (!response) return null;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      current = assertHttp(new URL(location, current).toString());
      continue;
    }
    if (!response.body) return null;
    const text = htmlToText(await readLimited(response));
    if (!response.ok) return isChallenge(text) ? null : text;
    return text;
  }
  return null;
}

const chromePort = 9339;
const chromeProfile = '/tmp/anan-agent-chrome';
const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

let chromeTail: Promise<void> = Promise.resolve();

function enqueueChrome<T>(job: () => Promise<T>): Promise<T> {
  const run = chromeTail.then(job, job);
  chromeTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

type CdpSend = (
  method: string,
  params?: Record<string, unknown>,
  sessionId?: string,
) => Promise<{ result?: { targetId?: string; sessionId?: string; result?: { value?: string } } }>;

async function fetchWithChrome(url: string): Promise<string> {
  await assertPublic(url);
  return withChromeSession(async (send, sessionId) => {
    await send('Page.enable', {}, sessionId);
    await send('Page.navigate', { url }, sessionId);
    return expandedText(send, sessionId);
  });
}

async function withChromeSession<T>(run: (send: CdpSend, sessionId: string) => Promise<T>): Promise<T> {
  return enqueueChrome(async () => {
    await ensureChrome();
    const version = (await (await fetch(`http://127.0.0.1:${chromePort}/json/version`)).json()) as {
      webSocketDebuggerUrl: string;
    };
    const browser = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      browser.addEventListener('open', () => resolve());
      browser.addEventListener('error', () => reject(new AppError(422, 'page_unreachable', 'Page could not be read')));
    });
    let messageId = 0;
    type CdpResult = { result?: { targetId?: string; sessionId?: string; result?: { value?: string } } };
    const pending = new Map<number, (message: CdpResult) => void>();
    browser.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as CdpResult & { id?: number };
      if (message.id && pending.has(message.id)) pending.get(message.id)?.(message);
    });
    const send: CdpSend = (method, params = {}, sessionId) => {
      const id = ++messageId;
      return new Promise((resolve) => {
        pending.set(id, resolve);
        browser.send(JSON.stringify({ id, method, params, sessionId }));
      });
    };
    const created = await send('Target.createTarget', { url: 'about:blank' });
    const targetId = created.result?.targetId;
    if (!targetId) {
      browser.close();
      throw new AppError(422, 'page_unreachable', 'Page could not be read');
    }
    const attached = await send('Target.attachToTarget', { targetId, flatten: true });
    const sessionId = attached.result?.sessionId;
    if (!sessionId) {
      browser.close();
      throw new AppError(422, 'page_unreachable', 'Page could not be read');
    }
    try {
      return await run(send, sessionId);
    } finally {
      await send('Target.closeTarget', { targetId });
      browser.close();
    }
  });
}

async function expandedText(send: CdpSend, sessionId: string): Promise<string> {
  let text = '';
  for (let attempt = 0; attempt < 16 && (text.length < 200 || isChallenge(text)); attempt += 1) {
    await delay(500);
    text = await pageText(send, sessionId);
  }
  const labels = await evaluate(
    send,
    sessionId,
    `(() => JSON.stringify([...document.querySelectorAll('button,a,[role="tab"],summary')].map((node) => (node.innerText || '').trim()).filter((label, index, all) => label.length > 2 && label.length < 40 && all.indexOf(label) === index && /מפרט|תיאור|על המוצר|מידע|נגישות|אביזר|مواصف|وصف|معلومات|specification|description|overview|highlights|about|fiche/i.test(label)).slice(0, 4)))()`,
  );
  let names: string[] = [];
  try {
    const parsed = JSON.parse(labels) as unknown;
    if (Array.isArray(parsed)) names = parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    names = [];
  }
  let combined = text;
  for (const label of names) {
    const encoded = JSON.stringify(label);
    await evaluate(
      send,
      sessionId,
      `(() => { const nodes = [...document.querySelectorAll('button,a,[role="tab"],summary')]; const hit = nodes.find((node) => (node.innerText || '').trim() === ${encoded} && node.getBoundingClientRect().width > 0); if (hit) { hit.scrollIntoView({ block: 'center' }); hit.click(); } return true; })()`,
    );
    await delay(800);
    const next = await pageText(send, sessionId);
    if (next.length > 80 && !combined.includes(next.slice(0, 140))) combined = `${combined}\n${next}`;
  }
  return combined.slice(0, 14_000);
}

async function findSpecTexts(model: string, given: string): Promise<string[]> {
  const query = `"${model}" מפרט`;
  const searchUrl = `https://www.google.com/search?hl=he&num=8&q=${encodeURIComponent(query)}`;
  return withChromeSession(async (send, sessionId) => {
    await send('Page.enable', {}, sessionId);
    await send('Page.navigate', { url: searchUrl }, sessionId);
    await delay(1_600);
    const hits: Array<{ block: string; weight: number }> = [];
    for (let index = 0; index < 6 && hits.length < 4; index += 1) {
      const clicked = await evaluate(
        send,
        sessionId,
        `(() => { const links = [...document.querySelectorAll('a')].filter((node) => node.querySelector('h3') && node.getBoundingClientRect().width > 0); const link = links[${index}]; if (!link) return ''; link.scrollIntoView({ block: 'center' }); link.click(); return '1'; })()`,
      );
      if (clicked !== '1') break;
      let landed = '';
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await delay(500);
        landed = await evaluate(send, sessionId, 'location.href');
        if (landed && !isSearchHost(landed)) break;
      }
      const usable = Boolean(landed) && !isSearchHost(landed) && !samePage(landed, given) && (await publicPage(landed));
      if (usable) {
        const text = await expandedText(send, sessionId);
        if (mentionsModel(text, model)) {
          const weight = narrativeWeight(text);
          hits.push({ block: `SOURCE ${landed}\n${text}`, weight });
          if (hits.filter((item) => item.weight >= 400).length >= 2) break;
        }
      }
      await send('Page.navigate', { url: searchUrl }, sessionId);
      await delay(1_400);
    }
    return hits
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 2)
      .map((item) => item.block);
  });
}

function narrativeWeight(text: string): number {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 80)
    .reduce((total, line) => total + line.length, 0);
}

function isStoreNoise(value: string): boolean {
  return /משלוח|קניה מאובטחת|שירות לקוחות|תקנון|شحن مجاني|شراء آمن|خدمة العملاء/.test(value);
}

async function evaluate(send: CdpSend, sessionId: string, expression: string): Promise<string> {
  const evaluated = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
  const value = evaluated.result?.result?.value;
  return typeof value === 'string' ? value : '';
}

function isSearchHost(value: string): boolean {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '');
    return ['google.com', 'google.co.il', 'bing.com', 'duckduckgo.com', 'youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com'].some(
      (item) => host === item || host.endsWith(`.${item}`),
    );
  } catch {
    return true;
  }
}

function samePage(left: string, right: string): boolean {
  if (!left || !right) return false;
  try {
    const first = new URL(left);
    const second = new URL(right);
    return (
      first.hostname.replace(/^www\./, '') === second.hostname.replace(/^www\./, '') &&
      first.pathname.replace(/\/$/, '') === second.pathname.replace(/\/$/, '')
    );
  } catch {
    return false;
  }
}

async function publicPage(value: string): Promise<boolean> {
  return assertPublic(value).then(
    () => true,
    () => false,
  );
}

function mentionsModel(text: string, model: string): boolean {
  const token = model.trim().toLowerCase();
  return token.length >= 3 && text.toLowerCase().includes(token);
}

async function pageText(
  send: (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<{ result?: { result?: { value?: string } } }>,
  sessionId: string,
): Promise<string> {
  const evaluated = await send('Runtime.evaluate', { expression: pageExpression(), returnByValue: true }, sessionId);
  return (evaluated.result?.result?.value ?? '').slice(0, 18_000);
}

function pageExpression(): string {
  return `(() => {
    const root = document.querySelector('main') || document.body;
    const clean = (value) => (value || '').trim().replace(/\\s+/g, ' ');
    const seen = new Set();
    const rows = [];
    for (const node of root.querySelectorAll('tr, div, li')) {
      const kids = [...node.children].filter((child) => clean(child.innerText));
      if (kids.length !== 2) continue;
      const label = clean(kids[0].innerText);
      const value = clean(kids[1].innerText);
      if (label.length < 2 || label.length > 50 || value.length < 1 || value.length > 180) continue;
      if (value.includes(label) && value.length > label.length + 20) continue;
      const key = label + '\\n' + value;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(label + ': ' + value);
      if (rows.length >= 24) break;
    }
    const lists = [];
    for (const list of root.querySelectorAll('ul, ol')) {
      const items = [...list.querySelectorAll(':scope > li')].map((item) => clean(item.innerText)).filter((text) => text.length > 2 && text.length < 180);
      if (items.length < 2 || items.length > 8) continue;
      const previous = list.previousElementSibling;
      const heading = previous && /^(H[1-4]|P|DIV)$/.test(previous.tagName) ? clean(previous.innerText) : '';
      if (heading.length < 2 || heading.length > 60) continue;
      lists.push(heading + '\\n' + items.slice(0, 8).join('\\n'));
      if (lists.length >= 4) break;
    }
    const prose = [];
    for (const heading of root.querySelectorAll('h2, h3')) {
      const title = clean(heading.innerText);
      if (title.length < 2 || title.length > 70) continue;
      const parts = [];
      let node = heading.nextElementSibling;
      while (node && !/^H[1-3]$/.test(node.tagName)) {
        if (node.tagName === 'UL' || node.tagName === 'OL') break;
        const text = clean(node.innerText);
        if (text.length > 60) parts.push(text);
        node = node.nextElementSibling;
        if (parts.length >= 3) break;
      }
      if (!parts.length) continue;
      prose.push(title + '\\n' + parts.join('\\n').slice(0, 900));
      if (prose.length >= 6) break;
    }
    const body = document.body ? document.body.innerText.slice(0, 12000) : '';
    return ['ROWS', ...rows, 'LISTS', ...lists, 'PROSE', ...prose, 'PAGE', body].join('\\n');
  })()`;
}

async function ensureChrome(): Promise<void> {
  if (await chromeReady()) return;
  if (!existsSync(chromeBin)) throw new AppError(422, 'page_unreachable', 'Page could not be read');
  const child = spawn(
    chromeBin,
    [
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${chromeProfile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--start-minimized',
      'about:blank',
    ],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await chromeReady()) return;
    await delay(300);
  }
  throw new AppError(422, 'page_unreachable', 'Page could not be read');
}

async function chromeReady(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${chromePort}/json/version`, { signal: AbortSignal.timeout(400) });
    return response.ok;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isChallenge(text: string): boolean {
  const sample = text.slice(0, 1_500).toLowerCase();
  return sample.includes('attention required') || sample.includes('you have been blocked') || sample.includes('just a moment');
}

function assertHttp(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AppError(422, 'page_blocked', 'Link is not allowed');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new AppError(422, 'page_blocked', 'Link is not allowed');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || (isIP(host) !== 0 && isBlockedAddress(host))) {
    throw new AppError(422, 'page_blocked', 'Link is not allowed');
  }
  return url.toString();
}

async function assertPublic(value: string): Promise<void> {
  const host = new URL(value).hostname;
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new AppError(422, 'page_blocked', 'Link is not allowed');
    return;
  }
  const records = await lookup(host, { all: true, verbatim: true }).catch(() => {
    throw new AppError(422, 'page_unreachable', 'Page could not be read');
  });
  if (records.length === 0 || records.some((record) => isBlockedAddress(record.address))) {
    throw new AppError(422, 'page_blocked', 'Link is not allowed');
  }
}

function isBlockedAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === undefined || b === undefined) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new AppError(422, 'page_unreachable', 'Page could not be read');
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < 1_500_000) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    chunks.push(step.value);
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nameHe', 'nameAr', 'brand', 'category', 'subcategory', 'specs'],
  properties: {
    nameHe: { type: 'string' },
    nameAr: { type: 'string' },
    brand: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'name', 'slug'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
      },
    },
    category: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'nameHe', 'nameAr', 'slug'],
      properties: {
        id: { type: 'string' },
        nameHe: { type: 'string' },
        nameAr: { type: 'string' },
        slug: { type: 'string' },
      },
    },
    subcategory: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'nameHe', 'nameAr'],
      properties: {
        id: { type: 'string' },
        nameHe: { type: 'string' },
        nameAr: { type: 'string' },
      },
    },
    specs: {
      type: 'array',
      maxItems: 30,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fieldId', 'labelHe', 'labelAr', 'type', 'section', 'value', 'valueAr'],
        properties: {
          fieldId: { type: 'string' },
          labelHe: { type: 'string' },
          labelAr: { type: 'string' },
          type: { type: 'string', enum: ['text', 'number', 'boolean'] },
          section: { type: 'string', enum: ['spec', 'features', 'info'] },
          value: { type: 'string' },
          valueAr: { type: 'string' },
        },
      },
    },
  },
} as const;

async function askModel(model: string, url: string, page: string, catalog: Catalog): Promise<Proposal> {
  const known = {
    brands: catalog.brands.map((brand) => ({ id: brand.id, name: brand.name })),
    categories: catalog.categories.map((category) => ({
      id: category.id,
      nameHe: category.name.he,
      nameAr: category.name.ar,
      subcategories: category.subcategories.map((item) => ({ id: item.id, nameHe: item.name.he, nameAr: item.name.ar })),
      fields: category.fields.map((field) => ({
        id: field.id,
        labelHe: field.label.he,
        labelAr: field.label.ar,
        type: field.type,
        section: field.section,
      })),
    })),
  };
  const messages = [
    {
      role: 'system',
      content:
        'Fill a product form from store pages. The user message is input, not the reply. Sources may include the given link and other pages found by searching the model. Use only facts written in those sources. Do not invent specifications, prices, energy ratings, warranty terms, or delivery promises. Skip store policies such as shipping, payment, and customer-service slogans. nameHe and labelHe are Hebrew. nameAr and labelAr are Arabic. value is the source wording. valueAr is the same fact in Arabic. Keep numbers, units, model codes, and Latin brand names unchanged in both languages. Never copy Hebrew into an Arabic field. Include the given model number in nameHe. When a brand, category, subcategory, or field already exists, copy its id; otherwise leave id empty and supply both names. Short label-value facts belong in section "features", at most 16. A heading followed by its own paragraphs belongs in section "spec", at most 8. The spec value is the paragraph, not a repeat of the heading, and it stops before the next heading. Bullet lists about the product belong in section "info", at most 4, one topic per item and one line per bullet. If a source has a description, spec must not be empty. If a source has product notes or a bullet list, info must not be empty. type "number" is digits only, "boolean" is "yes" or "no", otherwise "text". Omit price and stock.',
    },
    {
      role: 'user',
      content: JSON.stringify({ model, url, catalog: known, page }),
    },
  ];
  const structured = await complete(messages, {
    type: 'json_schema',
    json_schema: { name: 'product_intake', strict: true, schema: outputSchema },
  });
  const response = structured.ok ? structured : await complete(messages, { type: 'json_object' });
  if (!response.ok) throw new AppError(502, 'agent_failed', 'Language model did not respond');
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError(502, 'agent_failed', 'Language model did not respond');
  }
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { specs?: unknown }).specs)) {
    (parsed as { specs: unknown[] }).specs = (parsed as { specs: unknown[] }).specs.slice(0, 30);
  }
  const result = proposalSchema.safeParse(parsed);
  if (!result.success) throw new AppError(502, 'agent_failed', 'Language model did not respond');
  const proposal = result.data;
  await addNarrative(model, page, proposal);
  proposal.specs = proposal.specs.filter((spec) => !isStoreNoise(spec.labelHe) && !isStoreNoise(spec.value));
  const longSpec = proposal.specs.filter((spec) => spec.section === 'spec' && spec.value.trim().length >= 40 && !same(spec.value, spec.labelHe));
  proposal.specs = [
    ...proposal.specs.filter((spec) => spec.section === 'features').slice(0, 16),
    ...(longSpec.length > 0 ? longSpec : proposal.specs.filter((spec) => spec.section === 'spec')).slice(0, 8),
    ...proposal.specs.filter((spec) => spec.section === 'info').slice(0, 4),
  ];
  return fillArabic(repairProposal(proposal, page, model, catalog));
}

async function addNarrative(model: string, page: string, proposal: Proposal): Promise<void> {
  const missingSpec = !proposal.specs.some((item) => item.section === 'spec' && item.value.trim());
  const missingInfo = !proposal.specs.some((item) => item.section === 'info' && item.value.trim());
  if (!missingSpec && !missingInfo) return;
  const response = await complete(
    [
      {
        role: 'system',
        content:
          'Add only the missing long product text. section "spec" is one heading and only that heading\'s paragraphs. section "info" is one topic, with one bullet per line. Use only the sources. If a section has no such text, return no items for it. labelHe and value are Hebrew. labelAr and valueAr are Arabic. Do not copy Hebrew into Arabic. Do not invent facts, prices, or warranty terms. Leave fieldId empty.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          model,
          needSpec: missingSpec,
          needInfo: missingInfo,
          page: page.slice(0, 24_000),
        }),
      },
    ],
    {
      type: 'json_schema',
      json_schema: {
        name: 'product_narrative',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['specs'],
          properties: { specs: outputSchema.properties.specs },
        },
      },
    },
  ).catch(() => null);
  if (!response?.ok) return;
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '');
  } catch {
    return;
  }
  const extra = proposalSchema.shape.specs.safeParse((parsed as { specs?: unknown }).specs);
  if (!extra.success) return;
  for (const item of extra.data) {
    if (item.section === 'features' || !item.value.trim()) continue;
    if (item.section === 'spec' && !missingSpec) continue;
    if (item.section === 'info' && !missingInfo) continue;
    if (proposal.specs.some((spec) => spec.section === item.section && same(spec.labelHe, item.labelHe))) continue;
    proposal.specs.push(item);
  }
}

async function complete(messages: Array<{ role: string; content: string }>, responseFormat: unknown): Promise<Response> {
  return fetch(`${config.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.openaiModel,
      temperature: 0,
      response_format: responseFormat,
      messages,
    }),
  }).catch(() => {
    throw new AppError(502, 'agent_failed', 'Language model did not respond');
  });
}

function hasHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

async function fillArabic(proposal: Proposal): Promise<Proposal> {
  const jobs: Array<{ text: string; write: (value: string) => void }> = [];
  const queue = (text: string, write: (value: string) => void) => {
    const trimmed = text.trim();
    if (!hasHebrew(trimmed) || hasArabic(trimmed)) return;
    jobs.push({ text: trimmed, write });
  };
  if (!hasArabic(proposal.nameAr)) queue(proposal.nameHe, (value) => {
    proposal.nameAr = value;
  });
  if (!hasArabic(proposal.category.nameAr)) queue(proposal.category.nameHe, (value) => {
    proposal.category.nameAr = value;
  });
  if (!hasArabic(proposal.subcategory.nameAr)) queue(proposal.subcategory.nameHe, (value) => {
    proposal.subcategory.nameAr = value;
  });
  for (const spec of proposal.specs) {
    if (!hasArabic(spec.labelAr)) queue(spec.labelHe, (value) => {
      spec.labelAr = value;
    });
    if (spec.type === 'text' && !hasArabic(spec.valueAr)) queue(spec.value, (value) => {
      spec.valueAr = value;
    });
  }
  if (jobs.length === 0) return proposal;
  const translated = await translateAll(jobs.map((job) => job.text));
  jobs.forEach((job, index) => {
    const next = translated[index]?.trim();
    if (next && hasArabic(next)) job.write(next.slice(0, 4_000));
  });
  return proposal;
}

async function translateAll(texts: string[]): Promise<string[]> {
  const response = await complete(
    [
      {
        role: 'system',
        content:
          'Translate each appliance-store string into Arabic. Keep numbers, units, model codes, line breaks, and Latin brand names. Return JSON {"translations": string[]} with the same length and order.',
      },
      { role: 'user', content: JSON.stringify({ texts }) },
    ],
    {
      type: 'json_schema',
      json_schema: {
        name: 'translations',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['translations'],
          properties: { translations: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
  ).catch(() => null);
  if (!response?.ok) return texts;
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  try {
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '') as { translations?: string[] };
    if (!parsed.translations || parsed.translations.length !== texts.length) return texts;
    return parsed.translations;
  } catch {
    return texts;
  }
}

function repairProposal(proposal: Proposal, page: string, model: string, catalog: Catalog): Proposal {
  const named = proposal.brand.name.trim();
  const knownBrand = catalog.brands.find((item) => (named && same(item.name, named)) || (item.id === proposal.brand.id && mentioned(item.name, page, model)));
  const onPage = earliest(catalog.brands, (item) => item.name, page, model);
  if (knownBrand && mentioned(knownBrand.name, page, model)) proposal.brand = { id: knownBrand.id, name: knownBrand.name, slug: knownBrand.slug };
  else if (named && mentioned(named, page, model)) proposal.brand = { id: '', name: named, slug: '' };
  else if (onPage) proposal.brand = { id: onPage.id, name: onPage.name, slug: onPage.slug };
  else proposal.brand = { id: '', name: '', slug: '' };

  const category = earliest(
    catalog.categories,
    (item) => item.name.he,
    page,
    model,
  );
  const chosenCategory = catalog.categories.find((item) => item.id === proposal.category.id || same(item.name.he, proposal.category.nameHe));
  if (category && (!chosenCategory || !mentioned(chosenCategory.name.he, page, model))) {
    proposal.category = { id: category.id, nameHe: category.name.he, nameAr: category.name.ar, slug: category.slug };
  }

  const owner = catalog.categories.find((item) => item.id === proposal.category.id) ?? category;
  if (owner) {
    const chosenSub = owner.subcategories.find((item) => item.id === proposal.subcategory.id);
    const namedSub = owner.subcategories.find(
      (item) => same(item.name.he, proposal.subcategory.nameHe) || same(item.name.ar, proposal.subcategory.nameAr),
    );
    if (chosenSub && (mentioned(chosenSub.name.he, page, model) || mentioned(chosenSub.name.ar, page, model))) {
      proposal.subcategory = { id: chosenSub.id, nameHe: chosenSub.name.he, nameAr: chosenSub.name.ar };
    } else if (namedSub) proposal.subcategory = { id: namedSub.id, nameHe: namedSub.name.he, nameAr: namedSub.name.ar };
    else proposal.subcategory = { ...proposal.subcategory, id: '' };
  }

  return proposal;
}

function earliest<T>(items: T[], nameOf: (item: T) => string, page: string, model: string): T | undefined {
  const fromModel = items
    .filter((item) => mentioned(nameOf(item), '', model))
    .sort((left, right) => model.toLowerCase().indexOf(nameOf(left).toLowerCase()) - model.toLowerCase().indexOf(nameOf(right).toLowerCase()));
  if (fromModel[0]) return fromModel[0];
  let best: T | undefined;
  let at = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const name = nameOf(item).trim();
    if (name.length < 3) continue;
    const index = page.toLowerCase().indexOf(name.toLowerCase());
    if (index >= 0 && index < at) {
      at = index;
      best = item;
    }
  }
  return best;
}

function mentioned(name: string, page: string, model: string): boolean {
  const needle = name.trim().toLowerCase();
  if (needle.length < 3) return false;
  return page.toLowerCase().includes(needle) || model.toLowerCase().includes(needle);
}

async function applyProposal(model: string, proposal: Proposal, catalog: Catalog): Promise<ProductIntake> {
  const created = { brand: null as string | null, category: null as string | null, subcategory: null as string | null, fields: [] as string[] };
  const slugs = new Set([...catalog.brands.map((brand) => brand.slug), ...catalog.categories.map((category) => category.slug)]);
  const brandId = await ensureBrand(proposal, catalog, slugs, created);
  const category = await ensureCategory(proposal, catalog, slugs, created);
  const subcategoryId = await ensureSubcategory(proposal, category, created);
  const specs = await ensureSpecs(proposal, category, created);
  const nameHe = clip(proposal.nameHe || model);
  return {
    draft: {
      nameHe,
      nameAr: clip(proposal.nameAr || nameHe),
      brandId,
      categoryId: category.id,
      subcategoryId,
      specs: specs.values,
      specsAr: specs.arabic,
    },
    created,
  };
}

async function ensureBrand(proposal: Proposal, catalog: Catalog, slugs: Set<string>, created: ProductIntake['created']): Promise<string> {
  const existing = catalog.brands.find(
    (brand) => brand.id === proposal.brand.id || same(brand.name, proposal.brand.name),
  );
  if (existing) return existing.id;
  const name = clip(proposal.brand.name);
  if (!name) throw new AppError(422, 'agent_failed', 'Brand was not found on the page');
  const id = newId('brand');
  await createBrand({ id, name, slug: uniqueSlug(proposal.brand.slug || name, slugs), image: '' });
  created.brand = name;
  return id;
}

async function ensureCategory(
  proposal: Proposal,
  catalog: Catalog,
  slugs: Set<string>,
  created: ProductIntake['created'],
): Promise<Category> {
  const existing = catalog.categories.find(
    (category) =>
      category.id === proposal.category.id ||
      same(category.slug, proposal.category.slug) ||
      same(category.name.he, proposal.category.nameHe) ||
      same(category.name.ar, proposal.category.nameAr),
  );
  if (existing) return existing;
  const nameHe = clip(proposal.category.nameHe);
  if (!nameHe) throw new AppError(422, 'agent_failed', 'Category was not found on the page');
  const id = newId('cat');
  const nameAr = clip(proposal.category.nameAr || nameHe);
  await createCategory({
    id,
    slug: uniqueSlug(proposal.category.slug || nameHe, slugs),
    nameHe,
    nameAr,
    image: '',
  });
  created.category = nameHe;
  return { id, slug: '', name: { he: nameHe, ar: nameAr }, image: '', subcategories: [], fields: [] };
}

async function ensureSubcategory(proposal: Proposal, category: Category, created: ProductIntake['created']): Promise<string> {
  const nameHe = clip(proposal.subcategory.nameHe);
  if (!nameHe) return '';
  const existing = category.subcategories.find(
    (item) => item.id === proposal.subcategory.id || same(item.name.he, nameHe) || same(item.name.ar, proposal.subcategory.nameAr),
  );
  if (existing) return existing.id;
  const id = newId('sub');
  const nameAr = clip(proposal.subcategory.nameAr || nameHe);
  await createSubcategory(category.id, { id, nameHe, nameAr, image: '' });
  created.subcategory = nameHe;
  return id;
}

async function ensureSpecs(
  proposal: Proposal,
  category: Category,
  created: ProductIntake['created'],
): Promise<{ values: Record<string, string>; arabic: Record<string, string> }> {
  const fields = [...category.fields];
  const values: Record<string, string> = {};
  const arabic: Record<string, string> = {};
  for (const spec of proposal.specs) {
    const value = spec.type === 'boolean' ? booleanValue(spec.value) : spec.value.trim();
    if (!value) continue;
    const arabicValue = spec.type === 'boolean' || spec.type === 'number' ? value : spec.valueAr.trim();
    const known = fields.find(
      (field) =>
        field.id === spec.fieldId ||
        same(field.label.he, spec.labelHe) ||
        same(field.label.ar, spec.labelAr) ||
        related(field.label.he, spec.labelHe),
    );
    if (known && hasArabic(spec.labelAr) && known.label.ar === known.label.he) {
      await updateField(known.id, { nameHe: known.label.he, nameAr: spec.labelAr, type: known.type, section: known.section });
      known.label = { he: known.label.he, ar: spec.labelAr };
    }
    const field = known ?? (await addField(category.id, spec, fields, created));
    if (field) {
      values[field.id] = value;
      arabic[field.id] = arabicValue;
    }
    if (Object.keys(values).length >= 30) break;
  }
  return { values, arabic };
}

async function addField(
  categoryId: string,
  spec: Proposal['specs'][number],
  fields: Field[],
  created: ProductIntake['created'],
): Promise<Field | null> {
  const nameHe = clip(spec.labelHe);
  if (!nameHe || fields.length >= 40) return null;
  const id = newId('field');
  const nameAr = clip(spec.labelAr || nameHe);
  const field: Field = {
    id,
    label: { he: nameHe, ar: nameAr },
    type: spec.type,
    section: spec.section,
  };
  await createField(categoryId, { id, nameHe, nameAr, type: spec.type, section: spec.section });
  fields.push(field);
  created.fields.push(nameHe);
  return field;
}

function booleanValue(value: string): string {
  const token = value.trim().toLowerCase();
  if (['yes', 'true', 'כן', 'نعم'].includes(token)) return 'yes';
  if (['no', 'false', 'לא', 'لا'].includes(token)) return 'no';
  return '';
}

function same(left: string, right: string): boolean {
  const a = fold(left);
  const b = fold(right);
  return a.length > 0 && a === b;
}

function related(left: string, right: string): boolean {
  const a = fold(left);
  const b = fold(right);
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return short.length >= 6 && long.includes(short);
}

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[״"'׳]/g, '')
    .replace(/[()]/g, '')
    .replace(/ץ/g, 'צ')
    .replace(/ם/g, 'מ')
    .replace(/ן/g, 'נ')
    .replace(/ף/g, 'פ')
    .replace(/ך/g, 'כ')
    .replace(/\s+/g, ' ');
}

function clip(value: string): string {
  return value.trim().slice(0, 200);
}

function uniqueSlug(value: string, taken: Set<string>): string {
  const base =
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || `item-${randomUUID().slice(0, 8)}`;
  let slug = base;
  let count = 2;
  while (taken.has(slug)) {
    slug = `${base}-${count}`.slice(0, 80);
    count += 1;
  }
  taken.add(slug);
  return slug;
}

function newId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}
