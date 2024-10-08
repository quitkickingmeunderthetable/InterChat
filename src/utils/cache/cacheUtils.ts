import cacheClient from '#main/utils/cache/cacheClient.js';
import { RedisKeys } from '#main/utils/Constants.js';
import { Prisma } from '@prisma/client';
import Logger from '../Logger.js';
import { Awaitable } from 'discord.js';

// TODO: make this into a class

export const cacheData = async (key: string, value: string, expirySecs?: number) => {
  try {
    if (expirySecs) {
      return await cacheClient.set(key, value, 'EX', expirySecs);
    }
    return await cacheClient.set(key, value, 'KEEPTTL');
  }
  catch (e) {
    Logger.error('Failed to set cache: ', e);
  }
};

export const parseKey = (key: string) => {
  const [id, model] = key.split(':');
  return { id, model } as { id: string; model: Prisma.ModelName };
};

export const invalidateCacheForModel = async (model: string) => {
  const allCacheKeys = await cacheClient.keys('*');
  allCacheKeys.forEach(async (key) => {
    if (parseKey(key).model === model) {
      await cacheClient.del(`${model}:${key}`);
    }
  });
};

export function serializeCache<K>(data: string | null): ConvertDatesToString<K> | null;
export function serializeCache<K>(
  data: string | (string | null)[] | null,
): ConvertDatesToString<K>[] | null;
export function serializeCache(data: string | (string | null)[] | null) {
  if (!data) return null;

  if (!Array.isArray(data)) {
    try {
      return JSON.parse(data);
    }
    catch {
      return data;
    }
  }
  else if (data.length > 0) {
    return data.map((v) => (v ? JSON.parse(v) : undefined)).filter(Boolean);
  }

  return null;
}

export const traverseCursor = async (
  result: [cursor: string, elements: string[]],
  match: string,
  start: number,
) => {
  const cursor = parseInt(result[0]);
  if (isNaN(cursor) || cursor === 0) return result;

  const newRes = await cacheClient.scan(start, 'MATCH', match, 'COUNT', cursor);

  result[0] = newRes[0];
  result[1].push(...newRes[1]);
  return result;
};

export const getAllDocuments = async (match: string) => {
  const firstIter = await cacheClient.scan(0, 'MATCH', match, 'COUNT', 100);
  const keys = (await traverseCursor(firstIter, match, 100))[1];
  const result = (await Promise.all(keys.map(async (key) => await cacheClient.get(key)))).filter(
    Boolean,
  ) as string[];
  return result;
};

export const getCachedData = async <T>(
  key: `${RedisKeys}:${string}`,
  fetchFunction: (() => Awaitable<T | null>) | null,
  expiry?: number,
): Promise<{ data: ConvertDatesToString<T> | null; fromCache: boolean }> => {
  // Check cache first
  let data = serializeCache<T>(await cacheClient.get(key));
  const fromCache = data !== null;

  // If not in cache, fetch from database
  if (!fromCache && fetchFunction) {
    data = (await fetchFunction()) as ConvertDatesToString<T>;

    // Store in cache with TTL
    if (data) await cacheData(key, JSON.stringify(data), expiry);
  }

  return { data, fromCache };
};
