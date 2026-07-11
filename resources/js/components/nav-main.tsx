import { Link, router } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';

export function NavMain({ items = [] }: { items: NavItem[] }) {
    const { t } = useTranslation();
    const { isCurrentUrl } = useCurrentUrl();

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement | Element>, href: string) => {
        if (isCurrentUrl(href)) {
            e.preventDefault();
            router.reload({ only: [] });
        }
    };

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>{t('navigation.platform')}</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        {item.items && item.items.length > 0 ? (
                            <CollapsibleNavItem item={item} isCurrentUrl={isCurrentUrl} />
                        ) : item.target === '_blank' ? (
                            <SidebarMenuButton
                                asChild
                                tooltip={{ children: item.title }}
                            >
                                <a
                                    href={String(item.href) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </a>
                            </SidebarMenuButton>
                        ) : (
                            <SidebarMenuButton
                                asChild
                                isActive={isCurrentUrl(item.href || '')}
                                tooltip={{ children: item.title }}
                            >
                                <Link
                                    href={item.href || '#'}
                                    prefetch
                                    onClick={(e) => item.href && handleClick(e, String(item.href))}
                                >
                                    {item.icon && <item.icon />}
                                    <span>{item.title}</span>
                                </Link>
                            </SidebarMenuButton>
                        )}
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

function CollapsibleNavItem({ item, isCurrentUrl }: { item: NavItem; isCurrentUrl: (href: NonNullable<InertiaLinkProps['href']>) => boolean }) {
    const hasActiveChild = item.items?.some(subItem => subItem.href && isCurrentUrl(subItem.href));
    const [isOpen, setIsOpen] = useState(hasActiveChild);

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement | Element>, href: string) => {
        if (isCurrentUrl(href)) {
            e.preventDefault();
            router.reload({ only: [] });
        }
    };

    return (
        <>
            <SidebarMenuButton
                onClick={() => setIsOpen(!isOpen)}
                isActive={hasActiveChild}
                tooltip={{ children: item.title }}
            >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
                {isOpen ? <ChevronDown className="ml-auto" /> : <ChevronRight className="ml-auto" />}
            </SidebarMenuButton>
            {isOpen && item.items && (
                <SidebarMenuSub>
                    {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                                asChild
                                isActive={subItem.href ? isCurrentUrl(subItem.href) : false}
                            >
                                <Link
                                    href={subItem.href || '#'}
                                    prefetch
                                    onClick={(e) => subItem.href && handleClick(e, String(subItem.href))}
                                >
                                    <span>{subItem.title}</span>
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                    ))}
                </SidebarMenuSub>
            )}
        </>
    );
}
