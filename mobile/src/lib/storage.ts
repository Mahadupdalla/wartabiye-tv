import AsyncStorage from '@react-native-async-storage/async-storage';

// Everything the app keeps on the phone: settings, the last feeds and meta (for offline reading), saved articles and
// their offline copies. Nothing leaves the phone except the anonymous statistics and the push token (Settings).
export async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem('wtv:' + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch (e) {
    return fallback;
  }
}
export async function save(key: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem('wtv:' + key, JSON.stringify(value)); } catch (e) { /* storage full or blocked: the app still works online */ }
}
export async function remove(key: string): Promise<void> {
  try { await AsyncStorage.removeItem('wtv:' + key); } catch (e) { /* ignore */ }
}
export async function keys(prefix: string): Promise<string[]> {
  try { return (await AsyncStorage.getAllKeys()).filter(k => k.startsWith('wtv:' + prefix)).map(k => k.slice(4)); } catch (e) { return []; }
}
