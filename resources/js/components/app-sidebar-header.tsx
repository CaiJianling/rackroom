import { usePage } from '@inertiajs/react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const page = usePage();
    const url = page.url;

    const getTitle = () => {
        if (url === '/users') return '用户管理';
        if (url === '/rooms') return '机房管理';
        if (url === '/racks/visual-edit') return '机柜可视化编辑';
        if (url === '/racks') return '机柜列表';
        if (url.startsWith('/rack-types')) return '机柜信息维护';
        if (url.startsWith('/device-types')) return '设备类型管理';
        if (url.startsWith('/device-library')) return '设备库管理';
        if (url.startsWith('/devices')) return '设备列表管理';
        return null;
    };

    const title = getTitle();

    return (
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/50 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                {title && (
                    <span className="font-medium">{title}</span>
                )}
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
        </header>
    );
}
