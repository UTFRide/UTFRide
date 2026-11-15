import { JSONFilePreset } from 'lowdb/node';
import { createServer } from './server.mjs';

const db = await JSONFilePreset('apps/api/db.json', { users: [] });
createServer(db).listen(3000, () => console.log('API disponível em http://localhost:3000'));
