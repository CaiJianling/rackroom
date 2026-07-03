import { Link, usePage } from '@inertiajs/react';
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
    Wrench,
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
    const { auth } = usePage().props as any;
    const isAdmin = auth?.user?.is_admin ?? false;

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
                {
                    title: t('navigation.deviceBatchOperations'),
                    href: '/devices/batch-operations',
                },
                {
                    title: t('navigation.deviceDependencies'),
                    href: '/device-dependencies',
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
                    title: t('navigation.rackAnalysis'),
                    href: '/rack-analysis',
                },
                {
                    title: t('navigation.reports'),
                    href: '/reports',
                },
                {
                    title: t('navigation.alerts'),
                    href: '/alerts',
                },
                {
                    title: t('navigation.deviceChangeLogs'),
                    href: '/device-change-logs',
                },
            ],
        },
        {
            title: t('navigation.tools'),
            icon: Wrench,
            items: [
                {
                    title: t('navigation.h3cPassword'),
                    href: '/tools/h3c-password',
                },
                {
                    title: 'SSH WebSocket终端',
                    href: '/tools/ssh-terminal-ws',
                },
            ],
        },
        {
            title: t('navigation.system'),
            icon: Settings,
            items: [
                {
                    title: t('navigation.autoDetection'),
                    href: '/auto-detection',
                },
                {
                    title: t('navigation.backup'),
                    href: '/backup',
                },
            ],
        },
        ...(isAdmin ? [
            {
                title: t('navigation.userManagement'),
                href: '/users',
                icon: Users,
            },
        ] : []),
    ];

    const footerNavItems: NavItem[] = [];

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