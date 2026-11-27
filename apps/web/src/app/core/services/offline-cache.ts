import { Injectable } from '@angular/core';

const CACHE_PREFIX = 'utfride:offline:';
const USER_SCOPE_PREFIX = `${CACHE_PREFIX}user:`;

@Injectable({ providedIn: 'root' })
export class OfflineCache {
  get<T>(key: string): T | null {
    if (!key) {
      return null;
    }
    return this.readKey<T>(`${CACHE_PREFIX}${key}`);
  }

  set<T>(key: string, value: T): void {
    if (!key) {
      return;
    }
    this.writeKey(`${CACHE_PREFIX}${key}`, value);
  }

  remove(key: string): void {
    if (!key) {
      return;
    }
    this.deleteKey(`${CACHE_PREFIX}${key}`);
  }

  getUserItem<T>(userId: string, key: string): T | null {
    if (!userId || !key) {
      return null;
    }
    return this.readKey<T>(this.userKey(userId, key));
  }

  setUserItem<T>(userId: string, key: string, value: T): void {
    if (!userId || !key) {
      return;
    }
    this.writeKey(this.userKey(userId, key), value);
  }

  removeUserItem(userId: string, key: string): void {
    if (!userId || !key) {
      return;
    }
    this.deleteKey(this.userKey(userId, key));
  }

  clearUser(userId: string): void {
    if (!userId) {
      return;
    }
    this.clearByPrefix(`${USER_SCOPE_PREFIX}${userId}:`);
  }

  clearAllUsers(): void {
    this.clearByPrefix(USER_SCOPE_PREFIX);
  }

  private userKey(userId: string, key: string): string {
    return `${USER_SCOPE_PREFIX}${userId}:${key}`;
  }

  private getStorage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  private readKey<T>(storageKey: string): T | null {
    const storage = this.getStorage();
    if (!storage) {
      return null;
    }
    try {
      const raw = storage.getItem(storageKey);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private writeKey<T>(storageKey: string, value: T): void {
    const storage = this.getStorage();
    if (!storage || value === undefined) {
      return;
    }
    try {
      storage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Ignora indisponibilidade ou estouro de cota do localStorage em modo offline.
    }
  }

  private deleteKey(storageKey: string): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    try {
      storage.removeItem(storageKey);
    } catch {
      // Ignora indisponibilidade do localStorage.
    }
  }

  private clearByPrefix(prefix: string): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        storage.removeItem(key);
      }
    } catch {
      // Ignora indisponibilidade do localStorage.
    }
  }
}
