import { Head, Link } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    Building2,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Cpu,
    Eye,
    HardDrive,
    Plus,
    Server,
    Shield,
    TrendingUp,
    WifiOff,
    Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

interface StatCard {
    total: number;
    label: string;
    icon: string;
    color: string;
    href?: string;
    unit?: string;
    online?: number;
    offline?: number;
    maintenance?: number;
    critical?: number;
    warning?: number;
}

interface ChartData {
    name: string;
    value: number;
    color?: string;
}

interface RoomData {
    id: number;
    name: string;
    racks: number;
    devices: number;
}

interface AlertItem {
    id: number;
    title: string;
    severity: 'critical' | 'warning' | 'info';
    triggered_at: string;
}

interface DeviceItem {
    id: number;
    name: string;
    status: 'online' | 'offline' | 'maintenance';
    device_type_id: number | null;
    room_name: string | null;
    created_at: string;
}

interface DeviceType {
    id: number;
    name: string;
    icon: string | null;
    color: string | null;
}

interface Props {
    stats: {
        rooms: StatCard;
        racks: StatCard;
        devices: StatCard;
        alerts: StatCard;
        power: StatCard;
    };
    deviceStatusDistribution: ChartData[];
    roomDistribution: RoomData[];
    recentAlerts: AlertItem[];
    recentDevices: DeviceItem[];
    categoryDistribution: ChartData[];
    deviceTypes: DeviceType[];
}

const iconMap: Record<string, React.ElementType> = {
    Building2,
    Server,
    Cpu,
    AlertTriangle,
    Zap,
};

const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 border-blue-200',
    indigo: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
    green: 'bg-green-500/10 text-green-600 border-green-200',
    red: 'bg-red-500/10 text-red-600 border-red-200',
    yellow: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
    orange: 'bg-orange-500/10 text-orange-600 border-orange-200',
};

