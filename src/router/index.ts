import type { MenuItem } from './menuItem';
import { LayoutDashboard, Calendar, CheckSquare, Settings, Printer, Sparkles, BookOpen, FileText } from 'lucide-react';
import { createElement } from 'react';

export const getSchoolMenuItems = (): MenuItem[] => [
  {
    id: 'dashboard',
    name: 'Dashboard',
    link: '/',
    icon: createElement(LayoutDashboard, { size: 18 }),
  },
  {
    id: 'planner',
    name: 'Weekly Binder Planner',
    link: '/calendar/planner',
    icon: createElement(Printer, { size: 18 }),
  },
  {
    id: 'calendar',
    name: 'Master Calendar',
    link: '/calendar',
    icon: createElement(Calendar, { size: 18 }),
  },
  {
    id: 'assignments',
    name: 'School Assignments',
    link: '/assignments',
    icon: createElement(FileText, { size: 18 }),
  },
  {
    id: 'tasks',
    name: 'To-Do List & Tasks',
    link: '/tasks',
    icon: createElement(CheckSquare, { size: 18 }),
  },
  {
    id: 'holidays',
    name: 'Holidays Manager',
    link: '/holidays',
    icon: createElement(Sparkles, { size: 18 }),
  },
  {
    id: 'subjects-habits',
    name: 'Subjects & Habits',
    link: '/subjects-habits',
    icon: createElement(BookOpen, { size: 18 }),
  },
  {
    id: 'settings',
    name: 'Settings & Theme',
    link: '/settings',
    icon: createElement(Settings, { size: 18 }),
  },
];
