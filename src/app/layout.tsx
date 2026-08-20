import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { RootThemeProvider } from 'src/components/base/root-theme-provider';
import { Toastr } from 'src/components/base/toastr';
import { CustomizationProvider } from 'src/contexts/customization';
import { SchoolSettingsProvider } from 'src/contexts/school-settings';
import { SidebarProvider } from 'src/contexts/sidebar-context';
import { Layout } from 'src/layouts';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'School App — Weekly Calendar & Tasks',
  description: 'Weekly calendar and to-do list creator managed by parents for school activities and assignments.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <CustomizationProvider>
          <SchoolSettingsProvider>
            <RootThemeProvider>
              <SidebarProvider>
                <Layout>{children}</Layout>
                <Toastr />
              </SidebarProvider>
            </RootThemeProvider>
          </SchoolSettingsProvider>
        </CustomizationProvider>
      </body>
    </html>
  );
}
