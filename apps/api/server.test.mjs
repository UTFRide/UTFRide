import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Readable } from 'node:stream';
import { Low, Memory } from 'lowdb';
import { createServer } from './server.mjs';

test('retorna somente existência por e-mail sem distinguir maiúsculas ou por matrícula', async () => {
  const db = new Low(new Memory(), { users: [{ email: 'Ana@alunos.utfpr.edu.br', registrationNumber: '123', password: 'segredo' }] });
  const handle = createServer(db).listeners('request')[0];
  for (const [email, registrationNumber, exists] of [['ana@alunos.utfpr.edu.br', '456', true], ['outra@alunos.utfpr.edu.br', '123', true], ['outra@alunos.utfpr.edu.br', '456', false]]) {
    const req = Readable.from([JSON.stringify({ email, registrationNumber })]);
    req.url = '/registration-exists';
    req.method = 'POST';
    const res = { statusCode: 200, setHeader() {}, end(body) { this.body = body; } };
    await handle(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { exists });
  }
});

test('retorna pelo HTTP somente os dados públicos dos motoristas solicitados', async (t) => {
  const users = ['007', 'driver-2', 'driver-3'].map((id) => ({
    id,
    name: `Motorista ${id}`,
    ratingAverage: 4.9,
    email: `${id}@example.test`,
    password: 'senha-sintetica',
    whatsapp: '41900000000',
    registrationNumber: '123',
    isEmailConfirmed: true,
  }));
  const server = createServer(new Low(new Memory(), { users })).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  const response = await fetch(`${base}/driver-summaries?id=007&id=driver-3&id=007&id=missing`, {
    headers: { Origin: 'http://localhost:4200' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await response.json(), [
    { id: '007', name: 'Motorista 007', ratingAverage: 4.9 },
    { id: 'driver-3', name: 'Motorista driver-3', ratingAverage: 4.9 },
  ]);

  const noIds = await fetch(`${base}/driver-summaries`);
  assert.equal(noIds.status, 200);
  assert.deepEqual(await noIds.json(), []);

  const auth = await fetch(`${base}/users?email=007%40example.test`);
  assert.equal(auth.status, 200);
  assert.deepEqual(await auth.json(), [users[0]]);
});
