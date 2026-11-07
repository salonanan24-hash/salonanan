import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
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
  createSubcategory,
  readCatalog,
} from './catalog.js';

const inputSchema = z.object({
  model: z.string().trim().min(1).max(120),
  url: z
    .string()
    .trim()
    .max(2_000)
    .default('')
    .refine((value) => value.length === 0 || z.string().url().safeParse(value).success),
  notes: z.string().trim().max(20_000).default(''),
  images: z.array(z.string().trim().max(1_500_000)).max(4).default([]),
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
    .max(48)
    .default([]),
  price: z.string().trim().max(20).default(''),
  color: z.string().trim().max(40).default(''),
});

type Proposal = z.infer<typeof proposalSchema>;
type Catalog = Awaited<ReturnType<typeof readCatalog>>;
type Category = Catalog['categories'][number];
type Field = Catalog['products'][number]['fields'][number];

export type ProductIntake = {
  draft: {
    nameHe: string;
    nameAr: string;
    brandId: string;
    categoryId: string;
    subcategoryId: string;
    fields: Field[];
    specs: Record<string, string>;
    specsAr: Record<string, string>;
    price: string;
    color: string;
    variants: Array<{
      label: string;
      sku: string;
      price: string;
      subcategoryId: string;
      specs: Record<string, string>;
      specsAr: Record<string, string>;
    }>;
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
  if (!input.url) return intakeBrief(input);
  const given = input.url ? await readQuiet(input.url) : '';
  const found = await findSpecTexts(input.model, input.url).catch(() => [] as string[]);
  const parts = [...found, given && !isChallenge(given) ? `SOURCE ${input.url}\n${given.slice(0, 10_000)}` : ''].filter(
    (part) => part && !isChallenge(part),
  );
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
  const browsed = await fetchWithChrome(assertHttp(start)).catch(() => '');
  if (browsed.length >= 40 && !isChallenge(browsed)) return browsed.slice(0, 24_000);
  const direct = await fetchDirect(start);
  if (direct && !isChallenge(direct)) return direct.slice(0, 18_000);
  throw new AppError(422, 'page_unreachable', 'Page could not be read');
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
const execFileAsync = promisify(execFile);

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
  if (isChallenge(text)) return '';
  await evaluate(send, sessionId, 'window.scrollTo(0, Math.min(document.body.scrollHeight, 2400))');
  await delay(400);
  const labels = await evaluate(
    send,
    sessionId,
    `(() => JSON.stringify([...document.querySelectorAll('button,a,[role="tab"],summary')].map((node) => (node.innerText || '').trim()).filter((label, index, all) => label.length > 2 && label.length < 40 && all.indexOf(label) === index && /מפרט|תיאור|על המוצר|מידע|נגישות|אביזר|مواصف|وصف|معلومات|specification|description|overview|highlights|about|fiche/i.test(label)).slice(0, 8)))()`,
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
  return combined.slice(0, 24_000);
}

async function findSpecTexts(model: string, given: string): Promise<string[]> {
  const links = (await searchResultLinks(modelCode(model))).filter((link) => !samePage(link, given));
  const hits: Array<{ block: string; weight: number }> = [];
  const unread: string[] = [];
  for (const link of links.slice(0, 6)) {
    const direct = await fetchDirect(link).catch(() => null);
    const text = direct && !isChallenge(direct) ? direct.slice(0, 18_000) : '';
    if (usefulSource(text, model)) {
      hits.push({ block: `SOURCE ${link}\n${text}`, weight: sourceScore(text) });
      if (hits.length >= 2) break;
      continue;
    }
    if (!text) unread.push(link);
  }
  if (hits.length === 0) {
    for (const link of unread.slice(0, 2)) {
      const browsed = await fetchWithChrome(assertHttp(link)).catch(() => '');
      const text = browsed.length >= 40 && !isChallenge(browsed) ? browsed.slice(0, 18_000) : '';
      if (!usefulSource(text, model)) continue;
      hits.push({ block: `SOURCE ${link}\n${text}`, weight: sourceScore(text) });
      break;
    }
  }
  return hits
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 2)
    .map((item) => item.block);
}

async function searchResultLinks(model: string): Promise<string[]> {
  const query = `"${model}" מפרט`;
  const duck = rankSources(
    await searchHtml(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, /uddg=([^&"]+)/g),
    model,
  );
  if (duck.length > 0) return duck;
  const google = rankSources(
    await searchHtml(`https://www.google.com/search?gbv=1&hl=he&q=${encodeURIComponent(query)}`, /href="(https?:\/\/[^"]+)"/g),
    model,
  );
  if (google.length > 0) return google;
  return rankSources(
    await searchHtml(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=he`, /href="(https?:\/\/[^"]+)"/g),
    model,
  );
}

async function searchHtml(url: string, pattern: RegExp): Promise<string[]> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: 'text/html',
      'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  }).catch(() => null);
  if (!response?.ok) return [];
  const html = await response.text();
  const links: string[] = [];
  const seenHost = new Set<string>();
  const seen = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    let raw = '';
    try {
      raw = decodeURIComponent(match[1] ?? '').replace(/&amp;/g, '&');
    } catch {
      continue;
    }
    if (!raw.startsWith('http') || isSearchHost(raw)) continue;
    let host = '';
    let key = '';
    try {
      const parsed = new URL(raw);
      host = parsed.hostname.replace(/^www\./, '');
      key = `${host}${parsed.pathname}${parsed.search}`;
    } catch {
      continue;
    }
    if (seen.has(key) || seenHost.has(host)) continue;
    seen.add(key);
    seenHost.add(host);
    links.push(raw);
    if (links.length >= 8) break;
  }
  return links;
}

function rankSources(links: string[], model: string): string[] {
  const code = modelCode(model).toLowerCase();
  return [...links].sort((left, right) => Number(!left.toLowerCase().includes(code)) - Number(!right.toLowerCase().includes(code)));
}

function usefulSource(text: string, model: string): boolean {
  if (!text || isChallenge(text) || !mentionsModel(text, model)) return false;
  const rows = blocks(text, 'ROWS').flatMap((chunk) => chunk.split('\n')).filter((line) => line.includes(': '));
  const prose = blocks(text, 'PROSE').join('');
  return rows.length >= 3 || prose.length >= 80;
}

function sourceScore(text: string): number {
  const rows = blocks(text, 'ROWS').flatMap((chunk) => chunk.split('\n')).filter((line) => line.includes(': ')).length;
  return rows * 40 + narrativeWeight(text);
}

function narrativeWeight(text: string): number {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 80)
    .reduce((total, line) => total + line.length, 0);
}

function isContact(value: string): boolean {
  return /(?:\+972[\s-]?)?0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}|וואטסאפ|ווטסאפ|whatsapp|wa\.me|חייגו|התקשרו|צרו קשר|נשמח לעזור|צריכים עזרה|עזרה בבחיר|סניף|כתובת|רחוב|מיקוד|עברו לעמוד|בקרו ב|שעות פתיחה|הגיעו אל|@[a-z0-9.-]+\.[a-z]{2,}/i.test(
    value,
  );
}

function dropContact(value: string): string {
  return value
    .split(/\n+|(?<=[.!?؟])\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !isContact(part))
    .join('\n')
    .trim();
}

function scrubSpecs(specs: Proposal['specs']): Proposal['specs'] {
  return specs.flatMap((spec) => {
    const labelHe = dropContact(spec.labelHe);
    const labelAr = dropContact(spec.labelAr);
    const value = dropContact(spec.value);
    const valueAr = dropContact(spec.valueAr);
    if (!labelHe || !value || isContact(labelHe) || isContact(value)) return [];
    return [{ ...spec, labelHe, labelAr, value, valueAr }];
  });
}

function isStoreNoise(value: string): boolean {
  return (
    isContact(value) ||
    /משלוח|קניה מאובטחת|קנייה מאובטחת|שירות לקוחות|תקנון|אימות אבטחה|cloudflare|הוספה לסל|קנה עכשיו|התחברות|מדיניות|עוגיות|אספקה|תשלומים|شحن مجاني|شراء آمن|خدمة العملاء/.test(
      value,
    )
  );
}

function isRealParagraph(value: string): boolean {
  const text = value.trim();
  return text.length >= 80 && text.split(/\s+/).length >= 12 && !isStoreNoise(text);
}

async function evaluate(send: CdpSend, sessionId: string, expression: string): Promise<string> {
  const evaluated = await send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
  const value = evaluated.result?.result?.value;
  return typeof value === 'string' ? value : '';
}

function isSearchHost(value: string): boolean {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '');
    return ['google.com', 'google.co.il', 'googleusercontent.com', 'bing.com', 'duckduckgo.com', 'youtube.com', 'facebook.com', 'instagram.com', 'tiktok.com'].some(
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

function applyTypedFacts(proposal: Proposal, model: string, _catalog: Catalog): void {
  const inches = model.match(/(\d{2,3})\s*(?:"|″|אינץ|inch)/i)?.[1];
  const code = modelCode(model);
  const additions = [
    inches
      ? {
          labelHe: 'גודל מסך (אינץ׳)',
          labelAr: 'مقاس الشاشة (إنش)',
          type: 'number' as const,
          section: 'features' as const,
          value: inches,
        }
      : null,
    code
      ? {
          labelHe: 'דגם',
          labelAr: 'طراز',
          type: 'text' as const,
          section: 'features' as const,
          value: code,
        }
      : null,
  ];
  for (const addition of additions) {
    if (!addition) continue;
    if (proposal.specs.some((spec) => same(spec.labelHe, addition.labelHe))) continue;
    proposal.specs.push({
      fieldId: '',
      labelHe: addition.labelHe,
      labelAr: addition.labelAr,
      type: addition.type,
      section: addition.section,
      value: addition.value,
      valueAr: '',
    });
  }
}

function modelCode(value: string): string {
  const tokens = value.match(/[A-Za-z]{1,8}\d[A-Za-z0-9-]{2,}/g) ?? [];
  return tokens.sort((left, right) => right.length - left.length)[0] ?? value.trim();
}

function mentionsModel(text: string, model: string): boolean {
  const haystack = text.toLowerCase();
  const code = modelCode(model).toLowerCase();
  if (code.length >= 4 && haystack.includes(code)) return true;
  const token = model.trim().toLowerCase();
  return token.length >= 3 && haystack.includes(token);
}

async function pageText(
  send: (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<{ result?: { result?: { value?: string } } }>,
  sessionId: string,
): Promise<string> {
  const evaluated = await send('Runtime.evaluate', { expression: pageExpression(), returnByValue: true }, sessionId);
  return (evaluated.result?.result?.value ?? '').slice(0, 26_000);
}

function pageExpression(): string {
  return `(() => {
    const clean = (value) => (value || '').replace(/\\s+/g, ' ').trim();
    const skip = (node) => Boolean(node.closest('header, nav, footer, [role="navigation"]'));
    const root = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    const title = clean((document.querySelector('h1') || {}).innerText || '').slice(0, 200);
    const blob = clean((root.innerText || ''));
    const priceMatch = blob.match(/₪\\s*\\d[\\d,.\\s]{0,12}|\\d[\\d,.\\s]{0,12}\\s*₪/);
    const price = priceMatch ? priceMatch[0].trim() : '';
    const seen = new Set();
    const rows = [];
    const pushRow = (label, value) => {
      const left = clean(label);
      const right = clean(value);
      if (left.length < 2 || left.length > 80 || right.length < 1 || right.length > 500 || left === right) return;
      const key = left + '\\n' + right;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push(left + ': ' + right);
    };
    for (const row of root.querySelectorAll('tr')) {
      if (rows.length >= 80) break;
      if (skip(row)) continue;
      const cells = [...row.children].filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD');
      if (cells.length >= 2) pushRow(cells[0].innerText, cells[1].innerText);
    }
    for (const term of root.querySelectorAll('dt')) {
      if (rows.length >= 80) break;
      if (skip(term)) continue;
      const value = term.nextElementSibling;
      if (value && value.tagName === 'DD') pushRow(term.innerText, value.innerText);
    }
    for (const parent of root.querySelectorAll('section, ul, div')) {
      if (rows.length >= 80 || skip(parent)) continue;
      const pairs = [...parent.children].filter((child) => {
        const kids = [...child.children].filter((node) => clean(node.innerText));
        return kids.length === 2 && clean(kids[0].innerText).length <= 40 && clean(kids[1].innerText).length <= 120;
      });
      if (pairs.length < 4) continue;
      for (const pair of pairs) {
        const kids = [...pair.children].filter((node) => clean(node.innerText));
        pushRow(kids[0].innerText, kids[1].innerText);
      }
    }
    const lists = [];
    for (const list of root.querySelectorAll('ul, ol')) {
      if (skip(list) || lists.length >= 8) continue;
      const items = [...list.querySelectorAll(':scope > li')].map((item) => clean(item.innerText)).filter((text) => text.length > 2 && text.length < 240);
      if (items.length < 2 || items.length > 12) continue;
      const previous = list.previousElementSibling;
      const heading = previous ? clean(previous.innerText).slice(0, 80) : '';
      lists.push('## ' + (heading || 'רשימה') + '\\n' + items.slice(0, 12).join('\\n'));
    }
    const prose = [];
    for (const heading of root.querySelectorAll('h2, h3, h4')) {
      if (skip(heading) || prose.length >= 8) continue;
      const headingText = clean(heading.innerText);
      if (headingText.length < 2 || headingText.length > 80) continue;
      const parts = [];
      let node = heading.nextElementSibling;
      let steps = 0;
      while (node && steps < 6 && !/^H[1-4]$/.test(node.tagName)) {
        if (node.tagName !== 'UL' && node.tagName !== 'OL') {
          const text = clean(node.innerText);
          if (text.length > 40) parts.push(text.slice(0, 900));
        }
        node = node.nextElementSibling;
        steps += 1;
      }
      if (parts.length) prose.push('## ' + headingText + '\\n' + parts.join('\\n').slice(0, 1200));
    }
    const body = clean(root.innerText || '').slice(0, 8000);
    return ['TITLE', title, 'PRICE', price, 'ROWS', ...rows, 'LISTS', ...lists, 'PROSE', ...prose, 'PAGE', body].join('\\n');
  })()`;
}

async function ensureChrome(): Promise<void> {
  const running = await agentChromeCommand();
  if (running?.includes('--headless') && (await chromeReady())) return;
  if (running) await stopAgentChrome();
  if (!existsSync(chromeBin)) throw new AppError(422, 'page_unreachable', 'Page could not be read');
  const child = spawn(
    chromeBin,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-extensions',
      `--remote-debugging-port=${chromePort}`,
      `--user-data-dir=${chromeProfile}`,
      '--no-first-run',
      '--no-default-browser-check',
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

async function agentChromeCommand(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('lsof', ['-nP', `-iTCP:${chromePort}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    const pid = Number(stdout.trim().split('\n')[0]);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    const { stdout: command } = await execFileAsync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
    if (!command.includes(chromeProfile)) return null;
    return command;
  } catch {
    return null;
  }
}

async function stopAgentChrome(): Promise<void> {
  const command = await agentChromeCommand();
  if (!command) return;
  const pid = Number(
    (await execFileAsync('lsof', ['-nP', `-iTCP:${chromePort}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })).stdout.trim().split('\n')[0],
  );
  if (!Number.isInteger(pid) || pid <= 0) return;
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (!(await chromeReady())) return;
    await delay(200);
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    return;
  }
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
  const sample = text.slice(0, 4_000).toLowerCase();
  return (
    sample.includes('attention required') ||
    sample.includes('you have been blocked') ||
    sample.includes('just a moment') ||
    sample.includes('ביצוע אימות') ||
    sample.includes('אימות אבטחה') ||
    sample.includes('שירות אבטחה להגנה') ||
    sample.includes('verify you are human') ||
    sample.includes('ray id')
  );
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
  const rows: string[] = [];
  const remember = (labelHtml: string, valueHtml: string) => {
    const label = stripTags(labelHtml);
    const value = stripTags(valueHtml);
    if (label.length < 2 || label.length > 80 || value.length < 1 || value.length > 180) return;
    if (/לא צוין/.test(value) || /^(מפרט|specifications?)$/i.test(value)) return;
    rows.push(`${label}: ${value}`);
  };
  const withoutTables = html.replace(/<tr[\s\S]*?<\/tr>/gi, (row) => {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1] ?? '');
    if (cells.length >= 2) remember(cells[0] ?? '', cells[1] ?? '');
    return ' ';
  });
  const withoutDefs = withoutTables.replace(/<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi, (_row, label, value) => {
    remember(String(label), String(value));
    return ' ';
  });
  const text = stripTags(withoutDefs);
  return ['ROWS', ...rows.slice(0, 80), 'PAGE', text.slice(0, 12_000)].join('\n');
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_match, digits: string) => decodeCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, digits: string) => decodeCodePoint(Number.parseInt(digits, 16)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nameHe', 'nameAr', 'brand', 'category', 'subcategory', 'price', 'color', 'specs'],
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
    price: { type: 'string' },
    color: { type: 'string' },
    specs: {
      type: 'array',
      maxItems: 48,
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
    })),
  };
  const messages = [
    {
      role: 'system',
      content:
        'Fill the store product form only with facts about this exact model. The user message is input, not the reply. Use ROWS for short specifications, PROSE for a real description paragraph, and LISTS for product notes. Ignore other models, navigation, shipping, payment, delivery times, and slogans. Never include phone numbers, WhatsApp, email, addresses, branch or city names, store names, or text that invites the customer to call or visit. Do not invent specifications or prices. Do not return a field with an empty value. nameHe and labelHe are Hebrew. nameAr, labelAr, and valueAr are Arabic. Keep numbers, units, model codes, and Latin brand names unchanged. Never copy Hebrew into an Arabic field. Include the model code in nameHe. Copy an existing brand, category, or subcategory id when the source answers it; otherwise leave id empty and supply both names. Leave fieldId empty and supply both field names for each fact. price is the current selling price in shekels, digits only, or an empty string. color is the product color, or an empty string. Section "features" is one short label and one short value, including screen size, resolution, and the other feature facts the source answers. Section "spec" is only a heading plus its own paragraph of several sentences. A feature name without that paragraph is not a spec field. Section "info" is product notes, one topic per item and one bullet per line. Leave a section empty when the source has no such text. type "number" is digits only, "boolean" is "yes" or "no", otherwise "text". Do not fill stock.',
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
    (parsed as { specs: unknown[] }).specs = (parsed as { specs: unknown[] }).specs.slice(0, 48);
  }
  const result = proposalSchema.safeParse(parsed);
  if (!result.success) throw new AppError(502, 'agent_failed', 'Language model did not respond');
  const proposal = repairProposal(result.data, page, model, catalog);
  proposal.price = currentPrice(page) || money(proposal.price) || priceFromPage(page);
  proposal.color = cleanColor(proposal.color);
  backfill(proposal, page, catalog);
  applyTypedFacts(proposal, model, catalog);
  proposal.specs = placeSpecs(scrubSpecs(proposal.specs).filter((spec) => !isStoreNoise(spec.labelHe) && !isStoreNoise(spec.value)));
  await addNarrative(model, page, proposal);
  proposal.specs = placeSpecs(scrubSpecs(proposal.specs).filter((spec) => !isStoreNoise(spec.labelHe) && !isStoreNoise(spec.value)));
  return fillArabic(proposal);
}

function placeBriefSpecs(specs: Proposal['specs']): Proposal['specs'] {
  const placed = specs.map((spec) => {
    if (spec.section === 'info') return spec;
    if (isMeasuredFact(spec.labelHe, spec.value)) return { ...spec, section: 'spec' as const };
    if (spec.section === 'spec' && spec.value.trim().length < 80) return { ...spec, section: 'features' as const };
    return spec;
  });
  return [
    ...placed.filter((spec) => spec.section === 'spec').slice(0, 24),
    ...placed.filter((spec) => spec.section === 'features').slice(0, 36),
    ...placed.filter((spec) => spec.section === 'info').slice(0, 6),
  ];
}

function isMeasuredFact(label: string, value: string): boolean {
  const text = value.trim();
  if (!text || headingWords(label) >= 3) return false;
  if (/מק.?ט|דגם|צבע|אחריות|מידות|רוחב|גובה|עומק|משקל|קיבולת|נפח|מיכל|לחץ|משאבה|הספק|חשמל|וולט|ואט|הרץ|טחינה|גוף|חומר/.test(label)) {
    return text.length <= 400;
  }
  if (text.length > 40) return false;
  return text.length <= 40 && /\d/.test(text) && /ס"מ|ס״מ|מ"מ|ק"ג|ק״ג|ליטר|גרם|בר|וולט|ואט|הרץ/.test(`${label} ${text}`);
}

function headingWords(label: string): number {
  return fold(label).split(' ').filter((word) => word.length >= 2).length;
}

function sharesWord(label: string, text: string): boolean {
  const words = fold(label).split(' ').filter((word) => word.length >= 4);
  const hay = fold(text);
  return words.some((word) => hay.includes(word));
}

function isFullParagraph(value: string): boolean {
  const text = value.trim();
  return text.length >= 80 || text.split(/\s+/).length >= 12;
}

async function applySpecParagraphs(notes: string, fields: Field[], variants: BriefVariant[]): Promise<void> {
  const headings = fields.filter(
    (field) =>
      field.section === 'spec' &&
      field.type === 'text' &&
      (headingWords(field.label.he) >= 3 || fold(field.label.he) === 'מפרט'),
  );
  if (!notes.trim() || headings.length === 0) return;
  const paragraphs = (await writeSpecParagraphs(notes, headings))
    .map((item) => ({ ...item, value: completeFromSource(item.value, notes) }))
    .filter((item) => {
      const value = item.value.trim();
      if (!value) return true;
      if (startsMidSentence(value)) return false;
      return supportedFact(value, notes);
    });
  for (const variant of variants) variant.specs = mergeParagraphs(variant.specs, headings, paragraphs);
}

async function writeSpecParagraphs(notes: string, headings: Field[]): Promise<Array<{ fieldId: string; value: string; valueAr: string }>> {
  const ask = (targets: Field[], reminder: string) =>
    complete(
      [
        {
          role: 'system',
          content: `${reminder}Fill each specification heading by copying sentences from the seller notes only. Copy whole sentences from the start of the sentence, never from the middle. Do not begin with a continuation such as "על מידע זה" or "בהתבסס על" unless that is the real start of the sentence in the notes. Do not use knowledge of the product. Do not summarize, do not shorten, and do not leave out a relevant sentence that is written. If the notes do not discuss a heading, return an empty value. If a sentence is not in the notes, do not write it. value is Hebrew. valueAr is Arabic. Keep numbers, units, and model codes unchanged.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            notes,
            headings: targets.map((field) => ({ fieldId: field.id, labelHe: field.label.he, labelAr: field.label.ar })),
          }),
        },
      ],
      {
        type: 'json_schema',
        json_schema: { name: 'spec_paragraphs', strict: true, schema: paragraphSchema },
      },
    );
  const first = await readParagraphs(await ask(headings, '').catch(() => null));
  const weak = headings.filter((heading) => !isFullParagraph(first.find((item) => item.fieldId === heading.id)?.value ?? ''));
  if (weak.length === 0 || notes.trim().length < 200) return first;
  const second = await readParagraphs(
    await ask(weak, 'The previous paragraphs were too short. Copy the source sentences instead of a short phrase. ').catch(() => null),
  );
  return headings.map((heading) => {
    const again = second.find((item) => item.fieldId === heading.id);
    const earlier = first.find((item) => item.fieldId === heading.id);
    if (again && again.value.length > (earlier?.value.length ?? 0)) return again;
    return earlier ?? { fieldId: heading.id, value: '', valueAr: '' };
  });
}

async function readParagraphs(response: Response | null): Promise<Array<{ fieldId: string; value: string; valueAr: string }>> {
  if (!response?.ok) return [];
  try {
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = paragraphResultSchema.safeParse(JSON.parse(body.choices?.[0]?.message?.content ?? '{}'));
    return parsed.success ? parsed.data.paragraphs : [];
  } catch {
    return [];
  }
}

function mergeParagraphs(
  specs: Proposal['specs'],
  headings: Field[],
  paragraphs: Array<{ fieldId: string; value: string; valueAr: string }>,
): Proposal['specs'] {
  const byId = new Map(paragraphs.map((item) => [item.fieldId, item]));
  const kept = specs.flatMap((spec) => {
    const heading = headings.find((field) => field.id === spec.fieldId || same(field.label.he, spec.labelHe) || same(field.label.ar, spec.labelAr));
    if (!heading) return [spec];
    const paragraph = byId.get(heading.id);
    const replacing = paragraph ? isFullParagraph(paragraph.value) : false;
    const misplaced = spec.value.trim().length < 80 && !sharesWord(heading.label.he, `${spec.labelHe} ${spec.value}`);
    if (!replacing && !misplaced) return [spec];
    if (!same(spec.labelHe, heading.label.he) && spec.value.trim()) return [{ ...spec, fieldId: '', section: 'features' as const }];
    return [];
  });
  for (const heading of headings) {
    const paragraph = byId.get(heading.id);
    const value = paragraph?.value.trim() ?? '';
    if (!isFullParagraph(value)) continue;
    kept.unshift({
      fieldId: heading.id,
      labelHe: heading.label.he,
      labelAr: heading.label.ar,
      type: 'text',
      section: 'spec',
      value,
      valueAr: paragraph?.valueAr.trim() && hasArabic(paragraph.valueAr) ? paragraph.valueAr.trim() : '',
    });
  }
  return kept;
}

const paragraphSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['paragraphs'],
  properties: {
    paragraphs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fieldId', 'value', 'valueAr'],
        properties: {
          fieldId: { type: 'string' },
          value: { type: 'string' },
          valueAr: { type: 'string' },
        },
      },
    },
  },
} as const;

