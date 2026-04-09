import { Head, router, usePage } from '@inertiajs/react';
import {
    Pencil,
    Trash2,
    Plus,
    Search,
    X,
    Server,
    Cpu,
    HardDrive,
    Network,
    Monitor,
    Database,
    Wifi,
    Box,
    Eye,
} from 'lucide-react';
import { useState, useMemo } from 'react';
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
import AppLayout from '@/layouts/app-layout';

interface PageProps {
    errors?: Record<string, string>;
}

interface DeviceType {
    id: number;
    name: string;
    icon: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
    device_library_count?: number;
}

interface Props {
    deviceTypes: DeviceType[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

const iconOptions = [
    { value: 'server', label: '服务器', icon: Server },
    { value: 'cpu', label: 'CPU/处理器', icon: Cpu },
    { value: 'hard-drive', label: '存储设备', icon: HardDrive },
    { value: 'network', label: '网络设备', icon: Network },
    { value: 'monitor', label: '显示器', icon: Monitor },
    { value: 'database', label: '数据库', icon: Database },
    { value: 'wifi', label: '无线设备', icon: Wifi },
    { value: 'box', label: '其他设备', icon: Box },
];

const getIconComponent = (iconName: string | null) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
        server: Server,
        cpu: Cpu,
        'hard-drive': HardDrive,
        network: Network,
        monitor: Monitor,
        database: Database,
        wifi: Wifi,
        box: Box,
    };
    return iconName ? iconMap[iconName] : Server;
};

