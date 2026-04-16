import { Head, router, usePage } from '@inertiajs/react';
import {
    Pencil,
    Trash2,
    Plus,
    Search,
    X,
    Server,
    Eye,
    Cpu,
    ShieldCheck,
    AlertCircle,
    Link2,
    Monitor,
    Database,
    HardDrive,
    Network,
    ExternalLink,
    Wifi,
    Box,
    Layers,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
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
    flash?: {
        success?: string;
        error?: string;
        warning?: string;
        info?: string;
    };
}

interface Rack {
    id: number;
    name: string;
    u_count: number;
}

interface DeviceType {
    id: number;
    name: string;
    icon: string | null;
    color: string | null;
}

interface DeviceLibraryItem {
    id: number;
    device_type_id: number;
    name: string;
    model: string | null;
    manufacturer: string | null;
    u_height: number;
    power: number;
    device_type?: DeviceType;

    description?: string;
}

interface Device {
    id: number;
    rack_id: number | null;
    device_library_id: number | null;
    name: string;
    serial_number: string | null;
    u_position: number;
    connection_type: string | null;
    connection_port: number | null;
    ip_address: string | null;
    status: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    rack?: Rack;
    device_library?: DeviceLibraryItem;
}

interface Props {
    devices: Device[];
    racks: Rack[];
    deviceLibrary: DeviceLibraryItem[];
    deviceTypes: DeviceType[];
    breadcrumbs?: Array<{ title: string; href: string }>;
    message?: string;
}

const statuses = [
    { value: 'online', label: 'deviceManagement.statuses.online' },
    { value: 'offline', label: 'deviceManagement.statuses.offline' },
    { value: 'maintenance', label: 'deviceManagement.statuses.maintenance' },
];

const connectionTypes = [
    { value: 'ssh', label: 'SSH' },
    { value: 'rdp', label: 'RDP' },
    { value: 'vnc', label: 'VNC' },
    { value: 'radmin', label: 'Radmin' },
];

// 获取设备类型图标 - 与 /device-types 页面保持一致
const getDeviceTypeIcon = (iconName: string | null) => {
    switch (iconName) {
        case 'server': return <Server className="h-4 w-4" />;
        case 'cpu': return <Cpu className="h-4 w-4" />;
        case 'hard-drive': return <HardDrive className="h-4 w-4" />;
        case 'network': return <Network className="h-4 w-4" />;
        case 'monitor': return <Monitor className="h-4 w-4" />;
        case 'database': return <Database className="h-4 w-4" />;
        case 'wifi': return <Wifi className="h-4 w-4" />;
        case 'box': return <Box className="h-4 w-4" />;
        default: return <Server className="h-4 w-4" />;
    }
};

// 根据背景色计算对比度文字颜色
const getContrastTextColor = (backgroundColor: string): string => {
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#ffffff';
};

