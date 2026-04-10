import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Eye,
    Filter,
    Info,
    MoreHorizontal,
    RefreshCw,
    Search,
    ShieldCheck,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
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
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';

interface Alert {
    id: number;
    title: string;
    description: string | null;
    severity: 'critical' | 'warning' | 'info';
    status: 'active' | 'acknowledged' | 'resolved';
    alert_type: string;
    resource_type: string;
    resource_id: number | null;
    triggered_at: string;
    acknowledged_at: string | null;
    acknowledged_by_user: { name: string } | null;
    resolved_at: string | null;
    resolved_by_user: { name: string } | null;
    resolution_note: string | null;
}

interface AlertStats {
    total: number;
    active: number;
    critical: number;
    warning: number;
    acknowledged: number;
    resolved: number;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface Pagination {
    current_page: number;
    data: Alert[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: PaginationLink[];
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}

interface Filters {
    status: string;
    severity: string;
    type: string;
    search: string;
}

interface Props {
    alerts: Pagination;
    stats: AlertStats;
    filters: Filters;
    alertTypes: string[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function AlertIndex({ alerts, stats, filters, alertTypes, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const [selectedAlerts, setSelectedAlerts] = useState<number[]>([]);
    const [viewingAlert, setViewingAlert] = useState<Alert | null>(null);
    const [resolvingAlert, setResolvingAlert] = useState<Alert | null>(null);
    const [resolutionNote, setResolutionNote] = useState('');
    const [localFilters, setLocalFilters] = useState(filters);

    const toggleAlertSelection = (alertId: number) => {
        setSelectedAlerts((prev) =>
            prev.includes(alertId)
                ? prev.filter((id) => id !== alertId)
                : [...prev, alertId]
        );
    };

    const toggleAllSelection = () => {
        if (selectedAlerts.length === alerts.data.length) {
            setSelectedAlerts([]);
        } else {
            setSelectedAlerts(alerts.data.map((a) => a.id));
        }
    };

    const applyFilters = () => {
        router.get('/alerts', { ...localFilters }, { preserveState: true });
    };

    const clearFilters = () => {
        setLocalFilters({ status: 'all', severity: 'all', type: 'all', search: '' });
        router.get('/alerts', {}, { preserveState: true });
    };

    const acknowledgeAlert = async (alertId: number) => {
        try {
            const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '' },
            });
            if (response.ok) {
                router.reload();
            }
        } catch (error) {
            console.error('Failed to acknowledge alert:', error);
        }
    };

    const resolveAlert = async () => {
        if (!resolvingAlert) return;
        try {
            const response = await fetch(`/api/alerts/${resolvingAlert.id}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
                body: JSON.stringify({ note: resolutionNote }),
            });
            if (response.ok) {
                setResolvingAlert(null);
                setResolutionNote('');
                router.reload();
            }
        } catch (error) {
            console.error('Failed to resolve alert:', error);
        }
    };

    const batchAcknowledge = async () => {
        if (selectedAlerts.length === 0) return;
        try {
            const response = await fetch('/api/alerts/batch-acknowledge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
                },
                body: JSON.stringify({ ids: selectedAlerts }),
            });
            if (response.ok) {
                setSelectedAlerts([]);
                router.reload();
            }
        } catch (error) {
            console.error('Failed to batch acknowledge:', error);
        }
    };

    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical':
                return <XCircle className="h-4 w-4 text-red-500" />;
            case 'warning':
                return <AlertTriangle className="h-4 w-4 text-orange-500" />;
            case 'info':
                return <Info className="h-4 w-4 text-blue-500" />;
            default:
                return <Info className="h-4 w-4" />;
        }
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'critical':
                return <Badge variant="destructive">{t('alert.critical')}</Badge>;
            case 'warning':
                return <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">{t('alert.warning')}</Badge>;
            case 'info':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">{t('alert.info')}</Badge>;
            default:
                return <Badge variant="outline">-</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge variant="default" className="bg-red-500">{t('alert.activeAlerts')}</Badge>;
            case 'acknowledged':
                return <Badge variant="secondary">{t('alert.acknowledged')}</Badge>;
            case 'resolved':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{t('alert.resolved')}</Badge>;
            default:
                return <Badge variant="outline">-</Badge>;
        }
    };

    const formatDate = (date: string | null) => {
        if (!date) return '-';
        return new Date(date).toLocaleString();
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('alert.title')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                {/* 页面标题 */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">{t('alert.title')}</h1>
                    <Button variant="outline" size="sm" onClick={() => router.reload()}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t('common.refresh')}
                    </Button>
                </div>

                {/* 统计卡片 */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{t('alert.totalAlerts')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-red-200 bg-red-50/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-red-600">{t('alert.criticalAlerts')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-orange-200 bg-orange-50/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-orange-600">{t('alert.warningAlerts')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">{stats.warning}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{t('alert.activeAlerts')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.active}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{t('alert.acknowledged')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.acknowledged}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">{t('alert.resolved')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.resolved}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* 筛选工具栏 */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                            <div className="flex-1">
                                <Label className="text-xs">搜索</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="搜索告警标题或描述..."
                                        value={localFilters.search}
                                        onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">状态</Label>
                                <Select
                                    value={localFilters.status}
                                    onValueChange={(v) => setLocalFilters({ ...localFilters, status: v })}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部状态</SelectItem>
                                        <SelectItem value="active">活跃</SelectItem>
                                        <SelectItem value="acknowledged">已确认</SelectItem>
                                        <SelectItem value="resolved">已解决</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs">严重级别</Label>
                                <Select
                                    value={localFilters.severity}
                                    onValueChange={(v) => setLocalFilters({ ...localFilters, severity: v })}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部级别</SelectItem>
                                        <SelectItem value="critical">严重</SelectItem>
                                        <SelectItem value="warning">警告</SelectItem>
                                        <SelectItem value="info">信息</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs">告警类型</Label>
                                <Select
                                    value={localFilters.type}
                                    onValueChange={(v) => setLocalFilters({ ...localFilters, type: v })}
                                >
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">全部类型</SelectItem>
                                        {alertTypes.map((type) => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={applyFilters}>
                                    <Filter className="mr-2 h-4 w-4" />
                                    筛选
                                </Button>
                                <Button variant="outline" onClick={clearFilters}>
                                    <X className="mr-2 h-4 w-4" />
                                    清除
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 批量操作 */}
                {selectedAlerts.length > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                        <span className="text-sm font-medium">已选择 {selectedAlerts.length} 条告警</span>
                        <div className="ml-auto flex gap-2">
                            <Button variant="outline" size="sm" onClick={batchAcknowledge}>
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                批量确认
                            </Button>
                        </div>
                    </div>
                )}

                {/* 告警列表 */}
                <Card className="flex-1">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[40px]">
                                        <Checkbox
                                            checked={selectedAlerts.length === alerts.data.length && alerts.data.length > 0}
                                            onCheckedChange={toggleAllSelection}
                                        />
                                    </TableHead>
                                    <TableHead className="w-[80px]">级别</TableHead>
                                    <TableHead className="w-[100px]">状态</TableHead>
                                    <TableHead>告警标题</TableHead>
                                    <TableHead>类型</TableHead>
                                    <TableHead>触发时间</TableHead>
                                    <TableHead>处理人</TableHead>
                                    <TableHead className="text-right">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {alerts.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                                                <p>暂无符合条件的告警</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    alerts.data.map((alert) => (
                                        <TableRow key={alert.id} className="border-b border-border/50">
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedAlerts.includes(alert.id)}
                                                    onCheckedChange={() => toggleAlertSelection(alert.id)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getSeverityIcon(alert.severity)}
                                                    {getSeverityBadge(alert.severity)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(alert.status)}</TableCell>
                                            <TableCell className="font-medium">{alert.title}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{alert.alert_type}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDate(alert.triggered_at)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {alert.resolved_by_user ? (
                                                    <span className="text-sm">{alert.resolved_by_user.name}</span>
                                                ) : alert.acknowledged_by_user ? (
                                                    <span className="text-sm">{alert.acknowledged_by_user.name}</span>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => setViewingAlert(alert)}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            查看详情
                                                        </DropdownMenuItem>
                                                        {alert.status === 'active' && (
                                                            <DropdownMenuItem onClick={() => acknowledgeAlert(alert.id)}>
                                                                <ShieldCheck className="mr-2 h-4 w-4" />
                                                                确认告警
                                                            </DropdownMenuItem>
                                                        )}
                                                        {alert.status !== 'resolved' && (
                                                            <DropdownMenuItem onClick={() => setResolvingAlert(alert)}>
                                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                解决告警
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {/* 分页 */}
                        {alerts.last_page > 1 && (
                            <div className="flex items-center justify-between border-t px-4 py-3">
                                <div className="text-sm text-muted-foreground">
                                    显示 {alerts.from} - {alerts.to} 条，共 {alerts.total} 条
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!alerts.prev_page_url}
                                        onClick={() => alerts.prev_page_url && router.get(alerts.prev_page_url)}
                                    >
                                        上一页
                                    </Button>
                                    <span className="text-sm">
                                        {alerts.current_page} / {alerts.last_page}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!alerts.next_page_url}
                                        onClick={() => alerts.next_page_url && router.get(alerts.next_page_url)}
                                    >
                                        下一页
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 查看详情对话框 */}
            <Dialog open={!!viewingAlert} onOpenChange={() => setViewingAlert(null)}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {viewingAlert && getSeverityIcon(viewingAlert.severity)}
                            告警详情
                        </DialogTitle>
                        <DialogDescription>
                            {viewingAlert?.title}
                        </DialogDescription>
                    </DialogHeader>
                    {viewingAlert && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">告警级别</Label>
                                    <div className="mt-1">{getSeverityBadge(viewingAlert.severity)}</div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">当前状态</Label>
                                    <div className="mt-1">{getStatusBadge(viewingAlert.status)}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">告警类型</Label>
                                    <div className="mt-1 text-sm">{viewingAlert.alert_type}</div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">资源类型</Label>
                                    <div className="mt-1 text-sm">{viewingAlert.resource_type}</div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-medium">触发时间</Label>
                                <div className="mt-1 text-sm">{formatDate(viewingAlert.triggered_at)}</div>
                            </div>
                            {viewingAlert.description && (
                                <div>
                                    <Label className="text-sm font-medium">描述</Label>
                                    <div className="mt-1 rounded bg-muted p-2 text-sm">{viewingAlert.description}</div>
                                </div>
                            )}
                            {viewingAlert.acknowledged_by_user && (
                                <div>
                                    <Label className="text-sm font-medium">确认信息</Label>
                                    <div className="mt-1 text-sm">
                                        由 {viewingAlert.acknowledged_by_user.name} 于 {formatDate(viewingAlert.acknowledged_at)} 确认
                                    </div>
                                </div>
                            )}
                            {viewingAlert.resolved_by_user && (
                                <div>
                                    <Label className="text-sm font-medium">解决信息</Label>
                                    <div className="mt-1 text-sm">
                                        由 {viewingAlert.resolved_by_user.name} 于 {formatDate(viewingAlert.resolved_at)} 解决
                                    </div>
                                    {viewingAlert.resolution_note && (
                                        <div className="mt-1 rounded bg-green-50 p-2 text-sm text-green-800">
                                            备注: {viewingAlert.resolution_note}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingAlert(null)}>关闭</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 解决告警对话框 */}
            <Dialog open={!!resolvingAlert} onOpenChange={() => setResolvingAlert(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>解决告警</DialogTitle>
                        <DialogDescription>
                            请输入解决方案备注信息
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="note">解决备注（可选）</Label>
                        <Textarea
                            id="note"
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder="描述问题的解决方式..."
                            className="mt-2"
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResolvingAlert(null)}>取消</Button>
                        <Button onClick={resolveAlert}>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            确认解决
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
