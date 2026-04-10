import { Head, router } from '@inertiajs/react';
import {
    Plus,
    Eye,
    Download,
    Upload,
    Network,
    Zap,
    Building2,
    HardDrive,
    Save,
    Server,
    Trash2,
    Layers,
    Monitor,
    Database,
    Cpu,
    Activity,
    Link2,
    Pencil,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/components/ui/toast';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';

interface Device {
    id: number;
    rack_id: number | null;
    name: string;
    category: string;
    model: string | null;
    manufacturer: string | null;
    serial_number: string | null;
    u_position: number | null;
    power: number;
    status: string;
    description: string | null;
    device_library_id: number | null;
    device_library?: DeviceLibraryItem;
    ip_address: string | null;
    connection_type: string | null;
    connection_port: number | null;
}

interface Rack {
    id: number;
    room_id: number;
    name: string;
    u_count: number;
    power: number;
    device_count: number;
    room?: Room;
    devices?: DeviceWithLibrary[];
}

interface DeviceWithLibrary extends Device {
    device_library_id: number | null;
    device_library?: DeviceLibraryItem;
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
    serial_number: string | null;
    u_height: number;
    power: number;
    description: string | null;
    device_type?: DeviceType;
}

interface Room {
    id: number;
    name: string;
}

interface RackType {
    id: number;
    name: string;
    u_count: number;
    power: number;
    description: string | null;
}

interface Props {
    racks: Rack[];
    rooms: Room[];
    rackTypes: RackType[];
    deviceLibrary: DeviceLibraryItem[];
    deviceTypes: DeviceType[];
    usedLibraryIds: number[];
    selectedRoom?: string;
    breadcrumbs?: Array<{ title: string; href: string }>;
}

interface RackSlot {
    deviceId: number | null;
    device?: Device | null;
    uHeight: number;
    isStart: boolean;
    uPosition: number;
    isOccupied: boolean; // 标记该U位是否被占用
    parentDeviceId?: number | null; // 如果该U位是被多U设备占用的，记录父设备ID
}

interface RackDisplay {
    id: number;
    name: string;
    room_id: number;
    totalU: number;
    slots: RackSlot[];
    maxPower: number;
    curPower: number;
}



export default function RackVisualEdit({ racks, rooms, rackTypes, deviceLibrary, deviceTypes, usedLibraryIds, selectedRoom: initialRoom, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [selectedRoom, setSelectedRoom] = useState<string>(initialRoom || 'all');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [previewMode, setPreviewMode] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [addRackModalOpen, setAddRackModalOpen] = useState(false);
    const [addDeviceModalOpen, setAddDeviceModalOpen] = useState(false);
    const [editDeviceLibraryModalOpen, setEditDeviceLibraryModalOpen] = useState(false);
    const [currentEditDevice, setCurrentEditDevice] = useState<{ rackId: number; uIndex: number; device: Device } | null>(null);
    const [editingDeviceLibraryItem, setEditingDeviceLibraryItem] = useState<DeviceLibraryItem | null>(null);

    // 导入/导出对话框状态
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<{
        version: string;
        exported_at: string | null;
        counts: {
            rooms: number;
            rack_types: number;
            racks: number;
            device_types: number;
            device_library: number;
            devices: number;
        };
    } | null>(null);
    const [importData, setImportData] = useState<Record<string, unknown> | null>(null);
    const [importOptions, setImportOptions] = useState({
        rooms: true,
        rack_types: true,
        racks: true,
        device_types: true,
        device_library: true,
        devices: true,
    });
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // 批量检测状态
    const [isPinging, setIsPinging] = useState(false);
    const [pingResults, setPingResults] = useState<{
        open: boolean;
        total: number;
        online: number;
        offline: number;
        maintenance: number;
        results: Array<{
            id: number;
            name: string;
            ip: string | null;
            status: string;
            is_online: boolean;
            rack_name?: string;
        }>;
    }>({
        open: false,
        total: 0,
        online: 0,
        offline: 0,
        maintenance: 0,
        results: [],
    });

    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<{
        open: boolean;
        x: number;
        y: number;
        device: Device | null;
    }>({
        open: false,
        x: 0,
        y: 0,
        device: null,
    });

    // 设备详情弹窗状态
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [viewingDevice, setViewingDevice] = useState<Device | null>(null);

    // 设备库右键菜单状态
    const [libraryContextMenu, setLibraryContextMenu] = useState<{
        open: boolean;
        x: number;
        y: number;
        item: DeviceLibraryItem | null;
    }>({
        open: false,
        x: 0,
        y: 0,
        item: null,
    });

    // 设备库详情弹窗状态
    const [libraryDetailDialogOpen, setLibraryDetailDialogOpen] = useState(false);
    const [viewingLibraryItem, setViewingLibraryItem] = useState<DeviceLibraryItem | null>(null);

    // 添加机柜表单状态 - 与 Rack/Index.tsx 保持一致
    const [rackForm, setRackForm] = useState({
        room_id: '',
        rack_type_id: '',
        name: '',
        u_count: 42,
        power: 0,
        device_count: 0,
        description: '',
    });

    // 创建设备库条目表单状态 - 与 DeviceLibrary/Index.tsx 保持一致
    const [deviceLibraryForm, setDeviceLibraryForm] = useState({
        device_type_id: '',
        name: '',
        model: '',
        manufacturer: '',
        serial_number: '',
        u_height: 1,
        power: 0,
        description: '',
    });

    // 编辑设备库条目表单状态 - 与 DeviceLibrary/Index.tsx 保持一致
    const [editDeviceLibraryForm, setEditDeviceLibraryForm] = useState({
        device_type_id: '',
        name: '',
        model: '',
        manufacturer: '',
        serial_number: '',
        u_height: 1,
        power: 0,
        description: '',
    });

    const [editForm, setEditForm] = useState({
        name: '',
        model: '',
        manufacturer: '',
        serial_number: '',
        power: 0,
        status: 'offline',
        ip_address: '',
        connection_type: '',
        connection_port: undefined as number | undefined,
        device_library_id: '',
        rack_id: '',
        u_position: 1,
        description: '',
    });
    const [selectedDeviceType, setSelectedDeviceType] = useState<string>('');
    const [addDeviceForm, setAddDeviceForm] = useState({
        device_library_id: undefined as string | undefined,
        name: '',
        u_position: 1,
        rack_id: undefined as string | undefined,
        ip_address: '',
        connection_type: '',
        status: 'offline' as string,
    });

    // 拖动状态
    const [draggingDevice, setDraggingDevice] = useState<{ device: Device | DeviceLibraryItem; type: 'existing' | 'library' } | null>(null);
    const [dragPreviewPosition, setDragPreviewPosition] = useState<{ rackId: number; uPosition: number; uHeight: number } | null>(null);
    const [isDraggingOverLibrary, setIsDraggingOverLibrary] = useState(false);

    // 调试：监听全局拖拽事件
    useEffect(() => {
        const handleGlobalDragOver = (e: DragEvent) => {
            // 检查是否拖到了机柜区域
            const target = e.target as HTMLElement;
            if (target.closest('[data-rack-slot="true"]')) {
                console.log('Global dragover on rack slot');
            }
        };

        const handleGlobalDrop = (e: DragEvent) => {
            console.log('Global drop event:', {
                target: e.target,
                dataTransfer: {
                    deviceType: e.dataTransfer?.getData('deviceType'),
                    deviceLibraryId: e.dataTransfer?.getData('deviceLibraryId'),
                }
            });
        };

        document.addEventListener('dragover', handleGlobalDragOver);
        document.addEventListener('drop', handleGlobalDrop);

        return () => {
            document.removeEventListener('dragover', handleGlobalDragOver);
            document.removeEventListener('drop', handleGlobalDrop);
        };
    }, []);

    const racksData: RackDisplay[] = useMemo(() => {
        return racks.map(rack => {
            const deviceSlots: { uPosition: number; uHeight: number; device: Device }[] = [];

            if (rack.devices) {
                rack.devices.forEach(device => {
                    const uHeight = device.device_library?.u_height || 1;
                    const uPosition = device.u_position;

                    if (uPosition && uPosition > 0 && uPosition <= rack.u_count) {
                        deviceSlots.push({ uPosition, uHeight, device });
                    }
                });
            }

            const occupiedPositions = new Set<number>();
            deviceSlots.forEach(ds => {
                for (let i = 0; i < ds.uHeight; i++) {
                    occupiedPositions.add(ds.uPosition + i);
                }
            });

            const finalSlots: RackSlot[] = [];
            const sortedDevices = deviceSlots.sort((a, b) => a.uPosition - b.uPosition);

            for (let u = 1; u <= rack.u_count; u++) {
                const currentDevice = sortedDevices.find(d => d.uPosition === u);

                if (currentDevice) {
                    // 设备起始位置
                    finalSlots.push({
                        deviceId: currentDevice.device.id,
                        device: currentDevice.device,
                        uHeight: currentDevice.uHeight,
                        isStart: true,
                        uPosition: u,
                        isOccupied: true,
                        parentDeviceId: null,
                    });
                } else if (occupiedPositions.has(u)) {
                    // 被多U设备占用的位置（非起始位置）
                    const parentDevice = sortedDevices.find(d => u >= d.uPosition && u < d.uPosition + d.uHeight);
                    finalSlots.push({
                        deviceId: null,
                        device: null,
                        uHeight: 1,
                        isStart: false,
                        uPosition: u,
                        isOccupied: true,
                        parentDeviceId: parentDevice?.device.id || null,
                    });
                } else {
                    // 空U位
                    finalSlots.push({
                        deviceId: null,
                        device: null,
                        uHeight: 1,
                        isStart: false,
                        uPosition: u,
                        isOccupied: false,
                        parentDeviceId: null,
                    });
                }
            }

            return {
                id: rack.id,
                name: rack.name,
                room_id: rack.room_id,
                totalU: rack.u_count,
                slots: finalSlots,
                maxPower: rack.power || 5000,
                curPower: rack.devices?.reduce((sum, d) => sum + (d.power || 0), 0) || 0,
            };
        });
    }, [racks]);

    const libraryDevices = useMemo(() => {
        return deviceLibrary;
    }, [deviceLibrary]);

    const filteredDevices = useMemo(() => {
        const usedIdsSet = new Set(usedLibraryIds);
        const availableDevices = libraryDevices.filter(d => !usedIdsSet.has(d.id));

        if (activeCategory === 'all') {
            return availableDevices;
        }
        return availableDevices.filter(d => d.device_type_id.toString() === activeCategory);
    }, [libraryDevices, activeCategory, usedLibraryIds]);

    const filteredDeviceLibraryByType = useMemo(() => {
        if (!selectedDeviceType) return [];
        return deviceLibrary.filter(item => item.device_type_id.toString() === selectedDeviceType);
    }, [deviceLibrary, selectedDeviceType]);

    const handleDeviceLibraryChange = (value: string) => {
        const selectedLib = deviceLibrary.find(item => item.id.toString() === value);
        setAddDeviceForm({
            ...addDeviceForm,
            device_library_id: value,
            name: selectedLib ? selectedLib.name : addDeviceForm.name,
        });
    };

    const handleDeviceTypeChange = (value: string) => {
        setSelectedDeviceType(value);
        setAddDeviceForm(prev => ({
            ...prev,
            device_library_id: undefined,
        }));
    };

    const handleAddDevice = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/devices', {
            ...addDeviceForm,
            rack_id: addDeviceForm.rack_id ? parseInt(addDeviceForm.rack_id) : null,
            device_library_id: addDeviceForm.device_library_id ? parseInt(addDeviceForm.device_library_id) : null,
            u_position: parseInt(addDeviceForm.u_position.toString()) || 1,
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setAddDeviceModalOpen(false);
                setAddDeviceForm({
                    device_library_id: undefined,
                    name: '',
                    u_position: 1,
                    rack_id: undefined,
                    ip_address: '',
                    connection_type: '',
                    status: 'offline',
                });
                setSelectedDeviceType('');
                router.reload({ only: ['racks', 'devices'] });
            }
        });
    };

    // 打开创建设备库条目对话框 - 与 DeviceLibrary/Index.tsx 保持一致
    const openCreateDeviceLibraryDialog = () => {
        setDeviceLibraryForm({
            device_type_id: deviceTypes.length > 0 ? deviceTypes[0].id.toString() : '',
            name: '',
            model: '',
            manufacturer: '',
            serial_number: '',
            u_height: 1,
            power: 0,
            description: '',
        });
        setAddDeviceModalOpen(true);
    };

    // 关闭创建设备库条目对话框
    const closeCreateDeviceLibraryDialog = () => {
        setAddDeviceModalOpen(false);
        setDeviceLibraryForm({
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

    // 创建设备库条目提交 - 与 DeviceLibrary/Index.tsx 保持一致
    const handleCreateDeviceLibrarySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/device-library', {
            ...deviceLibraryForm,
            device_type_id: parseInt(deviceLibraryForm.device_type_id),
            u_height: parseInt(deviceLibraryForm.u_height as unknown as string),
            power: parseInt(deviceLibraryForm.power as unknown as string),
        }, {
            onSuccess: () => {
                closeCreateDeviceLibraryDialog();
                router.reload({ only: ['deviceLibrary'] });
            }
        });
    };

    // 打开编辑设备库条目对话框 - 与 DeviceLibrary/Index.tsx 保持一致
    const openEditDeviceLibraryDialog = (item: DeviceLibraryItem) => {
        setEditingDeviceLibraryItem(item);
        setEditDeviceLibraryForm({
            device_type_id: item.device_type_id.toString(),
            name: item.name,
            model: item.model || '',
            manufacturer: item.manufacturer || '',
            serial_number: item.serial_number || '',
            u_height: item.u_height,
            power: item.power,
            description: item.description || '',
        });
        setEditDeviceLibraryModalOpen(true);
    };

    // 关闭编辑设备库条目对话框
    const closeEditDeviceLibraryDialog = () => {
        setEditDeviceLibraryModalOpen(false);
        setEditingDeviceLibraryItem(null);
        setEditDeviceLibraryForm({
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

    // 处理设备库右键菜单
    const handleLibraryContextMenu = (e: React.MouseEvent, item: DeviceLibraryItem) => {
        e.preventDefault();
        e.stopPropagation();
        setLibraryContextMenu({
            open: true,
            x: e.clientX,
            y: e.clientY,
            item,
        });
    };

    // 关闭设备库右键菜单
    const closeLibraryContextMenu = () => {
        setLibraryContextMenu({ ...libraryContextMenu, open: false });
    };

    // 打开设备库详情弹窗
    const openLibraryDetailDialog = (item: DeviceLibraryItem) => {
        setViewingLibraryItem(item);
        setLibraryDetailDialogOpen(true);
        setLibraryContextMenu({ ...libraryContextMenu, open: false });
    };

    // 关闭设备库详情弹窗
    const closeLibraryDetailDialog = () => {
        setLibraryDetailDialogOpen(false);
        setViewingLibraryItem(null);
    };

    // 删除设备库条目
    const handleDeleteLibraryItem = (item: DeviceLibraryItem) => {
        router.delete(`/device-library/${item.id}`, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                showToast(t('deviceLibrary.deleted'), 'success');
                router.reload({ only: ['deviceLibrary'] });
            },
        });
        setLibraryContextMenu({ ...libraryContextMenu, open: false });
    };

    // 编辑设备库条目提交 - 与 DeviceLibrary/Index.tsx 保持一致
    const handleEditDeviceLibrarySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingDeviceLibraryItem) {
            router.put(`/device-library/${editingDeviceLibraryItem.id}`, {
                ...editDeviceLibraryForm,
                device_type_id: parseInt(editDeviceLibraryForm.device_type_id),
                u_height: parseInt(editDeviceLibraryForm.u_height as unknown as string),
                power: parseInt(editDeviceLibraryForm.power as unknown as string),
            }, {
                onSuccess: () => {
                    closeEditDeviceLibraryDialog();
                    router.reload({ only: ['deviceLibrary'] });
                }
            });
        }
    };

    // 导出数据
    const handleExport = async () => {
        setIsExporting(true);
        try {
            const response = await fetch('/data/export');
            if (!response.ok) throw new Error('导出失败');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rackroom_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showToast(t('visualEdit.exportSuccess'), 'success');
        } catch (error) {
            showToast(t('visualEdit.exportFailed'), 'error');
        } finally {
            setIsExporting(false);
            setExportDialogOpen(false);
        }
    };

    // 处理导入文件选择
    const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportFile(file);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch('/data/import-preview', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                const error = await response.json();
                showToast(error.error || t('visualEdit.importPreviewFailed'), 'error');
                return;
            }

            const result = await response.json();
            if (result.success) {
                setImportPreview(result.preview);
                setImportData(result.data);
                // 默认全选
                setImportOptions({
                    rooms: true,
                    rack_types: true,
                    racks: true,
                    device_types: true,
                    device_library: true,
                    devices: true,
                });
            }
        } catch (error) {
            showToast(t('visualEdit.importPreviewFailed'), 'error');
        }
    };

    // 处理导入选项的级联选择
    const handleImportOptionChange = (key: keyof typeof importOptions, checked: boolean) => {
        const newOptions = { ...importOptions, [key]: checked };

        // 级联逻辑：如果取消选择某一项，则取消选择所有依赖它的项
        if (!checked) {
            if (key === 'rooms') {
                newOptions.racks = false;
            }
            if (key === 'rack_types') {
                newOptions.racks = false;
            }
            if (key === 'racks') {
                newOptions.devices = false;
            }
            if (key === 'device_types') {
                newOptions.device_library = false;
            }
            if (key === 'device_library') {
                newOptions.devices = false;
            }
        }

        // 级联逻辑：如果要选择某一项，必须先选择它的依赖项
        if (checked) {
            if (key === 'racks') {
                newOptions.rooms = true;
                newOptions.rack_types = true;
            }
            if (key === 'devices') {
                newOptions.racks = true;
                newOptions.device_library = true;
            }
            if (key === 'device_library') {
                newOptions.device_types = true;
            }
        }

        setImportOptions(newOptions);
    };

    // 提交导入
    const handleImportSubmit = async () => {
        if (!importData) return;

        setIsImporting(true);
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch('/data/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    data: importData,
                    options: importOptions,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '导入失败');
            }

            const result = await response.json();
            showToast(
                t('visualEdit.importSuccess', {
                    rooms: result.stats.rooms,
                    racks: result.stats.racks,
                    devices: result.stats.devices,
                }),
                'success'
            );

            // 重置状态并刷新页面
            setImportDialogOpen(false);
            setImportFile(null);
            setImportPreview(null);
            setImportData(null);
            router.reload();
        } catch (error) {
            showToast(error instanceof Error ? error.message : t('visualEdit.importFailed'), 'error');
        } finally {
            setIsImporting(false);
        }
    };

    // 关闭导入对话框
    const closeImportDialog = () => {
        setImportDialogOpen(false);
        setImportFile(null);
        setImportPreview(null);
        setImportData(null);
        setImportOptions({
            rooms: true,
            rack_types: true,
            racks: true,
            device_types: true,
            device_library: true,
            devices: true,
        });
    };

    // 批量 Ping 检测
    const handleBatchPing = async () => {
        setIsPinging(true);
        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch('/ping/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': token,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    rack_id: selectedRoom !== 'all' ? null : null,
                }),
            });

            if (!response.ok) {
                throw new Error('检测失败');
            }

            const result = await response.json();
            setPingResults({
                open: true,
                total: result.total,
                online: result.online,
                offline: result.offline,
                maintenance: result.maintenance,
                results: result.results,
            });
            showToast(result.message, 'success');

            // 刷新页面以更新状态显示
            router.reload({ only: ['racks'] });
        } catch (error) {
            showToast(t('visualEdit.pingFailed'), 'error');
        } finally {
            setIsPinging(false);
        }
    };

    const handleRoomChange = (roomId: string) => {
        setSelectedRoom(roomId);
        if (roomId && roomId !== 'all') {
            router.get('/racks/visual-edit', { room_id: roomId }, { replace: true });
        } else {
            router.get('/racks/visual-edit', {}, { replace: true });
        }
    };

    const handleDragStart = (e: React.DragEvent, device: Device) => {
        e.dataTransfer.setData('deviceId', device.id.toString());
        e.dataTransfer.setData('deviceType', 'existing');
        e.dataTransfer.setData('deviceName', device.name);
        e.dataTransfer.setData('deviceStatus', device.status);
        e.dataTransfer.effectAllowed = 'move';
        setDraggingDevice({ device, type: 'existing' });
    };

    const handleLibraryDragStart = (e: React.DragEvent, libraryItem: DeviceLibraryItem) => {
        // 设置拖拽数据 - 使用多种方式确保数据能被正确读取
        const deviceLibraryId = libraryItem.id.toString();
        const uHeight = (libraryItem.u_height || 1).toString();

        e.dataTransfer.setData('deviceLibraryId', deviceLibraryId);
        e.dataTransfer.setData('deviceType', 'library');
        e.dataTransfer.setData('uHeight', uHeight);
        e.dataTransfer.setData('text/plain', `library:${deviceLibraryId}:${uHeight}`); // 备用数据格式

        e.dataTransfer.effectAllowed = 'copy';

        console.log('Library drag start:', {
            deviceLibraryId,
            uHeight,
            name: libraryItem.name,
        });

        setDraggingDevice({ device: libraryItem, type: 'library' });
    };

    const handleDragEnd = () => {
        setDraggingDevice(null);
        setDragPreviewPosition(null);
        setIsDraggingOverLibrary(false);
    };

    const handleDrop = (e: React.DragEvent, rackId: number, uPosition: number) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('Drop event triggered:', { rackId, uPosition });

        // 尝试多种方式读取拖拽数据
        let deviceType = e.dataTransfer.getData('deviceType');
        let deviceLibraryIdStr = e.dataTransfer.getData('deviceLibraryId');
        let deviceIdStr = e.dataTransfer.getData('deviceId');
        let uHeightStr = e.dataTransfer.getData('uHeight');

        // 如果直接读取失败，尝试从备用格式解析
        if (!deviceType && !deviceLibraryIdStr && !deviceIdStr) {
            const plainText = e.dataTransfer.getData('text/plain');
            console.log('Trying plain text format:', plainText);
            if (plainText && plainText.startsWith('library:')) {
                const parts = plainText.split(':');
                if (parts.length >= 3) {
                    deviceType = 'library';
                    deviceLibraryIdStr = parts[1];
                    uHeightStr = parts[2];
                }
            }
        }

        console.log('Drop data received:', {
            deviceType,
            deviceLibraryId: deviceLibraryIdStr,
            deviceId: deviceIdStr,
            uHeight: uHeightStr,
        });

        if (!deviceType) {
            console.error('No device type found in drag data');
            setDraggingDevice(null);
            setDragPreviewPosition(null);
            return;
        }

        const targetRack = racksData.find(r => r.id === rackId);
        if (!targetRack) {
            console.error('Target rack not found:', rackId);
            setDraggingDevice(null);
            setDragPreviewPosition(null);
            return;
        }

        // 获取正在拖动的设备ID
        const draggingDeviceId = deviceType === 'existing' && deviceIdStr
            ? parseInt(deviceIdStr)
            : null;

        // 获取设备高度
        let uHeight = 1;
        let libraryItem: DeviceLibraryItem | undefined;

        if (deviceType === 'library') {
            if (!deviceLibraryIdStr) {
                console.error('No device library ID provided');
                setDraggingDevice(null);
                setDragPreviewPosition(null);
                return;
            }

            const deviceLibraryId = parseInt(deviceLibraryIdStr);
            if (isNaN(deviceLibraryId)) {
                console.error('Invalid device library ID:', deviceLibraryIdStr);
                setDraggingDevice(null);
                setDragPreviewPosition(null);
                return;
            }

            libraryItem = deviceLibrary.find(item => item.id === deviceLibraryId);
            if (!libraryItem) {
                console.error('Device library item not found:', deviceLibraryId);
                setDraggingDevice(null);
                setDragPreviewPosition(null);
                return;
            }

            // 优先从dataTransfer获取u_height，否则从libraryItem获取
            uHeight = uHeightStr ? parseInt(uHeightStr) : (libraryItem.u_height || 1);
            console.log('Library item found:', { name: libraryItem.name, uHeight });
        } else if (deviceType === 'existing' && draggingDeviceId) {
            // 现有设备：查找设备并获取高度
            const device = racks.flatMap(r => r.devices || []).find(d => d.id === draggingDeviceId);
            uHeight = device?.device_library?.u_height || 1;
            console.log('Existing device found:', { id: draggingDeviceId, uHeight });
        }

        // U位是从下到上编号的，设备放在uPosition时，向上占据uHeight个U位
        const maxRequiredU = uPosition + uHeight - 1;
        if (maxRequiredU > targetRack.totalU) {
            showToast(
                t('visualEdit.toast.insufficientSpace', {
                    need: uHeight,
                    available: targetRack.totalU - uPosition + 1,
                    position: uPosition,
                }),
                'warning'
            );
            setDraggingDevice(null);
            setDragPreviewPosition(null);
            return;
        }

        // 检查从uPosition向上uHeight个U位是否都被占用
        for (let i = 0; i < uHeight; i++) {
            const checkU = uPosition + i;
            if (checkU > targetRack.totalU) {
                showToast(
                    t('visualEdit.toast.exceedsBoundary', { position: checkU }),
                    'warning'
                );
                setDraggingDevice(null);
                setDragPreviewPosition(null);
                return;
            }

            const checkSlot = targetRack.slots.find(s => s.uPosition === checkU);
            if (checkSlot && checkSlot.isOccupied) {
                // 如果是同一个设备（包括被占用的U位属于该设备），允许放置
                const slotDeviceId = checkSlot.deviceId || checkSlot.parentDeviceId;
                if (deviceType === 'existing' && slotDeviceId === draggingDeviceId) {
                    continue;
                }
                // 否则不允许放置
                showToast(t('visualEdit.toast.positionOccupied'), 'warning');
                setDraggingDevice(null);
                setDragPreviewPosition(null);
                return;
            }
        }

        if (deviceType === 'library') {
            // 重新解析设备库ID（确保使用最新值）
            const deviceLibraryId = parseInt(deviceLibraryIdStr!);

            // 从设备库创建设备时，使用设备库的名称+型号作为设备名称
            const deviceName = libraryItem!.model
                ? `${libraryItem!.name} (${libraryItem!.model})`
                : libraryItem!.name;

            const postData = {
                name: deviceName,
                device_library_id: deviceLibraryId,
                rack_id: rackId,
                u_position: uPosition,
                model: libraryItem!.model,
                manufacturer: libraryItem!.manufacturer,
                status: 'maintenance',
            };

            console.log('Sending POST request to /devices with data:', postData);

            router.post('/devices', postData, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    console.log('Device created successfully');
                    showToast(t('visualEdit.toast.deviceAdded'), 'success');
                    router.reload({ only: ['racks', 'devices'] });
                },
                onError: (errors) => {
                    console.error('Failed to create device:', errors);
                    showToast('Failed to create device: ' + JSON.stringify(errors), 'error');
                }
            });
        } else if (deviceType === 'existing' && draggingDeviceId) {
            const deviceName = e.dataTransfer.getData('deviceName');
            const deviceStatus = e.dataTransfer.getData('deviceStatus');

            console.log('Sending PUT request to update device:', { deviceId: draggingDeviceId, rackId, uPosition });

            router.put(`/devices/${draggingDeviceId}`, {
                rack_id: rackId,
                u_position: uPosition,
                name: deviceName,
                status: deviceStatus,
            }, {
                preserveState: false,
                preserveScroll: true,
                onSuccess: () => {
                    console.log('Device updated successfully');
                    showToast(t('visualEdit.toast.deviceUpdated'), 'success');
                    router.reload({ only: ['racks', 'devices'] });
                },
                onError: (errors) => {
                    console.error('Failed to update device:', errors);
                    showToast('Failed to update device: ' + JSON.stringify(errors), 'error');
                }
            });
        }

        // 清除拖拽状态
        setDraggingDevice(null);
        setDragPreviewPosition(null);
    };

    const handleLibraryDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const deviceType = draggingDevice?.type;

        console.log('Library drop - deviceType:', deviceType);

        if (deviceType === 'existing') {
            const deviceId = parseInt(e.dataTransfer.getData('deviceId'));
            if (isNaN(deviceId)) {
                console.error('Invalid device ID');
                setDraggingDevice(null);
                setDragPreviewPosition(null);
                setIsDraggingOverLibrary(false);
                return;
            }

            const deviceName = e.dataTransfer.getData('deviceName');

            console.log('Deleting device via library drop:', { deviceId, deviceName });

            // 直接删除设备记录
            router.delete(`/devices/${deviceId}`, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    console.log('Device deleted successfully');
                    showToast(t('visualEdit.toast.deviceDeleted'), 'success');
                    router.reload({ only: ['racks', 'devices'] });
                },
                onError: (errors) => {
                    console.error('Failed to delete device:', errors);
                    showToast('Failed to delete device: ' + JSON.stringify(errors), 'error');
                }
            });
        }

        // 清除拖拽状态
        setDraggingDevice(null);
        setDragPreviewPosition(null);
        setIsDraggingOverLibrary(false);
    };

    const handleLibraryDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 根据拖拽类型设置效果：现有设备可以移回设备库（move），库设备不能拖回自己
        if (draggingDevice?.type === 'existing') {
            e.dataTransfer.dropEffect = 'move';
            setIsDraggingOverLibrary(true);
        } else {
            e.dataTransfer.dropEffect = 'none';
            setIsDraggingOverLibrary(false);
        }
    };

    const handleLibraryDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDraggingOverLibrary(false);
    };

    const handleDragOver = (e: React.DragEvent, rackId: number, uPosition: number) => {
        e.preventDefault();
        e.stopPropagation();

        // 根据拖拽类型设置正确的 dropEffect
        if (draggingDevice) {
            e.dataTransfer.dropEffect = draggingDevice.type === 'library' ? 'copy' : 'move';
        } else {
            e.dataTransfer.dropEffect = 'copy';
        }

        // 调试日志 - 只在每10次调用时打印一次避免刷屏
        if (Math.random() < 0.05) {
            console.log('DragOver triggered:', { rackId, uPosition, draggingDevice });
        }

        const targetRack = racksData.find(r => r.id === rackId);
        if (!targetRack) return;

        // 使用 draggingDevice state 获取设备高度（dragover事件无法读取dataTransfer）
        let uHeight = 1;
        if (draggingDevice) {
            if (draggingDevice.type === 'library' && 'u_height' in draggingDevice.device) {
                uHeight = draggingDevice.device.u_height || 1;
            } else if (draggingDevice.type === 'existing' && 'device_library' in draggingDevice.device) {
                uHeight = draggingDevice.device.device_library?.u_height || 1;
            }
        }

        // U位是从下到上编号的，设备放在uPosition时，向上占据uHeight个U位
        // 检查设备是否能完整放入机柜
        const maxRequiredU = uPosition + uHeight - 1;
        if (maxRequiredU > targetRack.totalU) {
            // 无法放入，显示红色预览
            setDragPreviewPosition({
                rackId,
                uPosition,
                uHeight,
            });
            return;
        }

        // 更新预览位置
        setDragPreviewPosition({
            rackId,
            uPosition,
            uHeight,
        });
    };

    const openEditModal = (rackId: number, uIndex: number, device: Device) => {
        setCurrentEditDevice({ rackId, uIndex, device });
        // 设置设备类型
        const deviceTypeId = device.device_library?.device_type_id?.toString() || '';
        setSelectedDeviceType(deviceTypeId);
        setEditForm({
            name: device.name,
            model: device.model || '',
            manufacturer: device.manufacturer || '',
            serial_number: device.serial_number || '',
            power: device.power,
            status: device.status,
            ip_address: device.ip_address || '',
            connection_type: device.connection_type || '',
            connection_port: device.connection_port || undefined,
            device_library_id: device.device_library_id?.toString() || '',
            rack_id: device.rack_id?.toString() || '',
            u_position: device.u_position || 1,
            description: device.description || '',
        });
        setEditModalOpen(true);
    };

    const handleEditDeviceTypeChange = (value: string) => {
        setSelectedDeviceType(value);
        setEditForm({ ...editForm, device_library_id: '' });
    };

    const handleEditDeviceLibraryChange = (value: string) => {
        const selectedLib = deviceLibrary.find(item => item.id.toString() === value);
        if (selectedLib) {
            setEditForm({
                ...editForm,
                device_library_id: value,
                name: selectedLib.name,
                model: selectedLib.model || '',
                manufacturer: selectedLib.manufacturer || '',
            });
        }
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentEditDevice) return;

        const submitData = {
            ...editForm,
            rack_id: editForm.rack_id ? parseInt(editForm.rack_id) : null,
            device_library_id: editForm.device_library_id ? parseInt(editForm.device_library_id) : null,
        };

        router.put(`/devices/${currentEditDevice.device.id}`, submitData, {
            preserveState: false,
            preserveScroll: true,
            onSuccess: () => {
                setEditModalOpen(false);
                setSelectedDeviceType('');
                showToast(t('visualEdit.toast.deviceUpdated'), 'success');
                router.reload({ only: ['racks', 'devices'] });
            },
            onError: (errors) => {
                console.error('Failed to update device:', errors);
                showToast(t('visualEdit.toast.deviceUpdateFailed') + ': ' + JSON.stringify(errors), 'error');
            }
        });
    };

    const removeDeviceFromRack = () => {
        if (!currentEditDevice) return;

        console.log('Deleting device:', currentEditDevice.device.id);

        // 直接删除设备记录
        router.delete(`/devices/${currentEditDevice.device.id}`, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                console.log('Device deleted successfully');
                setEditModalOpen(false);
                setCurrentEditDevice(null);
                showToast(t('visualEdit.toast.deviceDeleted'), 'success');
                router.reload({ only: ['racks', 'devices'] });
            },
            onError: (errors) => {
                console.error('Failed to delete device:', errors);
                showToast('Failed to delete: ' + JSON.stringify(errors), 'error');
            }
        });
    };

    // 处理机柜类型变化 - 自动填充 U数和功率
    const handleRackTypeChange = (value: string) => {
        const selectedType = rackTypes.find(t => t.id.toString() === value);
        setRackForm({
            ...rackForm,
            rack_type_id: value,
            u_count: selectedType ? selectedType.u_count : 42,
            power: selectedType ? selectedType.power : 0,
        });
    };

    // 重置添加机柜表单
    const resetRackForm = () => {
        setRackForm({
            room_id: '',
            rack_type_id: '',
            name: '',
            u_count: 42,
            power: 0,
            device_count: 0,
            description: '',
        });
    };

    // 处理添加机柜提交 - 与 Rack/Index.tsx 保持一致
    const handleAddRackSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const submitData = {
            room_id: rackForm.room_id,
            rack_type_id: rackForm.rack_type_id === 'none' ? null : (rackForm.rack_type_id || null),
            name: rackForm.name,
            device_count: rackForm.device_count,
            description: rackForm.description,
        };
        router.post('/racks', submitData, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setAddRackModalOpen(false);
                resetRackForm();
                showToast(t('visualEdit.toast.rackAdded'), 'success');
                router.reload({ only: ['racks'] });
            },
            onError: (errors) => {
                showToast(t('visualEdit.toast.rackAddFailed') + ': ' + JSON.stringify(errors), 'error');
            }
        });
    };

    const handlePowerEdit = (rack: RackDisplay) => {
        const input = prompt(t('visualEdit.enterMaxPower'), rack.maxPower.toString());
        if (input) {
            const power = parseInt(input);
            if (!isNaN(power) && power > 0) {
                router.put(`/racks/${rack.id}`, {
                    power: power,
                }, {
                    onSuccess: () => router.reload({ only: ['racks'] })
                });
            }
        }
    };

    const getCategoryLabel = (category: string) => {
        // 首先尝试从 visualEdit 命名空间获取
        const visualEditKey = `visualEdit.${category}`;
        const visualEditValue = t(visualEditKey);
        if (visualEditValue !== visualEditKey) {
            return visualEditValue;
        }
        // 回退到根级别
        return t(category);
    };

    const getTypeColor = (typeId: number) => {
        const type = deviceTypes.find(t => t.id === typeId);
        return type?.color || '#3b82f6';
    };

    const getStatusLabel = (status: string) => {
        return t(`visualEdit.${status}`);
    };

    // 处理设备连接
    const handleConnect = (device: Device) => {
        if (!device.ip_address) {
            showToast(t('visualEdit.noIpAddress'), 'warning');
            return;
        }

        const protocol = device.connection_type || 'ssh';
        const ip = device.ip_address;
        const port = device.connection_port;

        let url = '';
        switch (protocol) {
            case 'ssh':
                url = port ? `ssh://${ip}:${port}` : `ssh://${ip}`;
                break;
            case 'rdp':
                url = port ? `rdp://${ip}:${port}` : `rdp://${ip}`;
                break;
            case 'vnc':
                url = port ? `vnc://${ip}:${port}` : `vnc://${ip}`;
                break;
            case 'radmin':
                url = port ? `radmin://${ip}:${port}` : `radmin://${ip}`;
                break;
            default:
                url = port ? `ssh://${ip}:${port}` : `ssh://${ip}`;
        }

        window.open(url, '_blank');
        setContextMenu({ ...contextMenu, open: false });
    };

    // 处理右键菜单
    const handleContextMenu = (e: React.MouseEvent, device: Device) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            open: true,
            x: e.clientX,
            y: e.clientY,
            device,
        });
    };

    // 关闭右键菜单
    const closeContextMenu = () => {
        setContextMenu({ ...contextMenu, open: false });
    };

    // 打开设备详情弹窗
    const openDetailDialog = (device: Device) => {
        setViewingDevice(device);
        setDetailDialogOpen(true);
        setContextMenu({ ...contextMenu, open: false });
    };

    // 关闭设备详情弹窗
    const closeDetailDialog = () => {
        setDetailDialogOpen(false);
        setViewingDevice(null);
    };

    const getIconForType = (iconName: string | null) => {
        switch (iconName) {
            case 'server': return <Monitor className="h-3 w-3" />;
            case 'network': return <Network className="h-3 w-3" />;
            case 'storage': return <Database className="h-3 w-3" />;
            case 'cpu': return <Cpu className="h-3 w-3" />;
            case 'layers': return <Layers className="h-3 w-3" />;
            default: return <HardDrive className="h-3 w-3" />;
        }
    };

    const categories = useMemo(() => {
        const baseCategories = [{ value: 'all', label: t('visualEdit.all'), icon: 'all', color: null }];
        const typeCategories = deviceTypes.map(type => ({
            value: type.id.toString(),
            label: type.name,
            icon: type.icon,
            color: type.color,
        }));
        return [...baseCategories, ...typeCategories];
    }, [deviceTypes, t]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('navigation.rackVisualEdit')} />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('navigation.rackVisualEdit')}
                    </h1>
                    <div className="flex gap-2">
                        <Button
                            variant={previewMode ? 'default' : 'outline'}
                            onClick={() => setPreviewMode(!previewMode)}
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            {previewMode ? t('visualEdit.editMode') : t('visualEdit.previewMode')}
                        </Button>
                        {!previewMode && (
                            <Button variant="outline" onClick={() => setAddRackModalOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                {t('visualEdit.addRack')}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2">
                        <Select value={selectedRoom} onValueChange={handleRoomChange}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder={t('visualEdit.selectRoom')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('visualEdit.allRooms')}</SelectItem>
                                {rooms.map((room) => (
                                    <SelectItem key={room.id} value={room.id.toString()}>
                                        {room.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-2">
                        {!previewMode && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => setExportDialogOpen(true)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    {t('visualEdit.export')}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
                                    <Upload className="mr-2 h-4 w-4" />
                                    {t('visualEdit.import')}
                                </Button>
                            </>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleBatchPing}
                            disabled={isPinging || previewMode}
                        >
                            <Activity className={`mr-2 h-4 w-4 ${isPinging ? 'animate-spin' : ''}`} />
                            {isPinging ? t('visualEdit.pinging') : t('visualEdit.batchPing')}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 gap-4 overflow-hidden">
                    <Card
                        className={`w-80 flex-shrink-0 transition-colors ${!previewMode && isDraggingOverLibrary ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600' : ''}`}
                        onDragOver={!previewMode ? handleLibraryDragOver : undefined}
                        onDragLeave={!previewMode ? handleLibraryDragLeave : undefined}
                        onDrop={!previewMode ? handleLibraryDrop : undefined}
                    >
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className={`text-base flex items-center gap-2 ${isDraggingOverLibrary ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    <HardDrive className="h-4 w-4" />
                                    {t('visualEdit.deviceLibrary')}
                                    {isDraggingOverLibrary && <span className="text-xs font-normal ml-2">(释放以移除)</span>}
                                </CardTitle>
                                {!previewMode && (
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={openCreateDeviceLibraryDialog} disabled={deviceTypes.length === 0}>
                                        + {t('visualEdit.addDevice')}
                                    </Button>
                                )}
                            </div>
                            {deviceTypes.length === 0 && (
                                <div className="rounded-md bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-800 mt-2">
                                    {t('deviceLibrary.pleaseCreateTypeFirst')}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-1 pt-2">
                                {categories.map((cat) => (
                                    <Button
                                        key={cat.value}
                                        variant={activeCategory === cat.value ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setActiveCategory(cat.value)}
                                        className="h-6 text-xs px-2"
                                        title={cat.label}
                                    >
                                        {cat.icon === 'all' ? <Layers className="h-3 w-3 mr-1" /> : getIconForType(cat.icon || null)}
                                        {cat.color && (
                                            <div
                                                className="w-2 h-2 rounded-full mr-1"
                                                style={{ backgroundColor: cat.color }}
                                            />
                                        )}
                                        {cat.label}
                                    </Button>
                                ))}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 360px)' }}>
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="h-8 text-xs">{t('visualEdit.name')}</TableHead>
                                            <TableHead className="h-8 text-xs">{t('visualEdit.category')}</TableHead>
                                            <TableHead className="h-8 text-xs">{t('visualEdit.uheight')}</TableHead>
                                            <TableHead className="h-8 text-xs">{t('visualEdit.power')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredDevices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
                                                    {t('visualEdit.noUnassignedDevices')}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredDevices.map((item) => (
                                                <TableRow
                                                    key={item.id}
                                                    draggable={!previewMode}
                                                    onDragStart={!previewMode ? (e) => handleLibraryDragStart(e, item) : undefined}
                                                    onDragEnd={!previewMode ? handleDragEnd : undefined}
                                                    onDoubleClick={!previewMode ? () => openEditDeviceLibraryDialog(item) : undefined}
                                                    onContextMenu={!previewMode ? (e) => handleLibraryContextMenu(e, item) : undefined}
                                                    className={`border-b border-border/50 transition-colors hover:bg-primary/10 hover:shadow-sm select-none ${!previewMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                                                    title={previewMode ? item.name : `${item.name} - ${t('visualEdit.dragToRack')} (${t('common.doubleClickToEdit')})`}
                                                    style={{ userSelect: 'none' }}
                                                >
                                                    <TableCell className="py-2 px-4 text-sm font-medium">
                                                        {item.name}
                                                    </TableCell>
                                                    <TableCell className="py-2 px-4">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                                style={{ backgroundColor: getTypeColor(item.device_type_id) }}
                                                            />
                                                            {getIconForType(item.device_type?.icon || null)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 px-4 text-sm text-muted-foreground">
                                                        {item.u_height}U
                                                    </TableCell>
                                                    <TableCell className="py-2 px-4 text-sm text-muted-foreground">
                                                        {item.power}W
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="flex-1 overflow-hidden">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Server className="h-4 w-4" />
                                        {t('visualEdit.rackView')}
                                    </CardTitle>
                                    <span className="text-sm text-muted-foreground">
                                        {racksData.length} {t('visualEdit.racks')}
                                    </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {t('visualEdit.dragHint')}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-auto p-4" style={{ maxHeight: 'calc(100vh - 360px)' }}>
                                {racksData.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                                        <Building2 className="mb-4 h-12 w-12 opacity-50" />
                                        <p>{t('visualEdit.noRacksAvailable')}</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-2"
                                            onClick={() => setAddRackModalOpen(true)}
                                        >
                                            {t('visualEdit.addRack')}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-4">
                                        {racksData.map((rack) => (
                                            <div
                                                key={rack.id}
                                                className="flex flex-col rounded-lg border bg-card"
                                            >
                                                <div className="flex items-center justify-between rounded-t-lg bg-muted px-3 py-2">
                                                    <span className="font-semibold">{rack.name}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0"
                                                        onClick={() => handlePowerEdit(rack)}
                                                        title={t('visualEdit.editPower')}
                                                    >
                                                        <Zap className="h-3 w-3 text-yellow-500" />
                                                    </Button>
                                                </div>
                                                <div
                                                    className="flex flex-col-reverse bg-slate-50 dark:bg-slate-900"
                                                    style={{ minHeight: `${rack.totalU * 24}px`, width: '150px' }}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        // 让事件继续传播到子元素
                                                    }}
                                                    onDrop={(e) => {
                                                        // 阻止默认行为，让子元素处理
                                                        e.preventDefault();
                                                        console.log('Rack container drop - should not reach here if slot handles it');
                                                    }}
                                                >
                                                    {rack.slots.map((slot, uIndex) => {
                                                        // 检查是否在拖动预览位置
                                                        // U位从下到上，设备放在uPosition时向上占据uHeight个U位
                                                        // 例如：4U设备放在30U，预览范围是30、31、32、33
                                                        const isDragPreview = dragPreviewPosition &&
                                                            dragPreviewPosition.rackId === rack.id &&
                                                            slot.uPosition >= dragPreviewPosition.uPosition &&
                                                            slot.uPosition < dragPreviewPosition.uPosition + dragPreviewPosition.uHeight;

                                                        const isDragPreviewTop = dragPreviewPosition &&
                                                            dragPreviewPosition.rackId === rack.id &&
                                                            slot.uPosition === dragPreviewPosition.uPosition;

                                                        // 检查是否可以放置（设备是否能完整放入机柜）
                                                        // U位从下到上，检查向上是否有足够空间
                                                        const canPlace = dragPreviewPosition &&
                                                            dragPreviewPosition.rackId === rack.id &&
                                                            dragPreviewPosition.uPosition + dragPreviewPosition.uHeight - 1 <= rack.totalU;

                                                        // 获取父设备（如果是被占用的U位）
                                                        const parentDevice = slot.parentDeviceId
                                                            ? rack.slots.find(s => s.deviceId === slot.parentDeviceId)?.device
                                                            : null;

                                                        return (
                                                            <div
                                                                key={uIndex}
                                                                data-rack-slot="true"
                                                                data-rack-id={rack.id}
                                                                data-u-position={slot.uPosition}
                                                                className={`flex items-center justify-center border-b border-border/50 text-[10px] relative
                                                                    ${!previewMode && isDragPreview ? (canPlace ? 'bg-green-200 dark:bg-green-900/50' : 'bg-red-200 dark:bg-red-900/50') : ''}
                                                                    ${slot.device && slot.isStart && !previewMode ? 'cursor-pointer' : 'cursor-default'}
                                                                    ${slot.isOccupied && !slot.device ? 'bg-slate-200 dark:bg-slate-800' : ''}`}
                                                                onDragOver={!previewMode ? (e) => handleDragOver(e, rack.id, slot.uPosition) : undefined}
                                                                onDrop={!previewMode ? (e) => handleDrop(e, rack.id, slot.uPosition) : undefined}
                                                                style={{ height: '24px' }}
                                                            >
                                                                {/* 空U位或被占用的U位显示U编号 */}
                                                                {(!slot.isStart || !slot.device) && (
                                                                    <span className={`${slot.isOccupied ? 'text-slate-400 dark:text-slate-600' : 'text-muted-foreground'}`}>
                                                                        {slot.uPosition}
                                                                    </span>
                                                                )}
                                                                {/* 设备起始位置显示设备 */}
                                                                {slot.device && slot.isStart && (
                                                                    <>
                                                                        <div
                                                                            draggable={!previewMode}
                                                                            onDragStart={!previewMode ? (e) => {
                                                                                // 从设备的任何U位开始拖动，都使用起始U位
                                                                                handleDragStart(e, slot.device!);
                                                                            } : undefined}
                                                                            className={`flex h-full w-full items-center justify-center truncate px-1 text-[9px] font-medium text-white absolute inset-0 z-10 ${!previewMode ? 'cursor-grab' : 'cursor-default'}`}
                                                                            style={{
                                                                                backgroundColor: slot.device.status === 'online' ? '#3b82f6' :
                                                                                    slot.device.status === 'offline' ? '#f97316' : '#64748b'
                                                                            }}
                                                                            onDoubleClick={!previewMode ? () => openEditModal(rack.id, slot.uPosition - 1, slot.device!) : undefined}
                                                                            onContextMenu={!previewMode ? (e) => handleContextMenu(e, slot.device!) : undefined}
                                                                            title={`${slot.device.name}
${getCategoryLabel(slot.device.device_library?.device_type?.name || slot.device.category || 'visualEdit.other')} | ${getStatusLabel(slot.device.status)} | ${slot.device.device_library?.power || slot.device.power || 0}W
${t('visualEdit.model')}: ${slot.device.model || slot.device.device_library?.model || '-'}
${t('visualEdit.manufacturer')}: ${slot.device.manufacturer || slot.device.device_library?.manufacturer || '-'}
${t('visualEdit.serialNumber')}: ${slot.device.serial_number || slot.device.device_library?.serial_number || '-'}`}
                                                                        >
                                                                            <div className="flex items-center gap-1">
                                                                                <div
                                                                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                                                                    style={{ backgroundColor: getTypeColor(slot.device.device_library?.device_type_id || 0) }}
                                                                                />
                                                                                {slot.device.name.length > 18
                                                                                    ? slot.device.name.slice(0, 16) + '..'
                                                                                    : slot.device.name}
                                                                            </div>
                                                                        </div>
                                                                        {/* 显示设备占据的所有U位标识 */}
                                                                        {slot.uHeight > 1 && (
                                                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-white/70 font-mono z-20">
                                                                                {slot.uPosition}-{slot.uPosition + slot.uHeight - 1}U
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {/* 被占用的U位（非起始位置）显示半透明覆盖层，也可以拖动 */}
                                                                {slot.isOccupied && parentDevice && !slot.device && (
                                                                    <div
                                                                        draggable={!previewMode}
                                                                        onDragStart={!previewMode ? (e) => {
                                                                            // 从被占用的U位拖动，使用父设备
                                                                            handleDragStart(e, parentDevice);
                                                                        } : undefined}
                                                                        onContextMenu={!previewMode ? (e) => handleContextMenu(e, parentDevice) : undefined}
                                                                        className={`absolute inset-0 bg-slate-400/20 dark:bg-slate-600/20 z-5 ${!previewMode ? 'cursor-grab' : 'cursor-default'}`}
                                                                        title={`${parentDevice.name} (U${slot.uPosition})
${getCategoryLabel(parentDevice.device_library?.device_type?.name || parentDevice.category || 'visualEdit.other')} | ${getStatusLabel(parentDevice.status)} | ${parentDevice.device_library?.power || parentDevice.power || 0}W
${t('visualEdit.model')}: ${parentDevice.model || parentDevice.device_library?.model || '-'}
${t('visualEdit.manufacturer')}: ${parentDevice.manufacturer || parentDevice.device_library?.manufacturer || '-'}
${t('visualEdit.serialNumber')}: ${parentDevice.serial_number || parentDevice.device_library?.serial_number || '-'}`}
                                                                    />
                                                                )}
                                                                {/* 拖动预览时的提示 */}
                                                                {!previewMode && isDragPreviewTop && draggingDevice && (
                                                                    <div className={`absolute inset-0 border-2 border-dashed z-30 pointer-events-none ${canPlace ? 'bg-green-500/30 border-green-500' : 'bg-red-500/30 border-red-500'}`}>
                                                                        <div className={`h-full w-full flex items-center justify-center text-xs font-bold ${canPlace ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                                                            {draggingDevice.type === 'library' && 'u_height' in draggingDevice.device
                                                                                ? `${draggingDevice.device.u_height}U`
                                                                                : (draggingDevice.type === 'existing' && 'device_library' in draggingDevice.device && draggingDevice.device.device_library?.u_height)
                                                                                    ? `${draggingDevice.device.device_library.u_height}U`
                                                                                    : '1U'}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex items-center justify-between rounded-b-lg bg-muted px-3 py-1.5 text-xs">
                                                    <span className="text-yellow-500">
                                                        {rack.curPower}/{rack.maxPower}W
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {rack.slots.filter(s => s.isStart && s.device).length}/{rack.totalU}U
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('deviceManagement.editDevice')}</DialogTitle>
                        <DialogDescription>{t('deviceManagement.editDeviceDesc')}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-device_type" className="text-right">
                                    {t('deviceLibrary.type')} *
                                </Label>
                                <Select
                                    value={selectedDeviceType}
                                    onValueChange={handleEditDeviceTypeChange}
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
                                    value={editForm.device_library_id}
                                    onValueChange={handleEditDeviceLibraryChange}
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
                                    value={editForm.rack_id}
                                    onValueChange={(value) => setEditForm({ ...editForm, rack_id: value === 'none' ? '' : value })}
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

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-u_position" className="text-right">
                                    {t('deviceManagement.uPosition')} *
                                </Label>
                                <Input
                                    id="edit-u_position"
                                    type="number"
                                    min="1"
                                    max={(() => {
                                        const rack = editForm.rack_id ? racks.find(r => r.id.toString() === editForm.rack_id) : null;
                                        const deviceLib = editForm.device_library_id ? deviceLibrary.find(item => item.id.toString() === editForm.device_library_id) : null;
                                        const deviceUHeight = deviceLib?.u_height || currentEditDevice?.device?.device_library?.u_height || 1;
                                        return rack ? rack.u_count - deviceUHeight + 1 : 42;
                                    })()}
                                    value={editForm.u_position}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value) || 1;
                                        const rack = editForm.rack_id ? racks.find(r => r.id.toString() === editForm.rack_id) : null;
                                        const deviceLib = editForm.device_library_id ? deviceLibrary.find(item => item.id.toString() === editForm.device_library_id) : null;
                                        const deviceUHeight = deviceLib?.u_height || currentEditDevice?.device?.device_library?.u_height || 1;
                                        const maxU = rack ? rack.u_count - deviceUHeight + 1 : 42;
                                        setEditForm({ ...editForm, u_position: Math.min(value, maxU) });
                                    }}
                                    className="col-span-3"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-ip_address" className="text-right">
                                    {t('deviceManagement.ipAddress')}
                                </Label>
                                <Input
                                    id="edit-ip_address"
                                    value={editForm.ip_address}
                                    onChange={(e) => setEditForm({ ...editForm, ip_address: e.target.value })}
                                    className="col-span-3"
                                    placeholder="192.168.1.1"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-connection_type" className="text-right">
                                    {t('deviceManagement.connectionType')}
                                </Label>
                                <Select
                                    value={editForm.connection_type}
                                    onValueChange={(value) => setEditForm({ ...editForm, connection_type: value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceManagement.selectConnectionType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ssh">SSH</SelectItem>
                                        <SelectItem value="rdp">RDP</SelectItem>
                                        <SelectItem value="vnc">VNC</SelectItem>
                                        <SelectItem value="radmin">Radmin</SelectItem>
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
                                    value={editForm.connection_port || ''}
                                    onChange={(e) => {
                                        const value = e.target.value ? parseInt(e.target.value) : undefined;
                                        setEditForm({ ...editForm, connection_port: value });
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
                                    value={editForm.status}
                                    onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                                >
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder={t('deviceManagement.selectStatus')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="online">{t('deviceManagement.statuses.online')}</SelectItem>
                                        <SelectItem value="offline">{t('deviceManagement.statuses.offline')}</SelectItem>
                                        <SelectItem value="maintenance">{t('deviceManagement.statuses.maintenance')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-description" className="text-right">
                                    {t('deviceManagement.description')}
                                </Label>
                                <Input
                                    id="edit-description"
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                        <DialogFooter className="flex justify-end gap-2 mt-4">
                            <Button type="button" variant="outline" onClick={() => {
                                setEditModalOpen(false);
                                setSelectedDeviceType('');
                            }}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={!selectedDeviceType || !editForm.device_library_id}>
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={addRackModalOpen} onOpenChange={setAddRackModalOpen}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{t('rackManagement.addRack')}</DialogTitle>
                        <DialogDescription>{t('rackManagement.addNewRack')}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddRackSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div className="grid gap-2">
                                <Label htmlFor="room_id">
                                    {t('rackManagement.room')} *
                                </Label>
                                <Select
                                    value={rackForm.room_id}
                                    onValueChange={(value) => setRackForm({ ...rackForm, room_id: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('rackManagement.selectRoom')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {rooms.map((room) => (
                                            <SelectItem key={room.id} value={room.id.toString()}>
                                                {room.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="rack_type_id">
                                    {t('rackManagement.rackType')}
                                </Label>
                                <Select
                                    value={rackForm.rack_type_id}
                                    onValueChange={handleRackTypeChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('rackManagement.selectRackType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">
                                            {t('rackManagement.noRackType')}
                                        </SelectItem>
                                        {rackTypes.map((type) => (
                                            <SelectItem key={type.id} value={type.id.toString()}>
                                                {type.name} ({type.u_count}U)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="name">
                                    {t('rackManagement.name')} *
                                </Label>
                                <Input
                                    id="name"
                                    value={rackForm.name}
                                    onChange={(e) => setRackForm({ ...rackForm, name: e.target.value })}
                                    placeholder={t('rackManagement.name')}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="u_count">
                                    {t('rackManagement.uCount')}
                                </Label>
                                <Input
                                    id="u_count"
                                    type="number"
                                    value={rackForm.u_count}
                                    disabled
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('rackManagement.autoFilledFromRackType')}
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="power">
                                    {t('rackManagement.power')}
                                </Label>
                                <Input
                                    id="power"
                                    type="number"
                                    value={rackForm.power}
                                    disabled
                                    className="bg-muted"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {t('rackManagement.autoFilledFromRackType')}
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="device_count">
                                    {t('rackManagement.deviceCount')}
                                </Label>
                                <Input
                                    id="device_count"
                                    type="number"
                                    value={rackForm.device_count}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="description">
                                    {t('rackManagement.description')}
                                </Label>
                                <Input
                                    id="description"
                                    value={rackForm.description}
                                    onChange={(e) => setRackForm({ ...rackForm, description: e.target.value })}
                                    placeholder={t('rackManagement.description')}
                                />
                            </div>
                        </div>
                        <DialogFooter className="flex justify-end gap-2 mt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setAddRackModalOpen(false);
                                    resetRackForm();
                                }}
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit">
                                {t('rackManagement.addRack')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={addDeviceModalOpen} onOpenChange={setAddDeviceModalOpen}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{t('deviceLibrary.add')}</DialogTitle>
                        <DialogDescription>{t('deviceLibrary.addDesc')}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateDeviceLibrarySubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="device_type_id" className="text-right">
                                    {t('deviceLibrary.type')} *
                                </Label>
                                <Select
                                    value={deviceLibraryForm.device_type_id}
                                    onValueChange={(value) => setDeviceLibraryForm({ ...deviceLibraryForm, device_type_id: value })}
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
                                    {t('deviceLibrary.name')} *
                                </Label>
                                <Input
                                    id="name"
                                    value={deviceLibraryForm.name}
                                    onChange={(e) => setDeviceLibraryForm({ ...deviceLibraryForm, name: e.target.value })}
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
                                    value={deviceLibraryForm.model}
                                    onChange={(e) => setDeviceLibraryForm({ ...deviceLibraryForm, model: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="manufacturer" className="text-right">
                                    {t('deviceLibrary.manufacturer')}
                                </Label>
                                <Input
                                    id="manufacturer"
                                    value={deviceLibraryForm.manufacturer}
                                    onChange={(e) => setDeviceLibraryForm({ ...deviceLibraryForm, manufacturer: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="serial_number" className="text-right">
                                    {t('deviceLibrary.serialNumber')}
                                </Label>
                                <Input
                                    id="serial_number"
                                    value={deviceLibraryForm.serial_number}
                                    onChange={(e) => setDeviceLibraryForm({ ...deviceLibraryForm, serial_number: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="u_height" className="text-right">
                                    {t('deviceLibrary.uHeight')} *
                                </Label>
                                <Input
                                    id="u_height"
                                    type="number"
                                    min="1"
                                    value={deviceLibraryForm.u_height}
                                    onChange={(e) => setDeviceLibraryForm({ ...deviceLibraryForm, u_height: parseInt(e.target.value) || 1 })}
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
                                    value={deviceLibraryForm.power}
                                    onChange={(e) => setDeviceLibraryForm({ ...deviceLibraryForm, power: parseInt(e.target.value) || 0 })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="description" className="text-right">
                                    {t('deviceLibrary.description')}
                                </Label>
                                <Textarea
                                    id="description"
                                    value={deviceLibraryForm.description}
                                    onChange={(e) => setDeviceLibraryForm({ ...deviceLibraryForm, description: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeCreateDeviceLibraryDialog}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={!deviceLibraryForm.device_type_id || !deviceLibraryForm.name}>
                                {t('common.create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* 编辑设备库条目对话框 - 与 DeviceLibrary/Index.tsx 保持一致 */}
            <Dialog open={editDeviceLibraryModalOpen} onOpenChange={setEditDeviceLibraryModalOpen}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{t('deviceLibrary.edit')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceLibrary.editDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditDeviceLibrarySubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-device_type_id" className="text-right">
                                    {t('deviceLibrary.type')}
                                </Label>
                                <Select
                                    value={editDeviceLibraryForm.device_type_id}
                                    onValueChange={(value) => setEditDeviceLibraryForm({ ...editDeviceLibraryForm, device_type_id: value })}
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
                                    value={editDeviceLibraryForm.name}
                                    onChange={(e) => setEditDeviceLibraryForm({ ...editDeviceLibraryForm, name: e.target.value })}
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
                                    value={editDeviceLibraryForm.model}
                                    onChange={(e) => setEditDeviceLibraryForm({ ...editDeviceLibraryForm, model: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-manufacturer" className="text-right">
                                    {t('deviceLibrary.manufacturer')}
                                </Label>
                                <Input
                                    id="edit-manufacturer"
                                    value={editDeviceLibraryForm.manufacturer}
                                    onChange={(e) => setEditDeviceLibraryForm({ ...editDeviceLibraryForm, manufacturer: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-serial_number" className="text-right">
                                    {t('deviceLibrary.serialNumber')}
                                </Label>
                                <Input
                                    id="edit-serial_number"
                                    value={editDeviceLibraryForm.serial_number}
                                    onChange={(e) => setEditDeviceLibraryForm({ ...editDeviceLibraryForm, serial_number: e.target.value })}
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
                                    value={editDeviceLibraryForm.u_height}
                                    onChange={(e) => setEditDeviceLibraryForm({ ...editDeviceLibraryForm, u_height: parseInt(e.target.value) || 1 })}
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
                                    value={editDeviceLibraryForm.power}
                                    onChange={(e) => setEditDeviceLibraryForm({ ...editDeviceLibraryForm, power: parseInt(e.target.value) || 0 })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-description" className="text-right">
                                    {t('deviceLibrary.description')}
                                </Label>
                                <Textarea
                                    id="edit-description"
                                    value={editDeviceLibraryForm.description}
                                    onChange={(e) => setEditDeviceLibraryForm({ ...editDeviceLibraryForm, description: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={closeEditDeviceLibraryDialog}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit">
                                {t('common.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* 导出对话框 */}
            <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('visualEdit.exportData')}</DialogTitle>
                        <DialogDescription>
                            {t('visualEdit.exportDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            {t('visualEdit.exportContent')}
                        </p>
                        <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                            <li>{t('visualEdit.exportRooms')}</li>
                            <li>{t('visualEdit.exportRackTypes')}</li>
                            <li>{t('visualEdit.exportRacks')}</li>
                            <li>{t('visualEdit.exportDeviceTypes')}</li>
                            <li>{t('visualEdit.exportDeviceLibrary')}</li>
                            <li>{t('visualEdit.exportDevices')}</li>
                        </ul>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleExport} disabled={isExporting}>
                            {isExporting ? t('common.loading') : t('visualEdit.export')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 导入对话框 */}
            <Dialog open={importDialogOpen} onOpenChange={closeImportDialog}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('visualEdit.importData')}</DialogTitle>
                        <DialogDescription>
                            {t('visualEdit.importDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col flex-1 overflow-hidden">
                        {!importPreview ? (
                            <div className="py-8">
                                <Label htmlFor="import-file" className="block text-sm font-medium mb-2">
                                    {t('visualEdit.selectImportFile')}
                                </Label>
                                <Input
                                    id="import-file"
                                    type="file"
                                    accept=".json"
                                    onChange={handleImportFileChange}
                                    className="cursor-pointer"
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    {t('visualEdit.importFileHint')}
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <div className="py-4 border-b">
                                    <h4 className="text-sm font-medium mb-2">{t('visualEdit.importPreview')}</h4>
                                    <div className="text-sm text-muted-foreground space-y-1">
                                        <p>{t('visualEdit.exportVersion')}: {importPreview.version}</p>
                                        <p>{t('visualEdit.exportDate')}: {importPreview.exported_at ? new Date(importPreview.exported_at).toLocaleString() : '-'}</p>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto py-4">
                                    <h4 className="text-sm font-medium mb-3">{t('visualEdit.selectImportContent')}</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="import-rooms"
                                                checked={importOptions.rooms}
                                                onCheckedChange={(checked) => handleImportOptionChange('rooms', checked as boolean)}
                                            />
                                            <Label htmlFor="import-rooms" className="text-sm cursor-pointer">
                                                {t('visualEdit.importRoomsLabel')} ({importPreview.counts.rooms} {t('visualEdit.items')})
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <Checkbox
                                                id="import-rack-types"
                                                checked={importOptions.rack_types}
                                                onCheckedChange={(checked) => handleImportOptionChange('rack_types', checked as boolean)}
                                            />
                                            <Label htmlFor="import-rack-types" className="text-sm cursor-pointer">
                                                {t('visualEdit.importRackTypesLabel')} ({importPreview.counts.rack_types} {t('visualEdit.items')})
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <Checkbox
                                                id="import-racks"
                                                checked={importOptions.racks}
                                                disabled={!importOptions.rooms || !importOptions.rack_types}
                                                onCheckedChange={(checked) => handleImportOptionChange('racks', checked as boolean)}
                                            />
                                            <Label htmlFor="import-racks" className={`text-sm cursor-pointer ${(!importOptions.rooms || !importOptions.rack_types) ? 'text-muted-foreground' : ''}`}>
                                                {t('visualEdit.importRacksLabel')} ({importPreview.counts.racks} {t('visualEdit.items')})
                                                {(!importOptions.rooms || !importOptions.rack_types) && (
                                                    <span className="text-xs text-muted-foreground ml-1">({t('visualEdit.requiresRoomsAndTypes')})</span>
                                                )}
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <Checkbox
                                                id="import-device-types"
                                                checked={importOptions.device_types}
                                                onCheckedChange={(checked) => handleImportOptionChange('device_types', checked as boolean)}
                                            />
                                            <Label htmlFor="import-device-types" className="text-sm cursor-pointer">
                                                {t('visualEdit.importDeviceTypesLabel')} ({importPreview.counts.device_types} {t('visualEdit.items')})
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <Checkbox
                                                id="import-device-library"
                                                checked={importOptions.device_library}
                                                disabled={!importOptions.device_types}
                                                onCheckedChange={(checked) => handleImportOptionChange('device_library', checked as boolean)}
                                            />
                                            <Label htmlFor="import-device-library" className={`text-sm cursor-pointer ${!importOptions.device_types ? 'text-muted-foreground' : ''}`}>
                                                {t('visualEdit.importDeviceLibraryLabel')} ({importPreview.counts.device_library} {t('visualEdit.items')})
                                                {!importOptions.device_types && (
                                                    <span className="text-xs text-muted-foreground ml-1">({t('visualEdit.requiresDeviceTypes')})</span>
                                                )}
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <Checkbox
                                                id="import-devices"
                                                checked={importOptions.devices}
                                                disabled={!importOptions.racks || !importOptions.device_library}
                                                onCheckedChange={(checked) => handleImportOptionChange('devices', checked as boolean)}
                                            />
                                            <Label htmlFor="import-devices" className={`text-sm cursor-pointer ${(!importOptions.racks || !importOptions.device_library) ? 'text-muted-foreground' : ''}`}>
                                                {t('visualEdit.importDevicesLabel')} ({importPreview.counts.devices} {t('visualEdit.items')})
                                                {(!importOptions.racks || !importOptions.device_library) && (
                                                    <span className="text-xs text-muted-foreground ml-1">({t('visualEdit.requiresRacksAndLibrary')})</span>
                                                )}
                                            </Label>
                                        </div>
                                    </div>
                                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                        <p className="text-xs text-yellow-800">
                                            {t('visualEdit.importCascadeHint')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeImportDialog}>
                            {t('common.cancel')}
                        </Button>
                        {importPreview && (
                            <Button onClick={handleImportSubmit} disabled={isImporting}>
                                {isImporting ? t('common.loading') : t('visualEdit.import')}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 批量检测结果对话框 */}
            <Dialog open={pingResults.open} onOpenChange={(open) => setPingResults({ ...pingResults, open })}>
                <DialogContent className="max-h-[90vh] flex flex-col max-w-3xl p-0">
                    <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                        <DialogTitle>{t('visualEdit.pingResults')}</DialogTitle>
                        <DialogDescription>
                            {t('visualEdit.pingResultsDesc', {
                                total: pingResults.total,
                                online: pingResults.online,
                                offline: pingResults.offline,
                                maintenance: pingResults.maintenance,
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
                        <div className="grid grid-cols-4 gap-4 py-4 shrink-0">
                            <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">{pingResults.total}</div>
                                <div className="text-xs text-blue-600/80">{t('visualEdit.totalDevices')}</div>
                            </div>
                            <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">{pingResults.online}</div>
                                <div className="text-xs text-green-600/80">{t('visualEdit.online')}</div>
                            </div>
                            <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                                <div className="text-2xl font-bold text-orange-600">{pingResults.offline}</div>
                                <div className="text-xs text-orange-600/80">{t('visualEdit.offline')}</div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <div className="text-2xl font-bold text-gray-600">{pingResults.maintenance}</div>
                                <div className="text-xs text-gray-600/80">{t('visualEdit.maintenance')}</div>
                            </div>
                        </div>
                        <div className="border rounded-md overflow-hidden">
                            <div className="max-h-[50vh] min-h-[200px] overflow-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 dark:hover:scrollbar-thumb-gray-500">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-background z-10">
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="h-8 text-xs whitespace-nowrap">{t('visualEdit.rack')}</TableHead>
                                            <TableHead className="h-8 text-xs whitespace-nowrap">{t('visualEdit.name')}</TableHead>
                                            <TableHead className="h-8 text-xs whitespace-nowrap">IP</TableHead>
                                            <TableHead className="h-8 text-xs whitespace-nowrap">{t('visualEdit.status')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pingResults.results.map((result) => (
                                            <TableRow key={result.id} className="hover:bg-muted/30">
                                                <TableCell className="py-2 text-sm whitespace-nowrap">{result.rack_name || '-'}</TableCell>
                                                <TableCell className="py-2 text-sm whitespace-nowrap">{result.name}</TableCell>
                                                <TableCell className="py-2 text-sm font-mono whitespace-nowrap">{result.ip || '-'}</TableCell>
                                                <TableCell className="py-2 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                        result.status === 'online'
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                                            : result.status === 'offline'
                                                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                                                    }`}>
                                                        {t(`visualEdit.${result.status}`)}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="px-6 py-4 border-t shrink-0">
                        <Button variant="outline" onClick={() => setPingResults({ ...pingResults, open: false })}>
                            {t('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 右键菜单 */}
            {!previewMode && contextMenu.open && contextMenu.device && (
                <>
                    {/* 遮罩层，点击关闭菜单 */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={closeContextMenu}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            closeContextMenu();
                        }}
                    />
                    {/* 菜单内容 */}
                    <div
                        className="fixed z-50 min-w-[160px] bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            {contextMenu.device.name}
                        </div>
                        <button
                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                            onClick={() => openDetailDialog(contextMenu.device!)}
                        >
                            <Eye className="h-4 w-4" />
                            <span>{t('common.view')}</span>
                        </button>
                        <button
                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleConnect(contextMenu.device!)}
                            disabled={!contextMenu.device.ip_address}
                        >
                            <Link2 className="h-4 w-4" />
                            <span>{t('visualEdit.connect')}</span>
                            {!contextMenu.device.ip_address && (
                                <span className="text-xs text-gray-400 ml-auto">({t('visualEdit.noIpAddress')})</span>
                            )}
                        </button>
                        <button
                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                            onClick={() => {
                                const rackId = racks.find(r => r.devices?.some(d => d.id === contextMenu.device!.id))?.id;
                                if (rackId && contextMenu.device?.u_position) {
                                    openEditModal(rackId, contextMenu.device.u_position - 1, contextMenu.device);
                                }
                                closeContextMenu();
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                            <span>{t('common.edit')}</span>
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                        <button
                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-red-600 dark:text-red-400"
                            onClick={() => {
                                if (contextMenu.device) {
                                    router.delete(`/devices/${contextMenu.device.id}`, {
                                        preserveState: true,
                                        preserveScroll: true,
                                        onSuccess: () => {
                                            showToast(t('visualEdit.deviceDeleted'), 'success');
                                            router.reload({ only: ['racks'] });
                                        },
                                    });
                                }
                                closeContextMenu();
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                            <span>{t('common.delete')}</span>
                        </button>
                    </div>
                </>
            )}

            {/* 设备详情弹窗 */}
            <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
                <DialogContent className="max-w-2xl">
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
                                    {viewingDevice.device_library?.device_type?.name || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.model')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingDevice.device_library
                                        ? `${viewingDevice.device_library.manufacturer || ''} ${viewingDevice.device_library.model || ''}`.trim() || '-'
                                        : '-'}
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
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.rack')}
                                </Label>
                                <span className="col-span-3">
                                    {racks.find(r => r.devices?.some(d => d.id === viewingDevice.id))?.name || t('deviceManagement.noRack')}
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
                                    {viewingDevice.connection_type?.toUpperCase() || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceManagement.connectionPort')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingDevice.connection_port || '-'}
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
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeDetailDialog}>
                            {t('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 设备库右键菜单 */}
            {!previewMode && libraryContextMenu.open && libraryContextMenu.item && (
                <>
                    {/* 遮罩层，点击关闭菜单 */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={closeLibraryContextMenu}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            closeLibraryContextMenu();
                        }}
                    />
                    {/* 菜单内容 */}
                    <div
                        className="fixed z-50 min-w-[160px] bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1"
                        style={{ left: libraryContextMenu.x, top: libraryContextMenu.y }}
                    >
                        <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            {libraryContextMenu.item.name}
                        </div>
                        <button
                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                            onClick={() => openLibraryDetailDialog(libraryContextMenu.item!)}
                        >
                            <Eye className="h-4 w-4" />
                            <span>{t('common.view')}</span>
                        </button>
                        <button
                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                            onClick={() => {
                                openEditDeviceLibraryDialog(libraryContextMenu.item!);
                                closeLibraryContextMenu();
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                            <span>{t('common.edit')}</span>
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                        <button
                            className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 text-red-600 dark:text-red-400"
                            onClick={() => handleDeleteLibraryItem(libraryContextMenu.item!)}
                        >
                            <Trash2 className="h-4 w-4" />
                            <span>{t('common.delete')}</span>
                        </button>
                    </div>
                </>
            )}

            {/* 设备库详情弹窗 */}
            <Dialog open={libraryDetailDialogOpen} onOpenChange={setLibraryDetailDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('deviceLibrary.details')}</DialogTitle>
                        <DialogDescription>
                            {t('deviceLibrary.detailsDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    {viewingLibraryItem && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.name')}
                                </Label>
                                <span className="col-span-3">{viewingLibraryItem.name}</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.type')}
                                </Label>
                                <span className="col-span-3">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: getTypeColor(viewingLibraryItem.device_type_id) }}
                                        />
                                        {viewingLibraryItem.device_type?.name || '-'}
                                    </div>
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.model')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingLibraryItem.model || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.manufacturer')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingLibraryItem.manufacturer || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.serialNumber')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingLibraryItem.serial_number || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.uHeight')}
                                </Label>
                                <span className="col-span-3">{viewingLibraryItem.u_height}U</span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.power')}
                                </Label>
                                <span className="col-span-3">
                                    {viewingLibraryItem.power ? `${viewingLibraryItem.power}W` : '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right font-medium">
                                    {t('deviceLibrary.description')}
                                </Label>
                                <span className="col-span-3 text-muted-foreground">
                                    {viewingLibraryItem.description || '-'}
                                </span>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeLibraryDetailDialog}>
                            {t('common.close')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
