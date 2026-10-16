import type { MenuItem } from './menuItem';
import { LayoutDashboard, Calendar, CheckSquare, Settings, Printer, Sparkles, BookOpen, FileText, Clock, Repeat } from 'lucide-react';
import { createElement } from 'react';

export const getSchoolMenuItems = (): MenuItem[] => [
  {
    id: 'dashboard',
    name: 'Dashboard',
    link: '/',
    section: 'daily',
    icon: createElement(LayoutDashboard, { size: 18 }),
  },
  {
    id: 'planner',
    name: 'Weekly Binder Planner',
    link: '/calendar/planner',
    section: 'daily',
    icon: createElement(Printer, { size: 18 }),
  },
  {
    id: 'calendar',
    name: 'Master Calendar',
    link: '/calendar',
    section: 'daily',
    icon: createElement(Calendar, { size: 18 }),
  },
  {
    id: 'assignments',
    name: 'Assignments',
    link: '/assignments',
    section: 'daily',
    icon: createElement(FileText, { size: 18 }),
  },
  {
    id: 'tasks',
    name: 'To-Do Tasks',
    link: '/tasks',
    section: 'daily',
    icon: createElement(CheckSquare, { size: 18 }),
  },
  {
    id: 'subjects-habits',
    name: 'Subjects & Habits',
    link: '/subjects-habits',
    section: 'setup',
    icon: createElement(BookOpen, { size: 18 }),
  },
  {
    id: 'automations',
    name: 'Automations & Syllabi',
    link: '/automations',
    section: 'setup',
    icon: createElement(Repeat, { size: 18 }),
  },
  {
    id: 'schedule',
    name: 'Weekly Time Grid',
    link: '/schedule',
    section: 'setup',
    icon: createElement(Clock, { size: 18 }),
  },
  {
    id: 'holidays',
    name: 'Holidays',
    link: '/holidays',
    section: 'setup',
    icon: createElement(Sparkles, { size: 18 }),
  },
  {
    id: 'settings',
    name: 'Settings & Theme',
    link: '/settings',
    section: 'setup',
    icon: createElement(Settings, { size: 18 }),
  },
];


