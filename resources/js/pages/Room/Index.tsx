import { Head, router, usePage } from '@inertiajs/react';
import {
    Pencil,
    Trash2,
    Plus,
    Search,
    X,
    Building2,
    MapPin,
    Server,
    User,
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

interface Room {
    id: number;
    name: string;
    location: string;
    racks_count: number;
    manager: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
}

interface Props {
    rooms: Room[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function RoomIndex({ rooms, breadcrumbs = [] }: Props) {
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
    const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null);
    const [viewingRoom, setViewingRoom] = useState<Room | null>(null);
    const [editingRoom, setEditingRoom] = useState<Room | null>(null);
    const [form, setForm] = useState({
        name: '',
        location: '',
        manager: '',
        description: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [managerFilter, setManagerFilter] = useState<string>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const handleDelete = (roomId: number) => {
        setDeletingRoomId(roomId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deletingRoomId) {
            router.delete(`/rooms/${deletingRoomId}`, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingRoomId(null);
                },
            });
        }
    };

    const cancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setDeletingRoomId(null);
    };

    const openEditDialog = (room: Room) => {
        setEditingRoom(room);
        setForm({
            name: room.name,
            location: room.location,
            manager: room.manager || '',
            description: room.description || '',
        });
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingRoom(null);
        setForm({
            name: '',
            location: '',
            manager: '',
            description: '',
        });
    };

    const openDetailDialog = (room: Room) => {
        setViewingRoom(room);
        setIsDetailDialogOpen(true);
    };

    const closeDetailDialog = () => {
        setIsDetailDialogOpen(false);
        setViewingRoom(null);
    };

    const openCreateDialog = () => {
        setForm({
            name: '',
            location: '',
            manager: '',
            description: '',
        });
        setIsCreateDialogOpen(true);
    };

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setForm({
            name: '',
            location: '',
            manager: '',
            description: '',
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingRoom) {
            router.put(`/rooms/${editingRoom.id}`, form, {
                onSuccess: () => closeEditDialog(),
            });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/rooms', form, {
            onSuccess: () => closeCreateDialog(),
        });
    };

    const filteredRooms = useMemo(() => {
        return rooms.filter((room) => {
            const matchesSearch =
                searchTerm === '' ||
                room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                room.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (room.manager && room.manager.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesLocation =
                locationFilter === 'all' || room.location === locationFilter;

            const matchesManager =
                managerFilter === 'all' ||
                (managerFilter === 'none' && !room.manager) ||
                room.manager === managerFilter;

            return matchesSearch && matchesLocation && matchesManager;
        });
    }, [rooms, searchTerm, locationFilter, managerFilter]);

    const uniqueLocations = useMemo(() => {
        return Array.from(new Set(rooms.map((room) => room.location)));
    }, [rooms]);

    const uniqueManagers = useMemo(() => {
        return Array.from(
            new Set(rooms.map((room) => room.manager).filter(Boolean) as string[])
        );
    }, [rooms]);

    const paginatedRooms = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredRooms.slice(startIndex, endIndex);
    }, [filteredRooms, currentPage]);

    const totalPages = Math.ceil(filteredRooms.length / itemsPerPage);

    const clearSearch = () => {
        setSearchTerm('');
    };

    const clearFilters = () => {
        setSearchTerm('');
        setLocationFilter('all');
        setManagerFilter('all');
        setCurrentPage(1);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('roomManagement.title')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('roomManagement.title')}
                    </h1>
                    <Button onClick={openCreateDialog}>
                        <Plus className="mr-2 h-4 w-4" />
                        {t('roomManagement.addRoom')}
                    </Button>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={t('roomManagement.searchPlaceholder')}
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
                            value={locationFilter}
                            onValueChange={(value) => {
                                setLocationFilter(value);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder={t('roomManagement.allLocations')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('roomManagement.allLocations')}
                                </SelectItem>
                                {uniqueLocations.map((location) => (
                                    <SelectItem key={location} value={location}>
                                        {location}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={managerFilter}
                            onValueChange={(value) => {
                                setManagerFilter(value);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder={t('roomManagement.allManagers')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('roomManagement.allManagers')}
                                </SelectItem>
                                <SelectItem value="none">
                                    {t('roomManagement.unassigned')}
                                </SelectItem>
                                {uniqueManagers.map((manager) => (
                                    <SelectItem key={manager} value={manager}>
                                        {manager}
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
                                <CardTitle>{t('roomManagement.rooms')}</CardTitle>
                                <CardDescription>
                                    {t('roomManagement.manageRooms')}
                                </CardDescription>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('roomManagement.roomsCount', {
                                    filtered: filteredRooms.length,
                                    total: rooms.length,
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
                                            {t('roomManagement.name')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            {t('roomManagement.location')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <Server className="h-4 w-4" />
                                            {t('roomManagement.rackCount')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4" />
                                            {t('roomManagement.manager')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('roomManagement.created')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4 text-right">
                                        {t('roomManagement.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRooms.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm ||
                                            locationFilter !== 'all' ||
                                            managerFilter !== 'all' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'roomManagement.noRoomsFound',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={clearFilters}
                                                    >
                                                        {t(
                                                            'roomManagement.clearFilters',
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Plus className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'roomManagement.noRooms',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={openCreateDialog}
                                                    >
                                                        {t(
                                                            'roomManagement.addFirstRoom',
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRooms.map((room) => (
                                        <TableRow
                                            key={room.id}
                                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                        >
                                            <TableCell className="px-4 py-3 font-medium">
                                                {room.name}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {room.location}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Server className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-semibold">
                                                        {room.racks_count}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {room.manager ? (
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        <span>{room.manager}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        -
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {new Date(
                                                    room.created_at,
                                                ).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openDetailDialog(room)
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openEditDialog(room)
                                                        }
                                                        className="h-8 w-8 p-0"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDelete(room.id)
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
                                    {t('roomManagement.roomsCount', {
                                        filtered: filteredRooms.length,
                                        total: rooms.length,
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
                                        { t('general.previousPage') }
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
                                        { t('general.nextPage') }
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
                                {t('roomManagement.createRoom')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('roomManagement.addNewRoom')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                                <div className="grid gap-2">
                                    <Label htmlFor="name">
                                        {t('roomManagement.name')} *
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
                                        placeholder={t('roomManagement.name')}
                                    />
                                    {errors?.name && (
                                        <p className="text-sm text-destructive">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="location">
                                        {t('roomManagement.location')} *
                                    </Label>
                                    <Input
                                        id="location"
                                        value={form.location}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                location: e.target.value,
                                            })
                                        }
                                        placeholder={t('roomManagement.location')}
                                    />
                                    {errors?.location && (
                                        <p className="text-sm text-destructive">
                                            {errors.location}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="manager">
                                        {t('roomManagement.manager')}
                                    </Label>
                                    <Input
                                        id="manager"
                                        value={form.manager}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                manager: e.target.value,
                                            })
                                        }
                                        placeholder={t('roomManagement.manager')}
                                    />
                                    {errors?.manager && (
                                        <p className="text-sm text-destructive">
                                            {errors.manager}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">
                                        {t('roomManagement.description')}
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
                                        placeholder={t('roomManagement.description')}
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
                                    {t('roomManagement.cancel')}
                                </Button>
                                <Button type="submit">
                                    {t('roomManagement.createRoom')}
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
                                {t('roomManagement.editRoom')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('roomManagement.updateRoom')}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="grid gap-4 py-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-name">
                                        {t('roomManagement.name')} *
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
                                        placeholder={t('roomManagement.name')}
                                    />
                                    {errors?.name && (
                                        <p className="text-sm text-destructive">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-location">
                                        {t('roomManagement.location')} *
                                    </Label>
                                    <Input
                                        id="edit-location"
                                        value={form.location}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                location: e.target.value,
                                            })
                                        }
                                        placeholder={t('roomManagement.location')}
                                    />
                                    {errors?.location && (
                                        <p className="text-sm text-destructive">
                                            {errors.location}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-manager">
                                        {t('roomManagement.manager')}
                                    </Label>
                                    <Input
                                        id="edit-manager"
                                        value={form.manager}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setForm({
                                                ...form,
                                                manager: e.target.value,
                                            })
                                        }
                                        placeholder={t('roomManagement.manager')}
                                    />
                                    {errors?.manager && (
                                        <p className="text-sm text-destructive">
                                            {errors.manager}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="edit-description">
                                        {t('roomManagement.description')}
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
                                        placeholder={t('roomManagement.description')}
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
                                    {t('roomManagement.cancel')}
                                </Button>
                                <Button type="submit">
                                    {t('roomManagement.updateRoom')}
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
                                {t('roomManagement.roomDetails')}
                            </DialogTitle>
                            <DialogDescription>
                                {viewingRoom?.name}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('roomManagement.name')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRoom?.name}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('roomManagement.location')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRoom?.location}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('roomManagement.rackCount')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRoom?.racks_count}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('roomManagement.manager')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRoom?.manager || '-'}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-medium">
                                    {t('roomManagement.description')}
                                </Label>
                                <div className="mt-1 text-sm">
                                    {viewingRoom?.description || '-'}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('roomManagement.created')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRoom?.created_at
                                            ? new Date(
                                                  viewingRoom.created_at,
                                              ).toLocaleString()
                                            : '-'}
                                    </div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">
                                        {t('common.updated')}
                                    </Label>
                                    <div className="mt-1 text-sm">
                                        {viewingRoom?.updated_at
                                            ? new Date(
                                                  viewingRoom.updated_at,
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
                                {t('roomManagement.confirmDelete')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('roomManagement.deleteWarning')}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={cancelDelete}
                            >
                                {t('roomManagement.cancel')}
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
