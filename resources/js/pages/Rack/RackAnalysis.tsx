import { Head, router, usePage } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    Box,
    CheckCircle,
    Cpu,
    DollarSign,
    Filter,
    Info,
    Layers,
    Loader2,
    Moon,
    Monitor,
    Power,
    RefreshCw,
    Server,
    Settings,
    Sun,
    Thermometer,
    TrendingDown,
    TrendingUp,
    Wifi,
    Zap,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppearance } from '@/hooks/use-appearance';
import type { Appearance } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';

interface Props {
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function RackAnalysis({ breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const { props } = usePage();
    const { appearance, updateAppearance } = useAppearance();

    const [activeTab, setActiveTab] = useState('space');
    const [selectedRoom, setSelectedRoom] = useState<string>('all');
    const [selectedRack, setSelectedRack] = useState<string>('');
    const [loading, setLoading] = useState(false);

    const [systemHealth, setSystemHealth] = useState<any>(null);
    const [systemPower, setSystemPower] = useState<any>(null);
    const [rackSpace, setRackSpace] = useState<any>(null);
    const [rackPower, setRackPower] = useState<any>(null);
    const [rackHealth, setRackHealth] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<any[]>([]);

    const [smartRecommendParams, setSmartRecommendParams] = useState({
        device_height: 4,
        device_power: 500,
        device_type: 'server',
        device_library_id: null as number | null,
        preferred_room_id: null as number | null,
        preferred_rack_id: null as number | null,
    });
    const [smartRecommendResult, setSmartRecommendResult] = useState<any>(null);
    const [smartRecommendLoading, setSmartRecommendLoading] = useState(false);

    const [capacityOverview, setCapacityOverview] = useState<any>(null);
    const [capacityWarnings, setCapacityWarnings] = useState<any[]>([]);
    const [capacityForecast, setCapacityForecast] = useState<any>(null);
    const [selectedCapacityRoom, setSelectedCapacityRoom] = useState<string>('all');
    const [selectedCapacityRack, setSelectedCapacityRack] = useState<string>('');
    const [rackCapacityTrend, setRackCapacityTrend] = useState<any>(null);
    const [capacityLoading, setCapacityLoading] = useState(false);

    const rooms = (props as any).rooms || [];
    const racks = (props as any).racks || [];

    useEffect(() => {
        loadSystemOverview();
    }, []);

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    const loadSystemOverview = async () => {
        setLoading(true);
        try {
            const [healthRes, powerRes] = await Promise.all([
                fetch('/api/rack-analysis/system-health-overview'),
                fetch('/api/rack-analysis/system-power-overview'),
            ]);

            const healthData = await healthRes.json();
            const powerData = await powerRes.json();

            if (healthData.success) setSystemHealth(healthData.data);
            if (powerData.success) setSystemPower(powerData.data);
        } catch (error) {
            console.error('Failed to load system overview:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSmartRecommend = async () => {
        setSmartRecommendLoading(true);
        try {
            const response = await fetch('/api/rack-analysis/smart-recommend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                },
                body: JSON.stringify({
                    device_height: smartRecommendParams.device_height,
                    device_power: smartRecommendParams.device_power,
                    device_type: smartRecommendParams.device_type,
                    device_library_id: smartRecommendParams.device_library_id,
                    preferred_room_id: smartRecommendParams.preferred_room_id,
                    preferred_rack_id: smartRecommendParams.preferred_rack_id,
                }),
                credentials: 'same-origin',
            });

            const data = await response.json();
            if (data.success) {
                setSmartRecommendResult(data.data);
            }
        } catch (error) {
            console.error('Failed to load smart recommendation:', error);
        } finally {
            setSmartRecommendLoading(false);
        }
    };

    const loadCapacityData = async () => {
        setCapacityLoading(true);
        try {
            const [overviewRes, warningsRes, forecastRes] = await Promise.all([
                fetch('/api/rack-analysis/capacity-overview'),
                fetch('/api/rack-analysis/capacity-warnings'),
                fetch('/api/rack-analysis/capacity-forecast', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken || '',
                    },
                    body: JSON.stringify({ months: 12 }),
                    credentials: 'same-origin',
                }),
            ]);

            const overviewData = await overviewRes.json();
            const warningsData = await warningsRes.json();
            const forecastData = await forecastRes.json();

            if (overviewData.success) setCapacityOverview(overviewData.data);
            if (warningsData.success) setCapacityWarnings(warningsData.data);
            if (forecastData.success) setCapacityForecast(forecastData.data);
        } catch (error) {
            console.error('Failed to load capacity data:', error);
        } finally {
            setCapacityLoading(false);
        }
    };

    const loadRackCapacityTrend = async (rackId: string) => {
        if (!rackId) return;

        try {
            const response = await fetch('/api/rack-analysis/rack-capacity-trend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                },
                body: JSON.stringify({ rack_id: parseInt(rackId), months: 6 }),
                credentials: 'same-origin',
            });

            const data = await response.json();
            if (data.success) {
                setRackCapacityTrend(data.data);
            }
        } catch (error) {
            console.error('Failed to load rack capacity trend:', error);
        }
    };

