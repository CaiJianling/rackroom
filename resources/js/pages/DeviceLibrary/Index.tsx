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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
}

interface DeviceLibraryItem {
    id: number;
    device_type_id: number;
    name: string;
    model: string | null;
    manufacturer: string | null;
    serial_number: string | null;
    u_height: number;
    power: number;
    description: string | null;
    created_at: string;
    updated_at: string;
    device_type?: DeviceType;
    devices?: Device[];
}

interface Rack {
    id: number;
    name: string;
}

interface Device {
    id: number;
    rack_id: number | null;
    name: string;
    u_position: number;
    rack?: Rack;
}

interface Props {
    deviceLibrary: DeviceLibraryItem[];
    deviceTypes: DeviceType[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

const getDeviceTypeIcon = (iconName: string | null) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
        server: Server,
        cpu: Cpu,
        'hard-drive': HardDrive,
        network: Wifi,
        monitor: Monitor,
        database: Database,
        wifi: Wifi,
        box: Box,
    };
    return iconName ? iconMap[iconName] || Server : Server;
};

export default function DeviceLibraryIndex({ deviceLibrary, deviceTypes, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const { errors } = usePage().props as PageProps;
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
    const [viewingItem, setViewingItem] = useState<DeviceLibraryItem | null>(null);
    const [editingItem, setEditingItem] = useState<DeviceLibraryItem | null>(null);
    const [form, setForm] = useState({
        device_type_id: '',
        name: '',
        model: '',
        manufacturer: '',
        serial_number: '',
        u_height: 1,
        power: 0,
        description: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const handleDelete = (itemId: number) => {
        setDeletingItemId(itemId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deletingItemId) {
            router.delete(`/device-library/${deletingItemId}`, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingItemId(null);
                },
            });
        }
    };

    const cancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setDeletingItemId(null);
    };

    const openEditDialog = (item: DeviceLibraryItem) => {
        setEditingItem(item);
        setForm({
            device_type_id: item.device_type_id.toString(),
            name: item.name,
            model: item.model || '',
            manufacturer: item.manufacturer || '',
            serial_number: item.serial_number || '',
            u_height: item.u_height,
            power: item.power,
            description: item.description || '',
        });
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingItem(null);
        setForm({
            device_type_id: '',
            name: '',
            model: '',
            manufacturer: '',
            serial_number: '',
            u_height: 1,
            power: 0,
            description: '',
        });
    };

    const openDetailDialog = (item: DeviceLibraryItem) => {
        setViewingItem(item);
        setIsDetailDialogOpen(true);
    };

    const closeDetailDialog = () => {
        setIsDetailDialogOpen(false);
        setViewingItem(null);
    };

    const openCreateDialog = () => {
        setForm({
            device_type_id: deviceTypes.length > 0 ? deviceTypes[0].id.toString() : '',
            name: '',
            model: '',
            manufacturer: '',
            serial_number: '',
            u_height: 1,
            power: 0,
            description: '',
        });
        setIsCreateDialogOpen(true);
    };

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setForm({
            device_type_id: '',
            name: '',
            model: '',
            manufacturer: '',
            serial_number: '',
            u_height: 1,
            power: 0,
            description: '',
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem) {
            router.put(`/device-library/${editingItem.id}`, {
                ...form,
                device_type_id: parseInt(form.device_type_id),
                u_height: parseInt(form.u_height as unknown as string),
                power: parseInt(form.power as unknown as string),
            }, {
                onSuccess: () => closeEditDialog(),
            });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/device-library', {
            ...form,
            device_type_id: parseInt(form.device_type_id),
            u_height: parseInt(form.u_height as unknown as string),
            power: parseInt(form.power as unknown as string),
        }, {
            onSuccess: () => closeCreateDialog(),
        });
    };

    const filteredItems = useMemo(() => {
        return deviceLibrary.filter((item) => {
            const matchesSearch =
                searchTerm === '' ||
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.model && item.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.manufacturer && item.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesType =
                typeFilter === 'all' || item.device_type_id.toString() === typeFilter;

            return matchesSearch && matchesType;
        });
    }, [deviceLibrary, searchTerm, typeFilter]);

    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredItems.slice(startIndex, endIndex);
    }, [filteredItems, currentPage]);

    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    const clearSearch = () => {
        setSearchTerm('');
    };

    const getTypeName = (typeId: number) => {
        const type = deviceTypes.find(t => t.id === typeId);
        return type ? type.name : '-';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('navigation.deviceLibrary')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('navigation.deviceLibrary')}
                    </h1>
                    <Button onClick={openCreateDialog} disabled={deviceTypes.length === 0}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('deviceLibrary.add')}
                    </Button>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={t('deviceLibrary.searchPlaceholder')}
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
                    <Select value={typeFilter} onValueChange={(value) => {
                        setTypeFilter(value);
                        setCurrentPage(1);
                    }}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder={t('deviceLibrary.filterByType')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{t('deviceLibrary.allTypes')}</SelectItem>
                            {deviceTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id.toString()}>
                                    {type.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {errors?.error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                        {errors.error}
                    </div>
                )}

                {deviceTypes.length === 0 && (
                    <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
                        {t('deviceLibrary.pleaseCreateTypeFirst')}
                    </div>
                )}

                <Card className="flex-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('deviceLibrary.list')}</CardTitle>
                                <CardDescription>
                                    {t('deviceLibrary.description')}
                                </CardDescription>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('deviceLibrary.count', {
                                    filtered: filteredItems.length,
                                    total: deviceLibrary.length,
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
                                            {t('deviceLibrary.name')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="h-4 w-4" />
                                            {t('deviceLibrary.type')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceLibrary.model')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceLibrary.manufacturer')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceLibrary.uHeight')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceLibrary.power')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceLibrary.status')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4 text-right">
                                        {t('deviceLibrary.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm || typeFilter !== 'all' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t('deviceLibrary.noResults')}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSearchTerm('');
                                                            setTypeFilter('all');
                                                        }}
                                                    >
                                                        {t('common.clearFilters')}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Plus className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t('deviceLibrary.empty')}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={openCreateDialog}
                                                    >
                                                        {t('deviceLibrary.addFirst')}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedItems.map((item) => {
                                        const IconComponent = item.device_type?.icon
                                            ? getDeviceTypeIcon(item.device_type.icon)
                                            : Server;
                                        return (
                                            <TableRow
                                                key={item.id}
                                                className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                            >
                                                <TableCell className="px-4 py-3 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <IconComponent className="h-4 w-4" />
                                                        {item.name}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    {getTypeName(item.device_type_id)}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-muted-foreground">
                                                    {item.model || '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-muted-foreground">
                                                    {item.manufacturer || '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    {item.u_height}U
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    {item.power}W
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    {item.devices && item.devices.length > 0 ? (
                                                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                                            {t('deviceLibrary.used')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                                                            {t('deviceLibrary.unused')}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openDetailDialog(item)}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEditDialog(item)}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(item.id)}
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
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{t('deviceLibrary.add')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceLibrary.addDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="device_type_id" className="text-right">
                                    {t('deviceLibrary.type')}
                                </Label>
                                <Select
                                    value={form.device_type_id}
                                    onValueChange={(value) => setForm({ ...form, device_type_id: value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceLibrary.selectType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {deviceTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.id.toString()}>
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">
                                    {t('deviceLibrary.name')}
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
                                <Label htmlFor="model" className="text-right">
                                    {t('deviceLibrary.model')}
                                </Label>
                                <Input
                                    id="model"
                                    value={form.model}
                                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="manufacturer" className="text-right">
                                    {t('deviceLibrary.manufacturer')}
                                </Label>
                                <Input
                                    id="manufacturer"
                                    value={form.manufacturer}
                                    onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="serial_number" className="text-right">
                                    {t('deviceLibrary.serialNumber')}
                                </Label>
                                <Input
                                    id="serial_number"
                                    value={form.serial_number}
                                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="u_height" className="text-right">
                                    {t('deviceLibrary.uHeight')}
                                </Label>
                                <Input
                                    id="u_height"
                                    type="number"
                                    min="1"
                                    value={form.u_height}
                                    onChange={(e) => setForm({ ...form, u_height: parseInt(e.target.value) || 1 })}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="power" className="text-right">
                                    {t('deviceLibrary.power')}
                                </Label>
                                <Input
                                    id="power"
                                    type="number"
                                    min="0"
                                    value={form.power}
                                    onChange={(e) => setForm({ ...form, power: parseInt(e.target.value) || 0 })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="description" className="text-right">
                                    {t('deviceLibrary.description')}
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
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{t('deviceLibrary.edit')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceLibrary.editDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-device_type_id" className="text-right">
                                    {t('deviceLibrary.type')}
                                </Label>
                                <Select
                                    value={form.device_type_id}
                                    onValueChange={(value) => setForm({ ...form, device_type_id: value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceLibrary.selectType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {deviceTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.id.toString()}>
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-name" className="text-right">
                                    {t('deviceLibrary.name')}
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
                                <Label htmlFor="edit-model" className="text-right">
                                    {t('deviceLibrary.model')}
                                </Label>
                                <Input
                                    id="edit-model"
                                    value={form.model}
                                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-manufacturer" className="text-right">
                                    {t('deviceLibrary.manufacturer')}
                                </Label>
                                <Input
                                    id="edit-manufacturer"
                                    value={form.manufacturer}
                                    onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-serial_number" className="text-right">
                                    {t('deviceLibrary.serialNumber')}
                                </Label>
                                <Input
                                    id="edit-serial_number"
                                    value={form.serial_number}
                                    onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-u_height" className="text-right">
                                    {t('deviceLibrary.uHeight')}
                                </Label>
                                <Input
                                    id="edit-u_height"
                                    type="number"
                                    min="1"
                                    value={form.u_height}
                                    onChange={(e) => setForm({ ...form, u_height: parseInt(e.target.value) || 1 })}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-power" className="text-right">
                                    {t('deviceLibrary.power')}
                                </Label>
                                <Input
                                    id="edit-power"
                                    type="number"
                                    min="0"
                                    value={form.power}
                                    onChange={(e) => setForm({ ...form, power: parseInt(e.target.value) || 0 })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-description" className="text-right">
                                    {t('deviceLibrary.description')}
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
                        <DialogTitle>{t('deviceLibrary.delete')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceLibrary.deleteConfirm')}
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
                        <DialogTitle>{t('deviceLibrary.details')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceLibrary.detailsDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    {viewingItem && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.name')}
                                </Label>
                                <span className="col-span-3">{viewingItem.name}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.type')}
                                </Label>
                                <span className="col-span-3">{getTypeName(viewingItem.device_type_id)}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.model')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingItem.model || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.manufacturer')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingItem.manufacturer || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.serialNumber')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingItem.serial_number || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.uHeight')}
                                </Label>
                                <span className="col-span-3">{viewingItem.u_height}U</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.power')}
                                </Label>
                                <span className="col-span-3">{viewingItem.power}W</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.description')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingItem.description || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.created')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {new Date(viewingItem.created_at).toLocaleString()}
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
