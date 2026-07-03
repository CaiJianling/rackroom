import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Eye,
    Filter,
    Info,
    Lightbulb,
    MoreHorizontal,
    RefreshCw,
    Search,
    ShieldCheck,
    X,
    XCircle,
    Zap,
} from 'lucide-react';
import { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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

interface AlertRule {
    id: number;
    name: string;
    description: string | null;
    rule_type: string;
    condition: string;
    condition_value: string;
    severity: string;
    is_enabled: boolean;
    suggestion: string | null;
    created_at: string;
    updated_at: string;
}

interface SmartAlertResult {
    triggered: boolean;
    rule: AlertRule;
    device: { id: number; name: string };
    value: number;
    suggestion: {
        title: string;
        description: string;
        action: string;
        action_type: string;
        target_rack_id?: number;
        device_id?: number;
    };
}

interface Props {
    alerts: Pagination;
    stats: AlertStats;
    filters: Filters;
    alertTypes: string[];
    alertRules?: AlertRule[];
    smartAlertResults?: SmartAlertResult[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function AlertIndex({ alerts, stats, filters, alertTypes, alertRules = [], smartAlertResults = [], breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const [selectedAlerts, setSelectedAlerts] = useState<number[]>([]);
    const [viewingAlert, setViewingAlert] = useState<Alert | null>(null);
    const [resolvingAlert, setResolvingAlert] = useState<Alert | null>(null);
    const [resolutionNote, setResolutionNote] = useState('');
    const [localFilters, setLocalFilters] = useState(filters);
    const [activeTab, setActiveTab] = useState('alerts');
    const [rules, setRules] = useState<AlertRule[]>(alertRules);
    const [evaluating, setEvaluating] = useState(false);
    const [evaluationResults, setEvaluationResults] = useState<SmartAlertResult[]>(smartAlertResults);

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

    const toggleRule = async (ruleId: number) => {
        try {
            const response = await fetch(`/api/smart-alerts/${ruleId}/toggle`, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '' },
            });
            if (response.ok) {
                const data = await response.json();
                setRules(rules.map(r => r.id === ruleId ? { ...r, is_enabled: data.data.is_enabled } : r));
            }
        } catch (error) {
            console.error('Failed to toggle rule:', error);
        }
    };

    const evaluateRules = async () => {
        setEvaluating(true);
        try {
            const response = await fetch('/api/smart-alerts/evaluate', {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '' },
            });
            if (response.ok) {
                const data = await response.json();
                setEvaluationResults(data.data.triggered || []);
            }
        } catch (error) {
            console.error('Failed to evaluate rules:', error);
        } finally {
            setEvaluating(false);
        }
    };

    const getRuleTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            power_overload: '电源负载预警',
            health_decline: '健康度下降',
            temperature_high: '温度过高',
            rack_capacity: '机柜容量预警',
            device_offline: '设备离线',
        };
        return labels[type] || type;
    };

    const getConditionLabel = (condition: string) => {
        const labels: Record<string, string> = {
            gt: '大于',
            gte: '大于等于',
            lt: '小于',
            lte: '小于等于',
            eq: '等于',
            not_eq: '不等于',
        };
        return labels[condition] || condition;
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

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="alerts">{t('alert.alerts')}</TabsTrigger>
                        <TabsTrigger value="smart-alerts">
                            <Zap className="mr-2 h-4 w-4" />
                            {t('alert.smartAlerts')}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="alerts" className="space-y-4">
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
                                <Label className="text-xs">{t('common.search')}</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder={t('alert.searchPlaceholder')}
                                        value={localFilters.search}
                                        onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="text-xs">{t('alert.status')}</Label>
                                <Select
                                    value={localFilters.status}
                                    onValueChange={(v) => setLocalFilters({ ...localFilters, status: v })}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('alert.allStatus')}</SelectItem>
                                        <SelectItem value="active">{t('alert.activeAlerts')}</SelectItem>
                                        <SelectItem value="acknowledged">{t('alert.acknowledged')}</SelectItem>
                                        <SelectItem value="resolved">{t('alert.resolved')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs">{t('alert.severity')}</Label>
                                <Select
                                    value={localFilters.severity}
                                    onValueChange={(v) => setLocalFilters({ ...localFilters, severity: v })}
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('alert.allSeverity')}</SelectItem>
                                        <SelectItem value="critical">{t('alert.critical')}</SelectItem>
                                        <SelectItem value="warning">{t('alert.warning')}</SelectItem>
                                        <SelectItem value="info">{t('alert.info')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-xs">{t('alert.type')}</Label>
                                <Select
                                    value={localFilters.type}
                                    onValueChange={(v) => setLocalFilters({ ...localFilters, type: v })}
                                >
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">{t('alert.allTypes')}</SelectItem>
                                        {alertTypes.map((type) => (
                                            <SelectItem key={type} value={type}>{type}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={applyFilters}>
                                    <Filter className="mr-2 h-4 w-4" />
                                    {t('common.filter')}
                                </Button>
                                <Button variant="outline" onClick={clearFilters}>
                                    <X className="mr-2 h-4 w-4" />
                                    {t('common.reset')}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 批量操作 */}
                {selectedAlerts.length > 0 && (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
                        <span className="text-sm font-medium">{t('alert.selectedCount', { count: selectedAlerts.length })}</span>
                        <div className="ml-auto flex gap-2">
                            <Button variant="outline" size="sm" onClick={batchAcknowledge}>
                                <ShieldCheck className="mr-2 h-4 w-4" />
                                {t('alert.batchAcknowledge')}
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
                                    <TableHead className="w-[80px]">{t('alert.severity')}</TableHead>
                                    <TableHead className="w-[100px]">{t('alert.status')}</TableHead>
                                    <TableHead>{t('alert.title')}</TableHead>
                                    <TableHead>{t('alert.type')}</TableHead>
                                    <TableHead>{t('alert.triggeredAt')}</TableHead>
                                    <TableHead>{t('alert.resolvedBy')}</TableHead>
                                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {alerts.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircle2 className="h-8 w-8 text-green-500" />
                                                <p>{t('alert.noAlerts')}</p>
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
                                                            {t('alert.viewDetails')}
                                                        </DropdownMenuItem>
                                                        {alert.status === 'active' && (
                                                            <DropdownMenuItem onClick={() => acknowledgeAlert(alert.id)}>
                                                                <ShieldCheck className="mr-2 h-4 w-4" />
                                                                {t('alert.acknowledge')}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {alert.status !== 'resolved' && (
                                                            <DropdownMenuItem onClick={() => setResolvingAlert(alert)}>
                                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                                {t('alert.resolve')}
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
                                    {t('alert.paginationInfo', { from: alerts.from, to: alerts.to, total: alerts.total })}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!alerts.prev_page_url}
                                        onClick={() => alerts.prev_page_url && router.get(alerts.prev_page_url)}
                                    >
                                        {t('alert.prevPage')}
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
                                        {t('alert.nextPage')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
                    </TabsContent>

                    <TabsContent value="smart-alerts" className="space-y-4">
                        {/* 智能告警工具栏 */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={evaluateRules} disabled={evaluating}>
                                    <Zap className="mr-2 h-4 w-4" />
                                    {evaluating ? t('alert.evaluating') : t('alert.evaluateNow')}
                                </Button>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('alert.enabledRules', { count: rules.filter(r => r.is_enabled).length })}
                            </div>
                        </div>

                        {/* 触发规则结果 */}
                        {evaluationResults.length > 0 && (
                            <Card className="border-orange-200 bg-orange-50/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center gap-2 text-orange-600">
                                        <AlertTriangle className="h-5 w-5" />
                                        {t('alert.triggeredAlerts')}
                                    </CardTitle>
                                    <CardDescription>
                                        {t('alert.triggeredAlertsDesc', { count: evaluationResults.length })}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {evaluationResults.map((result, index) => (
                                        <div key={index} className="rounded-lg border bg-white p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    {result.rule.severity === 'critical' ? (
                                                        <XCircle className="h-5 w-5 text-red-500" />
                                                    ) : (
                                                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                                                    )}
                                                    <div>
                                                        <p className="font-medium">{result.rule.name} - {result.device.name}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {t('alert.currentValue')}: {result.value.toFixed(1)} {result.rule.condition} {result.rule.condition_value}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            {result.suggestion && (
                                                <div className="mt-3 rounded bg-blue-50 p-3">
                                                    <div className="flex items-start gap-2">
                                                        <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5" />
                                                        <div>
                                                            <p className="font-medium text-blue-800">{result.suggestion.title}</p>
                                                            <p className="text-sm text-blue-700 mt-1">{result.suggestion.description}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* 告警规则列表 */}
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('alert.ruleList')}</CardTitle>
                                <CardDescription>{t('alert.ruleListDesc')}</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="w-[40px]">{t('alert.enabled')}</TableHead>
                                            <TableHead>{t('alert.ruleName')}</TableHead>
                                            <TableHead>{t('alert.ruleType')}</TableHead>
                                            <TableHead>{t('alert.condition')}</TableHead>
                                            <TableHead>{t('alert.severity')}</TableHead>
                                            <TableHead>{t('common.actions')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rules.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                                    {t('alert.noRules')}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            rules.map((rule) => (
                                                <TableRow key={rule.id}>
                                                    <TableCell>
                                                        <Checkbox
                                                            checked={rule.is_enabled}
                                                            onCheckedChange={() => toggleRule(rule.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{rule.name}</div>
                                                        {rule.description && (
                                                            <div className="text-xs text-muted-foreground">{rule.description}</div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{getRuleTypeLabel(rule.rule_type)}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {getConditionLabel(rule.condition)} {rule.condition_value}
                                                        {rule.rule_type === 'power_overload' || rule.rule_type === 'rack_capacity' || rule.rule_type === 'health_decline' ? '%' : ''}
                                                    </TableCell>
                                                    <TableCell>
                                                        {rule.severity === 'critical' ? (
                                                            <Badge variant="destructive">{t('alert.critical')}</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">{t('alert.warning')}</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm" onClick={() => router.get(`/alerts?device_id=${rule.id}`)}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            {t('common.view')}
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* 查看详情对话框 */}
            <Dialog open={!!viewingAlert} onOpenChange={() => setViewingAlert(null)}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {viewingAlert && getSeverityIcon(viewingAlert.severity)}
                            {t('alert.alertDetails')}
                        </DialogTitle>
                        <DialogDescription>
                            {viewingAlert?.title}
                        </DialogDescription>
                    </DialogHeader>
                    {viewingAlert && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">{t('alert.severity')}</Label>
                                    <div className="mt-1">{getSeverityBadge(viewingAlert.severity)}</div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">{t('alert.status')}</Label>
                                    <div className="mt-1">{getStatusBadge(viewingAlert.status)}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-sm font-medium">{t('alert.type')}</Label>
                                    <div className="mt-1 text-sm">{viewingAlert.alert_type}</div>
                                </div>
                                <div>
                                    <Label className="text-sm font-medium">{t('alert.resourceType')}</Label>
                                    <div className="mt-1 text-sm">{viewingAlert.resource_type}</div>
                                </div>
                            </div>
                            <div>
                                <Label className="text-sm font-medium">{t('alert.triggeredAt')}</Label>
                                <div className="mt-1 text-sm">{formatDate(viewingAlert.triggered_at)}</div>
                            </div>
                            {viewingAlert.description && (
                                <div>
                                    <Label className="text-sm font-medium">{t('alert.alertDescription')}</Label>
                                    <div className="mt-1 rounded bg-muted p-2 text-sm">{viewingAlert.description}</div>
                                </div>
                            )}
                            {viewingAlert.acknowledged_by_user && (
                                <div>
                                    <Label className="text-sm font-medium">{t('alert.acknowledgedInfo')}</Label>
                                    <div className="mt-1 text-sm">
                                        {t('alert.acknowledgedBy', { name: viewingAlert.acknowledged_by_user.name, date: formatDate(viewingAlert.acknowledged_at) })}
                                    </div>
                                </div>
                            )}
                            {viewingAlert.resolved_by_user && (
                                <div>
                                    <Label className="text-sm font-medium">{t('alert.resolvedInfo')}</Label>
                                    <div className="mt-1 text-sm">
                                        {t('alert.resolvedByUser', { name: viewingAlert.resolved_by_user.name, date: formatDate(viewingAlert.resolved_at) })}
                                    </div>
                                    {viewingAlert.resolution_note && (
                                        <div className="mt-1 rounded bg-green-50 p-2 text-sm text-green-800">
                                            {t('alert.resolutionNote')}: {viewingAlert.resolution_note}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewingAlert(null)}>{t('common.close')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 解决告警对话框 */}
            <Dialog open={!!resolvingAlert} onOpenChange={() => setResolvingAlert(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{t('alert.resolveAlert')}</DialogTitle>
                        <DialogDescription>
                            {t('alert.resolveAlertDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="note">{t('alert.resolutionNoteText')}</Label>
                        <Textarea
                            id="note"
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder={t('alert.enterResolutionNote')}
                            className="mt-2"
                            rows={4}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setResolvingAlert(null)}>{t('common.cancel')}</Button>
                        <Button onClick={resolveAlert}>
                            {t('alert.confirmResolve')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
