// Font files embedded (as data URLs) into printed documents so printing looks identical on every PC.
// One import per bundled woff2 file in assets/fonts.

import f0 from '../assets/fonts/cairo-arabic-400-normal.woff2?inline'
import f1 from '../assets/fonts/cairo-latin-400-normal.woff2?inline'
import f2 from '../assets/fonts/cairo-arabic-700-normal.woff2?inline'
import f3 from '../assets/fonts/cairo-latin-700-normal.woff2?inline'
import f4 from '../assets/fonts/noto-naskh-arabic-arabic-400-normal.woff2?inline'
import f5 from '../assets/fonts/noto-naskh-arabic-latin-400-normal.woff2?inline'
import f6 from '../assets/fonts/noto-naskh-arabic-arabic-700-normal.woff2?inline'
import f7 from '../assets/fonts/noto-naskh-arabic-latin-700-normal.woff2?inline'
import f8 from '../assets/fonts/amiri-arabic-400-normal.woff2?inline'
import f9 from '../assets/fonts/amiri-latin-400-normal.woff2?inline'
import f10 from '../assets/fonts/amiri-arabic-700-normal.woff2?inline'
import f11 from '../assets/fonts/amiri-latin-700-normal.woff2?inline'
import f12 from '../assets/fonts/roboto-latin-400-normal.woff2?inline'
import f13 from '../assets/fonts/roboto-latin-400-italic.woff2?inline'
import f14 from '../assets/fonts/roboto-latin-700-normal.woff2?inline'
import f15 from '../assets/fonts/roboto-latin-700-italic.woff2?inline'

export interface EmbeddedFont { family: string; weight: number; style: string; range: string; url: string }

export const EMBEDDED_FONTS: EmbeddedFont[] = [
  { family: 'Cairo', weight: 400, style: 'normal', range: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EEFF', url: f0 },
  { family: 'Cairo', weight: 400, style: 'normal', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f1 },
  { family: 'Cairo', weight: 700, style: 'normal', range: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EEFF', url: f2 },
  { family: 'Cairo', weight: 700, style: 'normal', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f3 },
  { family: 'Noto Naskh Arabic', weight: 400, style: 'normal', range: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EEFF', url: f4 },
  { family: 'Noto Naskh Arabic', weight: 400, style: 'normal', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f5 },
  { family: 'Noto Naskh Arabic', weight: 700, style: 'normal', range: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EEFF', url: f6 },
  { family: 'Noto Naskh Arabic', weight: 700, style: 'normal', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f7 },
  { family: 'Amiri', weight: 400, style: 'normal', range: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EEFF', url: f8 },
  { family: 'Amiri', weight: 400, style: 'normal', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f9 },
  { family: 'Amiri', weight: 700, style: 'normal', range: 'U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC4, U+10EFC-10EFF, U+1EE00-1EEFF', url: f10 },
  { family: 'Amiri', weight: 700, style: 'normal', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f11 },
  { family: 'Roboto', weight: 400, style: 'normal', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f12 },
  { family: 'Roboto', weight: 400, style: 'italic', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f13 },
  { family: 'Roboto', weight: 700, style: 'normal', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f14 },
  { family: 'Roboto', weight: 700, style: 'italic', range: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD, U+211E', url: f15 }
]
