import { Head, router, usePage } from '@inertiajs/react';
import {
    Archive,
    ArrowDownToLine,
    ArrowUpFromLine,
    Plus,
    Trash2,
    RotateCcw,
    X,
    AlertCircle,
    Check,
    ChevronRight,
    ChevronDown,
    FolderOpen,
    HardDrive,
    Server,
    Database,
    Layers,
    Box,
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';

interface Backup {
    id: string;
    filename: string;
    size: string;
    size_bytes: number;
    created_at: string;
}

interface PageProps {
    backups: Backup[];
    errors?: Record<string, string>;
}

// usePage().props 不包含 backups（backups 是直接传入的 props）
interface InertiaPageProps {
    errors?: Record<string, string>;
}

interface BackupPreview {
    version: string;
    exported_at: string | null;
    name: string | null;
    counts: {
        rooms: number;
        rack_types: number;
        racks: number;
        device_types: number;
        device_library: number;
        devices: number;
    };
}

interface RestoreOptions {
    rooms: boolean;
    rack_types: boolean;
    racks: boolean;
    device_types: boolean;
    device_library: boolean;
    devices: boolean;
}

const dataCategories = [
    { key: 'rooms', label: 'backup.categories.rooms', icon: Database, color: 'text-blue-500' },
    { key: 'rack_types', label: 'backup.categories.rackTypes', icon: Layers, color: 'text-purple-500' },
    { key: 'racks', label: 'backup.categories.racks', icon: Server, color: 'text-green-500' },
    { key: 'device_types', label: 'backup.categories.deviceTypes', icon: Box, color: 'text-orange-500' },
    { key: 'device_library', label: 'backup.categories.deviceLibrary', icon: HardDrive, color: 'text-pink-500' },
    { key: 'devices', label: 'backup.categories.devices', icon: Archive, color: 'text-cyan-500' },
] as const;

// 依赖关系图：哪些数据依赖于其他数据
const dependencies: Record<string, string[]> = {
    racks: ['rooms', 'rack_types'],
    device_library: ['device_types'],
    devices: ['racks', 'device_library'],
};

export default function BackupIndex({ backups }: PageProps) {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const { errors } = usePage().props as InertiaPageProps;

    // 创建备份对话框
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [backupName, setBackupName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // 恢复备份对话框
    const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
    const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
    const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
    const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
        rooms: true,
        rack_types: true,
        racks: true,
        device_types: true,
        device_library: true,
        devices: true,
    });
    const [restoreMode, setRestoreMode] = useState<'replace' | 'append'>('replace');
    const [isRestoring, setIsRestoring] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // 删除确认对话框
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingBackup, setDeletingBackup] = useState<Backup | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // 上传备份对话框
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [saveToServer, setSaveToServer] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadPreview, setUploadPreview] = useState<BackupPreview | null>(null);

    const totalSize = useMemo(() => {
        return backups.reduce((sum, b) => sum + (b.size_bytes || 0), 0);
    }, [backups]);

    const formatTotalSize = (bytes: number) => {
        const units = ['B', 'KB', 'MB', 'GB'];
        let unitIndex = 0;
        while (bytes >= 1024 && unitIndex < units.length - 1) {
            bytes /= 1024;
            unitIndex++;
        }
        return `${bytes.toFixed(2)} ${units[unitIndex]}`;
    };

    // 创建备份
    const handleCreateBackup = async () => {
        setIsCreating(true);
        try {
            const response = await fetch('/backup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ name: backupName }),
            });

            const result = await response.json();

            if (result.success) {
                showToast(t('backup.createSuccess'), 'success');
                setCreateDialogOpen(false);
                setBackupName('');
                router.reload({ only: ['backups'] });
            } else {
                showToast(result.message || t('backup.createFailed'), 'error');
            }
        } catch (error) {
            showToast(t('backup.createFailed'), 'error');
        } finally {
            setIsCreating(false);
        }
    };

    // 下载备份
    const handleDownload = (backup: Backup) => {
        window.location.href = `/backup/${backup.id}/download`;
    };

    // 打开恢复对话框
    const openRestoreDialog = async (backup: Backup) => {
        setSelectedBackup(backup);
        setRestoreDialogOpen(true);
        setIsRestoring(true);

        try {
            const response = await fetch(`/backup/${backup.id}`);
            const result = await response.json();

            if (result.success) {
                setBackupPreview(result.preview);
                // 默认全选
                setRestoreOptions({
                    rooms: true,
                    rack_types: true,
                    racks: true,
                    device_types: true,
                    device_library: true,
                    devices: true,
                });
            } else {
                showToast(result.message || '加载备份信息失败', 'error');
                setRestoreDialogOpen(false);
            }
        } catch (error) {
            showToast('加载备份信息失败', 'error');
            setRestoreDialogOpen(false);
        } finally {
            setIsRestoring(false);
        }
    };

    // 处理选项变更（带依赖检查）
    const handleOptionChange = (key: keyof RestoreOptions, checked: boolean) => {
        const newOptions = { ...restoreOptions, [key]: checked };

        // 如果取消选中某一项，需要取消选中依赖它的项
        if (!checked) {
            Object.entries(dependencies).forEach(([dependent, deps]) => {
                if (deps.includes(key) && newOptions[dependent as keyof RestoreOptions]) {
                    newOptions[dependent as keyof RestoreOptions] = false;
                }
            });
        }

        // 如果选中某一项，需要选中它依赖的项
        if (checked && dependencies[key]) {
            dependencies[key].forEach((dep) => {
                newOptions[dep as keyof RestoreOptions] = true;
            });
        }

        setRestoreOptions(newOptions);
    };

    // 检查某项是否应该被禁用（因为依赖项未选中）
    const isOptionDisabled = (key: string): boolean => {
        if (!dependencies[key]) return false;
        return dependencies[key].some((dep) => !restoreOptions[dep as keyof RestoreOptions]);
    };

    // 执行恢复
    const handleRestore = async () => {
        if (!selectedBackup) return;

        setIsRestoring(true);
        try {
            const response = await fetch(`/backup/${selectedBackup.id}/restore`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    options: restoreOptions,
                    mode: restoreMode,
                }),
            });

            const result = await response.json();

            if (result.success) {
                showToast(t('backup.restoreSuccess'), 'success');
                setRestoreDialogOpen(false);
                setSelectedBackup(null);
                setBackupPreview(null);
            } else {
                showToast(result.message || t('backup.restoreFailed'), 'error');
            }
        } catch (error) {
            showToast(t('backup.restoreFailed'), 'error');
        } finally {
            setIsRestoring(false);
        }
    };

    // 打开删除确认对话框
    const openDeleteDialog = (backup: Backup) => {
        setDeletingBackup(backup);
        setDeleteDialogOpen(true);
    };

    // 删除备份
    const handleDelete = async () => {
        if (!deletingBackup) return;

        setIsDeleting(true);
        try {
            const response = await fetch(`/backup/${deletingBackup.id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const result = await response.json();

            if (result.success) {
                showToast(t('backup.deleteSuccess'), 'success');
                setDeleteDialogOpen(false);
                setDeletingBackup(null);
                router.reload({ only: ['backups'] });
            } else {
                showToast(result.message || t('backup.deleteFailed'), 'error');
            }
        } catch (error) {
            showToast(t('backup.deleteFailed'), 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    // 处理文件上传
    const handleFileUpload = async () => {
        if (!uploadFile) return;

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!csrfToken) {
            showToast('CSRF token not found. Please refresh the page.', 'error');
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('save_to_server', saveToServer.toString());

        try {
            const response = await fetch('/backup/upload', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: formData,
            });

            // 检查响应状态
            if (!response.ok) {
                if (response.status === 302 || response.redirected) {
                    throw new Error('Session expired or authentication required. Please refresh the page.');
                }
                const text = await response.text();
                throw new Error(`Server error: ${response.status} - ${text.substring(0, 100)}`);
            }

            const result = await response.json();

            if (result.success) {
                showToast(saveToServer ? t('backup.uploadSuccess') : t('backup.fileParsed'), 'success');
                setUploadDialogOpen(false);
                setUploadFile(null);
                setUploadPreview(null);
                if (saveToServer) {
                    router.reload({ only: ['backups'] });
                }
            } else {
                showToast(result.message || t('backup.uploadFailed'), 'error');
            }
        } catch (error) {
            console.error('Upload error:', error);
            showToast(error instanceof Error ? error.message : t('backup.uploadFailed'), 'error');
        } finally {
            setIsUploading(false);
        }
    };

    // 预览上传的文件
    const previewUploadFile = async (file: File) => {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!csrfToken) {
            console.error('CSRF token not found');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('save_to_server', 'false');

        try {
            const response = await fetch('/backup/upload', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: formData,
            });

            if (!response.ok) {
                console.error('Preview failed:', response.status);
                return;
            }

            const result = await response.json();

            if (result.success) {
                setUploadPreview(result.preview);
            }
        } catch (error) {
            console.error('Preview error:', error);
        }
    };

    return (
        <AppLayout breadcrumbs={[
            { title: t('nav.system'), href: '#' },
            { title: t('nav.backup'), href: '/backup' },
        ]}>
            <Head title={t('backup.title')} />

            <div className="flex flex-col gap-6 p-6">
                {/* 统计卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {t('backup.totalBackups')}
                            </CardTitle>
                            <Archive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{backups.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {t('backup.totalSize')}
                            </CardTitle>
                            <HardDrive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatTotalSize(totalSize)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {t('backup.latestBackup')}
                            </CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {backups.length > 0 ? backups[0].created_at.split(' ')[0] : '-'}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 备份列表 */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('backup.list')}</CardTitle>
                                <CardDescription>{t('backup.listDesc')}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                                    <ArrowUpFromLine className="mr-2 h-4 w-4" />
                                    {t('backup.upload')}
                                </Button>
                                <Button onClick={() => setCreateDialogOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    {t('backup.create')}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {backups.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Archive className="mx-auto h-12 w-12 opacity-20 mb-2" />
                                <p>{t('backup.noBackups')}</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('backup.filename')}</TableHead>
                                        <TableHead>{t('backup.size')}</TableHead>
                                        <TableHead>{t('backup.createdAt')}</TableHead>
                                        <TableHead className="text-right">{t('common.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {backups.map((backup) => (
                                        <TableRow key={backup.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Archive className="h-4 w-4 text-muted-foreground" />
                                                    {backup.filename}
                                                </div>
                                            </TableCell>
                                            <TableCell>{backup.size}</TableCell>
                                            <TableCell>{backup.created_at}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDownload(backup)}
                                                    >
                                                        <ArrowDownToLine className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openRestoreDialog(backup)}
                                                    >
                                                        <RotateCcw className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => openDeleteDialog(backup)}
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 创建备份对话框 */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('backup.create')}</DialogTitle>
                        <DialogDescription>{t('backup.createDesc')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="backup-name" className="text-right">
                                {t('backup.name')}
                            </Label>
                            <Input
                                id="backup-name"
                                value={backupName}
                                onChange={(e) => setBackupName(e.target.value)}
                                placeholder={t('backup.namePlaceholder')}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleCreateBackup} disabled={isCreating}>
                            {isCreating ? t('backup.creating') : t('backup.create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 恢复备份对话框 */}
            <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{t('backup.restore')}</DialogTitle>
                        <DialogDescription>
                            {selectedBackup?.filename}
                        </DialogDescription>
                    </DialogHeader>

                    {backupPreview && (
                        <div className="flex-1 overflow-y-auto py-4">
                            {/* 恢复模式选择 */}
                            <div className="mb-6">
                                <Label className="text-base font-medium mb-3 block">
                                    {t('backup.restoreMode')}
                                </Label>
                                <RadioGroup
                                    value={restoreMode}
                                    onValueChange={(v) => setRestoreMode(v as 'replace' | 'append')}
                                    className="grid grid-cols-2 gap-4"
                                >
                                    <div className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                                        restoreMode === 'replace' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                                    }`}>
                                        <RadioGroupItem value="replace" id="replace" className="sr-only" />
                                        <Label htmlFor="replace" className="cursor-pointer">
                                            <div className="font-medium mb-1">{t('backup.modeReplace')}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {t('backup.modeReplaceDesc')}
                                            </div>
                                        </Label>
                                    </div>
                                    <div className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                                        restoreMode === 'append' ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                                    }`}>
                                        <RadioGroupItem value="append" id="append" className="sr-only" />
                                        <Label htmlFor="append" className="cursor-pointer">
                                            <div className="font-medium mb-1">{t('backup.modeAppend')}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {t('backup.modeAppendDesc')}
                                            </div>
                                        </Label>
                                    </div>
                                </RadioGroup>

                                {restoreMode === 'replace' && (
                                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800 flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                        {t('backup.replaceWarning')}
                                    </div>
                                )}
                            </div>

                            {/* 数据选择 */}
                            <div>
                                <Label className="text-base font-medium mb-3 block">
                                    {t('backup.selectData')}
                                </Label>
                                <div className="space-y-2 border rounded-md p-4">
                                    {dataCategories.map((category) => {
                                        const Icon = category.icon;
                                        const count = backupPreview.counts[category.key as keyof typeof backupPreview.counts];
                                        const isDisabled = isOptionDisabled(category.key);

                                        return (
                                            <div
                                                key={category.key}
                                                className={`flex items-center justify-between p-2 rounded ${
                                                    isDisabled ? 'opacity-50' : 'hover:bg-muted'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Checkbox
                                                        id={`restore-${category.key}`}
                                                        checked={restoreOptions[category.key as keyof RestoreOptions]}
                                                        onCheckedChange={(checked) =>
                                                            handleOptionChange(category.key as keyof RestoreOptions, checked as boolean)
                                                        }
                                                        disabled={isDisabled}
                                                    />
                                                    <Icon className={`h-4 w-4 ${category.color}`} />
                                                    <Label
                                                        htmlFor={`restore-${category.key}`}
                                                        className="cursor-pointer font-normal"
                                                    >
                                                        {t(category.label)}
                                                    </Label>
                                                </div>
                                                <span className="text-sm text-muted-foreground">
                                                    {count} {t('backup.items')}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={handleRestore}
                            disabled={isRestoring || !Object.values(restoreOptions).some(Boolean)}
                        >
                            {isRestoring ? t('backup.restoring') : t('backup.restore')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 删除确认对话框 */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
                        <DialogDescription>
                            {t('backup.deleteConfirm')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? t('backup.deleting') : t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 上传备份对话框 */}
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('backup.upload')}</DialogTitle>
                        <DialogDescription>{t('backup.uploadDesc')}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="backup-file">{t('backup.file')}</Label>
                            <Input
                                id="backup-file"
                                type="file"
                                accept=".json"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setUploadFile(file);
                                        previewUploadFile(file);
                                    }
                                }}
                            />
                        </div>

                        {uploadPreview && (
                            <div className="p-3 bg-muted rounded-md">
                                <div className="text-sm font-medium mb-2">{t('backup.preview')}</div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {dataCategories.map((cat) => (
                                        <div key={cat.key} className="flex justify-between">
                                            <span className="text-muted-foreground">{t(cat.label)}:</span>
                                            <span>{uploadPreview.counts[cat.key as keyof typeof uploadPreview.counts]}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="save-to-server"
                                checked={saveToServer}
                                onCheckedChange={(checked) => setSaveToServer(checked as boolean)}
                            />
                            <Label htmlFor="save-to-server" className="cursor-pointer">
                                {t('backup.saveToServer')}
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setUploadDialogOpen(false);
                            setUploadFile(null);
                            setUploadPreview(null);
                        }}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={handleFileUpload}
                            disabled={isUploading || !uploadFile}
                        >
                            {isUploading ? t('backup.uploading') : t('backup.upload')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}