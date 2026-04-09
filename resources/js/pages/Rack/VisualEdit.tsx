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
}

interface Room {
    id: number;
    name: string;
}

interface Props {
    racks: Rack[];
    rooms: Room[];
    deviceLibrary: DeviceLibraryItem[];
    deviceTypes: DeviceType[];
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



export default function RackVisualEdit({ racks, rooms, deviceLibrary, deviceTypes, selectedRoom: initialRoom, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const [selectedRoom, setSelectedRoom] = useState<string>(initialRoom || 'all');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [previewMode, setPreviewMode] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [addRackModalOpen, setAddRackModalOpen] = useState(false);
    const [addDeviceModalOpen, setAddDeviceModalOpen] = useState(false);
    const [currentEditDevice, setCurrentEditDevice] = useState<{ rackId: number; uIndex: number; device: Device } | null>(null);

    const [rackU, setRackU] = useState(42);
    const [rackRows, setRackRows] = useState(1);
    const [rackCols, setRackCols] = useState(2);

    const [newRackName, setNewRackName] = useState('');
    const [newRackRoom, setNewRackRoom] = useState('');

    const [editForm, setEditForm] = useState({
        name: '',
        model: '',
        manufacturer: '',
        serial_number: '',
        power: 0,
        status: 'offline',
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
        const usedLibraryIds = new Set(
            racks.flatMap(r => r.devices || [])
                .map(d => d.device_library_id)
                .filter((id): id is number => id !== null && id !== undefined)
        );
        const availableDevices = libraryDevices.filter(d => !usedLibraryIds.has(d.id));

        if (activeCategory === 'all') {
            return availableDevices;
        }
        return availableDevices.filter(d => d.device_type_id.toString() === activeCategory);
    }, [libraryDevices, activeCategory, racks]);

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
            alert(`Cannot place device: need ${uHeight}U space, but only ${targetRack.totalU - uPosition + 1}U available from position ${uPosition}`);
            setDraggingDevice(null);
            setDragPreviewPosition(null);
            return;
        }

        // 检查从uPosition向上uHeight个U位是否都被占用
        for (let i = 0; i < uHeight; i++) {
            const checkU = uPosition + i;
            if (checkU > targetRack.totalU) {
                alert(`Cannot place device: exceeds rack boundary at U${checkU}`);
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
                alert('U-position is already occupied');
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
                status: 'offline',
            };

            console.log('Sending POST request to /devices with data:', postData);

            router.post('/devices', postData, {
                preserveState: false,
                preserveScroll: true,
                onSuccess: () => {
                    console.log('Device created successfully');
                    router.reload({ only: ['racks', 'devices'] });
                },
                onError: (errors) => {
                    console.error('Failed to create device:', errors);
                    alert('Failed to create device: ' + JSON.stringify(errors));
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
                    router.reload({ only: ['racks', 'devices'] });
                },
                onError: (errors) => {
                    console.error('Failed to update device:', errors);
                    alert('Failed to update device: ' + JSON.stringify(errors));
                }
            });
        }

        // 清除拖拽状态
        setDraggingDevice(null);
        setDragPreviewPosition(null);
    };

    const handleLibraryDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const deviceType = e.dataTransfer.getData('deviceType');

        if (deviceType === 'existing') {
            const deviceId = parseInt(e.dataTransfer.getData('deviceId'));
            if (isNaN(deviceId)) return;

            const deviceName = e.dataTransfer.getData('deviceName');
            const deviceStatus = e.dataTransfer.getData('deviceStatus');

            router.put(`/devices/${deviceId}`, {
                rack_id: null,
                u_position: null,
                name: deviceName,
                status: deviceStatus,
            }, {
                preserveState: false,
                preserveScroll: true,
                onSuccess: () => {
                    router.reload({ only: ['racks', 'devices'] });
                }
            });
        }

