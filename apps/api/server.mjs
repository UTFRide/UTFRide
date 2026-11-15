import { createServer as createHttpServer } from 'node:http';
import { createApp } from 'json-server/lib/app.js';

export function createServer(db) {
  const app = createApp(db);
  return createHttpServer(async (req, res) => {
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