    const loadRackAnalysis = async (rackId: string) => {
        if (!rackId) return;

        setLoading(true);
        try {
            const [spaceRes, powerRes, healthRes] = await Promise.all([
                fetch('/api/rack-analysis/analyze-space', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken || '',
                    },
                    body: JSON.stringify({ rack_id: parseInt(rackId) }),
                    credentials: 'same-origin',
                }),
                fetch('/api/rack-analysis/power-analysis', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken || '',
                    },
                    body: JSON.stringify({ rack_id: parseInt(rackId) }),
                    credentials: 'same-origin',
                }),
                fetch('/api/rack-analysis/rack-health', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken || '',
                    },
                    body: JSON.stringify({ rack_id: parseInt(rackId) }),
                }),
            ]);

            const spaceData = await spaceRes.json();
            const powerData = await powerRes.json();
            const healthData = await healthRes.json();

            if (spaceData.success) {
                setRackSpace(spaceData.data);
                generateRecommendations(spaceData.data, powerData.data, healthData.data);
            }
            if (powerData.success) setRackPower(powerData.data);
            if (healthData.success) setRackHealth(healthData.data);
        } catch (error) {
            console.error('Failed to load rack analysis:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateRecommendations = (space: any, power: any, health: any) => {
        const recs: any[] = [];

        if (space && space.utilization_rate > 85) {
            recs.push({
                type: 'warning',
                title: '机柜空间利用率过高',
                message: `当前利用率 ${space.utilization_rate}%，建议规划新机柜以应对扩展需求`,
                icon: Box,
            });
        }

        if (power && power.utilization > 80) {
            recs.push({
                type: 'danger',
                title: '电源容量接近上限',
                message: `当前负载 ${power.utilization}%，存在电源过载风险`,
                icon: Zap,
            });
        }

        if (health && health.critical_devices?.length > 0) {
            recs.push({
                type: 'danger',
                title: '存在健康度异常的设备',
                message: `${health.critical_devices.length} 台设备需要紧急维护`,
                icon: AlertTriangle,
            });
        }

        if (space && space.gaps?.length > 0) {
            const largeGaps = space.gaps.filter((g: any) => g.size >= 4);
            if (largeGaps.length > 0) {
                recs.push({
                    type: 'info',
                    title: '存在可用空间',
                    message: `发现 ${largeGaps.length} 处连续空闲区域，可容纳更大设备`,
                    icon: CheckCircle,
                });
            }
        }

        setRecommendations(recs);
    };

    const getHealthStatusColor = (status: string) => {
        switch (status) {
            case 'excellent':
                return 'text-green-600 bg-green-50';
            case 'good':
                return 'text-blue-600 bg-blue-50';
            case 'fair':
                return 'text-yellow-600 bg-yellow-50';
            case 'poor':
                return 'text-orange-600 bg-orange-50';
            case 'critical':
                return 'text-red-600 bg-red-50';
            default:
                return 'text-gray-600 bg-gray-50';
        }
    };

    const getPowerStatusColor = (utilization: number) => {
        if (utilization >= 90) return 'bg-red-500';
        if (utilization >= 80) return 'bg-orange-500';
        if (utilization >= 60) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="机柜智能分析" />

            <div className="flex flex-col gap-6 p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">机柜智能分析</h1>
                        <p className="text-muted-foreground mt-1">
                            基于设备特征的智能空间推荐与健康度分析
                        </p>
                    </div>
                    <Button onClick={loadSystemOverview} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        刷新数据
                    </Button>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">系统健康度</CardTitle>
                            <Activity className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {systemHealth?.overall_health_score || '--'}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {systemHealth?.total_devices || 0} 台设备
                            </p>
                            <Progress
                                value={systemHealth?.overall_health_score || 0}
                                className="mt-2 h-1"
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">电源总负载</CardTitle>
                            <Zap className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {systemPower?.total_power || 0} W
                            </div>
                            <p className="text-xs text-muted-foreground">
                                可用 {systemPower?.available_power || 0} W
                            </p>
                            <Progress
                                value={systemPower?.system_utilization || 0}
                                className="mt-2 h-1"
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">告警设备</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {systemHealth?.critical_devices || 0}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {systemHealth?.warning_devices || 0} 台需要关注
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">电源告警</CardTitle>
                            <Power className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-orange-600">
                                {systemPower?.critical_racks?.length || 0}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {systemPower?.warning_racks?.length || 0} 台接近上限
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="mb-6 flex gap-4">
                    <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                        <SelectTrigger className="w-[200px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="选择机房" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部机房</SelectItem>
                            {rooms.map((room: any) => (
                                <SelectItem key={room.id} value={room.id.toString()}>
                                    {room.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedRack} onValueChange={(val) => {
                        setSelectedRack(val);
                        loadRackAnalysis(val);
                    }}>
                        <SelectTrigger className="w-[200px]">
                            <Server className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="选择机柜" />
                        </SelectTrigger>
                        <SelectContent>
                            {racks
                                .filter((r: any) => selectedRoom === 'all' || r.room_id.toString() === selectedRoom)
                                .map((rack: any) => (
                                    <SelectItem key={rack.id} value={rack.id.toString()}>
                                        {rack.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>

                {recommendations.length > 0 && (
                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {recommendations.map((rec: any, idx: number) => {
                            const IconComponent = rec.icon;
                            return (
                                <Card key={idx} className={
                                    rec.type === 'danger' ? 'border-red-200 bg-red-50/50' :
                                    rec.type === 'warning' ? 'border-orange-200 bg-orange-50/50' :
                                    'border-blue-200 bg-blue-50/50'
                                }>
                                    <CardContent className="pt-4">
                                        <div className="flex items-start gap-3">
                                            <div className={
                                                rec.type === 'danger' ? 'text-red-600' :
                                                rec.type === 'warning' ? 'text-orange-600' :
                                                'text-blue-600'
                                            }>
                                                <IconComponent className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{rec.title}</h4>
                                                <p className="text-sm text-muted-foreground mt-1">{rec.message}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                <Tabs value={activeTab} onValueChange={(val) => {
                        setActiveTab(val);
                        if (val === 'capacity' && !capacityOverview) {
                            loadCapacityData();
                        }
                    }}>
                    <TabsList>
                        <TabsTrigger value="space">空间分析</TabsTrigger>
                        <TabsTrigger value="power">电源分析</TabsTrigger>
                        <TabsTrigger value="health">健康度分析</TabsTrigger>
                        <TabsTrigger value="smart">智能上架</TabsTrigger>
                        <TabsTrigger value="capacity">容量规划</TabsTrigger>
                    </TabsList>

                    <TabsContent value="space" className="mt-4">
                        {rackSpace ? (
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>空间利用率</CardTitle>
                                        <CardDescription>
                                            {rackSpace.rack_name} - U位使用情况
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="mb-4">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>已用空间</span>
                                                <span>{rackSpace.occupied_u} / {rackSpace.total_u} U</span>
                                            </div>
                                            <Progress value={rackSpace.utilization_rate} className="h-3" />
                                            <p className="text-right text-sm text-muted-foreground mt-1">
                                                {rackSpace.utilization_rate}% 已使用
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-6">
                                            <div className="text-center p-3 bg-slate-50 rounded-lg">
                                                <div className="text-xl font-bold">{rackSpace.free_u}</div>
                                                <div className="text-xs text-muted-foreground">空闲U位</div>
                                            </div>
                                            <div className="text-center p-3 bg-slate-50 rounded-lg">
                                                <div className="text-xl font-bold">{rackSpace.device_count}</div>
                                                <div className="text-xs text-muted-foreground">设备数量</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>空间区域分析</CardTitle>
                                        <CardDescription>按区域统计空间使用情况</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {rackSpace.zones?.map((zone: any) => (
                                                <div key={zone.zone} className="flex items-center gap-3">
                                                    <span className="text-sm font-medium w-16">{zone.label}</span>
                                                    <Progress value={zone.utilization} className="flex-1 h-2" />
                                                    <span className="text-sm w-12 text-right">{zone.utilization}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {rackSpace.gaps?.length > 0 && (
                                    <Card className="lg:col-span-2">
                                        <CardHeader>
                                            <CardTitle>空闲区间</CardTitle>
                                            <CardDescription>可用的连续空闲空间</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-2">
                                                {rackSpace.gaps.map((gap: any, idx: number) => (
                                                    <Badge key={idx} variant="outline" className="px-3 py-1">
                                                        U{gap.start} - U{gap.end} ({gap.size}U)
                                                    </Badge>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    请选择机柜以查看空间分析
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="power" className="mt-4">
                        {rackPower ? (
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>电源负载分析</CardTitle>
                                        <CardDescription>
                                            {rackPower.rack_name} - 功率使用情况
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="mb-4">
                                            <div className="flex justify-between text-sm mb-1">
                                                <span>当前负载</span>
                                                <span>{rackPower.current_power} / {rackPower.power_limit || '无限制'} W</span>
                                            </div>
                                            <Progress
                                                value={rackPower.utilization}
                                                className="h-3"
                                                indicatorClassName={getPowerStatusColor(rackPower.utilization)}
                                            />
                                            <p className="text-right text-sm text-muted-foreground mt-1">
                                                {rackPower.utilization}% 已使用
                                            </p>
                                        </div>

                                        <div className={`p-3 rounded-lg mb-4 ${
                                            rackPower.status === 'critical' ? 'bg-red-50 text-red-700' :
                                            rackPower.status === 'warning' ? 'bg-orange-50 text-orange-700' :
                                            'bg-green-50 text-green-700'
                                        }`}>
                                            <div className="flex items-center gap-2">
                                                {rackPower.status === 'critical' ? (
                                                    <AlertTriangle className="h-4 w-4" />
                                                ) : rackPower.status === 'warning' ? (
                                                    <AlertTriangle className="h-4 w-4" />
                                                ) : (
                                                    <CheckCircle className="h-4 w-4" />
                                                )}
                                                <span className="text-sm font-medium">{rackPower.warning || '电源状态正常'}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="text-center p-3 bg-slate-50 rounded-lg">
                                                <div className="text-xl font-bold">{rackPower.available_power}</div>
                                                <div className="text-xs text-muted-foreground">可用功率 (W)</div>
                                            </div>
                                            <div className="text-center p-3 bg-slate-50 rounded-lg">
                                                <div className="text-xl font-bold">{rackPower.device_count}</div>
                                                <div className="text-xs text-muted-foreground">设备数量</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>功率分布</CardTitle>
                                        <CardDescription>按设备类型统计功率消耗</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {rackPower.power_distribution?.map((dist: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Cpu className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">{dist.category}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-medium">{dist.total_power} W</span>
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            ({dist.percentage}%)
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {rackPower.redundancy && (
                                    <Card className="lg:col-span-2">
                                        <CardHeader>
                                            <CardTitle>电源冗余分析</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-full ${
                                                    rackPower.redundancy.has_redundant_power ? 'bg-green-100' : 'bg-yellow-100'
                                                }`}>
                                                    {rackPower.redundancy.has_redundant_power ? (
                                                        <CheckCircle className="h-6 w-6 text-green-600" />
                                                    ) : (
                                                        <AlertTriangle className="h-6 w-6 text-yellow-600" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium">
                                                        {rackPower.redundancy.has_redundant_power ? '具备电源冗余' : '无冗余电源'}
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {rackPower.redundancy.recommendation}
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    请选择机柜以查看电源分析
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="health" className="mt-4">
                        {rackHealth ? (
                            <div className="grid grid-cols-1 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>机柜健康度总览</CardTitle>
                                        <CardDescription>
                                            {rackHealth.rack_name} - {rackHealth.device_count} 台设备
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-6 mb-6">
                                            <div className="text-center">
                                                <div className="text-4xl font-bold text-blue-600">
                                                    {rackHealth.overall_health_score}
                                                </div>
                                                <div className="text-xs text-muted-foreground">综合健康度</div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="grid grid-cols-5 gap-2">
                                                    {['excellent', 'good', 'fair', 'poor', 'critical'].map((level) => (
                                                        <div key={level} className="text-center">
                                                            <div className={`text-lg font-bold ${getHealthStatusColor(level).split(' ')[0]}`}>
                                                                {rackHealth.health_distribution?.[level] || 0}
                                                            </div>
                                                            <div className="text-xs capitalize">{level}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {rackHealth.critical_devices?.length > 0 && (
                                            <div className="mb-4 p-4 bg-red-50 rounded-lg">
                                                <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                                                    <AlertTriangle className="h-4 w-4" />
                                                    需要关注的设备
                                                </h4>
                                                <div className="space-y-2">
                                                    {rackHealth.critical_devices.map((device: any) => (
                                                        <div key={device.id} className="flex items-center justify-between text-sm">
                                                            <span>{device.name}</span>
                                                            <Badge variant="destructive">{device.risk_level}</Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {rackHealth.device_details && Object.keys(rackHealth.device_details).length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>设备健康度详情</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>设备名称</TableHead>
                                                        <TableHead>健康度</TableHead>
                                                        <TableHead>在线率</TableHead>
                                                        <TableHead>稳定性</TableHead>
                                                        <TableHead>风险等级</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {Object.values(rackHealth.device_details).map((device: any) => (
                                                        <TableRow key={device.device_id}>
                                                            <TableCell className="font-medium">{device.device_name}</TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${
                                                                        device.health_score >= 80 ? 'bg-green-500' :
                                                                        device.health_score >= 60 ? 'bg-yellow-500' :
                                                                        'bg-red-500'
                                                                    }`} />
                                                                    {device.health_score}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>{device.online_rate}%</TableCell>
                                                            <TableCell>{device.stability_score}</TableCell>
                                                            <TableCell>
                                                                <Badge className={
                                                                    device.risk_level === 'low' ? 'bg-green-100 text-green-700' :
                                                                    device.risk_level === 'medium' ? 'bg-blue-100 text-blue-700' :
                                                                    device.risk_level === 'high' ? 'bg-orange-100 text-orange-700' :
                                                                    'bg-red-100 text-red-700'
                                                                }>
                                                                    {device.risk_level}
                                                                </Badge>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    请选择机柜以查看健康度分析
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="smart" className="mt-4">
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>智能设备上架推荐</CardTitle>
                                    <CardDescription>
                                        根据机房热力图、散热路径、电源均衡和设备兼容性智能推荐最佳放置位置
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">设备高度 (U)</label>
                                            <Select
                                                value={smartRecommendParams.device_height.toString()}
                                                onValueChange={(val) => setSmartRecommendParams(prev => ({ ...prev, device_height: parseInt(val) }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">1U</SelectItem>
                                                    <SelectItem value="2">2U</SelectItem>
                                                    <SelectItem value="4">4U</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">设备功率 (W)</label>
                                            <Select
                                                value={smartRecommendParams.device_power.toString()}
                                                onValueChange={(val) => setSmartRecommendParams(prev => ({ ...prev, device_power: parseInt(val) }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="300">300W</SelectItem>
                                                    <SelectItem value="500">500W</SelectItem>
                                                    <SelectItem value="750">750W</SelectItem>
                                                    <SelectItem value="1000">1000W</SelectItem>
                                                    <SelectItem value="1500">1500W</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">设备类型</label>
                                            <Select
                                                value={smartRecommendParams.device_type}
                                                onValueChange={(val) => setSmartRecommendParams(prev => ({ ...prev, device_type: val }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="server">服务器</SelectItem>
                                                    <SelectItem value="switch">交换机</SelectItem>
                                                    <SelectItem value="storage">存储设备</SelectItem>
                                                    <SelectItem value="router">路由器</SelectItem>
                                                    <SelectItem value="firewall">防火墙</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium mb-2 block">优先机房</label>
                                            <Select
                                                value={smartRecommendParams.preferred_room_id?.toString() || 'all'}
                                                onValueChange={(val) => setSmartRecommendParams(prev => ({ ...prev, preferred_room_id: val === 'all' ? null : parseInt(val) }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">不限定</SelectItem>
                                                    {rooms.map((room: any) => (
                                                        <SelectItem key={room.id} value={room.id.toString()}>
                                                            {room.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <Button onClick={loadSmartRecommend} disabled={smartRecommendLoading}>
                                            <Cpu className={`mr-2 h-4 w-4 ${smartRecommendLoading ? 'animate-spin' : ''}`} />
                                            {smartRecommendLoading ? '分析中...' : '开始分析'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {smartRecommendResult && (
                                <>
                                    {smartRecommendResult.heat_effect_warning && (
                                        <Card className="border-yellow-200 bg-yellow-50/50">
                                            <CardContent className="pt-4">
                                                <div className="flex items-center gap-3">
                                                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                                    <span className="text-sm text-yellow-800">{smartRecommendResult.heat_effect_warning.message}</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {smartRecommendResult.top_recommendations?.map((rec: any, idx: number) => (
                                            <Card key={idx} className={idx === 0 ? 'border-green-300 bg-green-50/30' : ''}>
                                                <CardHeader className="pb-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            {idx === 0 && <CheckCircle className="h-5 w-5 text-green-600" />}
                                                            <CardTitle className="text-base">
                                                                {rec.room_name} / {rec.rack_name}
                                                            </CardTitle>
                                                        </div>
                                                        <Badge variant={rec.overall_score >= 80 ? 'default' : 'secondary'}>
                                                            {rec.overall_score}分
                                                        </Badge>
                                                    </div>
                                                    <CardDescription>
                                                        推荐位置：U{rec.recommended_u_position} - U{rec.recommended_u_end}
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                                            <div className="flex items-center gap-1">
                                                                <Box className="h-4 w-4 text-muted-foreground" />
                                                                <span>位置评分：{rec.score_breakdown?.slot_score}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Server className="h-4 w-4 text-muted-foreground" />
                                                                <span>兼容性：{rec.score_breakdown?.type_compatibility}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Zap className="h-4 w-4 text-muted-foreground" />
                                                                <span>电源均衡：{rec.score_breakdown?.power_balance}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <Activity className="h-4 w-4 text-muted-foreground" />
                                                                <span>电源余量：{rec.score_breakdown?.power_headroom}</span>
                                                            </div>
                                                        </div>

                                                        {rec.reasons && rec.reasons.length > 0 && (
                                                            <div className="pt-2 border-t">
                                                                <p className="text-xs font-medium text-muted-foreground mb-1">推荐理由：</p>
                                                                <ul className="text-xs space-y-0.5">
                                                                    {rec.reasons.slice(0, 3).map((reason: string, i: number) => (
                                                                        <li key={i} className="flex items-start gap-1">
                                                                            <span className="text-green-600">✓</span>
                                                                            {reason}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {rec.warnings && rec.warnings.length > 0 && (
                                                            <div className="pt-2 border-t">
                                                                {rec.warnings.map((warning: any, i: number) => (
                                                                    <div key={i} className={`flex items-start gap-1 text-xs ${
                                                                        warning.type === 'danger' ? 'text-red-600' :
                                                                        warning.type === 'warning' ? 'text-orange-600' :
                                                                        'text-blue-600'
                                                                    }`}>
                                                                        <AlertTriangle className="h-3 w-3 mt-0.5" />
                                                                        {warning.message}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>

                                    {(!smartRecommendResult.top_recommendations || smartRecommendResult.top_recommendations.length === 0) && (
                                        <Card>
                                            <CardContent className="py-12 text-center text-muted-foreground">
                                                没有找到符合条件的机柜，请调整设备参数后重试
                                            </CardContent>
                                        </Card>
                                    )}
                                </>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="capacity" className="mt-4">
                        {capacityLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : capacityOverview ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>总机柜数</CardDescription>
                                            <CardTitle className="text-2xl">{capacityOverview.total_racks}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-muted-foreground">
                                                {capacityOverview.total_devices} 台设备
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>空间利用率</CardDescription>
                                            <CardTitle className="text-2xl">{capacityOverview.space_utilization}%</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-2">
                                                <Progress value={capacityOverview.space_utilization} className="h-2" />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {capacityOverview.used_space_u} / {capacityOverview.total_space_u} U
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>电源利用率</CardDescription>
                                            <CardTitle className="text-2xl">{capacityOverview.power_utilization}%</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-2">
                                                <Progress value={capacityOverview.power_utilization} className="h-2" />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {capacityOverview.used_power}W / {capacityOverview.total_power}W
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>告警数量</CardDescription>
                                            <CardTitle className="text-2xl">{capacityWarnings.length}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-muted-foreground">
                                                {capacityWarnings.filter((w: any) => w.type === 'critical').length} 严重 / {capacityWarnings.filter((w: any) => w.type === 'warning').length} 警告
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {capacityWarnings.length > 0 && (
                                    <Card className="border-yellow-200 bg-yellow-50/50">
                                        <CardHeader>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                                容量预警
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2">
                                                {capacityWarnings.slice(0, 5).map((warning: any, idx: number) => (
                                                    <div key={idx} className={`flex items-start gap-2 text-sm ${
                                                        warning.type === 'critical' ? 'text-red-700' : 'text-orange-700'
                                                    }`}>
                                                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                                        <span>{warning.room_name} - {warning.rack_name}: {warning.message}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {capacityForecast && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>容量预测（未来12个月）</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                                <div>
                                                    <h4 className="text-sm font-medium mb-3">空间使用趋势</h4>
                                                    <div className="space-y-2">
                                                        {capacityForecast.space_forecast?.map((forecast: any, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-3">
                                                                <span className="text-xs text-muted-foreground w-16">{forecast.month}</span>
                                                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${
                                                                            forecast.status === 'critical' ? 'bg-red-500' :
                                                                            forecast.status === 'warning' ? 'bg-yellow-500' :
                                                                            'bg-green-500'
                                                                        }`}
                                                                        style={{ width: `${forecast.utilization}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs w-12 text-right">{forecast.utilization}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-medium mb-3">电源使用趋势</h4>
                                                    <div className="space-y-2">
                                                        {capacityForecast.power_forecast?.map((forecast: any, idx: number) => (
                                                            <div key={idx} className="flex items-center gap-3">
                                                                <span className="text-xs text-muted-foreground w-16">{forecast.month}</span>
                                                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full ${
                                                                            forecast.status === 'critical' ? 'bg-red-500' :
                                                                            forecast.status === 'warning' ? 'bg-yellow-500' :
                                                                            'bg-green-500'
                                                                        }`}
                                                                        style={{ width: `${forecast.utilization}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-xs w-12 text-right">{forecast.utilization}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            {capacityForecast.recommendations && capacityForecast.recommendations.length > 0 && (
                                                <div className="mt-4 pt-4 border-t">
                                                    <h4 className="text-sm font-medium mb-2">优化建议</h4>
                                                    <ul className="space-y-1">
                                                        {capacityForecast.recommendations.map((rec: any, idx: number) => (
                                                            <li key={idx} className={`text-sm flex items-start gap-2 ${
                                                                rec.priority === 'high' ? 'text-red-600' :
                                                                rec.priority === 'medium' ? 'text-orange-600' :
                                                                'text-green-600'
                                                            }`}>
                                                                <span>•</span>
                                                                {rec.message}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                <Card>
                                    <CardHeader>
                                        <CardTitle>各机房容量详情</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {capacityOverview.room_stats?.map((room: any) => (
                                                <div key={room.room_id} className="border rounded-lg p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h4 className="font-medium">{room.room_name}</h4>
                                                        <Badge variant="outline">{room.rack_count} 机柜</Badge>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <div className="flex justify-between text-sm mb-1">
                                                                <span className="text-muted-foreground">空间</span>
                                                                <span>{room.utilization_rate}%</span>
                                                            </div>
                                                            <Progress
                                                                value={room.utilization_rate}
                                                                className="h-2"
                                                                indicatorClassName={
                                                                    room.utilization_rate >= 90 ? 'bg-red-500' :
                                                                    room.utilization_rate >= 80 ? 'bg-yellow-500' :
                                                                    'bg-green-500'
                                                                }
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between text-sm mb-1">
                                                                <span className="text-muted-foreground">电源</span>
                                                                <span>{room.power_utilization}%</span>
                                                            </div>
                                                            <Progress
                                                                value={room.power_utilization}
                                                                className="h-2"
                                                                indicatorClassName={
                                                                    room.power_utilization >= 90 ? 'bg-red-500' :
                                                                    room.power_utilization >= 80 ? 'bg-yellow-500' :
                                                                    'bg-green-500'
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {room.device_count} 台设备
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    加载容量数据失败，请刷新重试
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}