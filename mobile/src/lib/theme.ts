// Wartabiye TV colours and type, taken from the website (assets/site.css :root and [data-theme="dark"])
export const LIGHT = {
  dark: false,
  blue: '#037BDC', blueD: '#0263b3', red: '#F2060A', grey: '#BDBEC0',
  bar: '#0263b3', barFg: '#ffffff', bg: '#f4f7fb', surface: '#ffffff', fg: '#0b1c33', muted: '#0b1c33', soft: '#4a5a70', line: '#BDBEC0', chip: '#f4f7fb', foot: '#0263b3', footFg: '#ffffff',
  link: '#037BDC', skeleton: '#e6ebf2', skeletonHi: '#f3f6fa', amber: '#8a5a00', amberBg: '#fff4dc',
};
export const DARK: typeof LIGHT = {
  dark: true,
  blue: '#037BDC', blueD: '#0263b3', red: '#F2060A', grey: '#5d6b80',
  bar: '#04213f', barFg: '#ffffff', bg: '#0a1424', surface: '#111e33', fg: '#e7eef8', muted: '#a7b6cb', soft: '#a7b6cb', line: '#22324c', chip: '#1a2b46', foot: '#061a31', footFg: '#c9d8ea',
  link: '#6cb6ff', skeleton: '#1a2a42', skeletonHi: '#22344f', amber: '#ffd58a', amberBg: '#3a2a0b',
};
export type Colors = typeof LIGHT;
// Archivo at the website's condensed widths (site.css font-stretch 88-93 %), made from the official variable font (OFL)
export const FONT = {
  brand: 'ArchivoCond-900',
  display: 'ArchivoCond-800',
  displayBold: 'ArchivoCond-700',
  body: 'PublicSans_400Regular',
  bodyMed: 'PublicSans_500Medium',
  bodyBold: 'PublicSans_700Bold',
};
