import { Head, router, usePage } from '@inertiajs/react';
import {
    Pencil,
    Trash2,
    Plus,
    Search,
    X,
    Server,
    Download,
    Upload,
    Eye,
    Cpu,
    HardDrive,
    Network,
    ShieldCheck,
    AlertCircle,
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
    message?: string;
}

interface Rack {
    id: number;
    name: string;
}

interface Device {
    id: number;
    rack_id: number | null;
    name: string;
    category: string;
    model: string | null;
    manufacturer: string | null;
    serial_number: string | null;
    u_position: number;
    power: number;
    status: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    rack?: Rack;
}

interface Props {
    devices: Device[];
    racks: Rack[];
    breadcrumbs?: Array<{ title: string; href: string }>;
    message?: string;
}

const categories = [
    { value: 'server', label: 'deviceManagement.categories.server' },
    { value: 'network', label: 'deviceManagement.categories.network' },
    { value: 'storage', label: 'deviceManagement.categories.storage' },
    { value: 'other', label: 'deviceManagement.categories.other' },
];

const statuses = [
    { value: 'online', label: 'deviceManagement.statuses.online' },
    { value: 'offline', label: 'deviceManagement.statuses.offline' },
    { value: 'maintenance', label: 'deviceManagement.statuses.maintenance' },
];