const paragraphResultSchema = z.object({
  paragraphs: z
    .array(
      z.object({
        fieldId: z.string().max(80).default(''),
        value: z.string().trim().max(4_000).default(''),
        valueAr: z.string().trim().max(4_000).default(''),
      }),
    )
    .max(24)
    .default([]),
});

function placeSpecs(specs: Proposal['specs']): Proposal['specs'] {
  const placed = specs.map((spec) =>
    spec.section === 'spec' && spec.value.trim().length < 40 ? { ...spec, section: 'features' as const } : spec,
  );
  return [
    ...placed.filter((spec) => spec.section === 'features').slice(0, 36),
    ...placed.filter((spec) => spec.section === 'spec' && isRealParagraph(spec.value) && !same(spec.value, spec.labelHe)).slice(0, 4),
    ...placed.filter((spec) => spec.section === 'info').slice(0, 6),
  ];
}

function backfill(proposal: Proposal, page: string, catalog: Catalog): void {
  const category = catalog.categories.find(
    (item) => item.id === proposal.category.id || same(item.name.he, proposal.category.nameHe),
  );
  for (const line of blocks(page, 'ROWS').flatMap((chunk) => chunk.split('\n'))) {
    const split = line.indexOf(': ');
    if (split < 2) continue;
    const label = line.slice(0, split).trim();
    const value = line.slice(split + 2).trim();
    if (!usableRow(label, value)) continue;
    const known = category?.fields.find((field) => same(field.label.he, label) || related(field.label.he, label));
    if (proposal.specs.some((spec) => same(spec.labelHe, label) || (known !== undefined && spec.fieldId === known.id))) continue;
    proposal.specs.push({
      fieldId: known?.id ?? '',
      labelHe: known?.label.he || label,
      labelAr: known?.label.ar ?? '',
      type: known?.type ?? guessType(value),
      section: known && (known.section !== 'spec' || isRealParagraph(value)) ? known.section : 'features',
      value,
      valueAr: '',
    });
  }
  for (const piece of markedPieces(page, 'PROSE')) {
    const [title, ...rest] = piece.split('\n');
    const label = title?.trim() ?? '';
    const value = dropContact(rest.join('\n').trim());
    if (label.length < 2 || !isRealParagraph(value) || isStoreNoise(label) || isContact(label)) continue;
    if (proposal.specs.some((spec) => spec.section === 'spec' && same(spec.labelHe, label))) continue;
    proposal.specs.push({ fieldId: '', labelHe: label, labelAr: '', type: 'text', section: 'spec', value, valueAr: '' });
  }
  for (const piece of markedPieces(page, 'LISTS')) {
    const [title, ...rest] = piece.split('\n');
    const label = title?.trim() ?? '';
    const value = dropContact(rest.map((line) => line.trim()).filter((line) => line && !isContact(line)).join('\n'));
    if (label.length < 2 || value.length < 8 || isStoreNoise(label) || isContact(label)) continue;
    if (proposal.specs.some((spec) => spec.section === 'info' && same(spec.labelHe, label))) continue;
    proposal.specs.push({ fieldId: '', labelHe: label, labelAr: '', type: 'text', section: 'info', value, valueAr: '' });
  }
}