        // 清除拖拽状态
        setDraggingDevice(null);
        setDragPreviewPosition(null);
    };

    const handleLibraryDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
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
        setEditForm({
            name: device.name,
            model: device.model || '',
            manufacturer: device.manufacturer || '',
            serial_number: device.serial_number || '',
            power: device.power,
            status: device.status,
        });
        setEditModalOpen(true);
    };

    const saveEdit = () => {
        if (!currentEditDevice) return;

        router.put(`/devices/${currentEditDevice.device.id}`, editForm, {
            onSuccess: () => {
                setEditModalOpen(false);
                router.reload({ only: ['racks', 'devices'] });
            }
        });
    };

    const removeDeviceFromRack = () => {
        if (!currentEditDevice) return;

        router.put(`/devices/${currentEditDevice.device.id}`, {
            rack_id: null,
            u_position: null,
        }, {
            onSuccess: () => {
                setEditModalOpen(false);
                router.reload({ only: ['racks', 'devices'] });
            }
        });
    };

    const generateRacks = () => {
        for (let r = 0; r < rackRows; r++) {
            for (let c = 0; c < rackCols; c++) {
                const name = newRackName || `Rack-${String.fromCharCode(65 + r)}${c + 1}`;
                const roomId = newRackRoom ? parseInt(newRackRoom) : (rooms[0]?.id || 1);

                router.post('/racks', {
                    room_id: roomId,
                    name: `${name}-${r + 1}-${c + 1}`,
                    u_count: rackU,
                    power: 5000,
                    device_count: 0,
                });
            }
        }
        setAddRackModalOpen(false);
        setTimeout(() => router.reload({ only: ['racks'] }), 500);
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
        return t(`${category}`);
    };

    const getStatusLabel = (status: string) => {
        return t(`visualEdit.${status}`);
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
        const baseCategories = [{ value: 'all', label: t('visualEdit.all'), icon: 'all' }];
        const typeCategories = deviceTypes.map(type => ({
            value: type.id.toString(),
            label: type.name,
            icon: type.icon,
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
                        <Button variant="outline" onClick={() => setAddRackModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t('visualEdit.addRack')}
                        </Button>
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
                        <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            {t('visualEdit.export')}
                        </Button>
                        <Button variant="outline" size="sm">
                            <Upload className="mr-2 h-4 w-4" />
                            {t('visualEdit.import')}
                        </Button>
                        <Button variant="outline" size="sm">
                            <Network className="mr-2 h-4 w-4" />
                            {t('visualEdit.batchPing')}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-1 gap-4 overflow-hidden">
                    <Card
                        className="w-80 flex-shrink-0"
                        onDragOver={handleLibraryDragOver}
                        onDrop={handleLibraryDrop}
                    >
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <HardDrive className="h-4 w-4" />
                                    {t('visualEdit.deviceLibrary')}
                                </CardTitle>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAddDeviceModalOpen(true)}>
                                    + {t('visualEdit.addDevice')}
                                </Button>
                            </div>
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
                                                    draggable
                                                    onDragStart={(e) => handleLibraryDragStart(e, item)}
                                                    onDragEnd={handleDragEnd}
                                                    className="cursor-grab active:cursor-grabbing border-b border-border/50 transition-colors hover:bg-primary/10 hover:shadow-sm select-none"
                                                    title={`${item.name} - ${t('visualEdit.dragToRack')}`}
                                                    style={{ userSelect: 'none' }}
                                                >
                                                    <TableCell className="py-2 px-4 text-sm font-medium">
                                                        {item.name}
                                                    </TableCell>
                                                    <TableCell className="py-2 px-4">
                                                        <span className="inline-flex items-center">
                                                            {getIconForType(item.device_type?.icon || null)}
                                                        </span>
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
                                                                    ${isDragPreview ? (canPlace ? 'bg-green-200 dark:bg-green-900/50' : 'bg-red-200 dark:bg-red-900/50') : ''}
                                                                    ${slot.device && slot.isStart ? 'cursor-pointer' : ''}
                                                                    ${slot.isOccupied && !slot.device ? 'bg-slate-200 dark:bg-slate-800' : ''}`}
                                                                onDragOver={(e) => handleDragOver(e, rack.id, slot.uPosition)}
                                                                onDrop={(e) => handleDrop(e, rack.id, slot.uPosition)}
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
                                                                            draggable
                                                                            onDragStart={(e) => {
                                                                                // 从设备的任何U位开始拖动，都使用起始U位
                                                                                handleDragStart(e, slot.device!);
                                                                            }}
                                                                            className="flex h-full w-full items-center justify-center truncate px-1 text-[9px] font-medium text-white cursor-grab absolute inset-0 z-10"
                                                                            style={{
                                                                                backgroundColor: (slot.device.device_library?.device_type?.name === 'server' || slot.device.category === 'server') ? '#3b82f6' :
                                                                                    (slot.device.device_library?.device_type?.name === 'network' || slot.device.category === 'network') ? '#06b6d4' :
                                                                                        (slot.device.device_library?.device_type?.name === 'storage' || slot.device.category === 'storage') ? '#0ea5e9' : '#64748b'
                                                                            }}
                                                                            onDoubleClick={() => openEditModal(rack.id, slot.uPosition - 1, slot.device!)}
                                                                            title={`${slot.device.name}\n${getCategoryLabel(slot.device.device_library?.device_type?.name || slot.device.category || 'other')} | ${getStatusLabel(slot.device.status)} | ${slot.device.device_library?.power || slot.device.power || 0}W`}
                                                                        >
                                                                            {slot.device.name.length > 18
                                                                                ? slot.device.name.slice(0, 16) + '..'
                                                                                : slot.device.name}
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
                                                                        draggable
                                                                        onDragStart={(e) => {
                                                                            // 从被占用的U位拖动，使用父设备
                                                                            handleDragStart(e, parentDevice);
                                                                        }}
                                                                        className="absolute inset-0 bg-slate-400/20 dark:bg-slate-600/20 cursor-grab z-5"
                                                                        title={`${parentDevice.name} (U${slot.uPosition})\n${getCategoryLabel(parentDevice.device_library?.device_type?.name || parentDevice.category || 'other')} | ${getStatusLabel(parentDevice.status)} | ${parentDevice.device_library?.power || parentDevice.power || 0}W`}
                                                                    />
                                                                )}
                                                                {/* 拖动预览时的提示 */}
                                                                {isDragPreviewTop && draggingDevice && (
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('visualEdit.editDevice')}</DialogTitle>
                        <DialogDescription>{t('visualEdit.editDeviceDesc')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">{t('visualEdit.name')}</Label>
                            <Input
                                id="name"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="model">{t('visualEdit.model')}</Label>
                            <Input
                                id="model"
                                value={editForm.model}
                                onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="manufacturer">{t('visualEdit.manufacturer')}</Label>
                            <Input
                                id="manufacturer"
                                value={editForm.manufacturer}
                                onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="serial_number">{t('visualEdit.serialNumber')}</Label>
                            <Input
                                id="serial_number"
                                value={editForm.serial_number}
                                onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="power">{t('visualEdit.power')} (W)</Label>
                            <Input
                                id="power"
                                type="number"
                                value={editForm.power}
                                onChange={(e) => setEditForm({ ...editForm, power: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="status">{t('visualEdit.status')}</Label>
                            <Select
                                value={editForm.status}
                                onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                            >
                                <SelectTrigger id="status">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="online">{t('visualEdit.online')}</SelectItem>
                                    <SelectItem value="offline">{t('visualEdit.offline')}</SelectItem>
                                    <SelectItem value="maintenance">{t('visualEdit.maintenance')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter className="flex gap-2">
                        <Button variant="outline" onClick={removeDeviceFromRack} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('visualEdit.removeFromRack')}
                        </Button>
                        <Button onClick={saveEdit}>
                            <Save className="mr-2 h-4 w-4" />
                            {t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={addRackModalOpen} onOpenChange={setAddRackModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('visualEdit.quickAddRacks')}</DialogTitle>
                        <DialogDescription>{t('visualEdit.quickAddRacksDesc')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="room">{t('visualEdit.room')}</Label>
                            <Select value={newRackRoom} onValueChange={setNewRackRoom}>
                                <SelectTrigger id="room">
                                    <SelectValue placeholder={t('visualEdit.selectRoom')} />
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
                            <Label htmlFor="rackName">{t('visualEdit.rackNamePrefix')}</Label>
                            <Input
                                id="rackName"
                                value={newRackName}
                                onChange={(e) => setNewRackName(e.target.value)}
                                placeholder={t('visualEdit.rackNamePlaceholder')}
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="uCount">{t('visualEdit.uCount')}</Label>
                                <Input
                                    id="uCount"
                                    type="number"
                                    value={rackU}
                                    onChange={(e) => setRackU(parseInt(e.target.value) || 42)}
                                    min={4}
                                    max={48}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="rows">{t('visualEdit.rows')}</Label>
                                <Input
                                    id="rows"
                                    type="number"
                                    value={rackRows}
                                    onChange={(e) => setRackRows(parseInt(e.target.value) || 1)}
                                    min={1}
                                    max={4}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cols">{t('visualEdit.cols')}</Label>
                                <Input
                                    id="cols"
                                    type="number"
                                    value={rackCols}
                                    onChange={(e) => setRackCols(parseInt(e.target.value) || 2)}
                                    min={1}
                                    max={6}
                                />
                            </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {t('visualEdit.willGenerate', { rows: rackRows, cols: rackCols, total: rackRows * rackCols })}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={generateRacks}>
                            <Plus className="mr-2 h-4 w-4" />
                            {t('visualEdit.generate')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={addDeviceModalOpen} onOpenChange={setAddDeviceModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t('deviceManagement.newDevice')}</DialogTitle>
                        <DialogDescription>{t('deviceManagement.addDeviceDesc')}</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddDevice}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="add-device-type" className="text-right">
                                    {t('deviceLibrary.type')} *
                                </Label>
                                <Select value={selectedDeviceType} onValueChange={handleDeviceTypeChange}>
                                    <SelectTrigger id="add-device-type" className="col-span-3">
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
                                <Label htmlFor="add-device-library" className="text-right">
                                    {t('deviceLibrary.name')} *
                                </Label>
                                <Select value={addDeviceForm.device_library_id} onValueChange={handleDeviceLibraryChange} disabled={!selectedDeviceType}>
                                    <SelectTrigger id="add-device-library" className="col-span-3">
                                        <SelectValue placeholder={t('deviceLibrary.selectDevice')} />
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
                                <Label htmlFor="add-rack" className="text-right">
                                    {t('deviceManagement.rack')}
                                </Label>
                                <Select value={addDeviceForm.rack_id} onValueChange={(value) => setAddDeviceForm({ ...addDeviceForm, rack_id: value === 'none' ? undefined : value })}>
                                    <SelectTrigger id="add-rack" className="col-span-3">
                                        <SelectValue placeholder={t('deviceManagement.selectRack')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">{t('deviceManagement.noRack')}</SelectItem>
                                        {racks.map((rack) => (
                                            <SelectItem key={rack.id} value={rack.id.toString()}>
                                                {rack.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="add-u_position" className="text-right">
                                    {t('deviceManagement.uPosition')} *
                                </Label>
                                <Input
                                    id="add-u_position"
                                    type="number"
                                    min="1"
                                    value={addDeviceForm.u_position}
                                    onChange={(e) => setAddDeviceForm({ ...addDeviceForm, u_position: parseInt(e.target.value) || 1 })}
                                    className="col-span-3"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="add-ip" className="text-right">
                                    {t('deviceManagement.ipAddress')}
                                </Label>
                                <Input
                                    id="add-ip"
                                    value={addDeviceForm.ip_address}
                                    onChange={(e) => setAddDeviceForm({ ...addDeviceForm, ip_address: e.target.value })}
                                    className="col-span-3"
                                    placeholder="192.168.1.1"
                                />
                            </div>

                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="add-status" className="text-right">
                                    {t('deviceManagement.status')} *
                                </Label>
                                <Select value={addDeviceForm.status} onValueChange={(value) => setAddDeviceForm({ ...addDeviceForm, status: value })}>
                                    <SelectTrigger id="add-status" className="col-span-3">
                                        <SelectValue placeholder={t('deviceManagement.selectStatus')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="online">{t('deviceManagement.statuses.online')}</SelectItem>
                                        <SelectItem value="offline">{t('deviceManagement.statuses.offline')}</SelectItem>
                                        <SelectItem value="maintenance">{t('deviceManagement.statuses.maintenance')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setAddDeviceModalOpen(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={!selectedDeviceType || !addDeviceForm.device_library_id}>
                                {t('common.create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
