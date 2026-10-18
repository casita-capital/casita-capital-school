import type { Metadata } from 'next';
import {
  DM_Sans,
  Inter,
  Newsreader,
  Nunito,
  Outfit,
  Plus_Jakarta_Sans,
} from 'next/font/google';
import type { ReactNode } from 'react';
import { AppUpdateBanner } from 'src/components/base/app-update-banner';
import { RootThemeProvider } from 'src/components/base/root-theme-provider';
import { Toastr } from 'src/components/base/toastr';
import { CustomizationProvider } from 'src/contexts/customization';
import { SchoolSettingsProvider } from 'src/contexts/school-settings';
import { SidebarProvider } from 'src/contexts/sidebar-context';
import { Layout } from 'src/layouts';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-jakarta',
});
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-outfit',
});
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-dmsans',
});
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-nunito',
});
const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

export const metadata: Metadata = {
  title: 'School App — Weekly Calendar & Tasks',
  description: 'Weekly calendar and to-do list creator managed by parents for school activities and assignments.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontVars = [
    inter.className,
    inter.variable,
    plusJakarta.variable,
    outfit.variable,
    dmSans.variable,
    nunito.variable,
    newsreader.variable,
  ].join(' ');

  return (
    <html lang="en" className={fontVars}>
      <body>
        <CustomizationProvider>
          <SchoolSettingsProvider>
            <RootThemeProvider>
              <SidebarProvider>
                <Layout>{children}</Layout>
                <Toastr />
                <AppUpdateBanner />
              </SidebarProvider>
            </RootThemeProvider>
          </SchoolSettingsProvider>
        </CustomizationProvider>
      </body>
    </html>
  );
}
