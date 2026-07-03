import { Moon, Monitor, RefreshCw, Sun } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAppearance } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import type { Appearance } from '@/hooks/use-appearance';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { appearance, updateAppearance } = useAppearance();

    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border/50 px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            <div className="flex items-center gap-2">
                <div className="inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
                    {(['light', 'dark', 'system'] as Appearance[]).map((value) => {
                        const Icon = value === 'light' ? Sun : value === 'dark' ? Moon : Monitor;
                        return (
                            <button
                                key={value}
                                onClick={() => {
                                    updateAppearance(value);
                                    fetch('/api/preferences/theme', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                                        },
                                        body: JSON.stringify({ value }),
                                        credentials: 'same-origin',
                                    });
                                }}
                                className={cn(
                                    'flex items-center rounded-md px-2 py-1 transition-colors',
                                    appearance === value
                                        ? 'bg-white shadow-xs dark:bg-neutral-700 dark:text-neutral-100'
                                        : 'text-neutral-500 hover:bg-neutral-200/60 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-700/60',
                                )}
                                title={value === 'light' ? '浅色' : value === 'dark' ? '深色' : '跟随系统'}
                            >
                                <Icon className="h-4 w-4" />
                            </button>
                        );
                    })}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    className="h-9 w-9 p-0"
                    title="刷新页面"
                >
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>
        </header>
    );
}