export default function DeviceIndex({ devices, racks, breadcrumbs = [], message }: Props) {
    const { t } = useTranslation();
    const { errors } = usePage().props as PageProps;
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [deletingDeviceId, setDeletingDeviceId] = useState<number | null>(null);
    const [viewingDevice, setViewingDevice] = useState<Device | null>(null);
    const [editingDevice, setEditingDevice] = useState<Device | null>(null);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [form, setForm] = useState({
        rack_id: '',
        name: '',
        category: 'server',
        model: '',
        manufacturer: '',
        serial_number: '',
        u_position: 1,
        power: 0,
        status: 'online',
        description: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const handleDelete = (deviceId: number) => {
        setDeletingDeviceId(deviceId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deletingDeviceId) {
            router.delete(`/devices/${deletingDeviceId}`, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingDeviceId(null);
                },
            });
        }
    };

    const cancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setDeletingDeviceId(null);
    };

    const openEditDialog = (device: Device) => {
        setEditingDevice(device);
        setForm({
            rack_id: device.rack_id ? device.rack_id.toString() : '',
            name: device.name,
            category: device.category,
            model: device.model || '',
            manufacturer: device.manufacturer || '',
            serial_number: device.serial_number || '',
            u_position: device.u_position,
            power: device.power,
            status: device.status,
            description: device.description || '',
        });
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingDevice(null);
        setForm({
            rack_id: '',
            name: '',
            category: 'server',
            model: '',
            manufacturer: '',
            serial_number: '',
            u_position: 1,
            power: 0,
            status: 'online',
            description: '',
        });
    };

    const openDetailDialog = (device: Device) => {
        setViewingDevice(device);
        setIsDetailDialogOpen(true);
    };

    const closeDetailDialog = () => {
        setIsDetailDialogOpen(false);
        setViewingDevice(null);
    };

    const openCreateDialog = () => {
        setForm({
            rack_id: '',
            name: '',
            category: 'server',
            model: '',
            manufacturer: '',
            serial_number: '',
            u_position: 1,
            power: 0,
            status: 'online',
            description: '',
        });
        setIsCreateDialogOpen(true);
    };

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setForm({
            rack_id: '',
            name: '',
            category: 'server',
            model: '',
            manufacturer: '',
            serial_number: '',
            u_position: 1,
            power: 0,
            status: 'online',
            description: '',
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDevice) {
            router.put(`/devices/${editingDevice.id}`, form, {
                onSuccess: () => closeEditDialog(),
            });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/devices', form, {
            onSuccess: () => closeCreateDialog(),
        });
    };

    const handleExport = () => {
        window.location.href = '/devices/export';
    };

    const handleImport = (e: React.FormEvent) => {
        e.preventDefault();
        if (importFile) {
            const formData = new FormData();
            formData.append('file', importFile);
            router.post('/devices/import', formData, {
                onSuccess: () => {
                    setIsImportDialogOpen(false);
                    setImportFile(null);
                },
            });
        }
    };

    const filteredDevices = useMemo(() => {
        return devices.filter((device) => {
            const matchesSearch =
                searchTerm === '' ||
                device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (device.model &&
                    device.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (device.manufacturer &&
                    device.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (device.serial_number &&
                    device.serial_number.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesCategory =
                categoryFilter === 'all' || device.category === categoryFilter;

            const matchesStatus =
                statusFilter === 'all' || device.status === statusFilter;

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [devices, searchTerm, categoryFilter, statusFilter]);

    const paginatedDevices = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredDevices.slice(startIndex, endIndex);
    }, [filteredDevices, currentPage]);

    const totalPages = Math.ceil(filteredDevices.length / itemsPerPage);

    const clearSearch = () => {
        setSearchTerm('');
    };

    const clearFilters = () => {
        setSearchTerm('');
        setCategoryFilter('all');
        setStatusFilter('all');
        setCurrentPage(1);
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'server':
                return <Server className="h-4 w-4" />;
            case 'network':
                return <Network className="h-4 w-4" />;
            case 'storage':
                return <HardDrive className="h-4 w-4" />;
            default:
                return <Cpu className="h-4 w-4" />;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'online':
                return <ShieldCheck className="h-4 w-4 text-green-500" />;
            case 'offline':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'maintenance':
                return <AlertCircle className="h-4 w-4 text-yellow-500" />;
            default:
                return <AlertCircle className="h-4 w-4" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'online':
                return (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {t('deviceManagement.statuses.online')}
                    </span>
                );
            case 'offline':
                return (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                        {t('deviceManagement.statuses.offline')}
                    </span>
                );
            case 'maintenance':
                return (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                        {t('deviceManagement.statuses.maintenance')}
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('deviceManagement.title')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('deviceManagement.title')}
                    </h1>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleExport}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            {t('deviceManagement.export')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsImportDialogOpen(true)}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            {t('deviceManagement.import')}
                        </Button>
                        <Button onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t('deviceManagement.addDevice')}
                        </Button>
                    </div>
                </div>

                {message && (
                    <div className="rounded-md bg-green-100 p-3 text-sm text-green-800">
                        {message}
                    </div>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={t('deviceManagement.searchPlaceholder')}
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

                    <div className="flex gap-2">
                        <Select
                            value={categoryFilter}
                            onValueChange={(value) => {
                                setCategoryFilter(value);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder={t('deviceManagement.allCategories')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('deviceManagement.allCategories')}
                                </SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {t(cat.label)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={statusFilter}
                            onValueChange={(value) => {
                                setStatusFilter(value);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder={t('deviceManagement.allStatuses')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('deviceManagement.allStatuses')}
                                </SelectItem>
                                {statuses.map((status) => (
                                    <SelectItem key={status.value} value={status.value}>
                                        {t(status.label)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                                <CardTitle>{t('deviceManagement.devices')}</CardTitle>
                                <CardDescription>
                                    {t('deviceManagement.manageDevices')}
                                </CardDescription>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('deviceManagement.devicesCount', {
                                    filtered: filteredDevices.length,
                                    total: devices.length,
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
                                            <Cpu className="h-4 w-4" />
                                            {t('deviceManagement.name')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.category')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.model')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.manufacturer')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.rack')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.uPosition')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.power')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.status')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.created')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4 text-right">
                                        {t('deviceManagement.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredDevices.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={10}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm ||
                                            categoryFilter !== 'all' ||
                                            statusFilter !== 'all' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'deviceManagement.noDevicesFound',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={clearFilters}
                                                    >
                                                        {t(
                                                            'deviceManagement.clearFilters',
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Plus className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'deviceManagement.noDevices',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={openCreateDialog}
                                                    >
                                                        {t(
                                                            'deviceManagement.addFirstDevice',
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedDevices.map((device) => (
                                        <TableRow
                                            key={device.id}
                                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                        >
                                            <TableCell className="px-4 py-3 font-medium">
                                                {device.name}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {getCategoryIcon(device.category)}
                                                    <span className="font-semibold">
                                                        {t(
                                                            `deviceManagement.categories.${device.category}`,
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {device.model || '-'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {device.manufacturer || '-'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {device.rack?.name || '-'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <span className="font-semibold">
                                                    {device.u_position}U
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <span className="font-semibold">
                                                    {device.power}W
                                                </span>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {getStatusBadge(device.status)}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {new Date(
                                                    device.created_at,
                                                ).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openDetailDialog(device)
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openEditDialog(device)
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDelete(device.id)
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
                                    {t('deviceManagement.devicesCount', {
                                        filtered: filteredDevices.length,
                                        total: devices.length,
                                    })}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((prev) =>
                                                Math.max(prev - 1, 1)
                                            )
                                        }
                                        disabled={currentPage === 1}
                                    >
                                        {t('deviceManagement.previousPage')}
                                    </Button>
                                    <span className="text-sm">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage((prev) =>
                                                Math.min(prev + 1, totalPages)
                                            )
                                        }
                                        disabled={currentPage === totalPages}
                                    >
                                        {t('deviceManagement.nextPage')}
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
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>
                                {t('deviceManagement.createDevice')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('deviceManagement.addNewDevice')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit}>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">
                                        {t('deviceManagement.name')} *
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
                                        placeholder={t('deviceManagement.name')}
                                    />
                                    {errors?.name && (
                                        <p className="text-sm text-destructive">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="category">
                                            {t('deviceManagement.category')} *
                                        </Label>
                                        <Select
                                            value={form.rack_id}
                                            onValueChange={(value) =>
                                                setForm({
                                                    ...form,
                                                    rack_id: value === 'none' ? '' : value,
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('deviceManagement.selectCategory')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((cat) => (
                                                    <SelectItem
                                                        key={cat.value}
                                                        value={cat.value}
                                                    >
                                                        {t(cat.label)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors?.category && (
                                            <p className="text-sm text-destructive">
                                                {errors.category}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="status">
                                            {t('deviceManagement.status')} *
                                        </Label>
                                        <Select
                                            value={form.status}
                                            onValueChange={(value) =>
                                                setForm({
                                                    ...form,
                                                    status: value,
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('deviceManagement.selectStatus')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statuses.map((status) => (
                                                    <SelectItem
                                                        key={status.value}
                                                        value={status.value}
                                                    >
                                                        {t(status.label)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors?.status && (
                                            <p className="text-sm text-destructive">
                                                {errors.status}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="model">
                                            {t('deviceManagement.model')}
                                        </Label>
                                        <Input
                                            id="model"
                                            value={form.model}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setForm({
                                                    ...form,
                                                    model: e.target.value,
                                                })
                                            }
                                            placeholder={t('deviceManagement.model')}
                                        />
                                        {errors?.model && (
                                            <p className="text-sm text-destructive">
                                                {errors.model}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="manufacturer">
                                            {t('deviceManagement.manufacturer')}
                                        </Label>
                                        <Input
                                            id="manufacturer"
                                            value={form.manufacturer}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setForm({
                                                    ...form,
                                                    manufacturer: e.target.value,
                                                })
                                            }
                                            placeholder={t('deviceManagement.manufacturer')}
                                        />
                                        {errors?.manufacturer && (
                                            <p className="text-sm text-destructive">
                                                {errors.manufacturer}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="serial_number">
                                            {t('deviceManagement.serialNumber')}
                                        </Label>
                                        <Input
                                            id="serial_number"
                                            value={form.serial_number}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setForm({
                                                    ...form,
                                                    serial_number: e.target.value,
                                                })
                                            }
                                            placeholder={t('deviceManagement.serialNumber')}
                                        />
                                        {errors?.serial_number && (
                                            <p className="text-sm text-destructive">
                                                {errors.serial_number}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="rack_id">
                                            {t('deviceManagement.rack')}
                                        </Label>
                                        <Select
                                            value={form.rack_id}
                                            onValueChange={(value) =>
                                                setForm({
                                                    ...form,
                                                    rack_id: value === 'none' ? '' : value,
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('deviceManagement.selectRack')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    {t('deviceManagement.noRack')}
                                                </SelectItem>
                                                {racks.map((rack) => (
                                                    <SelectItem
                                                        key={rack.id}
                                                        value={rack.id.toString()}
                                                    >
                                                        {rack.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors?.rack_id && (
                                            <p className="text-sm text-destructive">
                                                {errors.rack_id}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="u_position">
                                            {t('deviceManagement.uPosition')} *
                                        </Label>
                                        <Input
                                            id="u_position"
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={form.u_position}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setForm({
                                                    ...form,
                                                    u_position: parseInt(
                                                        e.target.value,
                                                    ) || 1,
                                                })
                                            }
                                            placeholder={t('deviceManagement.uPosition')}
                                        />
                                        {errors?.u_position && (
                                            <p className="text-sm text-destructive">
                                                {errors.u_position}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="power">
                                            {t('deviceManagement.power')} *
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
                                                    ) || 0,
                                                })
                                            }
                                            placeholder={t('deviceManagement.power')}
                                        />
                                        {errors?.power && (
                                            <p className="text-sm text-destructive">
                                                {errors.power}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">
                                        {t('deviceManagement.description')}
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
                                        placeholder={t('deviceManagement.description')}
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
                                    {t('deviceManagement.cancel')}
                                </Button>
                                <Button type="submit">
                                    {t('deviceManagement.createDevice')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                >
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>
                                {t('deviceManagement.editDevice')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('deviceManagement.updateDevice')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleEditSubmit}>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-name">
                                        {t('deviceManagement.name')} *
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
                                        placeholder={t('deviceManagement.name')}
                                    />
                                    {errors?.name && (
                                        <p className="text-sm text-destructive">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-category">
                                            {t('deviceManagement.category')} *
                                        </Label>
                                        <Select
                                            value={form.category}
                                            onValueChange={(value) =>
                                                setForm({
                                                    ...form,
                                                    category: value,
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('deviceManagement.selectCategory')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((cat) => (
                                                    <SelectItem
                                                        key={cat.value}
                                                        value={cat.value}
                                                    >
                                                        {t(cat.label)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors?.category && (
                                            <p className="text-sm text-destructive">
                                                {errors.category}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-status">
                                            {t('deviceManagement.status')} *
                                        </Label>
                                        <Select
                                            value={form.status}
                                            onValueChange={(value) =>
                                                setForm({
                                                    ...form,
                                                    status: value,
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('deviceManagement.selectStatus')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statuses.map((status) => (
                                                    <SelectItem
                                                        key={status.value}
                                                        value={status.value}
                                                    >
                                                        {t(status.label)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors?.status && (
                                            <p className="text-sm text-destructive">
                                                {errors.status}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-model">
                                            {t('deviceManagement.model')}
                                        </Label>
                                        <Input
                                            id="edit-model"
                                            value={form.model}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setForm({
                                                    ...form,
                                                    model: e.target.value,
                                                })
                                            }
                                            placeholder={t('deviceManagement.model')}
                                        />
                                        {errors?.model && (
                                            <p className="text-sm text-destructive">
                                                {errors.model}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-manufacturer">
                                            {t('deviceManagement.manufacturer')}
                                        </Label>
                                        <Input
                                            id="edit-manufacturer"
                                            value={form.manufacturer}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setForm({
                                                    ...form,
                                                    manufacturer: e.target.value,
                                                })
                                            }
                                            placeholder={t('deviceManagement.manufacturer')}
                                        />
                                        {errors?.manufacturer && (
                                            <p className="text-sm text-destructive">
                                                {errors.manufacturer}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-serial_number">
                                            {t('deviceManagement.serialNumber')}
                                        </Label>
                                        <Input
                                            id="edit-serial_number"
                                            value={form.serial_number}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setForm({
                                                    ...form,
                                                    serial_number: e.target.value,
                                                })
                                            }
                                            placeholder={t('deviceManagement.serialNumber')}
                                        />
                                        {errors?.serial_number && (
                                            <p className="text-sm text-destructive">
                                                {errors.serial_number}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-rack_id">
                                            {t('deviceManagement.rack')}
                                        </Label>
                                        <Select
                                            value={form.rack_id}
                                            onValueChange={(value) =>
                                                setForm({
                                                    ...form,
                                                    rack_id: value === 'none' ? '' : value,
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('deviceManagement.selectRack')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">
                                                    {t('deviceManagement.noRack')}
                                                </SelectItem>
                                                {racks.map((rack) => (
                                                    <SelectItem
                                                        key={rack.id}
                                                        value={rack.id.toString()}
                                                    >
                                                        {rack.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors?.rack_id && (
                                            <p className="text-sm text-destructive">
                                                {errors.rack_id}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-u_position">
                                            {t('deviceManagement.uPosition')} *
                                        </Label>
                                        <Input
                                            id="edit-u_position"
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={form.u_position}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                                setForm({
                                                    ...form,
                                                    u_position: parseInt(
                                                        e.target.value,
                                                    ) || 1,
                                                })
                                            }
                                            placeholder={t('deviceManagement.uPosition')}
                                        />
                                        {errors?.u_position && (
                                            <p className="text-sm text-destructive">
                                                {errors.u_position}
                                            </p>
                                        )}
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="edit-power">
                                            {t('deviceManagement.power')} *
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
                                                    ) || 0,
                                                })
                                            }
                                            placeholder={t('deviceManagement.power')}
                                        />
                                        {errors?.power && (
                                            <p className="text-sm text-destructive">
                                                {errors.power}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-description">
                                        {t('deviceManagement.description')}
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
                                        placeholder={t('deviceManagement.description')}
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
                                    {t('deviceManagement.cancel')}
                                </Button>
                                <Button type="submit">
                                    {t('deviceManagement.updateDevice')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isDetailDialogOpen}
                    onOpenChange={setIsDetailDialogOpen}
                >
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>
                                {t('deviceManagement.deviceDetails')}
                            </DialogTitle>
                            <DialogDescription>
                                {viewingDevice?.name}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.name')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice?.name}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.category')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice &&
                                            t(
                                                `deviceManagement.categories.${viewingDevice.category}`,
                                            )}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.model')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice?.model || '-'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.manufacturer')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice?.manufacturer || '-'}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.serialNumber')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice?.serial_number || '-'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.rack')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice?.rack?.name || '-'}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.uPosition')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice?.u_position}U
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.power')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice?.power}W
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.status')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice &&
                                            getStatusBadge(viewingDevice.status)}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-medium">
                                    {t('deviceManagement.description')}
                                </Label>
                                <div className="mt-1 text-sm">
                                    {viewingDevice?.description || '-'}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('deviceManagement.created')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice?.created_at
                                            ? new Date(
                                                  viewingDevice.created_at,
                                              ).toLocaleString()
                                            : '-'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('common.updated')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingDevice?.updated_at
                                            ? new Date(
                                                  viewingDevice.updated_at,
                                              ).toLocaleString()
                                            : '-'}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                onClick={closeDetailDialog}
                            >
                                {t('common.close')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isDeleteDialogOpen}
                    onOpenChange={setIsDeleteDialogOpen}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {t('deviceManagement.confirmDelete')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('deviceManagement.deleteWarning')}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={cancelDelete}
                            >
                                {t('deviceManagement.cancel')}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={confirmDelete}
                            >
                                {t('common.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog
                    open={isImportDialogOpen}
                    onOpenChange={setIsImportDialogOpen}
                >
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {t('deviceManagement.import')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('deviceManagement.importDescription')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleImport}>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="file">
                                        {t('deviceManagement.selectFile')} *
                                    </Label>
                                    <Input
                                        id="file"
                                        type="file"
                                        accept=".csv,.txt"
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setImportFile(file);
                                            }
                                        }}
                                    />
                                    {errors?.file && (
                                        <p className="text-sm text-destructive">
                                            {errors.file}
                                        </p>
                                    )}
                                </div>
                                <div className="rounded-md bg-muted p-3 text-sm">
                                    <p className="font-medium mb-2">
                                        {t('deviceManagement.importFormat')}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t('deviceManagement.importFormatDescription')}
                                    </p>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsImportDialogOpen(false)}
                                >
                                    {t('deviceManagement.cancel')}
                                </Button>
                                <Button type="submit" disabled={!importFile}>
                                    {t('deviceManagement.import')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
