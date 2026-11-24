// Encrypted, local-only storage.
//
// Everything sensitive (GitHub token, repo cache, your tags/folders, background image)
// lives in this browser's IndexedDB, encrypted with AES-GCM-256. The key is a
// NON-EXTRACTABLE WebCrypto key: page scripts can use it to encrypt/decrypt but can
// never read its raw bytes, so it cannot be copied out and sent anywhere.
// Nothing is ever sent to a RepoVerse server — there isn't one.

const DB_NAME = 'repoverse'
const DB_VERSION = 1
let dbPromise
let keyPromise

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
        if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode)
        const s = t.objectStore(store)
        const req = fn(s)
        t.oncomplete = () => resolve(req && req.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      })
  )
}

function getKey() {
  if (!keyPromise) {
    keyPromise = (async () => {
      let key = await tx('keys', 'readonly', (s) => s.get('master'))
      if (!key) {
        key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
        await tx('keys', 'readwrite', (s) => s.put(key, 'master'))
      }
      return key
    })()
  }
  return keyPromise
}

export async function setSecure(name, value) {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = new TextEncoder().encode(JSON.stringify(value))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  await tx('kv', 'readwrite', (s) => s.put({ iv, ct }, name))
}

export async function getSecure(name, fallback = null) {
  try {
    const rec = await tx('kv', 'readonly', (s) => s.get(name))
    if (!rec) return fallback
    const key = await getKey()
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, key, rec.ct)
    return JSON.parse(new TextDecoder().decode(pt))
  } catch {
    return fallback
  }
}

export async function delSecure(name) {
  await tx('kv', 'readwrite', (s) => s.delete(name))
}

/** Wipe everything: data AND the encryption key. */
export async function wipeAll() {
  await tx('kv', 'readwrite', (s) => s.clear())
  await tx('keys', 'readwrite', (s) => s.clear())
  keyPromise = null
  localStorage.removeItem('rv-settings')
  sessionStorage.clear()
}
