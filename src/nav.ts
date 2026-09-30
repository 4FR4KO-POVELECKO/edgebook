import {
  Analytics01Icon, Calculator01Icon, Calendar03Icon, DashboardSquare01Icon, LeftToRightListBulletIcon, Settings02Icon, Target02Icon,
} from '@hugeicons/core-free-icons'

/** App sections, shared by the sidebar, the mobile tab bar and the command palette.
 * `group` places the item in the sidebar; settings live in the sidebar footer instead.
 * The mobile tab bar skips tools, which are reached from the top bar. */
export const NAV = [
  { to: '/', icon: DashboardSquare01Icon, key: 'dashboard', group: 'journal' },
  { to: '/trades', icon: LeftToRightListBulletIcon, key: 'trades', group: 'journal' },
  { to: '/calendar', icon: Calendar03Icon, key: 'calendar', group: 'journal' },
  { to: '/analytics', icon: Analytics01Icon, key: 'analytics', group: 'insights' },
  { to: '/strategies', icon: Target02Icon, key: 'strategies', group: 'insights' },
  { to: '/calculator', icon: Calculator01Icon, key: 'calculator', group: 'tools' },
  { to: '/settings', icon: Settings02Icon, key: 'settings', group: 'footer' },
] as const

export const NAV_GROUPS = ['journal', 'insights', 'tools'] as const
