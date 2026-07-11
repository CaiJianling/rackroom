import { Head, router } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    Clock,
    HardDrive,
    Loader2,
    RefreshCw,
    Server,
    WifiOff,
    Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';

interface Stats {
    rooms: { total: number; label: string };
    racks: { total: number; label: string };
    devices: {
        total: number;
        online: number;
        offline: number;
        maintenance: number;
        label: string;
    };
    alerts: {
        critical: number;
        warning: number;
        total: number;
        label: string;
    };
    timestamp: string;
}

interface DeviceItem {
    id: number;
    name: string;
    status: 'online' | 'offline' | 'maintenance';
    ip_address: string | null;
    category: string;
    rack_name: string | null;
    room_name: string | null;
    last_seen: string;
}

interface AlertItem {
    id: number;
    title: string;
    severity: 'critical' | 'warning' | 'info';
    status: string;
    triggered_at: string;
}

interface Props {
    initialStats: Stats;
    recentAlerts: AlertItem[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function MonitorIndex({ initialStats, recentAlerts, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const [stats, setStats] = useState<Stats>(initialStats);
    const [devices, setDevices] = useState<DeviceItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshInterval, setRefreshInterval] = useState(30);
    const [deviceFilter, setDeviceFilter] = useState<string>('all');

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/monitor/stats');
            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const fetchDevices = async () => {
        try {
            const params = new URLSearchParams();
            if (deviceFilter !== 'all') {
                params.append('status', deviceFilter);
            }
            const response = await fetch(`/api/monitor/devices?${params}`);
            const data = await response.json();
            setDevices(data);
        } catch (error) {
            console.error('Failed to fetch devices:', error);
        }
    };

    const refreshAll = async () => {
        setLoading(true);
        await Promise.all([fetchStats(), fetchDevices()]);
        setLoading(false);
    };

    useEffect(() => {
        fetchDevices();
    }, [deviceFilter]);

    useEffect(() => {
        if (!autoRefresh) return;

        const interval = setInterval(() => {
            fetchStats();
            fetchDevices();
        }, refreshInterval * 1000);

        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, deviceFilter]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'online':
                return 'bg-green-500';
            case 'offline':
                return 'bg-red-500';
            case 'maintenance':
                return 'bg-yellow-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'online':
                return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="mr-1 h-3 w-3" />{t('monitor.online')}</Badge>;
            case 'offline':
                return <Badge variant="destructive"><WifiOff className="mr-1 h-3 w-3" />{t('monitor.offline')}</Badge>;
            case 'maintenance':
                return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950"><AlertCircle className="mr-1 h-3 w-3" />{t('monitor.maintenance')}</Badge>;
            default:
                return <Badge variant="outline">{t('monitor.unknown')}</Badge>;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical':
                return 'text-red-500 bg-red-50 border-red-200';
            case 'warning':
                return 'text-orange-500 bg-orange-50 border-orange-200';
            case 'info':
                return 'text-blue-500 bg-blue-50 border-blue-200';
            default:
                return 'text-gray-500 bg-gray-50 border-gray-200';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('monitor.title')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                {/* 页面标题和刷新控制 */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-2xl font-bold">{t('monitor.title')}</h1>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{t('monitor.lastUpdated')}: {stats.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : '-'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{t('monitor.autoRefresh')}</span>
                            <Button
                                variant={autoRefresh ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setAutoRefresh(!autoRefresh)}
                            >
                                {autoRefresh ? t('common.on') : t('common.off')}
                            </Button>
                        </div>
                        <Select
                            value={refreshInterval.toString()}
                            onValueChange={(v) => setRefreshInterval(Number(v))}
                        >
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10{t('common.seconds')}</SelectItem>
                                <SelectItem value="30">30{t('common.seconds')}</SelectItem>
                                <SelectItem value="60">1{t('common.minute')}</SelectItem>
                                <SelectItem value="300">5{t('common.minutes')}</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={refreshAll}
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            {t('common.refresh')}
                        </Button>
                    </div>
                </div>

                {/* 统计卡片 */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* 机房统计 */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{t('monitor.totalRooms')}</CardTitle>
                            <HardDrive className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.rooms.total}</div>
                            <p className="text-xs text-muted-foreground">{t('monitor.totalRoomsDesc')}</p>
                        </CardContent>
                    </Card>

                    {/* 机柜统计 */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{t('monitor.totalRacks')}</CardTitle>
                            <Server className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.racks.total}</div>
                            <p className="text-xs text-muted-foreground">{t('monitor.availableRacks')}</p>
                        </CardContent>
                    </Card>

                    {/* 设备统计 */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{t('monitor.deviceStatus')}</CardTitle>
                            <Zap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.devices.total}</div>
                            <div className="mt-1 flex items-center gap-2 text-xs">
                                <span className="flex items-center text-green-600">
                                    <span className="mr-1 h-2 w-2 rounded-full bg-green-500" />
                                    {stats.devices.online}
                                </span>
                                <span className="flex items-center text-red-600">
                                    <span className="mr-1 h-2 w-2 rounded-full bg-red-500" />
                                    {stats.devices.offline}
                                </span>
                                <span className="flex items-center text-yellow-600">
                                    <span className="mr-1 h-2 w-2 rounded-full bg-yellow-500" />
                                    {stats.devices.maintenance}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 告警统计 */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{t('monitor.activeAlerts')}</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.alerts.total}</div>
                            <div className="mt-1 flex items-center gap-2 text-xs">
                                <span className="flex items-center text-red-600">
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    {t('monitor.critical')} {stats.alerts.critical}
                                </span>
                                <span className="flex items-center text-orange-600">
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    {t('monitor.warning')} {stats.alerts.warning}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 设备状态详情 */}
                <Card className="flex-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{t('monitor.deviceMonitoring')}</CardTitle>
                                <CardDescription>{t('monitor.deviceMonitoringDesc')}</CardDescription>
                            </div>
                            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder={t('monitor.statusFilter')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('monitor.allStatus')}</SelectItem>
                                    <SelectItem value="online">{t('monitor.online')}</SelectItem>
                                    <SelectItem value="offline">{t('monitor.offline')}</SelectItem>
                                    <SelectItem value="maintenance">{t('monitor.maintenance')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-[50px]">{t('monitor.status')}</TableHead>
                                    <TableHead>{t('monitor.deviceName')}</TableHead>
                                    <TableHead>{t('monitor.ipAddress')}</TableHead>
                                    <TableHead>{t('monitor.category')}</TableHead>
                                    <TableHead>{t('monitor.room')}</TableHead>
                                    <TableHead>{t('monitor.rack')}</TableHead>
                                    <TableHead className="text-right">{t('monitor.lastUpdated')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {devices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                            {t('monitor.noDeviceData')}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    devices.map((device) => (
                                        <TableRow key={device.id} className="border-b border-border/50">
                                            <TableCell>
                                                <div className={cn('h-3 w-3 rounded-full', getStatusColor(device.status))} />
                                            </TableCell>
                                            <TableCell className="font-medium">{device.name}</TableCell>
                                            <TableCell>{device.ip_address || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{device.category}</Badge>
                                            </TableCell>
                                            <TableCell>{device.room_name || '-'}</TableCell>
                                            <TableCell>{device.rack_name || '-'}</TableCell>
                                            <TableCell className="text-right text-sm text-muted-foreground">
                                                {device.last_seen}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* 最近告警 */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('monitor.recentAlerts')}</CardTitle>
                        <CardDescription>{t('monitor.recentAlertsDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {recentAlerts.length === 0 ? (
                                <div className="py-4 text-center text-muted-foreground">{t('monitor.noAlerts')}</div>
                            ) : (
                                recentAlerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className={cn(
                                            'flex items-center justify-between rounded-lg border p-3',
                                            getSeverityColor(alert.severity)
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <AlertCircle className="h-5 w-5" />
                                            <div>
                                                <p className="font-medium">{alert.title}</p>
                                                <p className="text-xs opacity-80">
                                                    {new Date(alert.triggered_at).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="bg-white/50">
                                            {alert.severity === 'critical' ? t('alert.critical') : alert.severity === 'warning' ? t('alert.warning') : t('alert.info')}
                                        </Badge>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
