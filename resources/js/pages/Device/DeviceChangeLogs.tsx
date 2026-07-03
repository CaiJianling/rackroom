import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    History,
    Loader2,
    Search,
    Server,
    Trash2,
    TrendingUp,
    User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const BREADCRUMBS = [
    { title: '监控/报表', href: '#' },
    { title: '设备变更追踪', href: '/device-change-logs' },
];

interface Props {
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function DeviceChangeLogs({ breadcrumbs = BREADCRUMBS }: Props) {
    const [logs, setLogs] = useState<any[]>([]);
    const [migrations, setMigrations] = useState<any[]>([]);
    const [statistics, setStatistics] = useState<any>(null);

    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState<any>(null);

    const [filters, setFilters] = useState({
        change_type: '',
        operator_name: '',
        date_from: '',
        date_to: '',
    });

    const [clearDialogOpen, setClearDialogOpen] = useState(false);
    const [clearDateFrom, setClearDateFrom] = useState('');
    const [clearDateTo, setClearDateTo] = useState('');
    const [clearing, setClearing] = useState(false);

    const [migrationFilters, setMigrationFilters] = useState({
        device_name: '',
        operator: '',
        date_from: '',
        date_to: '',
    });

    const changeTypeColors: Record<string, string> = {
        create: 'bg-green-100 text-green-800',
        update: 'bg-blue-100 text-blue-800',
        delete: 'bg-red-100 text-red-800',
        migrate: 'bg-purple-100 text-purple-800',
        power_on: 'bg-emerald-100 text-emerald-800',
        power_off: 'bg-orange-100 text-orange-800',
        maintenance: 'bg-yellow-100 text-yellow-800',
    };

    const changeTypeLabels: Record<string, string> = {
        create: '创建',
        update: '更新',
        delete: '删除',
        migrate: '迁移',
        power_on: '开机',
        power_off: '关机',
        maintenance: '维护',
    };

    useEffect(() => {
        loadLogs();
    }, []);

    const loadLogs = async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '20',
            });

            if (filters.change_type) params.append('change_type', filters.change_type);
            if (filters.operator_name) params.append('operator_name', filters.operator_name);
            if (filters.date_from) params.append('date_from', filters.date_from);
            if (filters.date_to) params.append('date_to', filters.date_to);

            const response = await fetch(`/api/device-change-logs?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setLogs(data.data);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMigrations = async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                per_page: '20',
            });

            if (migrationFilters.device_name) params.append('device_name', migrationFilters.device_name);
            if (migrationFilters.operator) params.append('operator', migrationFilters.operator);
            if (migrationFilters.date_from) params.append('date_from', migrationFilters.date_from);
            if (migrationFilters.date_to) params.append('date_to', migrationFilters.date_to);

            const response = await fetch(`/api/device-change-logs/migrations?${params.toString()}`);
            const data = await response.json();

            if (data.success) {
                setMigrations(data.data);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Failed to load migrations:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadStatistics = async () => {
        try {
            const response = await fetch('/api/device-change-logs/statistics');
            const data = await response.json();

            if (data.success) {
                setStatistics(data.data);
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    };

    const clearLogs = async () => {
        if (!clearDateFrom || !clearDateTo) {
            alert('请选择开始日期和结束日期');
            return;
        }

        setClearing(true);
        try {
            const response = await fetch('/api/device-change-logs', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    date_from: clearDateFrom,
                    date_to: clearDateTo,
                }),
            });
            const data = await response.json();

            if (data.success) {
                alert(data.message);
                setClearDialogOpen(false);
                setClearDateFrom('');
                setClearDateTo('');
                loadLogs();
                if (statistics) {
                    loadStatistics();
                }
            } else {
                alert(data.message || '清除失败');
            }
        } catch (error) {
            console.error('Failed to clear logs:', error);
            alert('清除失败');
        } finally {
            setClearing(false);
        }
    };

    const handleTabChange = (value: string) => {
        if (value === 'logs') {
            loadLogs();
        } else if (value === 'migrations') {
            loadMigrations();
        } else if (value === 'statistics') {
            if (!statistics) {
                loadStatistics();
            }
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="设备变更追踪" />

            <div className="flex flex-col gap-6 p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <History className="h-6 w-6" />
                            设备变更追踪
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            记录设备所有变更操作，形成完整的操作日志链
                        </p>
                    </div>
                    <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4" />
                                清除历史
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-destructive" />
                                    确认清除历史日志
                                </AlertDialogTitle>
                                <AlertDialogDescription className="space-y-3">
                                    <p>确定要清除指定日期范围内的所有变更日志吗？此操作不可恢复，请谨慎操作。</p>
                                    <div className="flex gap-4 items-center">
                                        <div className="flex-1">
                                            <label className="text-sm font-medium mb-1 block">开始日期</label>
                                            <Input
                                                type="date"
                                                value={clearDateFrom}
                                                onChange={(e) => setClearDateFrom(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-sm font-medium mb-1 block">结束日期</label>
                                            <Input
                                                type="date"
                                                value={clearDateTo}
                                                onChange={(e) => setClearDateTo(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={(e) => {
                                        e.preventDefault();
                                        clearLogs();
                                    }}
                                    disabled={clearing}
                                    className="bg-red-600 text-white hover:bg-red-700"
                                >
                                    {clearing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            清除中...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            确认清除
                                        </>
                                    )}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

                <Tabs defaultValue="logs" onValueChange={handleTabChange}>
                    <TabsList>
                        <TabsTrigger value="logs">
                            <Activity className="mr-2 h-4 w-4" />
                            变更日志
                        </TabsTrigger>
                        <TabsTrigger value="migrations">
                            <ArrowRight className="mr-2 h-4 w-4" />
                            迁移记录
                        </TabsTrigger>
                        <TabsTrigger value="statistics">
                            <TrendingUp className="mr-2 h-4 w-4" />
                            统计报表
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="logs" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>变更日志</CardTitle>
                                <CardDescription>
                                    查看所有设备变更操作记录
                                </CardDescription>
                                <div className="flex flex-wrap gap-4 mt-4">
                                    <Select
                                        value={filters.change_type}
                                        onValueChange={(val) => setFilters(prev => ({ ...prev, change_type: val === 'all' ? '' : val }))}
                                    >
                                        <SelectTrigger className="w-32">
                                            <SelectValue placeholder="变更类型" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">全部类型</SelectItem>
                                            <SelectItem value="create">创建</SelectItem>
                                            <SelectItem value="update">更新</SelectItem>
                                            <SelectItem value="delete">删除</SelectItem>
                                            <SelectItem value="migrate">迁移</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    <Input
                                        placeholder="操作人"
                                        value={filters.operator_name}
                                        onChange={(e) => setFilters(prev => ({ ...prev, operator_name: e.target.value }))}
                                        className="w-40"
                                        onKeyDown={(e) => e.key === 'Enter' && loadLogs()}
                                    />

                                    <Input
                                        type="date"
                                        placeholder="开始日期"
                                        value={filters.date_from}
                                        onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                                        className="w-40"
                                    />

                                    <Input
                                        type="date"
                                        placeholder="结束日期"
                                        value={filters.date_to}
                                        onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                                        className="w-40"
                                    />

                                    <Button variant="outline" onClick={() => loadLogs()}>
                                        <Search className="mr-2 h-4 w-4" />
                                        搜索
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        暂无变更记录
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {logs.map((log: any) => {
                                            const deviceName = log.device?.name
                                                || (log.old_values?.name)
                                                || (log.new_values?.name)
                                                || (log.description?.match(/^(?:设备)?(.+?)(?:\s*[从将在]|$)/)?.[1])
                                                || '未知设备';

                                            return (
                                            <div
                                                key={log.id}
                                                className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <div className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${changeTypeColors[log.change_type] || 'bg-gray-100 text-gray-800'}`}>
                                                    {changeTypeLabels[log.change_type] || log.change_type}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                                                        <span className="flex items-center gap-1.5">
                                                            <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                                                            <span className="font-medium truncate">{deviceName}</span>
                                                        </span>
                                                        {log.old_rack_name && log.new_rack_name && log.change_type === 'migrate' && (
                                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <span className="truncate max-w-[100px]">{log.old_rack_name}</span>
                                                                <ArrowRight className="h-3 w-3 shrink-0" />
                                                                <span className="truncate max-w-[100px]">{log.new_rack_name}</span>
                                                            </span>
                                                        )}
                                                    </div>

                                                    <p className="text-sm text-muted-foreground mb-2">
                                                        {log.description}
                                                    </p>

                                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <User className="h-3 w-3" />
                                                            {log.operator_name || '系统'}
                                                        </span>
                                                        <span>{log.created_at}</span>
                                                        {log.operator_ip && <span>IP: {log.operator_ip}</span>}
                                                    </div>

                                                    {log.old_values && log.new_values && (
                                                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                <div>
                                                                    <span className="text-muted-foreground">变更前：</span>
                                                                    {Object.entries(log.old_values)
                                                                        .slice(0, 4)
                                                                        .map(([key, value]) => (
                                                                            <div key={key} className="truncate">{key}: {String(value)}</div>
                                                                        ))
                                                                    }
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted-foreground">变更后：</span>
                                                                    {Object.entries(log.new_values)
                                                                        .slice(0, 4)
                                                                        .map(([key, value]) => (
                                                                            <div key={key} className="truncate">{key}: {String(value)}</div>
                                                                        ))
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            );
                                        })}

                                        {pagination && pagination.last_page > 1 && (
                                            <div className="flex justify-center gap-2 mt-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => loadLogs(pagination.current_page - 1)}
                                                    disabled={pagination.current_page <= 1}
                                                >
                                                    上一页
                                                </Button>
                                                <span className="flex items-center px-3 text-sm">
                                                    第 {pagination.current_page} / {pagination.last_page} 页
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => loadLogs(pagination.current_page + 1)}
                                                    disabled={pagination.current_page >= pagination.last_page}
                                                >
                                                    下一页
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="migrations" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>设备迁移记录</CardTitle>
                                <CardDescription>
                                    记录设备在不同机柜之间的迁移历史
                                </CardDescription>
                                <div className="flex flex-wrap gap-4 mt-4">
                                    <Input
                                        placeholder="设备名称"
                                        value={migrationFilters.device_name}
                                        onChange={(e) => setMigrationFilters(prev => ({ ...prev, device_name: e.target.value }))}
                                        className="w-40"
                                        onKeyDown={(e) => e.key === 'Enter' && loadMigrations()}
                                    />

                                    <Input
                                        placeholder="操作人"
                                        value={migrationFilters.operator}
                                        onChange={(e) => setMigrationFilters(prev => ({ ...prev, operator: e.target.value }))}
                                        className="w-40"
                                        onKeyDown={(e) => e.key === 'Enter' && loadMigrations()}
                                    />

                                    <Input
                                        type="date"
                                        placeholder="开始日期"
                                        value={migrationFilters.date_from}
                                        onChange={(e) => setMigrationFilters(prev => ({ ...prev, date_from: e.target.value }))}
                                        className="w-40"
                                    />

                                    <Input
                                        type="date"
                                        placeholder="结束日期"
                                        value={migrationFilters.date_to}
                                        onChange={(e) => setMigrationFilters(prev => ({ ...prev, date_to: e.target.value }))}
                                        className="w-40"
                                    />

                                    <Button variant="outline" onClick={() => loadMigrations()}>
                                        <Search className="mr-2 h-4 w-4" />
                                        搜索
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : migrations.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        暂无迁移记录
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {migrations.map((migration: any) => (
                                            <div
                                                key={migration.id}
                                                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                            >
                                                <div className="p-2 bg-purple-100 rounded-lg shrink-0">
                                                    <ArrowRight className="h-5 w-5 text-purple-600" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <Server className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium truncate">{migration.device_name || '未知设备'}</span>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                                        <Badge variant="outline">{migration.from_rack || '未知'}</Badge>
                                                        {migration.from_position && (
                                                            <span className="text-muted-foreground">U{migration.from_position}</span>
                                                        )}
                                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                        <Badge variant="outline">{migration.to_rack || '未知'}</Badge>
                                                        {migration.to_position && (
                                                            <span className="text-muted-foreground">U{migration.to_position}</span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1">
                                                            <User className="h-3 w-3" />
                                                            {migration.operator || '系统'}
                                                        </span>
                                                        <span>{migration.timestamp}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        {pagination && pagination.last_page > 1 && (
                                            <div className="flex justify-center gap-2 mt-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => loadMigrations(pagination.current_page - 1)}
                                                    disabled={pagination.current_page <= 1}
                                                >
                                                    上一页
                                                </Button>
                                                <span className="flex items-center px-3 text-sm">
                                                    第 {pagination.current_page} / {pagination.last_page} 页
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => loadMigrations(pagination.current_page + 1)}
                                                    disabled={pagination.current_page >= pagination.last_page}
                                                >
                                                    下一页
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="statistics" className="mt-4">
                        {statistics ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>总变更数</CardDescription>
                                            <CardTitle className="text-2xl">{statistics.total_logs}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-muted-foreground">设备变更操作总数</p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>创建</CardDescription>
                                            <CardTitle className="text-2xl text-green-600">{statistics.total_creates}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-muted-foreground">新增设备数量</p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>更新</CardDescription>
                                            <CardTitle className="text-2xl text-blue-600">{statistics.total_updates}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-muted-foreground">配置变更次数</p>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <CardDescription>迁移</CardDescription>
                                            <CardTitle className="text-2xl text-purple-600">{statistics.total_migrations}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-xs text-muted-foreground">设备迁移次数</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>变更类型分布</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {statistics.type_distribution?.map((item: any) => (
                                                    <div key={item.type} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-3 h-3 rounded-full ${changeTypeColors[item.type] || 'bg-gray-400'}`} />
                                                            <span className="text-sm">{item.label}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${changeTypeColors[item.type] || 'bg-gray-400'}`}
                                                                    style={{
                                                                        width: `${(item.count / statistics.total_logs) * 100}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-sm font-medium w-12 text-right">
                                                                {item.count}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>操作人排行榜</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {statistics.operator_stats?.map((stat: any, idx: number) => (
                                                    <div key={stat.operator} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                                idx === 0 ? 'bg-yellow-100 text-yellow-800' :
                                                                idx === 1 ? 'bg-gray-100 text-gray-800' :
                                                                idx === 2 ? 'bg-orange-100 text-orange-800' :
                                                                'bg-muted'
                                                            }`}>
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-sm">{stat.operator || '系统'}</span>
                                                        </div>
                                                        <span className="font-medium">{stat.count} 次</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>最近变更</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {statistics.recent_logs?.map((log: any) => (
                                                <div
                                                    key={log.id}
                                                    className="flex items-center justify-between py-2 border-b last:border-0"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-2 py-0.5 rounded text-xs ${changeTypeColors[log.type] || 'bg-gray-100'}`}>
                                                            {changeTypeLabels[log.type] || log.type}
                                                        </span>
                                                        <span className="text-sm">{log.device_name || '未知设备'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        <span>{log.operator || '系统'}</span>
                                                        <span>{log.timestamp}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
