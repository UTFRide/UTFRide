import { createServer as createHttpServer } from 'node:http';
import { createApp } from 'json-server/lib/app.js';

export function createServer(db) {
  const app = createApp(db);
  return createHttpServer(async (req, res) => {
    const [pathname] = req.url.split('?', 1);
    if (pathname === '/driver-summaries' && req.method === 'GET') {
      const { searchParams } = new URL(req.url, 'http://localhost');
      const ids = new Set(searchParams.getAll('id'));
      const drivers = db.data.users
        .filter(({ id }) => ids.has(id))
        .map(({ id, name, ratingAverage }) => ({ id, name, ratingAverage }));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(drivers));
      return;
    }

    if (req.url !== '/registration-exists' || req.method !== 'POST') {
      app.attach(req, res);
      return;
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { email, registrationNumber } = JSON.parse(body);
      if (typeof email !== 'string' || typeof registrationNumber !== 'string') throw new Error('Invalid request');
      const exists = db.data.users.some((user) => user.email.toLowerCase() === email.toLowerCase() || user.registrationNumber === registrationNumber);
      res.end(JSON.stringify({ exists }));
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
  });
}
