import { test } from 'node:test';
import assert from 'node:assert/strict';
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
