import { createServer as createHttpServer } from 'node:http';
import { finished } from 'node:stream/promises';
import { createApp } from 'json-server/lib/app.js';
import { isItem, Service } from 'json-server/lib/service.js';

const MAX_REQUEST_BODY_BYTES = 100 * 1024;
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function createMutationRunner(db) {
  let pending = Promise.resolve();

  // Cada gravação substitui o JSON inteiro. As rotas de escrita compartilham a fila.
  return (res, mutate) => {
    const result = pending.then(async () => {
      if (res.destroyed) return;
      const data = structuredClone(db.data);
      let saving;
      const draft = {
        data,
        write() {
          if (res.destroyed || res.writableEnded) return;
          saving = (async () => {
            await db.adapter.write(data);
            db.data = data;
          })();
          return saving;
        },
      };

      try {
        await mutate(draft);
      } finally {
        // Uma desconexão pode encerrar a resposta antes de a gravação terminar.
        await saving?.catch(() => {});
      }
    });
    pending = result.catch(() => {});
    return result;
  };
}

function sendRequestMutation(res, status, body) {
  res.statusCode = status;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readRequestMutationBody(req, res) {
  try {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req.iterator({ destroyOnReturn: false })) {
      bytes += chunk.length;
      if (bytes > MAX_REQUEST_BODY_BYTES) {
        req.resume();
        return sendRequestMutation(res, 413, { error: 'Payload too large' });
      }
      chunks.push(chunk);
    }
    const body = bytes === 0 ? {} : JSON.parse(Buffer.concat(chunks, bytes).toString());
    if (isItem(body)) return body;
    return sendRequestMutation(res, 400, { error: 'Body must be a JSON object' });
  } catch {
    return sendRequestMutation(res, 400, { error: 'Invalid request' });
  }
}

function isActiveRequest(status) {
  return status === 'pending' || status === 'accepted';
}

function isRideRequestCollection(pathname) {
  const collection = /^\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (!collection) return false;
  try {
    return decodeURIComponent(collection) === 'ride_requests';
  } catch {
    return false;
  }
}

async function postRideRequest(runMutation, req, res) {
  const body = await readRequestMutationBody(req, res);
  if (!body) return;

  return runMutation(res, async (draft) => {
    const requests = draft.data.ride_requests;
    if (!Array.isArray(requests)) return sendRequestMutation(res, 404, { error: 'Not Found' });

    const { rideId, passengerId, status } = body;
    if (
      typeof rideId === 'string' &&
      typeof passengerId === 'string' &&
      isActiveRequest(status) &&
      requests.some((request) =>
        request?.rideId === rideId &&
        request.passengerId === passengerId &&
        isActiveRequest(request.status),
      )
    ) {
      return sendRequestMutation(res, 409, {
        code: 'active-ride-request',
        error: 'An active request already exists',
      });
    }

    try {
      const request = await new Service(draft).create('ride_requests', body);
      return sendRequestMutation(res, 201, request);
    } catch {
      return sendRequestMutation(res, 500, { error: 'Could not save request' });
    }
  });
}

async function patchRideRequest(runMutation, encodedId, req, res) {
  let id;
  try {
    id = decodeURIComponent(encodedId);
  } catch {
    return sendRequestMutation(res, 400, { error: 'Invalid request' });
  }
  const body = await readRequestMutationBody(req, res);
  if (!body) return;

  // O ID da sessão simulada é um filtro textual do MVP, sem autenticação no servidor.
  const passengerIds = new URL(req.url, 'http://localhost').searchParams.getAll('passengerId');
  const [passengerId] = passengerIds;
  const passengerCancellation = passengerIds.length > 0;
  if (
    passengerCancellation &&
    (passengerIds.length !== 1 ||
      !passengerId ||
      body.status !== 'cancelled' ||
      Object.keys(body).length !== 1)
  ) {
    return sendRequestMutation(res, 400, { error: 'Invalid passenger cancellation' });
  }

  return runMutation(res, async (draft) => {
    const service = new Service(draft);
    const request = service.findById('ride_requests', id, {});
    if (!request) return sendRequestMutation(res, 404, { error: 'Not Found' });
    if (passengerCancellation && request.passengerId !== passengerId) {
      return sendRequestMutation(res, 403, { error: 'Request belongs to another passenger' });
    }
    const driverDecision = body.status === 'accepted' || body.status === 'rejected';
    if ((passengerCancellation || driverDecision) && request.status !== 'pending') {
      return sendRequestMutation(res, 409, { error: 'Request is no longer pending' });
    }

    try {
      const updated = await service.patchById('ride_requests', id, body);
      return sendRequestMutation(res, 200, updated);
    } catch {
      return sendRequestMutation(res, 500, { error: 'Could not save request' });
    }
  });
}

function getPassengerTripSummaries(db, passengerId) {
  const { users = [], rides = [], ride_requests = [] } = db.data;
  const ridesById = new Map(rides.map((ride) => [ride.id, ride]));
  const driversById = new Map(users.map((user) => [user.id, user]));

  return ride_requests
    .filter((request) => request.passengerId === passengerId)
    .map(({ id, status, rideId }) => {
      const ride = typeof rideId === 'string' ? ridesById.get(rideId) : undefined;
      const driverId = ride?.driverId;
      const driver = typeof driverId === 'string' ? driversById.get(driverId) : undefined;
      const summary = {
        id,
        status,
        ride: ride
          ? {
              origin: ride.origin,
              destination: ride.destination,
              departureTime: ride.departureTime,
              pricePerSeat: ride.pricePerSeat,
              status: ride.status,
            }
          : null,
        driver: driver ? { name: driver.name, ratingAverage: driver.ratingAverage } : null,
      };
      const isConfirmed =
        status === 'accepted' && (ride?.status === 'active' || ride?.status === 'full');
      if (!isConfirmed) return summary;

      const whatsapp = typeof driver?.whatsapp === 'string' ? driver.whatsapp.trim() : '';
      return whatsapp ? { ...summary, whatsapp } : summary;
    });
}

export function createServer(db) {
  const app = createApp(db);
  const runMutation = createMutationRunner(db);
  return createHttpServer(async (req, res) => {
    const [pathname] = req.url.split('?', 1);
    if (req.method === 'POST' && isRideRequestCollection(pathname)) {
      return postRideRequest(runMutation, req, res);
    }
    if (req.method === 'PATCH') {
      const rideRequest = /^\/ride_requests\/([^/]+)\/?$/.exec(pathname);
      if (rideRequest) return patchRideRequest(runMutation, rideRequest[1], req, res);
    }

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

    if (pathname === '/passenger-trip-summaries' && req.method === 'GET') {
      const { searchParams } = new URL(req.url, 'http://localhost');
      // O identificador vem da sessão simulada no Angular e serve como filtro no MVP.
      const passengerIds = searchParams.getAll('passengerId');
      const [passengerId] = passengerIds;
      const summaries =
        passengerIds.length === 1 && passengerId ? getPassengerTripSummaries(db, passengerId) : [];
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(summaries));
      return;
    }

    if (req.url !== '/registration-exists' || req.method !== 'POST') {
      if (MUTATION_METHODS.has(req.method)) {
        return runMutation(res, (draft) => {
          const response = finished(res, { cleanup: true }).catch(() => {});
          createApp(draft).attach(req, res);
          return response;
        });
      }
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