export default function DeviceIndex({ devices, racks, deviceLibrary, deviceTypes, breadcrumbs = [], message }: Props) {
    const { t } = useTranslation();
    const { errors, flash } = usePage().props as PageProps;
    const { showToast } = useToast();

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

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
    const [deletingDeviceId, setDeletingDeviceId] = useState<number | null>(null);
    const [viewingDevice, setViewingDevice] = useState<Device | null>(null);
    const [editingDevice, setEditingDevice] = useState<Device | null>(null);
    const [selectedDeviceType, setSelectedDeviceType] = useState<string>('');
    const [form, setForm] = useState({
        rack_id: undefined as string | undefined,
        device_library_id: undefined as string | undefined,
        name: '',
        u_position: 1,
        connection_type: '',
        connection_port: undefined as number | undefined,
        ip_address: '',
        status: 'online',
        description: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filteredDeviceLibraryByType = useMemo(() => {
        if (!selectedDeviceType) return [];
        return deviceLibrary.filter(item => item.device_type_id.toString() === selectedDeviceType);
    }, [deviceLibrary, selectedDeviceType]);

    const getDeviceTypeName = (deviceTypeId: number) => {
        const type = deviceTypes.find(t => t.id === deviceTypeId);
        return type ? type.name : '-';
    };

    const getDeviceTypeColor = (deviceTypeId: number) => {
        const type = deviceTypes.find(t => t.id === deviceTypeId);
        return type?.color || '#3b82f6';
    };

    // 计算对比度并返回合适的文字颜色
    const getContrastTextColor = (bgColor: string): string => {
        const hex = bgColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? '#000000' : '#ffffff';
    };

    const getDeviceLibraryInfo = (deviceLibraryId: number | null) => {
        if (!deviceLibraryId) return null;
        return deviceLibrary.find(item => item.id === deviceLibraryId);
    };

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

    const resetForm = () => ({
        rack_id: undefined as string | undefined,
        device_library_id: undefined as string | undefined,
        name: '',
        u_position: 1,
        connection_type: '',
        connection_port: undefined as number | undefined,
        ip_address: '',
        status: 'online',
        description: '',
    });

    const openEditDialog = (device: Device) => {
        setEditingDevice(device);
        setForm({
            rack_id: device.rack_id ? device.rack_id.toString() : undefined,
            device_library_id: device.device_library_id ? device.device_library_id.toString() : undefined,
            name: device.name,
            u_position: device.u_position,
            connection_type: device.connection_type || '',
            connection_port: device.connection_port || undefined,
            ip_address: device.ip_address || '',
            status: device.status,
            description: device.description || '',
        });
        const deviceLib = device.device_library;
        if (deviceLib) {
            setSelectedDeviceType(deviceLib.device_type_id.toString());
        }
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingDevice(null);
        setSelectedDeviceType('');
        setForm(resetForm());
    };

    const openDetailDialog = (device: Device) => {
        setViewingDevice(device);
        setIsDetailDialogOpen(true);
    };

    const closeDetailDialog = () => {
        setIsDetailDialogOpen(false);
        setViewingDevice(null);
    };

    // 处理设备连接
    const handleConnect = (device: Device) => {
        if (!device.ip_address) {
            alert(t('deviceManagement.noIpAddress'));
            return;
        }

        const protocol = device.connection_type || 'ssh';
        const ip = device.ip_address;
        const port = device.connection_port;

        let url = '';

        switch (protocol) {
            case 'ssh':
                // SSH 协议: ssh://ip:port
                url = port ? `ssh://${ip}:${port}` : `ssh://${ip}`;
                break;
            case 'rdp':
                // RDP 协议: rdp://ip:port
                url = port ? `rdp://${ip}:${port}` : `rdp://${ip}`;
                break;
            case 'vnc':
                // VNC 协议: vnc://ip:port
                url = port ? `vnc://${ip}:${port}` : `vnc://${ip}`;
                break;
            case 'radmin':
                // Radmin 协议: radmin://ip:port
                url = port ? `radmin://${ip}:${port}` : `radmin://${ip}`;
                break;
            default:
                // 默认使用 SSH
                url = port ? `ssh://${ip}:${port}` : `ssh://${ip}`;
        }

        // 打开连接
        window.open(url, '_blank');
    };

    const openCreateDialog = () => {
        setSelectedDeviceType('');
        setForm(resetForm());
        setIsCreateDialogOpen(true);
    };

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setSelectedDeviceType('');
        setForm(resetForm());
    };

    const handleDeviceLibraryChange = (value: string) => {
        const selectedLib = deviceLibrary.find(item => item.id.toString() === value);
        setForm({
            ...form,
            device_library_id: value,
            name: selectedLib ? selectedLib.name : form.name,
        });
    };

    const handleDeviceTypeChange = (value: string) => {
        setSelectedDeviceType(value);
        setForm(prev => ({
            ...prev,
            device_library_id: '',
        }));
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDevice) {
            router.put(`/devices/${editingDevice.id}`, {
                ...form,
                rack_id: form.rack_id ? parseInt(form.rack_id) : null,
                device_library_id: form.device_library_id ? parseInt(form.device_library_id) : null,
                u_position: parseInt(form.u_position as unknown as string) || 1,
            }, {
                onSuccess: () => closeEditDialog(),
                onError: (errors) => {
                    console.error('Update failed:', errors);
                },
            });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/devices', {
            ...form,
            rack_id: form.rack_id ? parseInt(form.rack_id) : null,
            device_library_id: form.device_library_id ? parseInt(form.device_library_id) : null,
            u_position: parseInt(form.u_position.toString()) || 1,
        }, {
            onSuccess: () => closeCreateDialog(),
            onError: (errors) => {
                console.error('Create failed:', errors);
            },
        });
    };



    const filteredDevices = useMemo(() => {
        return devices.filter((device) => {
            const matchesSearch =
                searchTerm === '' ||
                device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (device.serial_number &&
                    device.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (device.ip_address &&
                    device.ip_address.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus =
                statusFilter === 'all' || device.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [devices, searchTerm, statusFilter]);

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
        setStatusFilter('all');
        setCurrentPage(1);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'online':
                return <ShieldCheck className="h-4 w-4 text-green-500" />;
            case 'offline':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'maintenance':
                return <Cpu className="h-4 w-4 text-yellow-500" />;
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
                        <Button onClick={openCreateDialog} disabled={deviceTypes.length === 0 || deviceLibrary.length === 0}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t('deviceManagement.addDevice')}
                        </Button>
                    </div>
                </div>

                {message && (
                    <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
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

                {deviceTypes.length === 0 && (
                    <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
                        {t('deviceLibrary.pleaseCreateTypeFirst')}
                    </div>
                )}

                {deviceTypes.length > 0 && deviceLibrary.length === 0 && (
                    <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
                        {t('deviceLibrary.pleaseCreateDeviceFirst')}
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
                                            <Server className="h-4 w-4" />
                                            {t('deviceManagement.name')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Layers className="h-4 w-4" />
                                            设备类型
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.model')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.serialNumber')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4" />
                                            {t('deviceManagement.rack')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.uPosition')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.ipAddress')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('deviceManagement.status')}
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
                                            colSpan={9}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm || statusFilter !== 'all' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t('deviceManagement.noDevicesFound')}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={clearFilters}
                                                    >
                                                        {t('deviceManagement.clearFilters')}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Plus className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t('deviceManagement.noDevices')}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={openCreateDialog}
                                                    >
                                                        {t('deviceManagement.addFirstDevice')}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedDevices.map((device) => {
                                        const deviceLib = getDeviceLibraryInfo(device.device_library_id);
                                        return (
                                            <TableRow
                                                key={device.id}
                                                className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                            >
                                                <TableCell className="px-4 py-3 font-medium">
                                                    {device.name}
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    {deviceLib?.device_type ? (
                                                        (() => {
                                                            const bgColor = getDeviceTypeColor(deviceLib.device_type_id);
                                                            return (
                                                                <span
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                                                                    style={{
                                                                        backgroundColor: bgColor,
                                                                        color: getContrastTextColor(bgColor),
                                                                    }}
                                                                >
                                                                    {getDeviceTypeIcon(deviceLib.device_type.icon)}
                                                                    {getDeviceTypeName(deviceLib.device_type_id)}
                                                                </span>
                                                            );
                                                        })()
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-muted-foreground">
                                                    {deviceLib ? `${deviceLib.manufacturer || ''} ${deviceLib.model || ''}`.trim() || '-' : '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-muted-foreground">
                                                    {device.serial_number || '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    {device.rack ? device.rack.name : t('deviceManagement.noRack')}
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    {device.u_position}U
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-muted-foreground">
                                                    {device.ip_address || '-'}
                                                </TableCell>
                                                <TableCell className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {getStatusIcon(device.status)}
                                                        <span>{t(`deviceManagement.statuses.${device.status}`)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openDetailDialog(device)}
                                                            className="h-8 w-8 p-0"
                                                            title={t('deviceManagement.view')}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleConnect(device)}
                                                            disabled={!device.ip_address}
                                                            className="h-8 w-8 p-0"
                                                            title={device.ip_address ? t('deviceManagement.connect') : t('deviceManagement.noIpAddress')}
                                                        >
                                                            <Link2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openEditDialog(device)}
                                                            className="h-8 w-8 p-0"
                                                            title={t('deviceManagement.edit')}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(device.id)}
                                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                            title={t('deviceManagement.delete')}
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
                                    {t('deviceManagement.previousPage')}
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
                                    {t('deviceManagement.nextPage')}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('deviceManagement.newDevice')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceManagement.newDeviceDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="device_type" className="text-right">
                                    {t('deviceLibrary.type')} *
                                </Label>
                                <Select
                                    value={selectedDeviceType}
                                    onValueChange={handleDeviceTypeChange}
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
                                <Label htmlFor="device_library_id" className="text-right">
                                    {t('deviceLibrary.name')} *
                                </Label>
                                <Select
                                    value={form.device_library_id}
                                    onValueChange={handleDeviceLibraryChange}
                                    disabled={!selectedDeviceType}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceLibrary.selectType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredDeviceLibraryByType.map((lib) => (
                                            <SelectItem key={lib.id} value={lib.id.toString()}>
                                                {lib.name} ({lib.manufacturer} {lib.model})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="rack_id" className="text-right">
                                    {t('deviceManagement.rack')}
                                </Label>
                                <Select
                                    value={form.rack_id}
                                    onValueChange={(value) => setForm({ ...form, rack_id: value === 'none' ? undefined : value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceManagement.selectRack')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            {t('deviceManagement.noRack')}
                                        </SelectItem>
                                        {racks.map((rack) => (
                                            <SelectItem key={rack.id} value={rack.id.toString()}>
                                                {rack.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="u_position" className="text-right pt-2">
                                    {t('deviceManagement.uPosition')} *
                                </Label>
                                <div className="col-span-3 space-y-1">
                                    <Input
                                        id="u_position"
                                        type="number"
                                        min="1"
                                        max={(() => {
                                            const rack = form.rack_id ? racks.find(r => r.id.toString() === form.rack_id) : null;
                                            const deviceLib = form.device_library_id ? deviceLibrary.find(item => item.id.toString() === form.device_library_id) : null;
                                            const deviceUHeight = deviceLib?.u_height || 1;
                                            return rack ? rack.u_count - deviceUHeight + 1 : 42;
                                        })()}
                                        value={form.u_position}
                                        onChange={(e) => {
                                            const value = parseInt(e.target.value) || 1;
                                            const rack = form.rack_id ? racks.find(r => r.id.toString() === form.rack_id) : null;
                                            const deviceLib = form.device_library_id ? deviceLibrary.find(item => item.id.toString() === form.device_library_id) : null;
                                            const deviceUHeight = deviceLib?.u_height || 1;
                                            const maxU = rack ? rack.u_count - deviceUHeight + 1 : 42;
                                            setForm({ ...form, u_position: Math.min(value, maxU) });
                                        }}
                                        className={errors?.u_position ? 'border-destructive' : ''}
                                        required
                                    />
                                    {errors?.u_position && (
                                        <p className="text-sm text-destructive">{errors.u_position}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="ip_address" className="text-right">
                                    {t('deviceManagement.ipAddress')}
                                </Label>
                                <Input
                                    id="ip_address"
                                    value={form.ip_address}
                                    onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                                    className="col-span-3"
                                    placeholder="192.168.1.1"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="connection_type" className="text-right">
                                    {t('deviceManagement.connectionType')}
                                </Label>
                                <Select
                                    value={form.connection_type}
                                    onValueChange={(value) => setForm({ ...form, connection_type: value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="选择连接方式" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {connectionTypes.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="connection_port" className="text-right">
                                    {t('deviceManagement.connectionPort')}
                                </Label>
                                <Input
                                    id="connection_port"
                                    type="number"
                                    min="0"
                                    max="65535"
                                    value={form.connection_port || ''}
                                    onChange={(e) => {
                                        const value = e.target.value ? parseInt(e.target.value) : undefined;
                                        setForm({ ...form, connection_port: value });
                                    }}
                                    className="col-span-3"
                                    placeholder="0-65535"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="status" className="text-right">
                                    {t('deviceManagement.status')} *
                                </Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(value) => setForm({ ...form, status: value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceManagement.selectStatus')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statuses.map((status) => (
                                            <SelectItem key={status.value} value={status.value}>
                                                {t(status.label)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="description" className="text-right">
                                    {t('deviceManagement.description')}
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
                            <Button type="submit" disabled={!selectedDeviceType || !form.device_library_id}>
                                {t('common.create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('deviceManagement.editDevice')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceManagement.editDeviceDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-device_type" className="text-right">
                                    {t('deviceLibrary.type')} *
                                </Label>
                                <Select
                                    value={selectedDeviceType}
                                    onValueChange={handleDeviceTypeChange}
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
                                <Label htmlFor="edit-device_library_id" className="text-right">
                                    {t('deviceLibrary.name')} *
                                </Label>
                                <Select
                                    value={form.device_library_id}
                                    onValueChange={handleDeviceLibraryChange}
                                    disabled={!selectedDeviceType}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceLibrary.selectType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {filteredDeviceLibraryByType.map((lib) => (
                                            <SelectItem key={lib.id} value={lib.id.toString()}>
                                                {lib.name} ({lib.manufacturer} {lib.model})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-rack_id" className="text-right">
                                    {t('deviceManagement.rack')}
                                </Label>
                                <Select
                                    value={form.rack_id}
                                    onValueChange={(value) => setForm({ ...form, rack_id: value === 'none' ? undefined : value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceManagement.selectRack')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            {t('deviceManagement.noRack')}
                                        </SelectItem>
                                        {racks.map((rack) => (
                                            <SelectItem key={rack.id} value={rack.id.toString()}>
                                                {rack.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="edit-u_position" className="text-right pt-2">
                                    {t('deviceManagement.uPosition')} *
                                </Label>
                                <div className="col-span-3 space-y-1">
                                    <Input
                                        id="edit-u_position"
                                        type="number"
                                        min="1"
                                        max={(() => {
                                            const rack = form.rack_id ? racks.find(r => r.id.toString() === form.rack_id) : null;
                                            const deviceLib = form.device_library_id ? deviceLibrary.find(item => item.id.toString() === form.device_library_id) : null;
                                            const deviceUHeight = deviceLib?.u_height || editingDevice?.device_library?.u_height || 1;
                                            return rack ? rack.u_count - deviceUHeight + 1 : 42;
                                        })()}
                                        value={form.u_position}
                                        onChange={(e) => {
                                            const value = parseInt(e.target.value) || 1;
                                            const rack = form.rack_id ? racks.find(r => r.id.toString() === form.rack_id) : null;
                                            const deviceLib = form.device_library_id ? deviceLibrary.find(item => item.id.toString() === form.device_library_id) : null;
                                            const deviceUHeight = deviceLib?.u_height || editingDevice?.device_library?.u_height || 1;
                                            const maxU = rack ? rack.u_count - deviceUHeight + 1 : 42;
                                            setForm({ ...form, u_position: Math.min(value, maxU) });
                                        }}
                                        className={errors?.u_position ? 'border-destructive' : ''}
                                        required
                                    />
                                    {errors?.u_position && (
                                        <p className="text-sm text-destructive">{errors.u_position}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-ip_address" className="text-right">
                                    {t('deviceManagement.ipAddress')}
                                </Label>
                                <Input
                                    id="edit-ip_address"
                                    value={form.ip_address}
                                    onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                                    className="col-span-3"
                                    placeholder="192.168.1.1"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-connection_type" className="text-right">
                                    {t('deviceManagement.connectionType')}
                                </Label>
                                <Select
                                    value={form.connection_type}
                                    onValueChange={(value) => setForm({ ...form, connection_type: value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="选择连接方式" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {connectionTypes.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-connection_port" className="text-right">
                                    {t('deviceManagement.connectionPort')}
                                </Label>
                                <Input
                                    id="edit-connection_port"
                                    type="number"
                                    min="0"
                                    max="65535"
                                    value={form.connection_port || ''}
                                    onChange={(e) => {
                                        const value = e.target.value ? parseInt(e.target.value) : undefined;
                                        setForm({ ...form, connection_port: value });
                                    }}
                                    className="col-span-3"
                                    placeholder="0-65535"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-status" className="text-right">
                                    {t('deviceManagement.status')} *
                                </Label>
                                <Select
                                    value={form.status}
                                    onValueChange={(value) => setForm({ ...form, status: value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceManagement.selectStatus')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statuses.map((status) => (
                                            <SelectItem key={status.value} value={status.value}>
                                                {t(status.label)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-description" className="text-right">
                                    {t('deviceManagement.description')}
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
                            <Button type="submit" disabled={!selectedDeviceType || !form.device_library_id}>
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('deviceManagement.confirmDelete')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceManagement.deleteWarning')}
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
                        <DialogTitle>{t('deviceManagement.deviceDetails')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceManagement.deviceDetailsDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    {viewingDevice && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.name')}
                                </Label>
                                <span className="col-span-3">{viewingDevice.name}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.type')}
                                </Label>
                                <span className="col-span-3">
                                    {viewingDevice.device_library?.device_type
                                        ? (
                                            <span
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
                                                style={{
                                                    backgroundColor: getDeviceTypeColor(viewingDevice.device_library.device_type_id),
                                                    color: getContrastTextColor(getDeviceTypeColor(viewingDevice.device_library.device_type_id)),
                                                }}
                                            >
                                                {getDeviceTypeIcon(viewingDevice.device_library.device_type.icon)}
                                                {getDeviceTypeName(viewingDevice.device_library.device_type_id)}
                                            </span>
                                        )
                                        : '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.model')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingDevice.device_library?.model || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.manufacturer')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingDevice.device_library?.manufacturer || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.serialNumber')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingDevice.serial_number || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right font-medium pt-2">
                                    {t('deviceLibrary.description')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground whitespace-pre-wrap">
                                    {viewingDevice.device_library?.description || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.rack')}
                                </Label>
                                <span className="col-span-3">
                                    {viewingDevice.rack ? viewingDevice.rack.name : t('deviceManagement.noRack')}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.uPosition')}
                                </Label>
                                <span className="col-span-3">{viewingDevice.u_position}U</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.power')}
                                </Label>
                                <span className="col-span-3">
                                    {viewingDevice.device_library ? `${viewingDevice.device_library.power}W` : '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.ipAddress')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingDevice.ip_address || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.connectionType')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingDevice.connection_type || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.status')}
                                </Label>
                                <span className="col-span-3">
                                    {t(`deviceManagement.statuses.${viewingDevice.status}`)}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.description')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingDevice.description || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.created')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {new Date(viewingDevice.created_at).toLocaleString()}
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
