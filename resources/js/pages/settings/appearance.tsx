import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import AppearanceTabs from '@/components/appearance-tabs';
import Heading from '@/components/heading';
import LanguageToggle from '@/components/language-toggle';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAppearance } from '@/routes/appearance';
import type { BreadcrumbItem } from '@/types';

export default function Appearance() {
    const { t } = useTranslation();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('settings.appearance.title'),
            href: editAppearance().url,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('settings.appearance.title')} />

            <h1 className="sr-only">{t('settings.appearance.heading')}</h1>

            <SettingsLayout>
                <div className="space-y-6">
                    <Heading
                        variant="small"
                        title={t('settings.appearance.title')}
                        description={t('settings.appearance.description')}
                    />
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {t('settings.appearance.theme')}
                            </label>
                            <AppearanceTabs />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">
                                {t('settings.appearance.language')}
                            </label>
                            <LanguageToggle />
                        </div>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
