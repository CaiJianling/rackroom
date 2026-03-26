/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-02-24 12:18:20
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-02-24 12:39:11
 * @FilePath: /godlytools/resources/js/components/language-toggle.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale, updateLocale } from '@/hooks/use-locale';
import { cn } from '@/lib/utils';

export default function LanguageToggle({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { t } = useTranslation();
    const locale = useLocale();

    const languages: { value: 'zh' | 'en'; label: string }[] = [
        { value: 'zh', label: t('settings.appearance.chinese') },
        { value: 'en', label: t('settings.appearance.english') },
    ];

    return (
        <div
            className={cn(
                'inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800',
                className,
            )}
            {...props}
        >
            {languages.map(({ value, label }) => (
                <button
                    key={value}
                    onClick={() => updateLocale(value)}
                    className={cn(
                        'flex items-center rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                        locale === value
                            ? 'bg-white shadow-xs dark:bg-neutral-700 dark:text-neutral-100'
                            : 'text-neutral-500 hover:bg-neutral-200/60 hover:text-black dark:text-neutral-400 dark:hover:bg-neutral-700/60',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
