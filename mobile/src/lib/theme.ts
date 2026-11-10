// Wartabiye TV colours and type, taken from the website (assets/site.css :root and [data-theme="dark"])
export const LIGHT = {
  dark: false,
  blue: '#037BDC', blueD: '#0263b3', red: '#F2060A', grey: '#BDBEC0',
  bar: '#0263b3', barFg: '#ffffff', bg: '#f4f7fb', surface: '#ffffff', fg: '#0b1c33', muted: '#4a5a70', line: '#dfe3ea', chip: '#eef3f9',
  link: '#037BDC', skeleton: '#e6ebf2', skeletonHi: '#f3f6fa', amber: '#8a5a00', amberBg: '#fff4dc',
};
export const DARK: typeof LIGHT = {
  dark: true,
  blue: '#3d9bff', blueD: '#0263b3', red: '#ff3b3e', grey: '#5d6b80',
  bar: '#04213f', barFg: '#ffffff', bg: '#0a1424', surface: '#111e33', fg: '#e7eef8', muted: '#a7b6cb', line: '#22324c', chip: '#1a2b46',
  link: '#6cb6ff', skeleton: '#1a2a42', skeletonHi: '#22344f', amber: '#ffd58a', amberBg: '#3a2a0b',
};
export type Colors = typeof LIGHT;
export const FONT = {
  display: 'Archivo_800ExtraBold',
  displayBold: 'Archivo_700Bold',
  body: 'PublicSans_400Regular',
  bodyMed: 'PublicSans_500Medium',
  bodyBold: 'PublicSans_700Bold',
};
