/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-02-25 00:33:04
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-02-25 01:05:03
 * @FilePath: /godlytools/resources/js/Pages/User/Edit.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
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

interface User {
    id: number;
    name: string;
    email: string;
    is_active: boolean;
    is_admin: boolean;
}

interface Props {
    user: User;
}

export default function UserEdit({ user }: Props) {
    const [form, setForm] = useState({
        name: user.name,
        email: user.email,
        password: '',
        is_active: user.is_active,
        is_admin: user.is_admin,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.put(`/users/${user.id}`, form);
    };

    return (
        <>
            <Head title="Edit User" />
            <div className="container mx-auto py-8">
                <div className="mx-auto max-w-md">
                    <Link href={`/users`}>
                        <Button variant="ghost" className="mb-4">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Users
                        </Button>
                    </Link>

                    <Card>
                        <CardHeader>
                            <CardTitle>Edit User</CardTitle>
                            <CardDescription>
                                Update user information
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Name</Label>
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
                                    <Label htmlFor="email">Email</Label>
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
                                    <Label htmlFor="password">
                                        New Password
                                    </Label>
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
                                        placeholder="Leave empty to keep current password"
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
                                    <Label htmlFor="is_active">Active</Label>
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
                                    <Label htmlFor="is_admin">Admin</Label>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Link href={`/users`}>
                                        <Button type="button" variant="outline">
                                            Cancel
                                        </Button>
                                    </Link>
                                    <Button type="submit">Update User</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
