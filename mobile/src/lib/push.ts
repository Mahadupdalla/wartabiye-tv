import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { EAS_PROJECT_ID } from './config';
import { load, save } from './storage';
import type { NotifPrefs } from './settings';
import type { Meta } from './types';

// Real push notifications through the existing Wartabiye TV push Worker (workers/push): the app registers its Expo push
// token and the categories the person chose; the publish workflow (tools/push_send.py) sends each new story ONCE, after
// the website is live, with the same limits as the website's bell (quiet hours, daily caps, no repeats).
// Delivery: Expo push service -> Firebase Cloud Messaging (Android) / Apple Push Notification service (iOS).

export type PushState = 'off-by-site' | 'unsupported' | 'denied' | 'needs-setup' | 'on' | 'off' | 'error';

export function categoriesOf(p: NotifPrefs): string[] {
  return (['breaking', 'eastAfrica', 'world', 'sports'] as const).filter(k => p[k]);
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

async function channels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('breaking', {
    name: 'Breaking news / Wararka degdegga ah', importance: Notifications.AndroidImportance.HIGH, lightColor: '#F2060A', vibrationPattern: [0, 250, 150, 250],
  });
  await Notifications.setNotificationChannelAsync('news', { name: 'News / Wararka', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#037BDC' });
}

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || 'HTTP ' + r.status);
  return j;
}

/** Ask permission (only when the person switches notifications on), get the token, tell the Worker the categories. */
export async function syncPush(meta: Meta | null, prefs: NotifPrefs, lang: string, wantOn: boolean, ask: boolean): Promise<PushState> {
  if (Platform.OS === 'web') return 'unsupported';
  const worker = meta?.push?.enabled && meta.push.workerUrl ? meta.push.workerUrl.replace(/\/+$/, '') : '';
  const prevToken = await load<string | null>('pushToken', null);
  if (!wantOn) {
    if (prevToken && worker) await post(worker + '/v1/app/unregister', { token: prevToken }).catch(() => undefined);
    await save('pushToken', null);
    return 'off';
  }
  if (!worker) return 'off-by-site';
  if (!Device.isDevice) return 'unsupported';
  if (!EAS_PROJECT_ID) return 'needs-setup';
  await channels();
  let perm = await Notifications.getPermissionsAsync();
  if (perm.status !== 'granted' && ask && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
  if (perm.status !== 'granted') return 'denied';
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID })).data;
    await post(worker + '/v1/app/register', { token, categories: categoriesOf(prefs), lang, platform: Platform.OS });
    await save('pushToken', token);
    return 'on';
  } catch (e) {
    return 'error';
  }
}
