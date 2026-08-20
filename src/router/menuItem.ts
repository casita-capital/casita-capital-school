import type { ReactNode } from 'react';

export interface MenuItem {
  id?: string;
  link?: string;
  name: string;
  icon?: ReactNode;
  badge?: string;
  badgeTooltip?: string;
  sub?: MenuItem[];
}