function blocks(page: string, name: string): string[] {
  const chunks: string[] = [];
  const token = `${name}\n`;
  let from = 0;
  while (from < page.length) {
    const at = page.indexOf(token, from);
    if (at < 0) break;
    if (at > 0 && page[at - 1] !== '\n') {
      from = at + token.length;
      continue;
    }
    const start = at + token.length;
    let end = page.length;
    for (const marker of ['TITLE', 'PRICE', 'ROWS', 'LISTS', 'PROSE', 'PAGE']) {
      if (marker === name) continue;
      const next = page.indexOf(`\n${marker}\n`, start);
      if (next >= 0 && next < end) end = next;
    }
    const source = page.indexOf('\nSOURCE ', start);
    if (source >= 0 && source < end) end = source;
    const chunk = page.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    from = end;
  }
  return chunks;
}

function markedPieces(page: string, name: string): string[] {
  return blocks(page, name)
    .flatMap((chunk) => chunk.split('\n## ').map((piece) => piece.replace(/^## /, '').trim()))
    .filter(Boolean);
}

function decodeCodePoint(code: number): string {
  if (!Number.isInteger(code) || code < 1 || code > 0x10ffff) return '';
  return String.fromCodePoint(code);
}

function usableRow(label: string, value: string): boolean {
  if (label.length < 2 || label.length > 80 || value.length < 1 || value.length > 180) return false;
  if (/לא צוין/.test(value) || /^(מפרט|specifications?)$/i.test(value.trim())) return false;
  if (label.split(/\s+/).length > 8) return false;
  if (isStoreNoise(label) || isStoreNoise(value) || isContact(label) || isContact(value) || label.includes('http') || value.includes('http')) return false;
  return !/^(דף הבית|עגלה|חיפוש|התחברות|קטגוריות|תפריט|menu|home|cart)$/i.test(label);
}

function currentPrice(page: string): string {
  const marked = page.match(/המחיר הנוכחי[^0-9₪]{0,30}₪?\s*(\d[\d,.\s]{1,12})/);
  return marked?.[1] ? money(marked[1]) : '';
}

function priceFromPage(page: string): string {
  for (const chunk of blocks(page, 'PRICE')) {
    const found = money(chunk);
    if (found) return found;
  }
  const shekel = page.match(/₪\s*\d[\d,.\s]{1,12}|\d[\d,.\s]{1,12}₪/);
  return shekel ? money(shekel[0]) : '';
}

function money(value: string): string {
  const match = value.match(/(\d{1,3}(?:[,.\s]\d{3})+|\d{2,6})/);
  if (!match?.[1]) return '';
  const amount = Number(match[1].replace(/[^\d]/g, ''));
  if (!Number.isFinite(amount) || amount < 50 || amount > 200_000) return '';
  return String(amount);
}

function cleanColor(value: string): string {
  const color = value.trim().replace(/\s+/g, ' ');
  if (!color || color.length > 40 || /₪|\d{3,}/.test(color) || color.split(' ').length > 4) return '';
  return color;
}

function guessType(value: string): 'text' | 'number' | 'boolean' {
  const token = value.trim().toLowerCase();
  if (['yes', 'no', 'true', 'false', 'כן', 'לא', 'نعم', 'لا'].includes(token)) return 'boolean';
  if (/^\d+(?:[.,]\d+)?$/.test(token)) return 'number';
  return 'text';
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

type ChatContent =
  | string
  | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

async function complete(messages: Array<{ role: string; content: ChatContent }>, responseFormat: unknown): Promise<Response> {
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
    if (!trimmed || hasArabic(trimmed) || !hasHebrew(trimmed)) return;
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
    // Translate Hebrew values for text AND mixed feature strings; pure numbers stay as-is.
    if (!hasArabic(spec.valueAr) && hasHebrew(spec.value)) {
      queue(spec.value, (value) => {
        spec.valueAr = value;
      });
    } else if (!spec.valueAr.trim() && spec.value.trim() && !hasHebrew(spec.value)) {
      spec.valueAr = spec.value.trim();
    }
  }
  if (jobs.length === 0) return proposal;
  const translated = await translateAll(jobs.map((job) => job.text));
  jobs.forEach((job, index) => {
    const next = translated[index]?.trim() ?? '';
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

type BriefVariant = {
  label: string;
  sku: string;
  price: string;
  subcategory: Proposal['subcategory'];
  specs: Proposal['specs'];
};

const emptySubcategory: Proposal['subcategory'] = { id: '', nameHe: '', nameAr: '' };

type ParsedSize = { size: string; modelCode: string; sku: string };
type ParsedNotes = {
  nameHe: string;
  brandName: string;
  categoryName: string;
  subcategoryName: string;
  specs: Proposal['specs'];
  variants: ParsedSize[];
};

function parseNotes(model: string, notes: string): ParsedNotes {
  const empty: ParsedNotes = { nameHe: '', brandName: '', categoryName: '', subcategoryName: '', specs: [], variants: [] };
  const text = notes.replace(/[\u200e\u200f\u05c1\u05bf]/g, '').replace(/\r/g, '').trim();
  if (text.length < 40) return empty;
  const variants: ParsedSize[] = [];
  const seen = new Set<string>();
  const body = text.replace(
    /([A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{3,})[^\n]{0,48}מק.?ט\s*[:：]?\s*(\d{4,8})/g,
    (_all, code: string, sku: string) => {
      const modelCodeValue = String(code).toUpperCase();
      if (!seen.has(modelCodeValue)) {
        seen.add(modelCodeValue);
        variants.push({ size: sizeToken(modelCodeValue), modelCode: modelCodeValue, sku: String(sku) });
      }
      return '\n';
    },
  );
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && line !== 'מפרט');
  const specs: Proposal['specs'] = [];
  let nameHe = '';
  let brandName = '';
  let categoryName = '';
  let subcategoryName = '';
  let heading = '';
  let context = '';
  let paragraph: string[] = [];
  let bullets: string[] = [];
  let featureMode = false;
  let pendingLabel = '';
  const measures: { stand: string; text: string }[] = [];
  const measureLines: string[] = [];
  const measureFields: { label: string; value: string }[] = [];

  const remember = (label: string, value: string, section: 'spec' | 'features' | 'info') => {
    const cleanLabel = label.trim();
    const cleanValue = value.trim();
    if (cleanLabel.length < 2 || !cleanValue || same(cleanLabel, cleanValue)) return;
    if (/^קטגורי/.test(cleanLabel)) {
      categoryName = cleanValue;
      return;
    }
    if (/תת.?קטגור/.test(cleanLabel)) {
      subcategoryName = cleanValue;
      return;
    }
    if (cleanLabel === 'מותג') {
      brandName = cleanValue;
      context = '';
    }
    if (cleanLabel === 'מידות' && !/\d/.test(cleanValue)) {
      context = cleanValue;
      return;
    }
    const stand = measureStand(context);
    const canonical = stand ? canonicalMeasure(stand, cleanLabel, cleanValue) : null;
    const noted = Boolean(stand && (canonical || /משקל|מעמד השולחני/.test(cleanLabel)));
    const storedLabel = canonical?.label ?? (noted || !context || context === cleanLabel ? cleanLabel : `${context} — ${cleanLabel}`);
    const storedValue = canonical?.value ?? cleanValue;
    if (specs.some((spec) => same(spec.labelHe, storedLabel))) return;
    if (noted) measures.push({ stand, text: `${measureName(cleanLabel)} ${cleanValue}` });
    specs.push({
      fieldId: '',
      labelHe: storedLabel,
      labelAr: '',
      type: section === 'features' ? guessType(storedValue) : 'text',
      section,
      value: storedValue,
      valueAr: '',
    });
  };

  const flush = () => {
    const prose = paragraph.join('\n').trim();
    const bulletCount = bullets.length;
    const notesText = bullets.join('\n').trim();
    paragraph = [];
    bullets = [];
    const combined = [prose, notesText].filter(Boolean).join('\n');
    const narrative = prose.length >= 60 || bulletCount >= 2;
    if (narrative) context = '';
    if (heading && combined) remember(heading, combined, narrative ? 'spec' : 'info');
    else if (!heading && prose) remember('מפרט', prose, 'spec');
    heading = '';
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line === 'תכונות ומאפיינים') {
      flush();
      featureMode = true;
      context = '';
      continue;
    }
    const scopeLabel = line.match(/^((?:מידות\s+)?(?:ללא|עם|כולל)\s+מעמד)\s*:?\s*$/);
    if (scopeLabel?.[1]) {
      flush();
      context = scopeLabel[1].replace(/\s+/g, ' ').trim();
      heading = '';
      continue;
    }
    if (featureMode) {
      const row = splitRow(line);
      if (row) {
        if (takeMeasure(row.label, row.value, pendingLabel || context, measureLines, measureFields)) continue;
        if (pendingLabel) context = pendingLabel;
        remember(row.label, row.value, 'features');
        pendingLabel = '';
        continue;
      }
      if (pendingLabel === 'מידות') pendingLabel = '';
      if (pendingLabel) {
        if (takeMeasure(pendingLabel, line, context, measureLines, measureFields)) {
          pendingLabel = '';
          continue;
        }
        remember(pendingLabel, line, 'features');
        pendingLabel = '';
        continue;
      }
      if (line.length <= 40) pendingLabel = line;
      continue;
    }
    const upcoming = lines[index + 1] ?? '';
    const stacked = stackedPair(line, upcoming);
    if (stacked) {
      flush();
      if (takeMeasure(stacked.label, stacked.value, context, measureLines, measureFields)) {
        index += 1;
        continue;
      }
      remember(stacked.label, stacked.value, 'features');
      index += 1;
      continue;
    }
    const row = splitRow(line);
    if (row) {
      if (takeMeasure(row.label, row.value, heading || context, measureLines, measureFields)) {
        if (heading) bullets.push(`${row.label}: ${row.value}`);
        continue;
      }
      if (heading) {
        bullets.push(`${row.label}: ${row.value}`);
        if (/דירוג אנרגטי/.test(row.label)) remember('דירוג אנרגטי', row.value, 'features');
        continue;
      }
      if (heading && paragraph.length === 0 && bullets.length === 0) context = heading;
      remember(row.label, row.value, 'features');
      continue;
    }
    if (!nameHe && !line.includes(':')) {
      nameHe = line;
      continue;
    }
    const upcomingIsList = isShortLine(upcoming) && !isSentence(upcoming) && !splitRow(upcoming);
    if (heading && paragraph.length === 0 && bullets.length > 0 && isShortLine(line) && !isSentence(line) && line.length <= 40 && upcomingIsList) {
      bullets.push(line);
      continue;
    }
    if (isTitle(line) && (isLongLine(upcoming) || isSentence(upcoming) || isBulletLine(upcoming) || Boolean(splitRow(upcoming)))) {
      flush();
      heading = line;
      continue;
    }
    if (isLongLine(line) || isSentence(line)) {
      paragraph.push(line);
      continue;
    }
    if (isShortLine(line)) bullets.push(line);
  }
  flush();

  context = '';
  if (measureLines.length > 0) {
    const summary = measureLines.join('\n');
    const existing = specs.find((spec) => spec.labelHe === 'מידות');
    if (existing) existing.value = summary;
    else remember('מידות', summary, 'features');
  }
  for (const field of measureFields) {
    const existing = specs.find((spec) => same(spec.labelHe, field.label));
    if (existing) existing.value = field.value;
    else remember(field.label, field.value, 'features');
  }
  if (measures.length > 0 && !specs.some((spec) => spec.labelHe === 'מידות')) {
    const summary = ['ללא מעמד', 'כולל מעמד']
      .map((stand) => {
        const rows = measures.filter((item) => item.stand === stand).map((item) => item.text);
        return rows.length > 0 ? `${stand}: ${rows.join(', ')}` : '';
      })
      .filter(Boolean)
      .join('\n');
    if (summary) {
      remember('מידות', summary, 'features');
      remember('מידות ומשקל כולל מעמד', summary, 'spec');
    }
  }
  const sourceSize = sizeToken(nameHe) || sizeToken(model) || variants[0]?.size || '';
  const source = variants.find((item) => item.size === sourceSize) ?? variants[0];
  if (source?.modelCode && !specs.some((spec) => spec.labelHe === 'דגם')) remember('דגם', source.modelCode, 'features');
  if (source?.sku && !specs.some((spec) => isSkuLabel(spec.labelHe))) remember('מק"ט', source.sku, 'features');
  if (sourceSize && !specs.some((spec) => /גודל מסך/.test(spec.labelHe))) remember('גודל מסך', sourceSize, 'features');
  if (!brandName) {
    const brand = nameHe.match(/\b(Samsung|LG|Sony|Philips|TCL|Hisense|Xiaomi)\b/i)?.[1] ?? '';
    brandName = brand;
  }
  if (!categoryName && /טלוויז/.test(`${nameHe}\n${text.slice(0, 400)}`)) categoryName = 'טלוויזיות';
  if (/טלוויזיה חכמה/.test(`${nameHe}\n${text.slice(0, 500)}`) && !specs.some((spec) => spec.labelHe === 'טלוויזיה חכמה')) {
    remember('טלוויזיה חכמה', 'כן', 'features');
  }
  const ordered = collectVariantSizes(model, `${nameHe}\n${text}`, variants);
  if (ordered.length === 0) {
    const code = modelCode(`${nameHe} ${model}`);
    const modelCodeValue = /[A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{3,}/.test(code) ? code.toUpperCase() : '';
    const sku = specs.find((spec) => isSkuLabel(spec.labelHe))?.value ?? '';
    const size = sizeToken(nameHe) || sizeToken(modelCodeValue) || sizeToken(model);
    if (modelCodeValue || sku || size) ordered.push({ size, modelCode: modelCodeValue, sku });
  }
  const sourceIndex = ordered.findIndex((item) => item.size === sourceSize);
  if (sourceIndex > 0) {
    const [first] = ordered.splice(sourceIndex, 1);
    if (first) ordered.unshift(first);
  }
  return { nameHe, brandName, categoryName, subcategoryName, specs, variants: ordered };
}

function modelFamilyKey(code: string): string {
  return code.toUpperCase().replace(/\d{2,3}/, '');
}

function sameModelFamily(left: string, right: string): boolean {
  if (!left || !right) return true;
  const a = modelFamilyKey(left);
  const b = modelFamilyKey(right);
  if (a.length < 4 || b.length < 4) return false;
  return a === b || a.startsWith(b.slice(0, 5)) || b.startsWith(a.slice(0, 5));
}

/**
 * Sizes come only from written model codes of the same family (and optional SKUs).
 * Do NOT invent sizes from dimension numbers in "מידות" — that created fake extras.
 */
function collectVariantSizes(model: string, notes: string, current: ParsedSize[]): ParsedSize[] {
  const text = `${model}\n${notes}`;
  const anchor = modelCode(model) || current.find((item) => item.modelCode)?.modelCode || '';
  const bySize = new Map<string, ParsedSize>();
  const remember = (size: string, modelCodeValue: string, sku: string) => {
    if (!size) return;
    if (anchor && modelCodeValue && !sameModelFamily(anchor, modelCodeValue)) return;
    const previous = bySize.get(size);
    bySize.set(size, {
      size,
      modelCode: modelCodeValue || previous?.modelCode || '',
      sku: sku || previous?.sku || '',
    });
  };
  for (const item of current) {
    if (item.modelCode || item.sku) remember(item.size || sizeToken(item.modelCode), item.modelCode, item.sku);
  }
  for (const match of text.matchAll(/([A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{3,})[^\n]{0,48}מק.?ט\s*[:：]?\s*(\d{4,8})/g)) {
    const code = String(match[1] ?? '').toUpperCase();
    remember(sizeToken(code), code, String(match[2] ?? ''));
  }
  for (const match of text.matchAll(/\b([A-Za-z]{1,8}\d{2}[A-Za-z0-9-]{3,})\b/g)) {
    const code = String(match[1] ?? '').toUpperCase();
    remember(sizeToken(code), code, '');
  }
  // Explicit size list only as a last resort when no model codes were found.
  if (bySize.size === 0) {
    for (const size of listedSizes(text)) remember(size, '', '');
  }
  return [...bySize.values()].sort((left, right) => Number(left.size) - Number(right.size));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split seller notes into a shared preamble + one block per size/model. */
function notesBlocksForSizes(notes: string, variants: ParsedSize[]): { shared: string; bySize: Map<string, string> } {
  const text = notes.replace(/\r/g, '');
  const markers: { index: number; size: string }[] = [];
  for (const item of variants) {
    if (!item.size) continue;
    let index = -1;
    if (item.modelCode) {
      // Prefer the last occurrence — catalogs often list all codes once at the top.
      const re = new RegExp(`\\b${escapeRegExp(item.modelCode)}\\b`, 'ig');
      let match: RegExpExecArray | null;
      while ((match = re.exec(text))) index = match.index;
    }
    if (index < 0) {
      const re = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(item.size)}\\s*(?:"|″|״|אינץ)`, 'ig');
      let match: RegExpExecArray | null;
      while ((match = re.exec(text))) index = match.index + (text[match.index] === '\n' ? 1 : 0);
    }
    if (index >= 0 && !markers.some((marker) => marker.size === item.size)) markers.push({ index, size: item.size });
  }
  markers.sort((left, right) => left.index - right.index);
  const bySize = new Map<string, string>();
  if (markers.length === 0) return { shared: text, bySize };
  const shared = text.slice(0, markers[0]!.index).trim();
  for (let index = 0; index < markers.length; index += 1) {
    const start = markers[index]!.index;
    const end = index + 1 < markers.length ? markers[index + 1]!.index : text.length;
    bySize.set(markers[index]!.size, text.slice(start, end).trim());
  }
  return { shared, bySize };
}

function mergeSpecs(base: Proposal['specs'], extra: Proposal['specs']): Proposal['specs'] {
  const merged = [...base];
  for (const item of extra) {
    if (!item.value.trim()) continue;
    const index = merged.findIndex(
      (spec) => same(spec.labelHe, item.labelHe) || (item.labelAr && same(spec.labelAr, item.labelAr)),
    );
    if (index >= 0) merged[index] = { ...item };
    else merged.push(item);
  }
  return merged;
}

function isIdentitySpec(label: string): boolean {
  return isSkuLabel(label) || label === 'דגם' || /גודל מסך/.test(label);
}

/** Lightweight row scrape when a size block is too short for full parseNotes. */
function rowsFromBlock(block: string): Proposal['specs'] {
  const specs: Proposal['specs'] = [];
  const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const row = splitRow(line) ?? stackedPair(line, lines[index + 1] ?? '');
    if (!row) continue;
    if (stackedPair(line, lines[index + 1] ?? '')) index += 1;
    if (specs.some((spec) => same(spec.labelHe, row.label))) continue;
    specs.push({
      fieldId: '',
      labelHe: row.label,
      labelAr: '',
      type: guessType(row.value),
      section: 'features',
      value: row.value,
      valueAr: '',
    });
  }
  return specs;
}

/**
 * Build specs for one size from THAT size's note block only.
 * Never clones another size's measurements or prose.
 */
function specsForSize(item: ParsedSize, shared: Proposal['specs'], blockNotes: string): Proposal['specs'] {
  const block = blockNotes.trim();
  const parsedLocal = block.length >= 40 ? parseNotes(item.modelCode || item.size, block) : null;
  const fromBlock = (parsedLocal?.specs.length ? parsedLocal.specs : rowsFromBlock(block)).filter(
    (spec) => !isIdentitySpec(spec.labelHe),
  );
  const next = mergeSpecs(
    shared.filter((spec) => !isIdentitySpec(spec.labelHe)),
    fromBlock,
  ).map((spec) => ({ ...spec, valueAr: '', labelAr: spec.labelAr || '' }));

  const ensure = (labelHe: string, value: string, type: 'text' | 'number' = 'text') => {
    if (!value) return;
    const index = next.findIndex(
      (spec) => same(spec.labelHe, labelHe) || (labelHe === 'מק"ט' && isSkuLabel(spec.labelHe)),
    );
    if (index >= 0) {
      next[index] = { ...next[index]!, value, valueAr: '', labelAr: next[index]!.labelAr || '' };
      return;
    }
    next.unshift({
      fieldId: '',
      labelHe,
      labelAr: '',
      type,
      section: 'features',
      value,
      valueAr: '',
    });
  };
  ensure('דגם', item.modelCode);
  ensure('מק"ט', item.sku);
  ensure('גודל מסך', item.size, 'number');
  return next;
}

function splitRow(line: string): { label: string; value: string } | null {
  const match = line.match(/^([^:]{2,40}):\s*(.+)$/);
  if (!match?.[1] || !match[2]) return null;
  const label = match[1].trim();
  if (label.split(/\s+/).length > 8) return null;
  return { label, value: match[2].trim() };
}

function stackedPair(label: string, value: string): { label: string; value: string } | null {
  const cleanLabel = label.trim();
  const cleanValue = value.trim();
  if (!cleanLabel || !cleanValue || splitRow(cleanLabel) || splitRow(cleanValue)) return null;
  if (isLongLine(cleanLabel) || isSentence(cleanLabel) || cleanLabel.length > 48) return null;
  if (isLongLine(cleanValue) && cleanValue.length > 80) return null;
  if (/^(?:מותג|דגם|מק.?ט|צבע|מערכת הפעלה|טכנולוגיה|סוג רזולוציה|גודל מסך|סוג תצוגה)/.test(cleanLabel)) {
    return { label: cleanLabel, value: cleanValue };
  }
  if (/(?:רוחב|גובה|עומק).*(?:מעמד|ס"מ|ס״מ)/.test(cleanLabel) && /^\d/.test(cleanValue)) {
    return { label: cleanLabel, value: cleanValue };
  }
  return null;
}

function startsMidSentence(value: string): boolean {
  return /^(?:על מידע זה|בהתבסס על(?:\s+מידע)?|הוא מספק|היא מספקת|כדי לספק|וכן |וגם )/u.test(value.trim());
}

function completeFromSource(value: string, source: string): string {
  const text = value.trim();
  if (!text) return '';
  const hay = source.replace(/\r/g, '');
  let at = -1;
  for (let len = Math.min(text.length, 160); len >= 24; len -= 1) {
    const found = hay.indexOf(text.slice(0, len));
    if (found >= 0) {
      at = found;
      break;
    }
  }
  if (at < 0) return startsMidSentence(text) ? '' : text;
  let start = at;
  while (start > 0) {
    const previousBreak = hay.lastIndexOf('\n', start - 1);
    const lineStart = previousBreak + 1;
    const previous = hay.slice(lineStart, start).trim();
    if (!previous) {
      start = lineStart;
      break;
    }
    if (isTitle(previous) || (!isLongLine(previous) && !isSentence(previous) && previous.length <= 48)) break;
    start = lineStart;
  }
  let end = Math.max(at + text.length, at + 24);
  while (end < hay.length) {
    const nextBreak = hay.indexOf('\n', end);
    const lineEnd = nextBreak < 0 ? hay.length : nextBreak;
    const next = hay.slice(end, lineEnd).replace(/^\n/, '').trim();
    if (!next) break;
    if (isTitle(next) && !isLongLine(next) && !isSentence(next)) break;
    if (/^(?:תצוגה|עיבוד|גיימינג|סאונד|כניסות|מידות|מק.?ט|דגם|מותג|תכונות)/.test(next)) break;
    end = nextBreak < 0 ? hay.length : nextBreak + 1;
    if (end - start > 1_800) break;
  }
  return hay.slice(start, end).trim();
}

function isShortLine(line: string): boolean {
  return line.length >= 2 && line.length <= 80 && line.split(/\s+/).length <= 10 && !isLongLine(line);
}

function isLongLine(line: string): boolean {
  return line.length >= 60 || line.split(/\s+/).length >= 8;
}

function isBulletLine(line: string): boolean {
  return /^(?:תמיכה|כניס|Wi-?Fi|Bluetooth|\d)/i.test(line);
}

function isSentence(line: string): boolean {
  return /[.!?]$/.test(line.trim());
}

function isTitle(line: string): boolean {
  if (!isShortLine(line) || isSentence(line) || isBulletLine(line)) return false;
  if (/^(?:הטלוויזיה|המערכת|קיימת|קיים|בנוסף|אפשרויות|שלוש|שני|המעמד|צבע )/.test(line)) return false;
  return true;
}

function standOf(text: string): string {
  if (!text || /אריזה|vesa/i.test(text)) return '';
  if (/ללא מעמד/.test(text)) return 'ללא מעמד';
  if (/(?:עם|כולל) מעמד/.test(text) && !/המעמד/.test(text)) return 'כולל מעמד';
  return '';
}

function takeMeasure(
  label: string,
  value: string,
  scope: string,
  lines: string[],
  fields: { label: string; value: string }[],
): boolean {
  const stand = standOf(label) || standOf(scope);
  const inline = /מידות|vesa/i.test(label);
  const part = Boolean(stand && /^(?:רוחב|גובה|עומק|משקל)/.test(label));
  if (!inline && !part) return false;
  const kind = label.match(/^(רוחב|גובה|עומק)/)?.[1] ?? '';
  const summary = inline ? `${label}: ${value}` : `${stand}: ${kind || measureName(label)} ${value}`;
  if (!lines.includes(summary)) lines.push(summary);
  if (stand && !/vesa|אריזה|המעמד/i.test(`${label} ${scope}`)) {
    const amountDirect = kind ? value.match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.') : '';
    if (kind && amountDirect) {
      const fieldLabel = `${kind} ${stand} (ס"מ)`;
      if (!fields.some((item) => item.label === fieldLabel)) fields.push({ label: fieldLabel, value: amountDirect });
    } else {
      const blob = /^(?:רוחב|גובה|עומק)$/.test(label) ? `${label} ${value}` : value;
      for (const name of ['רוחב', 'גובה', 'עומק']) {
        const amount = blob.match(new RegExp(`${name}\\s*[:]?\\s*(\\d+(?:[.,]\\d+)?)`))?.[1]?.replace(',', '.');
        if (!amount) continue;
        const fieldLabel = `${name} ${stand} (ס"מ)`;
        if (!fields.some((item) => item.label === fieldLabel)) fields.push({ label: fieldLabel, value: amount });
      }
    }
  }
  return true;
}

function isSkuLabel(label: string): boolean {
  return /^מק.?ט$/.test(label.trim());
}

function measureStand(context: string): string {
  if (!context || /אריזה|vesa/i.test(context)) return '';
  if (/ללא מעמד/.test(context)) return 'ללא מעמד';
  if (/כולל מעמד/.test(context)) return 'כולל מעמד';
  return '';
}

function canonicalMeasure(stand: string, label: string, value: string): { label: string; value: string } | null {
  if (label !== 'רוחב' && label !== 'גובה' && label !== 'עומק') return null;
  const amount = value.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.');
  if (!amount) return null;
  return { label: `${label} ${stand} (ס"מ)`, value: amount };
}

function measureName(label: string): string {
  if (label === 'רוחב' || label === 'גובה' || label === 'עומק') return label;
  if (/משקל/.test(label)) return 'משקל';
  if (/מעמד השולחני/.test(label)) return 'רוחב מעמד';
  return label;
}

function tidySubcategory(name: string): string {
  const numbers = sizeRange(name);
  if (numbers.length < 2) return name.trim();
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  const prefix = /טלוויז/.test(name) ? 'טלוויזיות' : name.replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  return `${prefix} ${low}"-${high}"`;
}

function sizeRange(name: string): number[] {
  return [...name.matchAll(/\d{2,3}/g)].map((match) => Number(match[0])).filter((value) => value >= 32 && value <= 120);
}

function rangeCovers(name: string, inches: number): boolean {
  const numbers = sizeRange(name);
  const open = /ומעלה|\+/.test(name);
  if (open && numbers.length >= 1) return inches >= Math.min(...numbers);
  if (numbers.length >= 2) return inches >= Math.min(...numbers) && inches <= Math.max(...numbers);
  return numbers.length === 1 && numbers[0] === inches;
}

function subcategoryForSize(size: string, written: string, catalog: Catalog, source: boolean): string {
  const inches = Number(size);
  for (const category of catalog.categories) {
    for (const subcategory of category.subcategories) {
      if (rangeCovers(subcategory.name.he, inches)) return subcategory.name.he;
    }
  }
  if (written && rangeCovers(written, inches)) return tidySubcategory(written);
  if (source && written && sizeRange(written).length === 0) return written;
  return '';
}

function parsedToVariants(parsed: ParsedNotes, catalog: Catalog, notes = ''): BriefVariant[] {
  const sizes = parsed.variants.length > 0 ? parsed.variants : [{ size: '', modelCode: '', sku: '' }];
  const source = sizes[0] ?? { size: '', modelCode: '', sku: '' };
  const sized = sizes.filter((item) => item.size);
  const multi = sized.length >= 2;
  const { shared, bySize } = notesBlocksForSizes(notes, sized);
  const sharedParsed = shared.length >= 40 ? parseNotes(parsed.nameHe || source.modelCode || '', shared) : null;
  // Multi-size: shared preamble only. Never reuse the whole-document parse (that cloned size #1).
  const sharedSpecs = (
    multi ? (sharedParsed?.specs ?? []) : sharedParsed?.specs.length ? sharedParsed.specs : parsed.specs
  ).filter((spec) => !isIdentitySpec(spec.labelHe));

  return sizes.map((item) => {
    const block = (item.size && bySize.get(item.size)) || (multi ? '' : notes);
    const isSource = item.size === source.size;
    const specs = specsForSize(item, sharedSpecs, block).map((spec) => {
      if (/ברקוד|barcode/i.test(spec.labelHe) && !isSource) return { ...spec, value: '', valueAr: '' };
      return spec;
    });
    return {
      label: item.size ? `${item.size}"` : '',
      sku: item.sku || (item.modelCode ? skuForSize(block || notes, item.size, item.modelCode) : ''),
      price: priceForSize(block || notes, item.size),
      subcategory: {
        id: '',
        nameHe: subcategoryForSize(item.size, parsed.subcategoryName || sharedParsed?.subcategoryName || '', catalog, isSource),
        nameAr: '',
      },
      specs,
    };
  });
}

async function applyParsed(input: z.infer<typeof inputSchema>, parsed: ParsedNotes, catalog: Catalog): Promise<ProductIntake> {
  const notes = `${input.model}\n${input.notes}`;
  parsed = { ...parsed, variants: collectVariantSizes(input.model, notes, parsed.variants) };
  const fitted = parsedToVariants(parsed, catalog, notes);
  const proposal: Proposal = {
    nameHe: familyName(parsed.nameHe || input.model, fitted.length),
    nameAr: '',
    brand: { id: '', name: parsed.brandName, slug: '' },
    category: { id: '', nameHe: parsed.categoryName, nameAr: '', slug: '' },
    subcategory: fitted[0]?.subcategory ?? emptySubcategory,
    specs: fitted[0]?.specs ?? [],
    price: fitted[0]?.price ?? '',
    color: fitted[0]?.label ?? '',
  };
  // Translate product shell + every variant's own specs (do not swallow failures into empty Arabic).
  await fillArabic(proposal);
  for (const variant of fitted) {
    await fillArabic({ ...proposal, specs: variant.specs, subcategory: variant.subcategory });
  }
  const created = { brand: null as string | null, category: null as string | null, subcategory: null as string | null, fields: [] as string[] };
  const slugs = new Set([...catalog.brands.map((brand) => brand.slug), ...catalog.categories.map((category) => category.slug)]);
  const brandId = await ensureBrand(proposal, catalog, slugs, created);
  const category = await ensureCategory(proposal, catalog, slugs, created);
  const fields: Field[] = [];
  const variants = [];
  for (const variant of fitted) {
    const subcategoryId = await ensureSubcategory({ ...proposal, subcategory: variant.subcategory }, category, created);
    const specs = await ensureSpecs({ ...proposal, specs: variant.specs }, fields, created);
    variants.push({
      label: clip(variant.label),
      sku: clip(variant.sku),
      price: clip(variant.price),
      subcategoryId,
      specs: specs.values,
      specsAr: specs.arabic,
    });
  }
  const first = variants[0];
  const nameHe = clip(proposal.nameHe || input.model);
  return {
    draft: {
      nameHe,
      nameAr: clip(proposal.nameAr || nameHe),
      brandId,
      categoryId: category.id,
      subcategoryId: first?.subcategoryId ?? '',
      fields,
      specs: first?.specs ?? {},
      specsAr: first?.specsAr ?? {},
      price: first?.price ?? '',
      color: first?.label ?? '',
      variants,
    },
    created,
  };
}

function familyName(title: string, count: number): string {
  if (count < 2) return title;
  return title
    .replace(/\s*דגם\s+\S+/g, '')
    .replace(/\d{2,3}\s*אינץ['׳״"]?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function briefPrice(price: string, label: string): string {
  const amount = money(price);
  const size = sizeToken(label);
  if (!amount || amount === size) return '';
  return amount;
}

async function intakeBrief(input: z.infer<typeof inputSchema>): Promise<ProductIntake> {
  const catalog = await readCatalog();
  const notes = `${input.model}\n${input.notes}`;
  const parsed = parseNotes(input.model, input.notes);
  const coded = collectVariantSizes(input.model, notes, parsed.variants);
  // Multiple written sizes → always use per-block parsing (never the AI overlay that cloned size #1).
  if (coded.length >= 2) {
    return applyParsed(
      input,
      {
        ...parsed,
        variants: coded,
        brandName: parsed.brandName || brandFromNotes(notes),
        categoryName: parsed.categoryName || inferCategory(notes),
      },
      catalog,
    );
  }
  if (canApplyParsed(parsed)) return applyParsed(input, parsed, catalog);
  const brief = await askBrief(input, catalog);
  if (!brief.brand.name.trim() || !supportedFact(brief.brand.name, notes)) {
    const name = brandFromNotes(notes);
    brief.brand = name ? { id: '', name, slug: '' } : { id: '', name: '', slug: '' };
  }
  if (!brief.category.nameHe.trim() || !supportedFact(brief.category.nameHe, notes)) {
    const nameHe = labeledValue(input.notes, /^קטגור/) || inferCategory(notes);
    brief.category = nameHe ? { ...brief.category, id: '', nameHe, nameAr: '', slug: '' } : { ...brief.category, id: '', nameHe: '', nameAr: '', slug: '' };
  }
  if (brief.nameHe && !supportedFact(brief.nameHe, notes)) brief.nameHe = input.model;
  const fitted = fitSizes(input.model, input.notes, brief.variants).map((variant) => ({
    ...variant,
    price: supportedFact(variant.price, notes) ? variant.price : '',
    subcategory: supportedFact(variant.subcategory.nameHe, notes) ? variant.subcategory : emptySubcategory,
    specs: variant.specs
      .map((spec) =>
        spec.section === 'spec' ? { ...spec, value: completeFromSource(spec.value, notes) || spec.value } : spec,
      )
      .filter((spec) => {
        if (!supportedFact(spec.value, notes)) return false;
        if (spec.section === 'spec' && startsMidSentence(spec.value)) return false;
        return true;
      }),
  }));
  if (!brief.brand.name.trim() && parsed.brandName) brief.brand = { id: '', name: parsed.brandName, slug: '' };
  if (!brief.category.nameHe.trim() && parsed.categoryName) {
    brief.category = { id: '', nameHe: parsed.categoryName, nameAr: '', slug: '' };
  }
  const proposal: Proposal = {
    nameHe: brief.nameHe || parsed.nameHe || input.model,
    nameAr: brief.nameAr,
    brand: brief.brand,
    category: brief.category,
    subcategory: fitted[0]?.subcategory ?? emptySubcategory,
    specs: fitted[0]?.specs ?? [],
    price: fitted[0]?.price ?? '',
    color: fitted[0]?.label ?? '',
  };
  await fillArabic(proposal);
  for (const variant of fitted) {
    await fillArabic({ ...proposal, specs: variant.specs, subcategory: variant.subcategory });
  }
  const created = { brand: null as string | null, category: null as string | null, subcategory: null as string | null, fields: [] as string[] };
  const slugs = new Set([...catalog.brands.map((brand) => brand.slug), ...catalog.categories.map((category) => category.slug)]);
  const brandId = await ensureBrand(proposal, catalog, slugs, created);
  const category = await ensureCategory(proposal, catalog, slugs, created);
  const fields: Field[] = [];
  await applySpecParagraphs(input.notes, fields, fitted);
  for (const variant of fitted) {
    await fillArabic({ ...proposal, specs: variant.specs, subcategory: variant.subcategory });
  }
  const variants = [];
  for (const variant of fitted) {
    const subcategoryId = await ensureSubcategory({ ...proposal, subcategory: variant.subcategory }, category, created);
    const specs = await ensureSpecs({ ...proposal, specs: variant.specs }, fields, created);
    variants.push({
      label: clip(variant.label),
      sku: clip(variant.sku),
      price: briefPrice(variant.price, variant.label),
      subcategoryId,
      specs: specs.values,
      specsAr: specs.arabic,
    });
  }
  const first = variants[0];
  const nameHe = clip(proposal.nameHe || input.model);
  return {
    draft: {
      nameHe,
      nameAr: clip(proposal.nameAr || nameHe),
      brandId,
      categoryId: category.id,
      subcategoryId: first?.subcategoryId ?? '',
      fields,
      specs: first?.specs ?? {},
      specsAr: first?.specsAr ?? {},
      price: first?.price ?? '',
      color: first?.label ?? '',
      variants,
    },
    created,
  };
}

async function askBrief(input: z.infer<typeof inputSchema>, catalog: Catalog): Promise<Proposal & { variants: BriefVariant[] }> {
  const known = {
    brands: catalog.brands.map((brand) => ({ id: brand.id, name: brand.name })),
    categories: catalog.categories.map((category) => ({
      id: category.id,
      nameHe: category.name.he,
      nameAr: category.name.ar,
      subcategories: category.subcategories.map((item) => ({ id: item.id, nameHe: item.name.he, nameAr: item.name.ar })),
    })),
  };
  const images = input.images.filter((image) => /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(image));
  const content: ChatContent = [
    { type: 'text', text: JSON.stringify({ model: input.model, notes: input.notes, catalog: known }) },
    ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
  ];
  const response = await complete(
    [
      {
        role: 'system',
        content:
          'Fill one store product only from the seller notes. The notes may be any layout: sentences, a loose spec list, a label on one line and its value on the next, or a mix. Copy every fact that is written there, and copy nothing else. Do not use knowledge of the brand, the model, or this kind of product. Do not browse, do not recall a spec sheet, and do not add a typical feature, price, warranty, size, or description. If the notes do not state a fact, leave it out. Attached images show this product only. Do not turn a recognized product into specifications that are not written in the notes. A brand inside a sentence still counts. Choose the closest existing category for the product type written in the notes, or name one when none fits. Do not return an empty product because the notes are not a catalog table. Section features is one short capability copied from the notes. A measured fact such as dimensions, weight, capacity, pressure, power, model code, catalog number, color, or warranty is its own short field only when that fact is written. Do not fill a spec heading of several words with one short phrase, and do not put a fact under a heading it does not belong to. Critical for TVs and similar products: when the notes mention several sizes for the same model (for example 55, 65, and 75, or three different model codes that differ only by the inch digits), you MUST return a separate variants[] entry for EVERY written size. Never collapse multiple sizes into one variant. label is the size, such as 55", or the color when no size is written. sku is that size\'s model code or catalog number. If the code contains the inch number, change only that number for another written size. Do not calculate or change any other number. price is digits only when that size has its own price written. Never copy one size\'s price onto another size. subcategory is filled only when a subcategory is written. specs are the written facts for that size. Leave a measurement empty when it was not written. Ignore phone numbers, addresses, store names, shipping, and payment badges. nameHe, labelHe, and value are Hebrew. nameAr, labelAr, and valueAr are Arabic. Keep numbers, units, and model codes unchanged. Copy an existing brand, category, or subcategory id when the notes match it. Otherwise leave the id empty and supply both names. Leave fieldId empty and supply both field names for each fact. Do not fill stock.',
      },
      { role: 'user', content },
    ],
    {
      type: 'json_schema',
      json_schema: { name: 'product_brief', strict: true, schema: briefSchema },
    },
  );
  if (!response.ok) throw new AppError(502, 'agent_failed', 'Language model did not respond');
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.choices?.[0]?.message?.content ?? '');
  } catch {
    throw new AppError(502, 'agent_failed', 'Language model did not respond');
  }
  const result = briefResultSchema.safeParse(parsed);
  if (!result.success) throw new AppError(502, 'agent_failed', 'Language model did not respond');
  return {
    ...result.data,
    subcategory: result.data.variants[0]?.subcategory ?? emptySubcategory,
    specs: [],
    price: result.data.variants[0]?.price ?? '',
    color: result.data.variants[0]?.label ?? '',
    variants: result.data.variants.map((variant) => ({
      ...variant,
      specs: placeBriefSpecs(scrubSpecs(variant.specs).filter((spec) => !isStoreNoise(spec.labelHe) && !isStoreNoise(spec.value))),
    })),
  };
}

const briefSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['nameHe', 'nameAr', 'brand', 'category', 'variants'],
  properties: {
    nameHe: { type: 'string' },
    nameAr: { type: 'string' },
    brand: outputSchema.properties.brand,
    category: outputSchema.properties.category,
    variants: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'sku', 'price', 'subcategory', 'specs'],
        properties: {
          label: { type: 'string' },
          sku: { type: 'string' },
          price: { type: 'string' },
          subcategory: outputSchema.properties.subcategory,
          specs: outputSchema.properties.specs,
        },
      },
    },
  },
} as const;

const briefResultSchema = z.object({
  nameHe: z.string().trim().max(200).default(''),
  nameAr: z.string().trim().max(200).default(''),
  brand: proposalSchema.shape.brand,
  category: proposalSchema.shape.category,
  variants: z
    .array(
      z.object({
        label: z.string().trim().max(80).default(''),
        sku: z.string().trim().max(80).default(''),
        price: z.string().trim().max(20).default(''),
        subcategory: proposalSchema.shape.subcategory,
        specs: proposalSchema.shape.specs,
      }),
    )
    .max(8)
    .default([]),
});

function canApplyParsed(parsed: ParsedNotes): boolean {
  const brand = parsed.brandName.trim();
  const category = parsed.categoryName.trim();
  if (!brand || !category) return false;
  return parsed.specs.length >= 4 || parsed.variants.length >= 2;
}

function labeledValue(notes: string, label: RegExp): string {
  const lines = notes.split('\n').map((line) => line.trim()).filter(Boolean);
  const bare = label.source.replace(/^\^/, '').replace(/\$$/, '');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const inline = line.match(new RegExp(`^${bare}\\s*[:：]?\\s*(.+)$`));
    if (inline?.[1] && !label.test(inline[1])) return inline[1].trim();
    if (label.test(line) && line.length <= 24) {
      const next = lines[index + 1] ?? '';
      if (next && next.length <= 80 && !label.test(next)) return next;
    }
  }
  return '';
}

function brandFromNotes(notes: string): string {
  const labeled = labeledValue(notes, /^מותג$/);
  if (labeled) return labeled;
  return notes.match(/(?:קונצרן|מותג)\s+([A-Za-z][A-Za-z0-9&.\- ]{1,40})/)?.[1]?.trim() ?? '';
}

function inferCategory(text: string): string {
  if (/מכונ(?:ת|ות) קפה/.test(text)) return 'מכונות קפה';
  if (/טלוויז/.test(text)) return 'טלוויזיות';
  if (/מקרר/.test(text)) return 'מקררים';
  if (/כביסה|מייבש/.test(text)) return 'מכונות כביסה';
  if (/מזגן/.test(text)) return 'מזגנים';
  if (/מדיח/.test(text)) return 'מדיחי כלים';
  if (/כיריים/.test(text)) return 'כיריים';
  if (/תנור/.test(text)) return 'תנורים';
  return '';
}

function fitSizes(model: string, notes: string, variants: BriefVariant[]): BriefVariant[] {
  const cleaned = variants.filter((variant) => variant.label || variant.sku || variant.price || variant.specs.length > 0);
  const source = cleaned[0] ?? {
    label: '',
    sku: modelCode(model),
    price: '',
    subcategory: emptySubcategory,
    specs: [],
  };
  // Prefer real model codes from the notes. Never invent sizes from measurement numbers.
  const coded = collectVariantSizes(model, notes, []);
  const sizes =
    coded.length >= 2
      ? coded.map((item) => item.size)
      : [
          ...new Set([
            ...listedSizes(`${model}\n${notes}`),
            ...cleaned.map((variant) => sizeToken(variant.label) || sizeToken(variant.sku)).filter(Boolean),
          ]),
        ].filter((size) => {
          const value = Number(size);
          return value >= 32 && value <= 120;
        });
  if (sizes.length < 2) return cleaned.length > 0 ? cleaned : [source];
  const known = new Map<string, BriefVariant>();
  for (const variant of cleaned) {
    const size = sizeToken(variant.label) || sizeToken(variant.sku);
    if (size) known.set(size, variant);
  }
  const blocks = notesBlocksForSizes(notes, coded);
  const sharedOnly = source.specs.filter((spec) => !isIdentitySpec(spec.labelHe));
  for (const item of coded) {
    if (known.has(item.size)) continue;
    const block = blocks.bySize.get(item.size) || '';
    known.set(item.size, {
      label: `${item.size}"`,
      sku: item.sku || item.modelCode,
      price: priceForSize(block || notes, item.size),
      subcategory: source.subcategory,
      specs: specsForSize(item, sharedOnly, block),
    });
  }
  return sizes.map((size) => known.get(size)).filter((variant): variant is BriefVariant => Boolean(variant));
}

function listedSizes(text: string): string[] {
  // Inch marks and explicit "גדלים" / "גודל מסך" only — not "מידות" (physical cm), which invents fake sizes.
  const marked = [...text.matchAll(/(\d{2,3})\s*(?:"|″|״)/g)].map((match) => match[1] ?? '');
  const inchWords = [...text.matchAll(/(\d{2,3})\s*אינץ['׳"]?/g)].map((match) => match[1] ?? '');
  const lines = [...text.matchAll(/(?:גדלים|גודל\s*מסך|sizes?)[^\n]{0,120}/gi)].flatMap((match) =>
    [...(match[0] ?? '').matchAll(/\b(\d{2,3})\b/g)].map((item) => item[1] ?? ''),
  );
  return [...new Set([...marked, ...inchWords, ...lines])].filter((size) => {
    const value = Number(size);
    return value >= 32 && value <= 120;
  });
}

function sizeToken(value: string): string {
  const marked = value.match(/(\d{2,3})\s*(?:"|″|״|אינץ)/);
  if (marked?.[1]) return marked[1];
  const code = value.match(/[A-Za-z]{1,8}(\d{2,3})[A-Za-z]/);
  const size = code?.[1] ?? '';
  const number = Number(size);
  return number >= 32 && number <= 120 ? size : '';
}

function skuForSize(notes: string, size: string, fallback: string): string {
  const found = notes.match(new RegExp(`\\b[A-Za-z]{1,8}${size}[A-Za-z0-9-]{2,}\\b`));
  return found?.[0] ?? fallback;
}

function priceForSize(notes: string, size: string): string {
  const marked = notes.match(
    new RegExp(`(?:מחיר|₪)\\s*[:]?\\s*(\\d[\\d,.]*)(?:[^\\n]{0,24}${size}|)|${size}\\s*(?:"|″|״|אינץ)[^\\n]{0,40}(?:מחיר|₪)\\s*[:]?\\s*(\\d[\\d,.]*)`),
  );
  const amount = briefPrice(marked?.[1] || marked?.[2] || '', `${size}"`);
  return amount;
}

async function applyProposal(model: string, proposal: Proposal, catalog: Catalog): Promise<ProductIntake> {
  const created = { brand: null as string | null, category: null as string | null, subcategory: null as string | null, fields: [] as string[] };
  const slugs = new Set([...catalog.brands.map((brand) => brand.slug), ...catalog.categories.map((category) => category.slug)]);
  const brandId = await ensureBrand(proposal, catalog, slugs, created);
  const category = await ensureCategory(proposal, catalog, slugs, created);
  const subcategoryId = await ensureSubcategory(proposal, category, created);
  const fields: Field[] = [];
  const specs = await ensureSpecs(proposal, fields, created);
  const nameHe = clip(proposal.nameHe || model);
  return {
    draft: {
      nameHe,
      nameAr: clip(proposal.nameAr || nameHe),
      brandId,
      categoryId: category.id,
      subcategoryId,
      fields,
      specs: specs.values,
      specsAr: specs.arabic,
      price: proposal.price,
      color: proposal.color,
      variants: [
        {
          label: clip(proposal.color),
          sku: modelCode(model),
          price: proposal.price,
          subcategoryId,
          specs: specs.values,
          specsAr: specs.arabic,
        },
      ],
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
  return { id, slug: '', name: { he: nameHe, ar: nameAr }, image: '', displayOrder: null, subcategories: [], fields: [] };
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
  fields: Field[],
  created: ProductIntake['created'],
): Promise<{ values: Record<string, string>; arabic: Record<string, string> }> {
  const values: Record<string, string> = {};
  const arabic: Record<string, string> = {};
  for (const spec of proposal.specs) {
    const known = fields.find((field) => {
      if (same(field.label.he, spec.labelHe) || (spec.labelAr && same(field.label.ar, spec.labelAr))) return true;
      if (!spec.fieldId || field.id !== spec.fieldId) return false;
      if (headingWords(field.label.he) >= 3) return sharesWord(field.label.he, spec.value);
      return sharesWord(field.label.he, spec.labelHe);
    });
    if (known && hasArabic(spec.labelAr) && known.label.ar === known.label.he) {
      known.label = { he: known.label.he, ar: spec.labelAr };
    }
    const field = known ?? addField(spec, fields, created);
    if (!field) continue;
    let stored = spec.value.trim();
    if (field.type === 'boolean') stored = booleanValue(stored);
    if (field.type === 'number') stored = numberValue(stored);
    if (!stored) continue;
    const previous = values[field.id] ?? '';
    if (previous.length >= 80 && stored.length <= previous.length) continue;
    if (field.section === 'spec' && headingWords(field.label.he) >= 3 && stored.length < 80 && !sharesWord(field.label.he, `${spec.labelHe} ${stored}`)) continue;
    values[field.id] = stored;
    arabic[field.id] = field.type === 'boolean' || field.type === 'number' ? stored : spec.valueAr.trim();
    if (Object.keys(values).length >= 80) break;
  }
  return { values, arabic };
}

function addField(
  spec: Proposal['specs'][number],
  fields: Field[],
  created: ProductIntake['created'],
): Field | null {
  const nameHe = clip(spec.labelHe);
  if (!nameHe || fields.length >= 80) return null;
  const id = newId('field');
  const nameAr = clip(spec.labelAr || nameHe);
  const field: Field = {
    id,
    label: { he: nameHe, ar: nameAr },
    type: spec.type,
    section: spec.section,
  };
  fields.push(field);
  created.fields.push(nameHe);
  return field;
}

function numberValue(value: string): string {
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match?.[0] ?? '';
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

function supportedFact(value: string, source: string): boolean {
  const text = value.trim();
  if (!text) return false;
  const folded = fold(source);
  const words = contentWords(text);
  const numbers = [...text.matchAll(/\d{2,}/g)].map((match) => match[0] ?? '').filter(Boolean);
  if (numbers.some((number) => !numberWritten(number, source))) return false;
  if (words.length === 0) {
    if (numbers.length > 0) return true;
    return folded.includes(fold(text));
  }
  const needed = text.length >= 80 ? 0.7 : 0.5;
  const hits = words.filter((word) => folded.includes(word)).length;
  return hits / words.length >= needed;
}

function numberWritten(number: string, source: string): boolean {
  return new RegExp(`(?<!\\d)${number.split('').join('\\D?')}(?!\\d)`).test(source);
}

function contentWords(value: string): string[] {
  const skip = new Set(['של', 'את', 'עם', 'על', 'אל', 'או', 'גם', 'זה', 'לא', 'יש', 'כן', 'עבור', 'בין', 'כל', 'מה', 'אם', 'הוא', 'היא', 'הם', 'זו', 'יותר', 'מאוד', 'ניתן', 'כולל', 'וכן', 'אחד', 'אחת']);
  return fold(value)
    .split(' ')
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((word) => word.length >= 3 && !skip.has(word) && !/^\d+$/.test(word));
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
