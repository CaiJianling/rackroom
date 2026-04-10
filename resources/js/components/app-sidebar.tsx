/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-25 03:55:13
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 20:47:33
 * @FilePath: /rackroom/resources/js/components/app-sidebar.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Link } from '@inertiajs/react';
import {
    BookOpen,
    Folder,
    LayoutGrid,
    Users,
    Building2,
    Server,
    Cpu,
    Activity,
    Settings,
    Eye,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';
import AppLogo from './app-logo';

export function AppSidebar() {
    const { t } = useTranslation();

    const mainNavItems: NavItem[] = [
        {
            title: t('navigation.dashboard'),
            href: dashboard(),
            icon: LayoutGrid,
        },
        {
            title: t('navigation.roomManagement'),
            href: '/rooms',
            icon: Building2,
        },
        {
            title: t('navigation.rackVisualEdit'),
            href: '/racks/visual-edit',
            icon: Eye,
        },
        {
            title: t('navigation.rackManagement'),
            icon: Server,
            items: [
                {
                    title: t('navigation.rackTypeManagement'),
                    href: '/rack-types',
                },
                {
                    title: t('navigation.rackList'),
                    href: '/racks',
                },
            ],
        },
        {
            title: t('navigation.deviceManagement'),
            icon: Cpu,
            items: [
                {
                    title: t('navigation.deviceTypeManagement'),
                    href: '/device-types',
                },
                {
                    title: t('navigation.deviceLibrary'),
                    href: '/device-library',
                },
                {
                    title: t('navigation.deviceList'),
                    href: '/devices',
                },
            ],
        },
        {
            title: t('navigation.monitorReports'),
            icon: Activity,
            items: [
                {
                    title: t('navigation.monitor'),
                    href: '/monitor',
                },
                {
                    title: t('navigation.reports'),
                    href: '/reports',
                },
                {
                    title: t('navigation.alerts'),
                    href: '/alerts',
                },
            ],
        },
        {
            title: t('navigation.system'),
            icon: Settings,
            items: [
                {
                    title: t('navigation.backup'),
                    href: '/backup',
                },
            ],
        },
        {
            title: t('navigation.userManagement'),
            href: '/users',
            icon: Users,
        },
    ];

    const footerNavItems: NavItem[] = [
        {
            title: t('navigation.repository'),
            href: 'https://github.com/laravel/react-starter-kit',
            icon: Folder,
        },
        {
            title: t('navigation.documentation'),
            href: 'https://laravel.com/docs/starter-kits#react',
            icon: BookOpen,
        },
    ];

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