export default function Dashboard({
    stats,
    deviceStatusDistribution,
    roomDistribution,
    recentAlerts,
    recentDevices,
    categoryDistribution,
    deviceTypes,
}: Props) {
    const { t } = useTranslation();

    // 获取设备类型名称（与 /devices 页面完全一致）
    const getDeviceTypeName = (deviceTypeId: number | null) => {
        if (!deviceTypeId) return '-';
        const type = deviceTypes.find(t => t.id === deviceTypeId);
        return type ? type.name : '-';
    };

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('navigation.dashboard'),
            href: '/dashboard',
        },
    ];

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
                return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="mr-1 h-3 w-3" />{t('deviceManagement.statuses.online')}</Badge>;
            case 'offline':
                return <Badge variant="destructive"><WifiOff className="mr-1 h-3 w-3" />{t('deviceManagement.statuses.offline')}</Badge>;
            case 'maintenance':
                return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950"><Activity className="mr-1 h-3 w-3" />{t('deviceManagement.statuses.maintenance')}</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical':
                return 'border-red-200 bg-red-50 text-red-700';
            case 'warning':
                return 'border-orange-200 bg-orange-50 text-orange-700';
            case 'info':
                return 'border-blue-200 bg-blue-50 text-blue-700';
            default:
                return 'border-gray-200 bg-gray-50 text-gray-700';
        }
    };

    // 计算百分比
    const calculatePercent = (value: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    };

    // 机房分布分页
    const ITEMS_PER_PAGE = 5;
    const [currentPage, setCurrentPage] = useState(0);
    const totalPages = Math.ceil(roomDistribution.length / ITEMS_PER_PAGE);

    const paginatedRooms = useMemo(() => {
        const start = currentPage * ITEMS_PER_PAGE;
        return roomDistribution.slice(start, start + ITEMS_PER_PAGE);
    }, [roomDistribution, currentPage]);

    const handlePrevPage = () => {
        setCurrentPage((prev) => Math.max(0, prev - 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
    };

    const StatCardComponent = ({ stat, title }: { stat: StatCard; title: string }) => {
        const Icon = iconMap[stat.icon] || Activity;
        const colorClass = colorMap[stat.color] || colorMap.blue;

        return (
            <Card className="relative h-[140px] overflow-hidden">
                <CardContent className="flex h-full items-center p-5">
                    <div className="flex w-full items-center justify-between gap-4">
                        {/* 左侧：文字内容区域 */}
                        <div className="flex flex-1 flex-col justify-center">
                            <p className="mb-1 text-xs font-medium text-muted-foreground">{stat.label}</p>
                            <div className="mb-2 flex items-baseline gap-1.5">
                                <span className="text-2xl font-bold tracking-tight">{stat.total.toLocaleString()}</span>
                                {stat.unit && <span className="text-xs text-muted-foreground">{stat.unit}</span>}
                            </div>
                            {/* 设备状态分布 */}
                            {stat.online !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 text-[10px] text-green-600">
                                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                        {stat.online}
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] text-red-600">
                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                        {stat.offline}
                                    </span>
                                    <span className="flex items-center gap-1 text-[10px] text-yellow-600">
                                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                                        {stat.maintenance}
                                    </span>
                                </div>
                            )}
                            {/* 告警分布 */}
                            {stat.critical !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-0.5 text-[10px] text-red-600">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        {t('dashboard.criticalShort')} {stat.critical}
                                    </span>
                                    <span className="flex items-center gap-0.5 text-[10px] text-orange-600">
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        {t('dashboard.warningShort')} {stat.warning}
                                    </span>
                                </div>
                            )}
                        </div>
                        {/* 右侧：图标区域 */}
                        <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border', colorClass)}>
                            <Icon className="h-5 w-5" />
                        </div>
                    </div>
                    {stat.href && (
                        <Link href={stat.href} className="absolute inset-0">
                            <span className="sr-only">{t('common.view')}{stat.label}</span>
                        </Link>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('navigation.dashboard')} />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto rounded-xl p-4">
                {/* 页面标题和快捷操作 */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">{t('navigation.dashboard')}</h1>
                        <p className="text-sm text-muted-foreground">{t('dashboard.subtitle')}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/monitor">
                                <Activity className="mr-2 h-4 w-4" />
                                {t('dashboard.realtimeMonitor')}
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/racks/visual-edit">
                                <Eye className="mr-2 h-4 w-4" />
                                {t('dashboard.visualEdit')}
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* 统计卡片 */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCardComponent stat={stats.rooms} title={t('roomManagement.title')} />
                    <StatCardComponent stat={stats.racks} title={t('rackManagement.title')} />
                    <StatCardComponent stat={stats.devices} title={t('deviceManagement.title')} />
                    <StatCardComponent stat={stats.alerts} title={t('alert.title')} />
                    <StatCardComponent stat={stats.power} title={t('deviceLibrary.power')} />
                </div>

                {/* 主要内容区 */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* 左侧：设备状态分布 */}
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HardDrive className="h-5 w-5 text-muted-foreground" />
                                设备状态分布
                            </CardTitle>
                            <CardDescription>各状态设备数量统计</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {deviceStatusDistribution.map((item) => (
                                    <div key={item.name} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-3 w-3 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span className="text-sm">
                                                {t(`deviceManagement.statuses.${item.name}`, item.name)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-24 text-right text-sm font-medium">{item.value} 台</div>
                                            <div className="w-16 text-right text-xs text-muted-foreground">
                                                {calculatePercent(item.value, stats.devices.total)}%
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
                                    <div className="flex h-full">
                                        {deviceStatusDistribution.map((item, idx) => (
                                            <div
                                                key={item.name}
                                                className="h-full transition-all"
                                                style={{
                                                    width: `${calculatePercent(item.value, stats.devices.total)}%`,
                                                    backgroundColor: item.color,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 中间：机房分布 */}
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                                机房分布
                            </CardTitle>
                            <CardDescription>各机房设备与机柜数量</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-4">
                                {/* 机房列表 - 固定5个位置的高度 */}
                                <div className="flex-1 space-y-3">
                                    {roomDistribution.length === 0 ? (
                                        Array.from({ length: ITEMS_PER_PAGE }).map((_, idx) => (
                                            <div key={idx} className="flex h-[46px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 p-3">
                                                <span className="text-xs text-muted-foreground">-</span>
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            {paginatedRooms.map((room) => (
                                                <div key={room.id} className="flex h-[46px] items-center justify-between rounded-lg border p-3">
                                                    <p className="font-medium">{room.name}</p>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Server className="h-3 w-3" />
                                                            <span>机柜</span>
                                                            <span className="font-medium text-foreground">{room.racks}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                            <Cpu className="h-3 w-3" />
                                                            <span>设备</span>
                                                            <span className="font-medium text-foreground">{room.devices}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* 填充空白位置 */}
                                            {Array.from({ length: ITEMS_PER_PAGE - paginatedRooms.length }).map((_, idx) => (
                                                <div key={`empty-${idx}`} className="flex h-[46px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 p-3">
                                                    <span className="text-xs text-muted-foreground/40">-</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>

                                {/* 分页控件 */}
                                {totalPages > 1 && (
                                    <div className="flex flex-col items-center gap-2 py-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={handlePrevPage}
                                            disabled={currentPage === 0}
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </Button>

                                        {/* 页数小圆点 */}
                                        <div className="flex flex-col items-center gap-1.5">
                                            {Array.from({ length: totalPages }).map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setCurrentPage(idx)}
                                                    className={cn(
                                                        'h-2 w-2 rounded-full transition-all',
                                                        idx === currentPage
                                                            ? 'bg-primary h-2.5 w-2.5'
                                                            : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                                                    )}
                                                />
                                            ))}
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={handleNextPage}
                                            disabled={currentPage === totalPages - 1}
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 右侧：最近告警 */}
                    <Card className="lg:col-span-1">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                                    最近告警
                                </CardTitle>
                                <CardDescription>需要关注的系统告警</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/alerts">查看全部</Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {recentAlerts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                                        <Shield className="h-10 w-10 text-green-500" />
                                        <p className="text-sm text-muted-foreground">暂无活跃告警</p>
                                        <p className="text-xs text-muted-foreground">系统运行正常</p>
                                    </div>
                                ) : (
                                    recentAlerts.map((alert) => (
                                        <div
                                            key={alert.id}
                                            className={cn(
                                                'flex items-start gap-3 rounded-lg border p-3',
                                                getSeverityColor(alert.severity)
                                            )}
                                        >
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="truncate text-sm font-medium">{alert.title}</p>
                                                <p className="text-xs opacity-80">{alert.triggered_at}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 底部：最近添加的设备和快捷操作 */}
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* 最近添加的设备 */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                                    最近添加的设备
                                </CardTitle>
                                <CardDescription>最新入库的设备列表</CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" asChild>
                                <Link href="/devices">查看全部</Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {recentDevices.length === 0 ? (
                                    <div className="py-8 text-center text-muted-foreground">
                                        暂无设备数据
                                    </div>
                                ) : (
                                    recentDevices.map((device) => (
                                        <div
                                            key={device.id}
                                            className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn('h-2 w-2 rounded-full', getStatusColor(device.status))} />
                                                <div>
                                                    <p className="font-medium">{device.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {getDeviceTypeName(device.device_type_id)} · {device.room_name || '未分配机房'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {getStatusBadge(device.status)}
                                                <span className="text-xs text-muted-foreground">{device.created_at}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 快捷操作 */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Plus className="h-5 w-5 text-muted-foreground" />
                                快捷操作
                            </CardTitle>
                            <CardDescription>快速访问常用功能</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                                    <Link href="/rooms">
                                        <Building2 className="h-6 w-6" />
                                        <span className="text-xs">添加机房</span>
                                    </Link>
                                </Button>
                                <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                                    <Link href="/racks">
                                        <Server className="h-6 w-6" />
                                        <span className="text-xs">添加机柜</span>
                                    </Link>
                                </Button>
                                <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                                    <Link href="/devices">
                                        <Cpu className="h-6 w-6" />
                                        <span className="text-xs">添加设备</span>
                                    </Link>
                                </Button>
                                <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
                                    <Link href="/reports">
                                        <TrendingUp className="h-6 w-6" />
                                        <span className="text-xs">生成报表</span>
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