export default function DeviceTypeIndex({ deviceTypes, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const { errors } = usePage().props as PageProps;
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [deletingDeviceTypeId, setDeletingDeviceTypeId] = useState<number | null>(null);
    const [viewingDeviceType, setViewingDeviceType] = useState<DeviceType | null>(null);
    const [editingDeviceType, setEditingDeviceType] = useState<DeviceType | null>(null);
    const [form, setForm] = useState({
        name: '',
        icon: 'server',
        description: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const handleDelete = (deviceTypeId: number) => {
        setDeletingDeviceTypeId(deviceTypeId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deletingDeviceTypeId) {
            router.delete(`/device-types/${deletingDeviceTypeId}`, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingDeviceTypeId(null);
                },
            });
        }
    };

    const cancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setDeletingDeviceTypeId(null);
    };

    const openEditDialog = (deviceType: DeviceType) => {
        setEditingDeviceType(deviceType);
        setForm({
            name: deviceType.name,
            icon: deviceType.icon || 'server',
            description: deviceType.description || '',
        });
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingDeviceType(null);
        setForm({
            name: '',
            icon: 'server',
            description: '',
        });
    };

    const openDetailDialog = (deviceType: DeviceType) => {
        setViewingDeviceType(deviceType);
        setIsDetailDialogOpen(true);
    };

    const closeDetailDialog = () => {
        setIsDetailDialogOpen(false);
        setViewingDeviceType(null);
    };

    const openCreateDialog = () => {
        setForm({
            name: '',
            icon: 'server',
            description: '',
        });
        setIsCreateDialogOpen(true);
    };

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setForm({
            name: '',
            icon: 'server',
            description: '',
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDeviceType) {
            router.put(`/device-types/${editingDeviceType.id}`, form, {
                onSuccess: () => closeEditDialog(),
            });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/device-types', form, {
            onSuccess: () => closeCreateDialog(),
        });
    };

    const filteredDeviceTypes = useMemo(() => {
        return deviceTypes.filter((deviceType) => {
            const matchesSearch =
                searchTerm === '' ||
                deviceType.name.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesSearch;
        });
    }, [deviceTypes, searchTerm]);

    const paginatedDeviceTypes = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredDeviceTypes.slice(startIndex, endIndex);
    }, [filteredDeviceTypes, currentPage]);

    const totalPages = Math.ceil(filteredDeviceTypes.length / itemsPerPage);

    const clearSearch = () => {
        setSearchTerm('');
    };

    const getIconLabel = (iconName: string | null) => {
        const option = iconOptions.find(o => o.value === iconName);
        return option ? option.label : iconName || '未设置';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('navigation.deviceTypeManagement')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('navigation.deviceTypeManagement')}
                    </h1>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('deviceTypeManagement.add')}
                    </Button>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={t('deviceTypeManagement.searchPlaceholder')}
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

                {errors?.error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                        {errors.error}
                    </div>
                )}

                <Card className="flex-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('deviceTypeManagement.list')}</CardTitle>
                                <CardDescription>
                                    {t('deviceTypeManagement.description')}
                                </CardDescription>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('deviceTypeManagement.count', {
                                    filtered: filteredDeviceTypes.length,
                                    total: deviceTypes.length,
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
                                            {t('deviceTypeManagement.name')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="h-4 w-4" />
                                            {t('deviceTypeManagement.icon')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceTypeManagement.deviceCount')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceTypeManagement.description')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceTypeManagement.created')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4 text-right">
                                        {t('deviceTypeManagement.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredDeviceTypes.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t('deviceTypeManagement.noResults')}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setSearchTerm('')}
                                                    >
                                                        {t('common.clearSearch')}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Plus className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t('deviceTypeManagement.empty')}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={openCreateDialog}
                                                    >
                                                        {t('deviceTypeManagement.addFirst')}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedDeviceTypes.map((deviceType) => {
                                        const IconComponent = getIconComponent(deviceType.icon);
                                        return (
                                            <TableRow
                                                key={deviceType.id}
                                                className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                            >
                                                <TableCell className="px-4 py-3 font-medium">
                                                    {deviceType.name}
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <IconComponent className="h-4 w-4" />
                                                        <span>{getIconLabel(deviceType.icon)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    {deviceType.device_library_count || 0}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-muted-foreground">
                                                    {deviceType.description || '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-muted-foreground">
                                                    {new Date(deviceType.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openDetailDialog(deviceType)}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEditDialog(deviceType)}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(deviceType.id)}
                                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                        {totalPages > 1 && (
                            <div className="flex items-center justify-end space-x-2 border-t px-4 py-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    {t('common.previous')}
                                </Button>
                                <span className="text-sm text-muted-foreground">
                                    {currentPage} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    {t('common.next')}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('deviceTypeManagement.add')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceTypeManagement.addDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    {t('deviceTypeManagement.name')}
                                </Label>
                                <Input
                                    id="name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="icon" className="text-right">
                                    {t('deviceTypeManagement.icon')}
                                </Label>
                                <select
                                    id="icon"
                                    value={form.icon}
                                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                    className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    {iconOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="description" className="text-right">
                                    {t('deviceTypeManagement.description')}
                                </Label>
                                <Textarea
                                    id="description"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeCreateDialog}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit">
                                {t('common.create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('deviceTypeManagement.edit')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceTypeManagement.editDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-name" className="text-right">
                                    {t('deviceTypeManagement.name')}
                                </Label>
                                <Input
                                    id="edit-name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-icon" className="text-right">
                                    {t('deviceTypeManagement.icon')}
                                </Label>
                                <select
                                    id="edit-icon"
                                    value={form.icon}
                                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                    className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    {iconOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-description" className="text-right">
                                    {t('deviceTypeManagement.description')}
                                </Label>
                                <Textarea
                                    id="edit-description"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeEditDialog}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit">
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('deviceTypeManagement.delete')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceTypeManagement.deleteConfirm')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={cancelDelete}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('deviceTypeManagement.details')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceTypeManagement.detailsDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    {viewingDeviceType && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceTypeManagement.name')}
                                </Label>
                                <span className="col-span-3">{viewingDeviceType.name}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceTypeManagement.icon')}
                                </Label>
                                <div className="col-span-3 flex items-center gap-2">
                                    {(() => {
                                        const IconComponent = getIconComponent(viewingDeviceType.icon);
                                        return <IconComponent className="h-4 w-4" />;
                                    })()}
                                    <span>{getIconLabel(viewingDeviceType.icon)}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceTypeManagement.description')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingDeviceType.description || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceTypeManagement.created')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {new Date(viewingDeviceType.created_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeDetailDialog}>
                            {t('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
