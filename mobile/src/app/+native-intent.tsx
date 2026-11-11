// Links from outside the app (Android App Links, iPhone Universal Links, wartabiye://, notification taps):
// https://www.wartabiyetv.com/war/<id>.html opens the article screen, /caalamka/ the World section, /xiriir/ the
// Contact page, and so on, inside the app. Unknown website paths open the app's home screen.
import { systemPath } from '../lib/linkmap';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return systemPath(path);
}
