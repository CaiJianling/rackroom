/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-25 03:55:13
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-27 07:34:46
 * @FilePath: /rackroom/resources/js/components/app-sidebar-header.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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
        if (url.startsWith('/racks')) return '机柜管理';
        if (url.startsWith('/devices')) return '设备管理';
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
