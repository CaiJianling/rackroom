import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function UserCreate() {
    const { t } = useTranslation();
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        is_active: true,
        is_admin: false,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/users', form);
    };

    return (
        <>
            <Head title={t('userManagement.createNewUser')} />
            <div className="container mx-auto py-8">
                <div className="mx-auto max-w-md">
                    <Link href={`/users`}>
                        <Button variant="ghost" className="mb-4">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            {t('userManagement.backToUsers')}
                        </Button>
                    </Link>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('userManagement.createNewUser')}</CardTitle>
                            <CardDescription>
                                {t('userManagement.addNewUser')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="name">{t('userManagement.name')}</Label>
                                    <Input
                                        id="name"
                                        type="text"
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                name: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="email">{t('userManagement.email')}</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={form.email}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                email: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="password">{t('userManagement.password')}</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={form.password}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                password: e.target.value,
                                            })
                                        }
                                        required
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="is_active"
                                        checked={form.is_active}
                                        onCheckedChange={(checked) =>
                                            setForm({
                                                ...form,
                                                is_active: checked as boolean,
                                            })
                                        }
                                    />
                                    <Label htmlFor="is_active">{t('userManagement.active')}</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="is_admin"
                                        checked={form.is_admin}
                                        onCheckedChange={(checked) =>
                                            setForm({
                                                ...form,
                                                is_admin: checked as boolean,
                                            })
                                        }
                                    />
                                    <Label htmlFor="is_admin">{t('userManagement.admin')}</Label>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Link href={`/users`}>
                                        <Button type="button" variant="outline">
                                            {t('userManagement.cancel')}
                                        </Button>
                                    </Link>
                                    <Button type="submit">{t('userManagement.createUser')}</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
