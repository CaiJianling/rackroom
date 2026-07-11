/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-26 20:39:11
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-07-11 14:50:59
 * @FilePath: /rackroom/resources/js/types/navigation.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

export type BreadcrumbItem = {
    title: string;
    href: string;
};

export type NavItem = {
    title: string;
    href?: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
    items?: NavItem[];
    target?: '_blank' | '_self';
};
