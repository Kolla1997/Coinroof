// The rename to Coinroof (#324): browser storage keys moved from `tallyn.*` to `coinroof.*`.
// Runs once at start-up, before anything reads them, so nobody loses their theme, household,
// terms-agreed or sign-in notes. A key already under the new name wins. Remove once old tabs are gone.
export function moveOldKeys(stores = [globalThis.localStorage, globalThis.sessionStorage]) {
  for (const store of stores) {
    try {
      const old = []
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i)
        if (k?.startsWith('tallyn.')) old.push(k)
      }
      for (const k of old) {
        const to = `coinroof.${k.slice('tallyn.'.length)}`
        if (store.getItem(to) === null) store.setItem(to, store.getItem(k))
        store.removeItem(k)
      }
    } catch {
      // storage blocked or full: nothing to move
    }
  }
}

moveOldKeys()
