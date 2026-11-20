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

test('projeta pelo HTTP apenas as próprias viagens e libera contato somente nas confirmadas', async (t) => {
  const driver = {
    id: '008',
    name: 'Camila Rocha',
    ratingAverage: 4.9,
    whatsapp: '41987651122',
    email: 'motorista@example.test',
    password: 'senha-sintetica',
    registrationNumber: '123',
  };
  const rideDetails = {
    origin: 'Praça do Japão',
    destination: 'UTFPR - Sede Centro',
    departureTime: '2030-05-10T11:15:00.000Z',
    pricePerSeat: 7.5,
  };
  const rides = ['active', 'full', 'completed', 'cancelled'].map((status) => ({
    ...rideDetails, id: status, status, driverId: driver.id, notes: 'fora do resumo',
  }));
  rides.push({ ...rides[0], id: 'missing-driver', driverId: '8' });
  const request = (id, status, rideId, passengerId = '007') => ({
    id, rideId, passengerId, status, createdAt: '2030-05-09T20:00:00.000Z',
  });
  const ride_requests = [
    request('pending', 'pending', 'active'),
    request('confirmed-active', 'accepted', 'active'),
    request('confirmed-full', 'accepted', 'full'),
    request('ended-completed', 'accepted', 'completed'),
    request('ended-cancelled', 'accepted', 'cancelled'),
    request('declined', 'rejected', 'active'),
    request('withdrawn', 'cancelled', 'active'),
    request('without-ride', 'accepted', 'missing-ride'),
    request('without-driver', 'accepted', 'missing-driver'),
    request('other-passenger', 'pending', 'active', '7'),
  ];
  const server = createServer(new Low(new Memory(), { users: [driver], rides, ride_requests }))
    .listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const summaries = `${base}/passenger-trip-summaries`;
  const driverSummary = { name: driver.name, ratingAverage: driver.ratingAverage };
  const summary = (id, status, rideStatus, overrides = {}) => ({
    id, status, ride: { ...rideDetails, status: rideStatus }, driver: driverSummary, ...overrides,
  });

  const response = await fetch(`${summaries}?passengerId=007`, {
    headers: { Origin: 'http://localhost:4200' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const trips = await response.json();
  assert.deepEqual(trips, [
    summary('pending', 'pending', 'active'),
    summary('confirmed-active', 'accepted', 'active', { whatsapp: driver.whatsapp }),
    summary('confirmed-full', 'accepted', 'full', { whatsapp: driver.whatsapp }),
    summary('ended-completed', 'accepted', 'completed'),
    summary('ended-cancelled', 'accepted', 'cancelled'),
    summary('declined', 'rejected', 'active'),
    summary('withdrawn', 'cancelled', 'active'),
    summary('without-ride', 'accepted', '', { ride: null, driver: null }),
    summary('without-driver', 'accepted', 'active', { driver: null }),
  ]);

  const otherTrips = async () => (await fetch(`${summaries}?passengerId=7`)).json();
  const other = [summary('other-passenger', 'pending', 'active')];
  assert.deepEqual(await otherTrips(), other);
  for (const query of ['', '?passengerId=missing', '?passengerId=007&passengerId=7']) {
    assert.deepEqual(await (await fetch(summaries + query)).json(), []);
  }

  const patch = await fetch(`${base}/ride_requests/pending?passengerId=007`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  });
  assert.equal(patch.status, 200);
  assert.equal((await patch.json()).status, 'cancelled');
  assert.deepEqual(
    (await (await fetch(`${summaries}?passengerId=007`)).json())[0],
    summary('pending', 'cancelled', 'active'),
  );
  assert.deepEqual(await otherTrips(), other);
});

function createControlledAdapter() {
  let persisted;
  let nextWrite;
  return {
    read: async () => structuredClone(persisted),
    async write(data) {
      const snapshot = structuredClone(data);
      if (nextWrite) {
        const { start, complete } = nextWrite;
        nextWrite = undefined;
        start();
        await complete;
      }
      persisted = snapshot;
    },
    pauseNextWrite() {
      const { promise: started, resolve: start } = Promise.withResolvers();
      const { promise: complete, resolve: succeed, reject } = Promise.withResolvers();
      nextWrite = { start, complete };
      return { started, succeed, fail: () => reject(new Error('Temporary write failure')) };
    },
  };
}

async function startRequestTransitionsServer(t, adapter = new Memory()) {
  const pending = { id: '007', passengerId: '009', rideId: '008', status: 'pending' };
  const other = { ...pending, id: '7', passengerId: '9' };
  const offer = { id: pending.rideId, availableSeats: 1, status: 'active' };
  const initial = {
    rides: [offer],
    ride_requests: [pending, other],
  };
  const db = new Low(adapter, initial);
  await db.write();
  await db.read();
  const server = createServer(db).listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (path) => {
    const response = await fetch(`${base}/${path}`);
    assert.equal(response.status, 200);
    return response.json();
  };
  const patch = (path, body) => fetch(`${base}/${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4200' },
    body: JSON.stringify(body),
  });
  return { base, server, get, patch, initial, pending, other, offer };
}

test('recusa cancelamento depois de confirmação concorrente e preserva a vaga ocupada', async (t) => {
  const { get, patch, pending, other, offer } = await startRequestTransitionsServer(t);
  const requestPath = `ride_requests/${pending.id}`;
  const offerPath = `rides/${offer.id}`;
  assert.deepEqual(await get(requestPath), pending);

  const confirmed = { ...pending, status: 'accepted' };
  const decision = await patch(requestPath, { status: 'accepted' });
  assert.equal(decision.status, 200);
  assert.deepEqual(await decision.json(), confirmed);
  const fullOffer = { ...offer, availableSeats: 0, status: 'full' };
  const seat = await patch(offerPath, { availableSeats: 0, status: 'full' });
  assert.equal(seat.status, 200);

  const cancellation = await patch(`${requestPath}?passengerId=009`, { status: 'cancelled' });
  assert.equal(cancellation.status, 409);
  assert.equal(cancellation.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await get('ride_requests'), [confirmed, other]);
  assert.deepEqual(await get(offerPath), fullOffer);
});

test('filtra o titular textual e impede decisões atrasadas após o cancelamento', async (t) => {
  const { base, get, patch, pending, other, offer } = await startRequestTransitionsServer(t);
  const requestPath = `ride_requests/${pending.id}`;
  const passengerPath = `${requestPath}?passengerId=${pending.passengerId}`;
  const preflight = await fetch(`${base}/${passengerPath}`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:4200',
      'Access-Control-Request-Method': 'PATCH',
      'Access-Control-Request-Headers': 'content-type',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  assert.match(preflight.headers.get('access-control-allow-methods'), /\bPATCH\b/);
  assert.match(preflight.headers.get('access-control-allow-headers'), /\bcontent-type\b/i);

  assert.deepEqual(await get(requestPath), pending);
  const wrongOwner = await patch(`${requestPath}?passengerId=9`, { status: 'cancelled' });
  assert.equal(wrongOwner.status, 403);
  const ambiguousOwner = await patch(`${passengerPath}&passengerId=9`, { status: 'cancelled' });
  assert.equal(ambiguousOwner.status, 400);
  assert.deepEqual(await get('ride_requests'), [pending, other]);

  const cancelled = { ...pending, status: 'cancelled' };
  const cancellation = await patch(passengerPath, { status: 'cancelled' });
  assert.equal(cancellation.status, 200);
  assert.deepEqual(await cancellation.json(), cancelled);
  for (const status of ['accepted', 'rejected']) {
    const staleDecision = await patch(requestPath, { status });
    assert.equal(staleDecision.status, 409);
  }
  assert.deepEqual(await get('ride_requests'), [cancelled, other]);
  assert.deepEqual(await get(`rides/${offer.id}`), offer);
});

test('mantém o pedido pendente após falha de gravação e permite tentar o cancelamento de novo', async (t) => {
  const adapter = createControlledAdapter();
  const { get, patch, initial, pending, other } = await startRequestTransitionsServer(t, adapter);
  const requestPath = `ride_requests/${pending.id}`;
  const passengerPath = `${requestPath}?passengerId=${pending.passengerId}`;
  const { started, fail } = adapter.pauseNextWrite();
  const cancellation = patch(passengerPath, { status: 'cancelled' });
  await started;
  fail();

  const failed = await cancellation;
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { error: 'Could not save request' });
  assert.deepEqual(await adapter.read(), initial);
  assert.deepEqual(await get(requestPath), pending);

  const cancelled = { ...pending, status: 'cancelled' };
  const retry = await patch(passengerPath, { status: 'cancelled' });
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), cancelled);
  assert.deepEqual(await get('ride_requests'), [cancelled, other]);
  assert.deepEqual(await adapter.read(), { ...initial, ride_requests: [cancelled, other] });
});

test('isola o cancelamento não gravado de leituras e de uma gravação concorrente de outra coleção', async (t) => {
  const adapter = createControlledAdapter();
  const { server, get, patch, initial, pending, offer } = await startRequestTransitionsServer(t, adapter);
  const requestPath = `ride_requests/${pending.id}`;
  const offerPath = `rides/${offer.id}`;
  const { started, fail } = adapter.pauseNextWrite();
  const cancellation = patch(`${requestPath}?passengerId=${pending.passengerId}`, { status: 'cancelled' });
  await started;

  const arrived = once(server, 'request');
  const offerUpdate = patch(offerPath, { availableSeats: 0, status: 'full' });
  let visibleRequests;
  try {
    await arrived;
    visibleRequests = await get('ride_requests');
  } finally {
    fail();
  }
  const [failed, saved] = await Promise.all([cancellation, offerUpdate]);
  assert.equal(failed.status, 500);
  await failed.json();
  assert.equal(saved.status, 200);
  const fullOffer = { ...offer, availableSeats: 0, status: 'full' };
  assert.deepEqual(await saved.json(), fullOffer);
  assert.deepEqual(await adapter.read(), { ...initial, rides: [fullOffer] });
  assert.deepEqual(visibleRequests, initial.ride_requests);
  assert.deepEqual(await get('ride_requests'), initial.ride_requests);
  assert.deepEqual(await get(offerPath), fullOffer);
});

test('decide a corrida entre cancelamento e motorista depois da primeira gravação', async (t) => {
  for (const decision of ['accepted', 'rejected']) {
    for (const firstStatus of ['cancelled', decision]) {
      const secondStatus = firstStatus === 'cancelled' ? decision : 'cancelled';
      await t.test(`${firstStatus} é gravado antes de ${secondStatus}`, async (t) => {
        const adapter = createControlledAdapter();
        const { server, get, patch, initial, pending, other } = await startRequestTransitionsServer(t, adapter);
        const requestPath = `ride_requests/${pending.id}`;
        const passengerPath = `${requestPath}?passengerId=${pending.passengerId}`;
        const update = (status) => patch(status === 'cancelled' ? passengerPath : requestPath, { status });
        const { started, succeed } = adapter.pauseNextWrite();
        const first = update(firstStatus);
        await started;

        const arrived = once(server, 'request');
        const second = update(secondStatus);
        let visible;
        try {
          await arrived;
          visible = await get(requestPath);
        } finally {
          succeed();
        }
        const [saved, conflict] = await Promise.all([first, second]);
        const updated = { ...pending, status: firstStatus };
        assert.equal(saved.status, 200);
        assert.deepEqual(await saved.json(), updated);
        assert.equal(conflict.status, 409);
        await conflict.json();
        assert.deepEqual(visible, pending);
        assert.deepEqual(await get('ride_requests'), [updated, other]);
        assert.deepEqual(await adapter.read(), { ...initial, ride_requests: [updated, other] });
      });
    }
  }
});
