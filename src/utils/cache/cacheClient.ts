// FIXME: Redis being instantiated like this causes it to never disconnect

import { Redis } from 'ioredis';

// when run usin scripts like registerCmds
const cacheClient = new Redis(process.env.REDIS_URI as string);

export default cacheClient;
