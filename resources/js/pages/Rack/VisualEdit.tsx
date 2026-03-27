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
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
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
}

interface Rack {
    id: number;
    room_id: number;
    name: string;
    u_count: number;
    power: number;
    device_count: number;
    room?: Room;
    devices?: Device[];
}

interface Room {
    id: number;
    name: string;
}

interface Props {
    racks: Rack[];
    rooms: Room[];
    devices: Device[];
    selectedRoom?: string;
    breadcrumbs?: Array<{ title: string; href: string }>;
}

interface RackSlot {
    deviceId: number | null;
    device?: Device | null;
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

const categoryColors: Record<string, string> = {
    server: 'bg-blue-500',
    network: 'bg-cyan-500',
    storage: 'bg-sky-400',
    other: 'bg-slate-500',
};

export default function RackVisualEdit({ racks, rooms, devices, selectedRoom: initialRoom, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const [selectedRoom, setSelectedRoom] = useState<string>(initialRoom || 'all');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [previewMode, setPreviewMode] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [addRackModalOpen, setAddRackModalOpen] = useState(false);
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

    const racksData: RackDisplay[] = useMemo(() => {
        return racks.map(rack => {
            const slots: RackSlot[] = [];
            for (let i = 0; i < rack.u_count; i++) {
                const device = rack.devices?.find(d => d.u_position === i + 1);
                slots.push({
                    deviceId: device?.id || null,
                    device: device || null,
                });
            }
            return {
                id: rack.id,
                name: rack.name,
                room_id: rack.room_id,
                totalU: rack.u_count,
                slots,
                maxPower: rack.power || 5000,
                curPower: rack.devices?.reduce((sum, d) => sum + (d.power || 0), 0) || 0,
            };
        });
    }, [racks]);

    const unassignedDevices = useMemo(() => {
        return devices.filter(d => !d.rack_id);
    }, [devices]);

    const filteredDevices = useMemo(() => {
        return unassignedDevices.filter(d => {
            if (activeCategory !== 'all' && d.category !== activeCategory) return false;
            return true;
        });
    }, [unassignedDevices, activeCategory]);

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
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (e: React.DragEvent, rackId: number, uIndex: number) => {
        e.preventDefault();
        const deviceId = parseInt(e.dataTransfer.getData('deviceId'));
        if (isNaN(deviceId)) return;

        router.put(`/devices/${deviceId}`, {
            rack_id: rackId,
            u_position: uIndex + 1,
        }, {
            onSuccess: () => {
                router.reload({ only: ['racks', 'devices'] });
            }
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
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
        return t(`visualEdit.${category}`);
    };

    const getStatusLabel = (status: string) => {
        return t(`visualEdit.${status}`);
    };

    const categories = [
        { value: 'all', label: t('visualEdit.all') },
        { value: 'server', label: t('visualEdit.server') },
        { value: 'network', label: t('visualEdit.network') },
        { value: 'storage', label: t('visualEdit.storage') },
        { value: 'other', label: t('visualEdit.other') },
    ];

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
                    <Card className="w-80 flex-shrink-0">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <HardDrive className="h-4 w-4" />
                                    {t('visualEdit.deviceLibrary')}
                                </CardTitle>
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
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
                                    >
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
                                            <TableHead className="h-8 text-xs">{t('visualEdit.power')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredDevices.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground text-sm">
                                                    {t('visualEdit.noUnassignedDevices')}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredDevices.map((device) => (
                                                <TableRow
                                                    key={device.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, device)}
                                                    className="cursor-grab border-b border-border/50 transition-colors hover:bg-muted/30"
                                                >
                                                    <TableCell className="py-2 text-sm font-medium">
                                                        {device.name}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${categoryColors[device.category] || 'bg-slate-500'}`}>
                                                            {getCategoryLabel(device.category)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-sm text-muted-foreground">
                                                        {device.power || 0}W
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
                                                    style={{ minHeight: `${rack.totalU * 24}px`, width: '120px' }}
                                                >
                                                    {rack.slots.map((slot, uIndex) => (
                                                        <div
                                                            key={uIndex}
                                                            className="flex h-6 items-center justify-center border-b border-border/50 text-[10px]"
                                                            onDragOver={handleDragOver}
                                                            onDrop={(e) => handleDrop(e, rack.id, uIndex)}
                                                            style={{
                                                                backgroundColor: slot.device ? undefined : 'transparent'
                                                            }}
                                                        >
                                                            {!slot.device && (
                                                                <span className="text-muted-foreground">
                                                                    {rack.totalU - uIndex}
                                                                </span>
                                                            )}
                                                            {slot.device && (
                                                                <div
                                                                    className="flex h-full w-full items-center justify-center truncate px-1 text-[9px] font-medium text-white cursor-pointer"
                                                                    style={{
                                                                        backgroundColor: slot.device.category === 'server' ? '#3b82f6' :
                                                                                         slot.device.category === 'network' ? '#06b6d4' :
                                                                                         slot.device.category === 'storage' ? '#0ea5e9' : '#64748b'
                                                                    }}
                                                                    onDoubleClick={() => openEditModal(rack.id, uIndex, slot.device!)}
                                                                    title={`${slot.device.name}\n${getCategoryLabel(slot.device.category)} | ${getStatusLabel(slot.device.status)} | ${slot.device.power || 0}W`}
                                                                >
                                                                    {slot.device.name.length > 10
                                                                        ? slot.device.name.slice(0, 8) + '..'
                                                                        : slot.device.name}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex items-center justify-between rounded-b-lg bg-muted px-3 py-1.5 text-xs">
                                                    <span className="text-yellow-500">
                                                        {rack.curPower}/{rack.maxPower}W
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {rack.slots.filter(s => s.device).length}/{rack.totalU}U
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
        </AppLayout>
    );
}
