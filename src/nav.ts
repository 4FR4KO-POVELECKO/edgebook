import {
  Analytics01Icon, Calendar03Icon, DashboardSquare01Icon, LeftToRightListBulletIcon, Settings02Icon, Target02Icon,
} from '@hugeicons/core-free-icons'

/** App sections, shared by the sidebar, the mobile tab bar and the command palette. */
export const NAV = [
  { to: '/', icon: DashboardSquare01Icon, key: 'dashboard' },
  { to: '/trades', icon: LeftToRightListBulletIcon, key: 'trades' },
  { to: '/calendar', icon: Calendar03Icon, key: 'calendar' },
  { to: '/analytics', icon: Analytics01Icon, key: 'analytics' },
  { to: '/strategies', icon: Target02Icon, key: 'strategies' },
  { to: '/settings', icon: Settings02Icon, key: 'settings' },
] as const
