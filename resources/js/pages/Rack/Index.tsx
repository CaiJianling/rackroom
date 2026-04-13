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
    Building2,
    Eye,
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
    flash?: {
        success?: string;
        error?: string;
        warning?: string;
        info?: string;
    };
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

interface Rack {
    id: number;
    room_id: number;
    rack_type_id: number | null;
    name: string;
    u_count: number;
    power: number;
    device_count: number;
    devices_count: number;
    description: string | null;
    created_at: string;
    updated_at: string;
    room?: Room;
    rack_type?: RackType;
}

interface Props {
    racks: Rack[];
    rooms: Room[];
    rackTypes?: RackType[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function RackIndex({ racks, rooms, rackTypes = [], breadcrumbs = [] }: Props) {
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
    const [deletingRackId, setDeletingRackId] = useState<number | null>(null);
    const [viewingRack, setViewingRack] = useState<Rack | null>(null);
    const [editingRack, setEditingRack] = useState<Rack | null>(null);
    const [form, setForm] = useState({
        room_id: '',
        rack_type_id: '',
        name: '',
        u_count: 42,
        power: 0,
        device_count: 0,
        description: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [roomFilter, setRoomFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const handleDelete = (rackId: number) => {
        setDeletingRackId(rackId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deletingRackId) {
            router.delete(`/racks/${deletingRackId}`, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingRackId(null);
                },
            });
        }
    };

    const cancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setDeletingRackId(null);
    };

    const openEditDialog = (rack: Rack) => {
        setEditingRack(rack);
        setForm({
            room_id: rack.room_id.toString(),
            rack_type_id: rack.rack_type_id?.toString() || '',
            name: rack.name,
            u_count: rack.u_count,
            power: rack.power,
            device_count: rack.device_count,
            description: rack.description || '',
        });
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingRack(null);
        setForm({
            room_id: '',
            rack_type_id: '',
            name: '',
            u_count: 42,
            power: 0,
            device_count: 0,
            description: '',
        });
    };

    const openDetailDialog = (rack: Rack) => {
        setViewingRack(rack);
        setIsDetailDialogOpen(true);
    };

    const closeDetailDialog = () => {
        setIsDetailDialogOpen(false);
        setViewingRack(null);
    };

    const openCreateDialog = () => {
        setForm({
            room_id: '',
            rack_type_id: '',
            name: '',
            u_count: 42,
            power: 0,
            device_count: 0,
            description: '',
        });
        setIsCreateDialogOpen(true);
    };

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setForm({
            room_id: '',
            rack_type_id: '',
            name: '',
            u_count: 42,
            power: 0,
            device_count: 0,
            description: '',
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingRack) {
            const submitData = {
                room_id: form.room_id,
                rack_type_id: form.rack_type_id === 'none' ? null : (form.rack_type_id || null),
                name: form.name,
                device_count: form.device_count,
                description: form.description,
            };
            router.put(`/racks/${editingRack.id}`, submitData, {
                onSuccess: () => closeEditDialog(),
            });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const submitData = {
            room_id: form.room_id,
            rack_type_id: form.rack_type_id === 'none' ? null : (form.rack_type_id || null),
            name: form.name,
            device_count: form.device_count,
            description: form.description,
        };
        router.post('/racks', submitData, {
            onSuccess: () => closeCreateDialog(),
        });
    };

    const handleRackTypeChange = (value: string, isEdit = false) => {
        const typeId = value === 'none' ? null : (value || null);
        const selectedType = rackTypes.find(t => t.id.toString() === value);

        if (isEdit) {
            setForm({
                ...form,
                rack_type_id: value,
                u_count: selectedType ? selectedType.u_count : form.u_count,
                power: selectedType ? selectedType.power : form.power,
            });
        } else {
            setForm({
                ...form,
                rack_type_id: value,
                u_count: selectedType ? selectedType.u_count : 42,
                power: selectedType ? selectedType.power : 0,
            });
        }
    };

    const filteredRacks = useMemo(() => {
        return racks.filter((rack) => {
            const matchesSearch =
                searchTerm === '' ||
                rack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (rack.room?.name &&
                    rack.room.name.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesRoom =
                roomFilter === 'all' || rack.room_id.toString() === roomFilter;

            return matchesSearch && matchesRoom;
        });
    }, [racks, searchTerm, roomFilter]);

    const paginatedRacks = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredRacks.slice(startIndex, endIndex);
    }, [filteredRacks, currentPage]);

    const totalPages = Math.ceil(filteredRacks.length / itemsPerPage);

    const clearSearch = () => {
        setSearchTerm('');
    };

    const clearFilters = () => {
        setSearchTerm('');
        setRoomFilter('all');
        setCurrentPage(1);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('rackManagement.title')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('rackManagement.title')}
                    </h1>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('rackManagement.addRack')}
                    </Button>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={t('rackManagement.searchPlaceholder')}
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
                            value={roomFilter}
                            onValueChange={(value) => {
                                setRoomFilter(value);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder={t('rackManagement.allRooms')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('rackManagement.allRooms')}
                                </SelectItem>
                                {rooms.map((room) => (
                                    <SelectItem key={room.id} value={room.id.toString()}>
                                        {room.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>



                <Card className="flex-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('rackManagement.racks')}</CardTitle>
                                <CardDescription>
                                    {t('rackManagement.manageRacks')}
                                </CardDescription>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('rackManagement.racksCount', {
                                    filtered: filteredRacks.length,
                                    total: racks.length,
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
                                            <Building2 className="h-4 w-4" />
                                            {t('rackManagement.room')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4" />
                                            {t('rackManagement.name')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="h-4 w-4" />
                                            {t('rackManagement.rackType')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="h-4 w-4" />
                                            {t('rackManagement.uCount')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Zap className="h-4 w-4" />
                                            {t('rackManagement.power')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4" />
                                            {t('rackManagement.deviceCount')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('rackManagement.created')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4 text-right">
                                        {t('rackManagement.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRacks.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={8}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm || roomFilter !== 'all' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'rackManagement.noRacksFound',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={clearFilters}
                                                    >
                                                        {t(
                                                            'rackManagement.clearFilters',
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Plus className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'rackManagement.noRacks',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={openCreateDialog}
                                                    >
                                                        {t(
                                                            'rackManagement.addFirstRack',
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRacks.map((rack) => (
                                        <TableRow
                                            key={rack.id}
                                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                        >
                                            <TableCell className="px-4 py-3">
                                                {rack.room?.name || '-'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 font-medium">
                                                {rack.name}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {rack.rack_type?.name || '-'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Cpu className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-semibold">
                                                        {rack.u_count}U
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-semibold">
                                                        {rack.power}W
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Server className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-semibold">
                                                        {rack.devices_count}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {new Date(
                                                    rack.created_at,
                                                ).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openDetailDialog(rack)
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openEditDialog(rack)
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDelete(rack.id)
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
                                    {t('rackManagement.racksCount', {
                                        filtered: filteredRacks.length,
                                        total: racks.length,
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
                    <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {t('rackManagement.createRack')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('rackManagement.addNewRack')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                                <div className="grid gap-2">
                                    <Label htmlFor="room_id">
                                        {t('rackManagement.room')} *
                                    </Label>
                                    <Select
                                        value={form.room_id}
                                        onValueChange={(value) =>
                                            setForm({
                                                ...form,
                                                room_id: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('rackManagement.selectRoom')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rooms.map((room) => (
                                                <SelectItem
                                                    key={room.id}
                                                    value={room.id.toString()}
                                                >
                                                    {room.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors?.room_id && (
                                        <p className="text-sm text-destructive">
                                            {errors.room_id}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="rack_type_id">
                                        {t('rackManagement.rackType')}
                                    </Label>
                                    <Select
                                        value={form.rack_type_id}
                                        onValueChange={(value) =>
                                            handleRackTypeChange(value)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('rackManagement.selectRackType')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">
                                                {t('rackManagement.noRackType')}
                                            </SelectItem>
                                            {rackTypes.map((type) => (
                                                <SelectItem
                                                    key={type.id}
                                                    value={type.id.toString()}
                                                >
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
                                        value={form.name}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                name: e.target.value,
                                            })
                                        }
                                        placeholder={t('rackManagement.name')}
                                    />
                                    {errors?.name && (
                                        <p className="text-sm text-destructive">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="u_count">
                                        {t('rackManagement.uCount')}
                                    </Label>
                                    <Input
                                        id="u_count"
                                        type="number"
                                        value={form.u_count}
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
                                        value={form.power}
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
                                        value={form.device_count}
                                        disabled
                                        className="bg-muted"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">
                                        {t('rackManagement.description')}
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
                                        placeholder={t('rackManagement.description')}
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
                                    {t('rackManagement.cancel')}
                                </Button>
                                <Button type="submit">
                                    {t('rackManagement.createRack')}
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
                                {t('rackManagement.editRack')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('rackManagement.updateRack')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-room_id">
                                        {t('rackManagement.room')} *
                                    </Label>
                                    <Select
                                        value={form.room_id}
                                        onValueChange={(value) =>
                                            setForm({
                                                ...form,
                                                room_id: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('rackManagement.selectRoom')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {rooms.map((room) => (
                                                <SelectItem
                                                    key={room.id}
                                                    value={room.id.toString()}
                                                >
                                                    {room.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors?.room_id && (
                                        <p className="text-sm text-destructive">
                                            {errors.room_id}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-rack_type_id">
                                        {t('rackManagement.rackType')}
                                        {editingRack?.devices_count && editingRack.devices_count > 0 && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                ({t('rackManagement.hasDevicesLocked')})
                                            </span>
                                        )}
                                    </Label>
                                    <Select
                                        value={form.rack_type_id}
                                        disabled={editingRack?.devices_count ? editingRack.devices_count > 0 : false}
                                        onValueChange={(value) =>
                                            handleRackTypeChange(value, true)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('rackManagement.selectRackType')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">
                                                {t('rackManagement.noRackType')}
                                            </SelectItem>
                                            {rackTypes.map((type) => (
                                                <SelectItem
                                                    key={type.id}
                                                    value={type.id.toString()}
                                                >
                                                    {type.name} ({type.u_count}U)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-name">
                                        {t('rackManagement.name')} *
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
                                        placeholder={t('rackManagement.name')}
                                    />
                                    {errors?.name && (
                                        <p className="text-sm text-destructive">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-u_count">
                                        {t('rackManagement.uCount')}
                                    </Label>
                                    <Input
                                        id="edit-u_count"
                                        type="number"
                                        value={form.u_count}
                                        disabled
                                        className="bg-muted"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('rackManagement.autoFilledFromRackType')}
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-power">
                                        {t('rackManagement.power')}
                                    </Label>
                                    <Input
                                        id="edit-power"
                                        type="number"
                                        value={form.power}
                                        disabled
                                        className="bg-muted"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t('rackManagement.autoFilledFromRackType')}
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-device_count">
                                        {t('rackManagement.deviceCount')}
                                    </Label>
                                    <Input
                                        id="edit-device_count"
                                        type="number"
                                        value={form.device_count}
                                        disabled
                                        className="bg-muted"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-description">
                                        {t('rackManagement.description')}
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
                                        placeholder={t('rackManagement.description')}
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
                                    {t('rackManagement.cancel')}
                                </Button>
                                <Button type="submit">
                                    {t('rackManagement.updateRack')}
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
                                {t('rackManagement.rackDetails')}
                            </DialogTitle>
                            <DialogDescription>
                                {viewingRack?.name}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('rackManagement.room')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRack?.room?.name || '-'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('rackManagement.name')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRack?.name}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('rackManagement.uCount')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRack?.u_count}U
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('rackManagement.power')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRack?.power}W
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('rackManagement.deviceCount')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRack?.device_count}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-medium">
                                    {t('rackManagement.description')}
                                </Label>
                                <div className="mt-1 text-sm">
                                    {viewingRack?.description || '-'}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('rackManagement.created')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRack?.created_at
                                            ? new Date(
                                                  viewingRack.created_at,
                                              ).toLocaleString()
                                            : '-'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('common.updated')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRack?.updated_at
                                            ? new Date(
                                                  viewingRack.updated_at,
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
                                {t('rackManagement.confirmDelete')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('rackManagement.deleteWarning')}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={cancelDelete}
                            >
                                {t('rackManagement.cancel')}
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
            </div>
        </AppLayout>
    );
}
