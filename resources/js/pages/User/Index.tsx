/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-02-25 00:31:51
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-03-26 12:28:57
 * @FilePath: /rackroom/resources/js/pages/User/Index.tsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Pencil,
    Trash2,
    UserPlus,
    ToggleLeft,
    ToggleRight,
    Search,
    X,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';

interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at: string;
    is_active: boolean;
    is_admin: boolean;
    created_at: string;
    updated_at: string;
}

interface Props {
    users: User[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function UserIndex({ users, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const { auth, errors } = usePage().props as any;
    const currentUserId = auth?.user?.id;
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        is_active: true,
        is_admin: false,
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<
        'all' | 'active' | 'inactive'
    >('all');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>(
        'all',
    );

    const handleDelete = (userId: number) => {
        setDeletingUserId(userId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deletingUserId) {
            router.delete(`/users/${deletingUserId}`, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingUserId(null);
                },
            });
        }
    };

    const cancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setDeletingUserId(null);
    };

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        setForm({
            name: user.name,
            email: user.email,
            password: '',
            is_active: user.is_active,
            is_admin: user.is_admin,
        });
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingUser(null);
        setForm({
            name: '',
            email: '',
            password: '',
            is_active: true,
            is_admin: false,
        });
    };

    const openCreateDialog = () => {
        setForm({
            name: '',
            email: '',
            password: '',
            is_active: true,
            is_admin: false,
        });
        setIsCreateDialogOpen(true);
    };

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setForm({
            name: '',
            email: '',
            password: '',
            is_active: true,
            is_admin: false,
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingUser) {
            router.put(`/users/${editingUser.id}`, form, {
                onSuccess: () => closeEditDialog(),
            });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/users', form, {
            onSuccess: () => closeCreateDialog(),
        });
    };

    const toggleStatus = (userId: number, currentStatus: boolean) => {
        router.put(`/users/${userId}/toggle-status`, {});
    };

    // 搜索和筛选逻辑
    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            // 搜索逻辑
            const matchesSearch =
                searchTerm === '' ||
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase());

            // 状态筛选
            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && user.is_active) ||
                (statusFilter === 'inactive' && !user.is_active);

            // 角色筛选
            const matchesRole =
                roleFilter === 'all' ||
                (roleFilter === 'admin' && user.is_admin) ||
                (roleFilter === 'user' && !user.is_admin);

            return matchesSearch && matchesStatus && matchesRole;
        });
    }, [users, searchTerm, statusFilter, roleFilter]);

    const clearSearch = () => {
        setSearchTerm('');
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('userManagement.title')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('userManagement.title')}
                    </h1>
                    <Button onClick={openCreateDialog}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        {t('userManagement.addUser')}
                    </Button>
                </div>

                {/* 搜索和筛选栏 */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={t('userManagement.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pr-10 pl-10"
                        />
                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearSearch}
                                className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 transform p-0"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) =>
                                setStatusFilter(
                                    e.target.value as
                                        | 'all'
                                        | 'active'
                                        | 'inactive',
                                )
                            }
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                        >
                            <option value="all">
                                {t('userManagement.allStatus')}
                            </option>
                            <option value="active">
                                {t('userManagement.active')}
                            </option>
                            <option value="inactive">
                                {t('userManagement.inactive')}
                            </option>
                        </select>

                        <select
                            value={roleFilter}
                            onChange={(e) =>
                                setRoleFilter(
                                    e.target.value as 'all' | 'admin' | 'user',
                                )
                            }
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none"
                        >
                            <option value="all">
                                {t('userManagement.allRoles')}
                            </option>
                            <option value="admin">
                                {t('userManagement.admin')}
                            </option>
                            <option value="user">
                                {t('userManagement.user')}
                            </option>
                        </select>
                    </div>
                </div>

                {errors.error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                        {errors.error}
                    </div>
                )}

                <Card className="flex-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>
                                    {t('userManagement.users')}
                                </CardTitle>
                                <CardDescription>
                                    {t('userManagement.manageUsers')}
                                </CardDescription>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('userManagement.usersCount', {
                                    filtered: filteredUsers.length,
                                    total: users.length,
                                })}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.name')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.email')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.status')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.role')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.created')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4 text-right">
                                        {t('userManagement.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm ||
                                            statusFilter !== 'all' ||
                                            roleFilter !== 'all' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'userManagement.noUsersFound',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSearchTerm('');
                                                            setStatusFilter(
                                                                'all',
                                                            );
                                                            setRoleFilter(
                                                                'all',
                                                            );
                                                        }}
                                                    >
                                                        {t(
                                                            'userManagement.clearFilters',
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <UserPlus className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'userManagement.noUsers',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={openCreateDialog}
                                                    >
                                                        {t(
                                                            'userManagement.addFirstUser',
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow
                                            key={user.id}
                                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                        >
                                            <TableCell className="px-4 py-3 font-medium">
                                                {user.name}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {user.email}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        toggleStatus(
                                                            user.id,
                                                            user.is_active,
                                                        )
                                                    }
                                                    disabled={user.id === currentUserId}
                                                    className="h-8 w-8 p-0 hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {user.is_active ? (
                                                        <ToggleRight className="h-5 w-5 text-green-500 hover:text-green-600" />
                                                    ) : (
                                                        <ToggleLeft className="h-5 w-5 text-gray-400 hover:text-gray-500" />
                                                    )}
                                                </Button>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {user.is_admin ? (
                                                    <Badge
                                                        variant="destructive"
                                                        className="px-2 py-1"
                                                    >
                                                        {t(
                                                            'userManagement.admin',
                                                        )}
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="px-2 py-1"
                                                    >
                                                        {t(
                                                            'userManagement.user',
                                                        )}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {new Date(
                                                    user.created_at,
                                                ).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openEditDialog(user)
                                                        }
                                                        className="h-8 w-8 p-0 hover:bg-muted"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDelete(
                                                                user.id,
                                                            )
                                                        }
                                                        className="h-8 w-8 p-0 text-red-500 hover:bg-muted hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Create User Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={closeCreateDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t('userManagement.createNewUser')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('userManagement.addNewUser')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="create-name">
                                {t('userManagement.name')}
                            </Label>
                            <Input
                                id="create-name"
                                type="text"
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="create-email">
                                {t('userManagement.email')}
                            </Label>
                            <Input
                                id="create-email"
                                type="email"
                                value={form.email}
                                onChange={(e) =>
                                    setForm({ ...form, email: e.target.value })
                                }
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="create-password">
                                {t('userManagement.password')}
                            </Label>
                            <Input
                                id="create-password"
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
                                id="create-is_active"
                                checked={form.is_active}
                                onCheckedChange={(checked) =>
                                    setForm({
                                        ...form,
                                        is_active: checked as boolean,
                                    })
                                }
                            />
                            <Label htmlFor="create-is_active">
                                {t('userManagement.active')}
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="create-is_admin"
                                checked={form.is_admin}
                                onCheckedChange={(checked) =>
                                    setForm({
                                        ...form,
                                        is_admin: checked as boolean,
                                    })
                                }
                            />
                            <Label htmlFor="create-is_admin">
                                {t('userManagement.admin')}
                            </Label>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeCreateDialog}
                            >
                                {t('userManagement.cancel')}
                            </Button>
                            <Button type="submit">
                                {t('userManagement.createUser')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={closeEditDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t('userManagement.editUser')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('userManagement.updateUserInfo')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="edit-name">
                                {t('userManagement.name')}
                            </Label>
                            <Input
                                id="edit-name"
                                type="text"
                                value={form.name}
                                onChange={(e) =>
                                    setForm({ ...form, name: e.target.value })
                                }
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-email">
                                {t('userManagement.email')}
                            </Label>
                            <Input
                                id="edit-email"
                                type="email"
                                value={form.email}
                                onChange={(e) =>
                                    setForm({ ...form, email: e.target.value })
                                }
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="edit-password">
                                {t('userManagement.newPassword')}
                            </Label>
                            <Input
                                id="edit-password"
                                type="password"
                                value={form.password}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        password: e.target.value,
                                    })
                                }
                                placeholder={t(
                                    'userManagement.passwordPlaceholder',
                                )}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="edit-is_active"
                                checked={!!form.is_active}
                                disabled={editingUser?.id === currentUserId}
                                onCheckedChange={(checked) =>
                                    setForm({
                                        ...form,
                                        is_active: checked as boolean,
                                    })
                                }
                                className="disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            <Label htmlFor="edit-is_active" className={editingUser?.id === currentUserId ? "text-muted-foreground" : ""}>
                                {t('userManagement.active')}
                                {editingUser?.id === currentUserId && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        ({t('userManagement.cannotChangeOwnStatus')})
                                    </span>
                                )}
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="edit-is_admin"
                                checked={!!form.is_admin}
                                onCheckedChange={(checked) =>
                                    setForm({
                                        ...form,
                                        is_admin: checked as boolean,
                                    })
                                }
                            />
                            <Label htmlFor="edit-is_admin">
                                {t('userManagement.admin')}
                            </Label>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeEditDialog}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit">
                                {t('userManagement.updateUser')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete User Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t('userManagement.confirmDelete')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('userManagement.deleteWarning')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={cancelDelete}
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={confirmDelete}
                        >
                            {t('common.delete')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
