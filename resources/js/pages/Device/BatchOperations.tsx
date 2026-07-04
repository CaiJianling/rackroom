import { Head, router, usePage } from '@inertiajs/react';
import {
    Upload,
    Download,
    ArrowRight,
    FileSpreadsheet,
    Server,
    Search,
    X,
    Plus,
    Minus,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Loader2,
    Power,
    PowerOff,
    RefreshCw,
    ArrowUpDown,
    ChevronDown,
    ChevronUp,
    Trash2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface Rack {
    id: number;
    name: string;
    u_count: number;
    room?: {
        id: number;
        name: string;
    };
}

interface DeviceLibraryItem {
    id: number;
    name: string;
    model: string | null;
    manufacturer: string | null;
    u_height: number;
    power: number;
    device_type_id: number;
}

interface DeviceType {
    id: number;
    name: string;
    icon: string | null;
    color: string | null;
}

interface Device {
    id: number;
    rack_id: number | null;
    device_library_id: number | null;
    name: string;
    serial_number: string | null;
    u_position: number;
    ip_address: string | null;
    status: string;
    description: string | null;
    rack?: Rack;
    device_library?: DeviceLibraryItem;
}

interface Props {
    racks: Rack[];
    deviceLibrary: DeviceLibraryItem[];
    deviceTypes: DeviceType[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

interface ImportPreviewRow {
    row_number: number;
    name: string;
    rack_id?: number;
    rack_name?: string;
    device_library_id?: number;
    device_library_name?: string;
    u_position: number;
    u_height?: number;
    ip_address?: string;
    connection_type?: string;
    connection_port?: number;
    status: string;
    description?: string;
    _selected?: boolean;
}

interface MigrationItem {
    device_id: number;
    device_name: string;
    current_rack: string;
    current_u_position: number;
    target_rack: string;
    target_rack_id: number;
    target_u_position: number;
    u_height: number;
    _selected?: boolean;
}

interface PowerScheduleItem {
    device_id: number;
    device_name: string;
    ip_address: string;
    rack_name: string;
    current_status: string;
    action: 'power_on' | 'power_off';
    action_label: string;
    _selected?: boolean;
}

const BREADCRUMBS = [
    { title: '设备管理', href: '#' },
    { title: '批量操作', href: '/devices/batch-operations' },
];

export default function DeviceBatchOperations({ racks, deviceLibrary, breadcrumbs = BREADCRUMBS }: Props) {
    const { t } = useTranslation();
    const { flash, errors } = usePage().props as PageProps;
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState('import');

    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
    const [importErrors, setImportErrors] = useState<any[]>([]);
    const [importLoading, setImportLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [selectAllImport, setSelectAllImport] = useState(true);

    const [migrationDevices, setMigrationDevices] = useState<Device[]>([]);
    const [migrationItems, setMigrationItems] = useState<MigrationItem[]>([]);
    const [migrationLoading, setMigrationLoading] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const [selectAllMigration, setSelectAllMigration] = useState(true);
    const [migrationSourceRack, setMigrationSourceRack] = useState<string>('');

    const [powerDevices, setPowerDevices] = useState<Device[]>([]);
    const [powerItems, setPowerItems] = useState<PowerScheduleItem[]>([]);
    const [powerLoading, setPowerLoading] = useState(false);
    const [executingPower, setExecutingPower] = useState(false);
    const [selectAllPower, setSelectAllPower] = useState(true);

    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmAction, setConfirmAction] = useState<'import' | 'migrate' | 'power'>('import');
    const [confirmLoading, setConfirmLoading] = useState(false);

    const selectedImportRows = useMemo(() => {
        return importPreview.filter(row => row._selected);
    }, [importPreview]);

    const selectedMigrationRows = useMemo(() => {
        return migrationItems.filter(item => item._selected);
    }, [migrationItems]);

    const selectedPowerRows = useMemo(() => {
        return powerItems.filter(item => item._selected);
    }, [powerItems]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
            showToast(t('batchOperations.uploadCSVError'), 'error');
            return;
        }

        setImportFile(file);
        setImportLoading(true);
        setImportErrors([]);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/batch-operations/devices/preview-import', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                const rowsWithSelection = data.data.map((row: ImportPreviewRow) => ({
                    ...row,
                    _selected: true,
                }));
                setImportPreview(rowsWithSelection);
                setImportErrors(data.errors || []);
                if (data.errors?.length > 0) {
                    showToast(`预览完成，发现 ${data.errors.length} 个问题`, 'warning');
                } else {
                    showToast(`预览完成，共 ${data.total} 条数据`, 'success');
                }
            } else {
                showToast(data.message || '预览失败', 'error');
            }
        } catch (error) {
            console.error('Preview failed:', error);
            showToast('预览失败，请检查文件格式', 'error');
        } finally {
            setImportLoading(false);
        }
    };

    const handleImport = () => {
        if (selectedImportRows.length === 0) {
            showToast(t('batchOperations.selectImportData'), 'warning');
            return;
        }
        setConfirmAction('import');
        setConfirmDialogOpen(true);
    };

    const executeImport = async () => {
        setConfirmLoading(true);

        try {
            const response = await fetch('/api/batch-operations/devices/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    devices: selectedImportRows.map(row => ({
                        name: row.name,
                        rack_id: row.rack_id,
                        device_library_id: row.device_library_id,
                        u_position: row.u_position,
                        ip_address: row.ip_address,
                        connection_type: row.connection_type,
                        connection_port: row.connection_port,
                        status: row.status,
                        description: row.description,
                    })),
                }),
            });

            const data = await response.json();

            if (data.success) {
                showToast(data.message, 'success');
                setImportPreview([]);
                setImportFile(null);
                setConfirmDialogOpen(false);
            } else {
                showToast(data.message || '导入失败', 'error');
            }
        } catch (error) {
            console.error('Import failed:', error);
            showToast(t('batchOperations.importFailed'), 'error');
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleLoadMigrationDevices = async () => {
        if (!migrationSourceRack) {
            showToast('请先选择源机柜', 'warning');
            return;
        }

        setMigrationLoading(true);

        try {
            const response = await fetch(`/api/batch-operations/devices/by-rack/${migrationSourceRack}`);

            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                } catch (e) {
                    try {
                        const text = await response.text();
                        console.error('Server response (first 500 chars):', text.substring(0, 500));
                    } catch {}
                }
                console.error('Load devices failed:', errorMsg);
                showToast(`加载设备失败: ${errorMsg}`, 'error');
                setMigrationLoading(false);
                return;
            }

            const data = await response.json();

            if (data.success) {
                setMigrationDevices(data.data);
                const items = data.data.map((device: Device) => ({
                    device_id: device.id,
                    device_name: device.name,
                    current_rack: device.rack?.name || '未分配',
                    current_u_position: device.u_position,
                    target_rack: '',
                    target_rack_id: 0,
                    target_u_position: device.u_position,
                    u_height: device.device_library?.u_height || 1,
                    _selected: true,
                }));
                setMigrationItems(items);
                showToast(`已加载 ${data.data.length} 台设备`, 'success');
            } else {
                console.error('Load devices failed:', data.message);
                showToast(`加载设备失败: ${data.message || '未知错误'}`, 'error');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '网络错误或服务器无响应';
            console.error('Load devices failed:', errorMessage);
            showToast(`加载设备失败: ${errorMessage}`, 'error');
        } finally {
            setMigrationLoading(false);
        }
    };

    const handleMigrationTargetRackChange = (index: number, targetRackId: string, targetRackName: string) => {
        const newItems = [...migrationItems];
        newItems[index] = {
            ...newItems[index],
            target_rack_id: parseInt(targetRackId),
            target_rack: targetRackName,
        };
        setMigrationItems(newItems);
    };

    const handleMigrationUPositionChange = (index: number, uPosition: number) => {
        const newItems = [...migrationItems];
        newItems[index] = {
            ...newItems[index],
            target_u_position: uPosition,
        };
        setMigrationItems(newItems);
    };

    const handlePreviewMigration = async () => {
        const itemsToMigrate = selectedMigrationRows.filter(item => item.target_rack_id > 0);
        if (itemsToMigrate.length === 0) {
            showToast('请至少选择一个目标机柜', 'warning');
            return;
        }

        setMigrationLoading(true);

        try {
            const response = await fetch('/api/batch-operations/devices/preview-migration', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    devices: itemsToMigrate.map(item => ({
                        device_id: item.device_id,
                        target_rack_id: item.target_rack_id,
                        target_u_position: item.target_u_position,
                    })),
                }),
            });

            const data = await response.json();

            if (data.success) {
                showToast(`校验通过，可以执行迁移`, 'success');
                setConfirmAction('migrate');
                setConfirmDialogOpen(true);
            } else {
                setMigrationItems(prev => prev.map(item => {
                    const error = data.errors?.find((e: any) => e.device_name === item.device_name);
                    if (error) {
                        return { ...item, _error: error.errors[0] };
                    }
                    return { ...item, _error: undefined };
                }));
                showToast(`校验失败，发现 ${data.errors?.length || 0} 个问题`, 'error');
            }
        } catch (error) {
            console.error('Preview migration failed:', error);
            showToast('校验失败', 'error');
        } finally {
            setMigrationLoading(false);
        }
    };

    const executeMigration = async () => {
        const itemsToMigrate = selectedMigrationRows.filter(item => item.target_rack_id > 0);
        setConfirmLoading(true);

        try {
            const response = await fetch('/api/batch-operations/devices/migrate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    devices: itemsToMigrate.map(item => ({
                        device_id: item.device_id,
                        target_rack_id: item.target_rack_id,
                        target_u_position: item.target_u_position,
                    })),
                }),
            });

            const data = await response.json();

            if (data.success) {
                showToast(data.message, 'success');
                setMigrationDevices([]);
                setMigrationItems([]);
                setMigrationSourceRack('');
                setConfirmDialogOpen(false);
            } else {
                showToast(data.message || '迁移失败', 'error');
            }
        } catch (error) {
            console.error('Migration failed:', error);
            showToast('迁移失败', 'error');
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleLoadPowerDevices = async (rackId: string) => {
        if (!rackId) {
            setPowerDevices([]);
            setPowerItems([]);
            return;
        }

        setPowerLoading(true);

        try {
            const response = await fetch(`/api/batch-operations/devices/by-rack/${rackId}`);

            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorData.error || errorMsg;
                } catch (e) {
                    try {
                        const text = await response.text();
                        console.error('Server response (first 500 chars):', text.substring(0, 500));
                    } catch {}
                }
                console.error('Load devices failed:', errorMsg);
                window.alert(`加载设备失败!\n\n${errorMsg}`);
                showToast(`加载设备失败: ${errorMsg}`, 'error');
                setPowerLoading(false);
                return;
            }

            const data = await response.json();

            if (data.success) {
                setPowerDevices(data.data);
                const items = data.data.map((device: Device) => ({
                    device_id: device.id,
                    device_name: device.name,
                    ip_address: device.ip_address || '',
                    rack_name: device.rack?.name || '未分配',
                    current_status: device.status,
                    action: 'power_on' as const,
                    action_label: '开机',
                    _selected: true,
                }));
                setPowerItems(items);
            } else {
                console.error('Load devices failed:', data.message);
                showToast(`加载设备失败: ${data.message || '未知错误'}`, 'error');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '网络错误或服务器无响应';
            console.error('Load devices failed:', errorMessage);
            showToast(`加载设备失败: ${errorMessage}`, 'error');
        } finally {
            setPowerLoading(false);
        }
    };

    const handlePowerActionChange = (index: number, action: 'power_on' | 'power_off') => {
        const newItems = [...powerItems];
        newItems[index] = {
            ...newItems[index],
            action,
            action_label: action === 'power_on' ? '开机' : '关机',
        };
        setPowerItems(newItems);
    };

    const handlePreviewPowerSchedule = async () => {
        if (selectedPowerRows.length === 0) {
            showToast('请至少选择一台设备', 'warning');
            return;
        }

        setPowerLoading(true);

        try {
            const response = await fetch('/api/batch-operations/devices/preview-power-schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    devices: selectedPowerRows.map(item => ({
                        device_id: item.device_id,
                        action: item.action,
                    })),
                }),
            });

            const data = await response.json();

            if (data.success) {
                showToast(`校验通过，可以执行上下电操作`, 'success');
                setConfirmAction('power');
                setConfirmDialogOpen(true);
            } else {
                showToast(`校验失败，发现 ${data.errors?.length || 0} 个问题`, 'error');
            }
        } catch (error) {
            console.error('Preview power schedule failed:', error);
            showToast('校验失败', 'error');
        } finally {
            setPowerLoading(false);
        }
    };

    const executePowerSchedule = async () => {
        setConfirmLoading(true);

        try {
            const response = await fetch('/api/batch-operations/devices/execute-power-schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    devices: selectedPowerRows.map(item => ({
                        device_id: item.device_id,
                        action: item.action,
                    })),
                }),
            });

            const data = await response.json();

            if (data.success) {
                showToast(data.message, 'success');
                setPowerDevices([]);
                setPowerItems([]);
                setConfirmDialogOpen(false);
            } else {
                showToast(data.message || '执行失败', 'error');
            }
        } catch (error) {
            console.error('Execute power schedule failed:', error);
            showToast('执行失败', 'error');
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleConfirm = () => {
        switch (confirmAction) {
            case 'import':
                executeImport();
                break;
            case 'migrate':
                executeMigration();
                break;
            case 'power':
                executePowerSchedule();
                break;
        }
    };

    const getConfirmTitle = () => {
        switch (confirmAction) {
            case 'import':
                return t('batchOperations.confirmImport');
            case 'migrate':
                return '确认迁移';
            case 'power':
                return '确认执行上下电';
        }
    };

    const getConfirmDescription = () => {
        switch (confirmAction) {
            case 'import':
                return t('batchOperations.confirmImportDesc', { count: selectedImportRows.length });
            case 'migrate':
                return `确定要迁移选中的 ${selectedMigrationRows.length} 台设备吗？`;
            case 'power':
                return `确定要执行选中的 ${selectedPowerRows.length} 台设备的上下电操作吗？`;
        }
    };

    const getSelectedCount = () => {
        switch (confirmAction) {
            case 'import':
                return selectedImportRows.length;
            case 'migrate':
                return selectedMigrationRows.length;
            case 'power':
                return selectedPowerRows.length;
        }
    };

    const toggleImportRow = (index: number) => {
        const newPreview = [...importPreview];
        newPreview[index] = {
            ...newPreview[index],
            _selected: !newPreview[index]._selected,
        };
        setImportPreview(newPreview);
    };

    const toggleAllImportRows = () => {
        const newValue = !selectAllImport;
        setSelectAllImport(newValue);
        setImportPreview(prev => prev.map(row => ({ ...row, _selected: newValue })));
    };

    const toggleMigrationRow = (index: number) => {
        const newItems = [...migrationItems];
        newItems[index] = {
            ...newItems[index],
            _selected: !newItems[index]._selected,
        };
        setMigrationItems(newItems);
    };

    const toggleAllMigrationRows = () => {
        const newValue = !selectAllMigration;
        setSelectAllMigration(newValue);
        setMigrationItems(prev => prev.map(item => ({ ...item, _selected: newValue })));
    };

    const togglePowerRow = (index: number) => {
        const newItems = [...powerItems];
        newItems[index] = {
            ...newItems[index],
            _selected: !newItems[index]._selected,
        };
        setPowerItems(newItems);
    };

    const toggleAllPowerRows = () => {
        const newValue = !selectAllPower;
        setSelectAllPower(newValue);
        setPowerItems(prev => prev.map(item => ({ ...item, _selected: newValue })));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('batchOperations.title')} />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">{t('batchOperations.title')}</h1>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="import" className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            {t('batchOperations.csvImport')}
                        </TabsTrigger>
                        <TabsTrigger value="migration" className="flex items-center gap-2">
                            <ArrowUpDown className="h-4 w-4" />
                            {t('batchOperations.batchMigration')}
                        </TabsTrigger>
                        <TabsTrigger value="power" className="flex items-center gap-2">
                            <Power className="h-4 w-4" />
                            {t('batchOperations.batchPower')}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="import" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5" />
                                    {t('batchOperations.csvImportTitle')}
                                </CardTitle>
                                <CardDescription>
                                    {t('batchOperations.csvImportDesc')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => window.location.href = '/api/batch-operations/devices/download-template'}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        {t('batchOperations.downloadTemplate')}
                                    </Button>
                                    <Label htmlFor="import-file" className="cursor-pointer">
                                        <div className="flex items-center gap-2 rounded-md border bg-background px-4 py-2 hover:bg-muted">
                                            <Upload className="h-4 w-4" />
                                            <span>{importFile ? importFile.name : t('batchOperations.selectCSV')}</span>
                                        </div>
                                        <Input
                                            id="import-file"
                                            type="file"
                                            accept=".csv,.txt"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </Label>
                                </div>

                                {importLoading && (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        <span className="ml-2">正在预览...</span>
                                    </div>
                                )}

                                {importPreview.length > 0 && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={selectAllImport}
                                                    onCheckedChange={toggleAllImportRows}
                                                />
                                                <span className="text-sm text-muted-foreground">
                                                    全选 / 取消全选 ({selectedImportRows.length}/{importPreview.length})
                                                </span>
                                            </div>
                                            <Button
                                                onClick={handleImport}
                                                disabled={selectedImportRows.length === 0 || importLoading}
                                            >
                                                <Plus className="mr-2 h-4 w-4" />
                                                {t('batchOperations.importSelected')} ({selectedImportRows.length})
                                            </Button>
                                        </div>

                                        <div className="max-h-96 overflow-auto border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="w-10"></TableHead>
                                                        <TableHead>设备名称</TableHead>
                                                        <TableHead>机柜</TableHead>
                                                        <TableHead>设备库</TableHead>
                                                        <TableHead>U位</TableHead>
                                                        <TableHead>IP地址</TableHead>
                                                        <TableHead>状态</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {importPreview.map((row, index) => (
                                                        <TableRow
                                                            key={index}
                                                            className={!row._selected ? 'opacity-50' : ''}
                                                        >
                                                            <TableCell>
                                                                <Checkbox
                                                                    checked={row._selected}
                                                                    onCheckedChange={() => toggleImportRow(index)}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="font-medium">{row.name}</TableCell>
                                                            <TableCell>{row.rack_name || '-'}</TableCell>
                                                            <TableCell>{row.device_library_name || '-'}</TableCell>
                                                            <TableCell>{row.u_position}U</TableCell>
                                                            <TableCell>{row.ip_address || '-'}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline">{row.status}</Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </>
                                )}

                                {importErrors.length > 0 && (
                                    <div className="mt-4 rounded-md bg-destructive/10 p-4">
                                        <div className="flex items-center gap-2 text-destructive font-medium mb-2">
                                            <AlertTriangle className="h-4 w-4" />
                                            发现 {importErrors.length} 个错误
                                        </div>
                                        <div className="max-h-32 overflow-auto space-y-1">
                                            {importErrors.slice(0, 10).map((error, index) => (
                                                <div key={index} className="text-sm text-destructive">
                                                    行 {error.row}: {error.message}
                                                </div>
                                            ))}
                                            {importErrors.length > 10 && (
                                                <div className="text-sm text-muted-foreground">
                                                    ...还有 {importErrors.length - 10} 个错误
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="migration" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ArrowUpDown className="h-5 w-5" />
                                    {t('batchOperations.batchMigrationTitle')}
                                </CardTitle>
                                <CardDescription>
                                    {t('batchOperations.batchMigrationDesc')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label>源机柜</Label>
                                        <Select value={migrationSourceRack} onValueChange={setMigrationSourceRack}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="选择源机柜" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {racks.map((rack) => (
                                                    <SelectItem key={rack.id} value={rack.id.toString()}>
                                                        {rack.name} ({rack.room?.name || '未分配机房'})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleLoadMigrationDevices} disabled={!migrationSourceRack || migrationLoading}>
                                        {migrationLoading ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Search className="mr-2 h-4 w-4" />
                                        )}
                                        加载设备
                                    </Button>
                                </div>

                                {migrationItems.length > 0 && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={selectAllMigration}
                                                    onCheckedChange={toggleAllMigrationRows}
                                                />
                                                <span className="text-sm text-muted-foreground">
                                                    全选 / 取消全选 ({selectedMigrationRows.length}/{migrationItems.length})
                                                </span>
                                            </div>
                                            <Button
                                                variant="default"
                                                onClick={handlePreviewMigration}
                                                disabled={selectedMigrationRows.length === 0 || migrationLoading}
                                            >
                                                <ArrowRight className="mr-2 h-4 w-4" />
                                                预览迁移 ({selectedMigrationRows.length})
                                            </Button>
                                        </div>

                                        <div className="max-h-96 overflow-auto border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="w-10"></TableHead>
                                                        <TableHead>设备名称</TableHead>
                                                        <TableHead>当前位置</TableHead>
                                                        <TableHead>目标机柜</TableHead>
                                                        <TableHead>目标U位</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {migrationItems.map((item, index) => (
                                                        <TableRow
                                                            key={item.device_id}
                                                            className={!item._selected ? 'opacity-50' : ''}
                                                        >
                                                            <TableCell>
                                                                <Checkbox
                                                                    checked={item._selected}
                                                                    onCheckedChange={() => toggleMigrationRow(index)}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="font-medium">{item.device_name}</TableCell>
                                                            <TableCell>
                                                                <span className="text-muted-foreground">
                                                                    {item.current_rack} - U{item.current_u_position}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Select
                                                                    value={item.target_rack_id > 0 ? item.target_rack_id.toString() : ''}
                                                                    onValueChange={(value) => {
                                                                        const rack = racks.find(r => r.id.toString() === value);
                                                                        handleMigrationTargetRackChange(index, value, rack?.name || '');
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="w-[180px]">
                                                                        <SelectValue placeholder="选择目标机柜" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {racks.map((rack) => (
                                                                            <SelectItem key={rack.id} value={rack.id.toString()}>
                                                                                {rack.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Input
                                                                    type="number"
                                                                    min="1"
                                                                    max="100"
                                                                    value={item.target_u_position}
                                                                    onChange={(e) => handleMigrationUPositionChange(index, parseInt(e.target.value) || 1)}
                                                                    className="w-20"
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </>
                                )}

                                {migrationDevices.length === 0 && !migrationLoading && (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <Server className="h-12 w-12 mb-4 opacity-50" />
                                        <p>选择源机柜并点击"加载设备"开始</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="power" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Power className="h-5 w-5" />
                                    {t('batchOperations.batchPowerTitle')}
                                </CardTitle>
                                <CardDescription>
                                    {t('batchOperations.batchPowerDesc')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <Label>选择机柜</Label>
                                        <Select value={powerDevices.length > 0 ? powerDevices[0]?.rack_id?.toString() || '' : ''} onValueChange={handleLoadPowerDevices}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="选择机柜" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {racks.map((rack) => (
                                                    <SelectItem key={rack.id} value={rack.id.toString()}>
                                                        {rack.name} ({rack.room?.name || '未分配机房'})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={() => handleLoadPowerDevices(powerDevices[0]?.rack_id?.toString() || '')} disabled={powerDevices.length === 0 || powerLoading}>
                                        {powerLoading ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                        )}
                                        刷新
                                    </Button>
                                </div>

                                {powerItems.length > 0 && (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={selectAllPower}
                                                    onCheckedChange={toggleAllPowerRows}
                                                />
                                                <span className="text-sm text-muted-foreground">
                                                    全选 / 取消全选 ({selectedPowerRows.length}/{powerItems.length})
                                                </span>
                                            </div>
                                            <Button
                                                variant="default"
                                                onClick={handlePreviewPowerSchedule}
                                                disabled={selectedPowerRows.length === 0 || powerLoading}
                                            >
                                                <Power className="mr-2 h-4 w-4" />
                                                执行上下电 ({selectedPowerRows.length})
                                            </Button>
                                        </div>

                                        <div className="max-h-96 overflow-auto border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead className="w-10"></TableHead>
                                                        <TableHead>设备名称</TableHead>
                                                        <TableHead>IP地址</TableHead>
                                                        <TableHead>机柜</TableHead>
                                                        <TableHead>当前状态</TableHead>
                                                        <TableHead>操作</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {powerItems.map((item, index) => (
                                                        <TableRow
                                                            key={item.device_id}
                                                            className={!item._selected ? 'opacity-50' : ''}
                                                        >
                                                            <TableCell>
                                                                <Checkbox
                                                                    checked={item._selected}
                                                                    onCheckedChange={() => togglePowerRow(index)}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="font-medium">{item.device_name}</TableCell>
                                                            <TableCell className="text-muted-foreground">
                                                                {item.ip_address || '-'}
                                                            </TableCell>
                                                            <TableCell>{item.rack_name}</TableCell>
                                                            <TableCell>
                                                                <Badge
                                                                    variant={item.current_status === 'online' ? 'default' : 'secondary'}
                                                                    className={item.current_status === 'online' ? 'bg-green-500' : ''}
                                                                >
                                                                    {item.current_status === 'online' ? '在线' : item.current_status === 'offline' ? '离线' : '维护中'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                <Select
                                                                    value={item.action}
                                                                    onValueChange={(value: 'power_on' | 'power_off') => handlePowerActionChange(index, value)}
                                                                >
                                                                    <SelectTrigger className="w-[120px]">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="power_on">
                                                                            <span className="flex items-center gap-2">
                                                                                <Power className="h-3 w-3 text-green-500" />
                                                                                开机
                                                                            </span>
                                                                        </SelectItem>
                                                                        <SelectItem value="power_off">
                                                                            <span className="flex items-center gap-2">
                                                                                <PowerOff className="h-3 w-3 text-red-500" />
                                                                                关机
                                                                            </span>
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </>
                                )}

                                {powerItems.length === 0 && !powerLoading && (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <Power className="h-12 w-12 mb-4 opacity-50" />
                                        <p>选择机柜并加载设备后开始</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{getConfirmTitle()}</DialogTitle>
                        <DialogDescription>{getConfirmDescription()}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                            取消
                        </Button>
                        <Button onClick={handleConfirm} disabled={confirmLoading}>
                            {confirmLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    处理中...
                                </>
                            ) : (
                                <>确认 ({getSelectedCount()})</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}