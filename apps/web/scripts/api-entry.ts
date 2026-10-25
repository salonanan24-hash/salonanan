import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../../api/src/app.js';

const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? '/';
  if (!url.startsWith('/api')) {
    const queryIndex = url.indexOf('?');
    const path = queryIndex === -1 ? url : url.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : url.slice(queryIndex);
    const suffix = path.startsWith('/') ? path : `/${path}`;
    req.url = `/api${suffix === '/' ? '' : suffix}${query}`;
  }
  app(req, res);
}
