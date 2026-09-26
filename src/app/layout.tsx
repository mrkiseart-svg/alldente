import './globals.css';
import MotionAtmosphere from '@/components/layout/MotionAtmosphere';
import type {ReactNode} from 'react';

export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="ru" suppressHydrationWarning><body><MotionAtmosphere/>{children}</body></html>;
}
