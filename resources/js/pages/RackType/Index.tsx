import { Head, router, usePage } from '@inertiajs/react';
import {
    Pencil,
    Trash2,
    Plus,
    Search,
    X,
    Server,
    Zap,
    Cpu,
    Eye,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';

interface PageProps {
    errors?: Record<string, string>;
    flash?: {
        success?: string;
        error?: string;
        warning?: string;
        info?: string;
    };
}

interface RackType {
    id: number;
    name: string;
    u_count: number;
    power: number;
    description: string | null;
    racks_count?: number;
    created_at: string;
    updated_at: string;
}

interface Props {
    rackTypes: RackType[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function RackTypeIndex({ rackTypes, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const { errors, flash } = usePage().props as PageProps;
    const { showToast } = useToast();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    // 监听 flash 消息并使用 toast 显示
    useEffect(() => {
        if (flash?.error) {
            showToast(flash.error, 'error');
        }
        if (flash?.success) {
            showToast(flash.success, 'success');
        }
        if (flash?.warning) {
            showToast(flash.warning, 'warning');
        }
        if (flash?.info) {
            showToast(flash.info, 'info');
        }
    }, [flash, showToast]);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [deletingRackTypeId, setDeletingRackTypeId] = useState<number | null>(null);
    const [viewingRackType, setViewingRackType] = useState<RackType | null>(null);
    const [editingRackType, setEditingRackType] = useState<RackType | null>(null);
    const [form, setForm] = useState({
        name: '',
        u_count: 42,
        power: 5000,
        description: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const handleDelete = (rackTypeId: number) => {
        setDeletingRackTypeId(rackTypeId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deletingRackTypeId) {
            router.delete(`/rack-types/${deletingRackTypeId}`, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingRackTypeId(null);
                },
            });
        }
    };

    const cancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setDeletingRackTypeId(null);
    };

    const openEditDialog = (rackType: RackType) => {
        setEditingRackType(rackType);
        setForm({
            name: rackType.name,
            u_count: rackType.u_count,
            power: rackType.power,
            description: rackType.description || '',
        });
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingRackType(null);
        setForm({
            name: '',
            u_count: 42,
            power: 5000,
            description: '',
        });
    };

    const openDetailDialog = (rackType: RackType) => {
        setViewingRackType(rackType);
        setIsDetailDialogOpen(true);
    };

    const closeDetailDialog = () => {
        setIsDetailDialogOpen(false);
        setViewingRackType(null);
    };

    const openCreateDialog = () => {
        setForm({
            name: '',
            u_count: 42,
            power: 5000,
            description: '',
        });
        setIsCreateDialogOpen(true);
    };

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setForm({
            name: '',
            u_count: 42,
            power: 5000,
            description: '',
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingRackType) {
            router.put(`/rack-types/${editingRackType.id}`, form, {
                onSuccess: () => closeEditDialog(),
            });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/rack-types', form, {
            onSuccess: () => closeCreateDialog(),
        });
    };

    const filteredRackTypes = useMemo(() => {
        return rackTypes.filter((rackType) => {
            const matchesSearch =
                searchTerm === '' ||
                rackType.name.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesSearch;
        });
    }, [rackTypes, searchTerm]);

    const paginatedRackTypes = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredRackTypes.slice(startIndex, endIndex);
    }, [filteredRackTypes, currentPage]);

    const totalPages = Math.ceil(filteredRackTypes.length / itemsPerPage);

    const clearSearch = () => {
        setSearchTerm('');
    };

    const clearFilters = () => {
        setSearchTerm('');
        setCurrentPage(1);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('rackTypeManagement.title')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('rackTypeManagement.title')}
                    </h1>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('rackTypeManagement.addRackType')}
                    </Button>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={t('rackTypeManagement.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
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
                </div>



                <Card className="flex-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('rackTypeManagement.rackTypes')}</CardTitle>
                                <CardDescription>
                                    {t('rackTypeManagement.manageRackTypes')}
                                </CardDescription>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('rackTypeManagement.rackTypesCount', {
                                    filtered: paginatedRackTypes.length,
                                    total: rackTypes.length,
                                })}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4" />
                                            {t('rackTypeManagement.name')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="h-4 w-4" />
                                            {t('rackTypeManagement.uCount')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Zap className="h-4 w-4" />
                                            {t('rackTypeManagement.power')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('rackTypeManagement.description')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('rackTypeManagement.created')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4 text-right">
                                        {t('rackTypeManagement.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRackTypes.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'rackTypeManagement.noRackTypesFound',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={clearFilters}
                                                    >
                                                        {t(
                                                            'rackTypeManagement.clearFilters',
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Plus className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'rackTypeManagement.noRackTypes',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={openCreateDialog}
                                                    >
                                                        {t(
                                                            'rackTypeManagement.addFirstRackType',
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRackTypes.map((rackType) => (
                                        <TableRow
                                            key={rackType.id}
                                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                        >
                                            <TableCell className="px-4 py-3 font-medium">
                                                {rackType.name}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Cpu className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-semibold">
                                                        {rackType.u_count}U
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-semibold">
                                                        {rackType.power}W
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {rackType.description || '-'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {new Date(
                                                    rackType.created_at,
                                                ).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openDetailDialog(rackType)
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openEditDialog(rackType)
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDelete(rackType.id)
                                                        }
                                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t px-4 py-3">
                                <div className="text-sm text-muted-foreground">
                                    {t('rackTypeManagement.rackTypesCount', {
                                        filtered: paginatedRackTypes.length,
                                        total: rackTypes.length,
                                    })}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((p) => Math.max(1, p - 1))
                                        }
                                        disabled={currentPage === 1}
                                    >
                                        Previous
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((p) =>
                                                Math.min(totalPages, p + 1),
                                            )
                                        }
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Dialog
                    open={isCreateDialogOpen}
                    onOpenChange={setIsCreateDialogOpen}
                >
                    <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {t('rackTypeManagement.addRackType')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('rackTypeManagement.addNewRackType')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">
                                        {t('rackTypeManagement.name')} *
                                    </Label>
                                    <Input
                                        id="name"
                                        value={form.name}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                name: e.target.value,
                                            })
                                        }
                                        placeholder={t('rackTypeManagement.name')}
                                    />
                                    {errors?.name && (
                                        <p className="text-sm text-destructive">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="u_count">
                                        {t('rackTypeManagement.uCount')} *
                                    </Label>
                                    <Input
                                        id="u_count"
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={form.u_count}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                u_count: parseInt(
                                                    e.target.value,
                                                ) || 42,
                                            })
                                        }
                                        placeholder={t('rackTypeManagement.uCount')}
                                    />
                                    {errors?.u_count && (
                                        <p className="text-sm text-destructive">
                                            {errors.u_count}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="power">
                                        {t('rackTypeManagement.power')} *
                                    </Label>
                                    <Input
                                        id="power"
                                        type="number"
                                        min="0"
                                        value={form.power}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                power: parseInt(
                                                    e.target.value,
                                                ) || 5000,
                                            })
                                        }
                                        placeholder={t('rackTypeManagement.power')}
                                    />
                                    {errors?.power && (
                                        <p className="text-sm text-destructive">
                                            {errors.power}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">
                                        {t('rackTypeManagement.description')}
                                    </Label>
                                    <Textarea
                                        id="description"
                                        value={form.description}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                            setForm({
                                                ...form,
                                                description: e.target.value,
                                            })
                                        }
                                        placeholder={t('rackTypeManagement.description')}
                                        rows={3}
                                    />
                                    {errors?.description && (
                                        <p className="text-sm text-destructive">
                                            {errors.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeCreateDialog}
                                >
                                    {t('rackTypeManagement.cancel')}
                                </Button>
                                <Button type="submit">
                                    {t('rackTypeManagement.createRackType')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                >
                    <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {t('rackTypeManagement.editRackType')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('rackTypeManagement.updateRackType')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-name">
                                        {t('rackTypeManagement.name')} *
                                    </Label>
                                    <Input
                                        id="edit-name"
                                        value={form.name}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                name: e.target.value,
                                            })
                                        }
                                        placeholder={t('rackTypeManagement.name')}
                                    />
                                    {errors?.name && (
                                        <p className="text-sm text-destructive">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-u_count">
                                        {t('rackTypeManagement.uCount')} *
                                        {editingRackType?.racks_count && editingRackType.racks_count > 0 && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                ({t('rackTypeManagement.inUseLocked')})
                                            </span>
                                        )}
                                    </Label>
                                    <Input
                                        id="edit-u_count"
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={form.u_count}
                                        disabled={editingRackType?.racks_count ? editingRackType.racks_count > 0 : false}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                u_count: parseInt(
                                                    e.target.value,
                                                ) || 42,
                                            })
                                        }
                                        placeholder={t('rackTypeManagement.uCount')}
                                    />
                                    {errors?.u_count && (
                                        <p className="text-sm text-destructive">
                                            {errors.u_count}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-power">
                                        {t('rackTypeManagement.power')} *
                                    </Label>
                                    <Input
                                        id="edit-power"
                                        type="number"
                                        min="0"
                                        value={form.power}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                power: parseInt(
                                                    e.target.value,
                                                ) || 5000,
                                            })
                                        }
                                        placeholder={t('rackTypeManagement.power')}
                                    />
                                    {errors?.power && (
                                        <p className="text-sm text-destructive">
                                            {errors.power}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-description">
                                        {t('rackTypeManagement.description')}
                                    </Label>
                                    <Textarea
                                        id="edit-description"
                                        value={form.description}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                            setForm({
                                                ...form,
                                                description: e.target.value,
                                            })
                                        }
                                        placeholder={t('rackTypeManagement.description')}
                                        rows={3}
                                    />
                                    {errors?.description && (
                                        <p className="text-sm text-destructive">
                                            {errors.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={closeEditDialog}
                                >
                                    {t('rackTypeManagement.cancel')}
                                </Button>
                                <Button type="submit">
                                    {t('rackTypeManagement.updateRackType')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isDeleteDialogOpen}
                    onOpenChange={setIsDeleteDialogOpen}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {t('rackTypeManagement.confirmDelete')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('rackTypeManagement.deleteWarning')}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={cancelDelete}
                            >
                                {t('rackTypeManagement.cancel')}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={confirmDelete}
                            >
                                {t('rackTypeManagement.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isDetailDialogOpen}
                    onOpenChange={setIsDetailDialogOpen}
                >
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {t('rackTypeManagement.rackTypeDetails')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('rackTypeManagement.rackTypeDetailsDesc')}
                            </DialogDescription>
                        </DialogHeader>
                        {viewingRackType && (
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>
                                        {t('rackTypeManagement.name')}
                                    </Label>
                                    <p className="text-sm font-medium">
                                        {viewingRackType.name}
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>
                                        {t('rackTypeManagement.uCount')}
                                    </Label>
                                    <p className="text-sm font-medium">
                                        {viewingRackType.u_count}U
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>
                                        {t('rackTypeManagement.power')}
                                    </Label>
                                    <p className="text-sm font-medium">
                                        {viewingRackType.power}W
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>
                                        {t('rackTypeManagement.description')}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        {viewingRackType.description || '-'}
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label>
                                        {t('rackTypeManagement.created')}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        {new Date(
                                            viewingRackType.created_at,
                                        ).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        )}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeDetailDialog}
                            >
                                {t('rackTypeManagement.cancel')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
