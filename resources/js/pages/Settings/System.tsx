import { Head } from '@inertiajs/react';
import { Activity, Loader2, Clock, RotateCcw, Save, Play, History, CheckCircle, XCircle, AlertCircle, Server } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';


interface SystemSetting {
    value: boolean | number | string;
    type: string;
    description: string;
}

interface SystemSettings {
    auto_detection_enabled?: SystemSetting;
    auto_detection_interval?: SystemSetting;
}

// 本地编辑状态接口
interface EditableSettings {
    auto_detection_enabled: boolean;
    auto_detection_interval: number;
}

// 检测日志接口
interface DetectionLog {
    id: number;
    type: 'auto' | 'manual';
    total_devices: number;
    online_count: number;
    offline_count: number;
    maintenance_count: number;
    updated_count: number;
    duration_ms: number;
    status: 'success' | 'failed' | 'skipped' | 'running';
    message: string;
    created_at: string;
    completed_at: string | null;
}

// 检测统计接口
interface DetectionStats {
    auto_detection_enabled: boolean;
    auto_detection_interval: number;
    last_auto_detection: {
        created_at: string;
        status: string;
        total_devices: number;
        updated_count: number;
        duration_ms: number;
    } | null;
    last_manual_detection: {
        created_at: string;
        status: string;
        total_devices: number;
        updated_count: number;
    } | null;
    next_scheduled_at: string | null;
    today: {
        total: number;
        success: number;
        failed: number;
        total_updated: number;
    };
}

export default function SystemSettings() {
    const { t } = useTranslation();
    const { showToast } = useToast();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [editableSettings, setEditableSettings] = useState<EditableSettings>({
        auto_detection_enabled: true,
        auto_detection_interval: 5,
    });
    const [hasChanges, setHasChanges] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // 检测日志状态
    const [detectionStats, setDetectionStats] = useState<DetectionStats | null>(null);
    const [detectionLogs, setDetectionLogs] = useState<DetectionLog[]>([]);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // 加载检测统计和日志
    const loadDetectionData = useCallback(async () => {
        setIsLoadingLogs(true);
        try {
            // 加载统计
            const statsResponse = await fetch('/api/detection-logs/stats', {
                headers: { 'Accept': 'application/json' },
                credentials: 'same-origin',
            });
            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                if (statsData.success) {
                    setDetectionStats(statsData.stats);
                }
            } else if (statsResponse.status === 401) {
                console.error('检测日志统计获取失败: 未授权');
            }

            // 加载日志
            const logsResponse = await fetch('/api/detection-logs?limit=10', {
                headers: { 'Accept': 'application/json' },
                credentials: 'same-origin',
            });
            if (logsResponse.ok) {
                const logsData = await logsResponse.json();
                if (logsData.success) {
                    setDetectionLogs(logsData.logs);
                }
            } else if (logsResponse.status === 401) {
                console.error('检测日志获取失败: 未授权');
            }
        } catch (error) {
            console.error('加载检测日志失败:', error);
        } finally {
            setIsLoadingLogs(false);
        }
    }, []);

    // 加载系统设置
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const response = await fetch('/api/system-settings', {
                    headers: {
                        'Accept': 'application/json',
                    },
                    credentials: 'same-origin',
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                if (data.success) {
                    setSettings(data.settings);
                    // 初始化本地编辑状态
                    setEditableSettings({
                        auto_detection_enabled: Boolean(data.settings?.auto_detection_enabled?.value ?? true),
                        auto_detection_interval: Number(data.settings?.auto_detection_interval?.value ?? 5),
                    });
                }
            } catch (error) {
                console.error('加载系统设置失败:', error);
                showToast(t('autoDetection.loadSettingsFailed'), 'error');
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
        loadDetectionData();

        // 定时刷新检测日志(每30秒)
        const interval = setInterval(loadDetectionData, 30000);
        return () => clearInterval(interval);
    }, [loadDetectionData]);

    // 检测是否有修改
    useEffect(() => {
        if (!settings) return;

        const originalEnabled = Boolean(settings?.auto_detection_enabled?.value ?? true);
        const originalInterval = Number(settings?.auto_detection_interval?.value ?? 5);

        const changed =
            editableSettings.auto_detection_enabled !== originalEnabled ||
            editableSettings.auto_detection_interval !== originalInterval;

        setHasChanges(changed);
    }, [editableSettings, settings]);

    // 保存所有设置
    const handleSave = async () => {
        setIsSaving(true);
        const settingsToSave = [
            { key: 'auto_detection_enabled', value: editableSettings.auto_detection_enabled },
            { key: 'auto_detection_interval', value: editableSettings.auto_detection_interval },
        ];

        try {
            const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

            // 并行保存所有设置
            const results = await Promise.all(
                settingsToSave.map(async ({ key, value }) => {
                    const response = await fetch(`/api/system-settings/${key}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': token,
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({ value }),
                    });

                    if (!response.ok) {
                        throw new Error(`保存 ${key} 失败`);
                    }

                    return response.json();
                })
            );

            // 更新原始设置状态
            setSettings((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    auto_detection_enabled: {
                        value: editableSettings.auto_detection_enabled,
                        type: 'boolean',
                        description: prev.auto_detection_enabled?.description || t('autoDetection.autoDetectionEnabledDescPlaceholder'),
                    },
                    auto_detection_interval: {
                        value: editableSettings.auto_detection_interval,
                        type: 'integer',
                        description: prev.auto_detection_interval?.description || t('autoDetection.autoDetectionIntervalDescPlaceholder'),
                    },
                };
            });

            setHasChanges(false);
            showToast(t('autoDetection.settingsSaved'), 'success');
        } catch (error) {
            console.error('保存设置失败:', error);
            showToast(t('autoDetection.saveFailed'), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // 重置设置
    const handleReset = () => {
        if (!settings) return;

        setEditableSettings({
            auto_detection_enabled: Boolean(settings?.auto_detection_enabled?.value ?? true),
            auto_detection_interval: Number(settings?.auto_detection_interval?.value ?? 5),
        });
        setHasChanges(false);
        showToast(t('autoDetection.resetToCurrent'), 'info');
    };

    // 刷新页面
    const handleRefresh = () => {
        window.location.reload();
    };

    // 执行手动检测
    const handleManualDetect = async () => {
        setIsDetecting(true);
        try {
            const response = await fetch('/api/detection-logs/detect', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                credentials: 'same-origin',
            });

            const data = await response.json();
            if (data.success) {
                showToast(data.message || t('autoDetection.detectionCompleted'), 'success');
                // 刷新日志
                await loadDetectionData();
            } else {
                showToast(data.message || t('autoDetection.detectionFailed'), 'error');
            }
        } catch (error) {
            console.error('手动检测失败:', error);
            showToast(t('autoDetection.detectionExecuteFailed'), 'error');
        } finally {
            setIsDetecting(false);
        }
    };

    // 格式化时间
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    // 格式化相对时间
    const getRelativeTime = (dateStr: string | null) => {
        if (!dateStr) return t('autoDetection.never');
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diff < 60) return t('autoDetection.justNow');
        if (diff < 3600) return `${Math.floor(diff / 60)} ${t('autoDetection.minutesAgo')}`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('autoDetection.hoursAgo')}`;
        return `${Math.floor(diff / 86400)} ${t('autoDetection.daysAgo')}`;
    };

    // 获取状态图标
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
            case 'skipped': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
            default: return <Activity className="h-4 w-4 text-blue-500" />;
        }
    };

    // 获取状态文本
    const getStatusText = (status: string) => {
        switch (status) {
            case 'success': return t('autoDetection.success');
            case 'failed': return t('autoDetection.failed');
            case 'skipped': return t('autoDetection.skipped');
            case 'running': return t('autoDetection.running');
            default: return status;
        }
    };

    if (isLoading) {
        return (
            <AppLayout>
                <Head title={t('autoDetection.title')} />
                <div className="container mx-auto py-6 px-4">
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={[
            { title: t('navigation.system'), href: '#' },
            { title: t('navigation.autoDetection'), href: '/auto-detection' },
        ]}>
            <Head title={t('navigation.autoDetection')} />

            <div className="container mx-auto py-6 px-4 max-w-4xl pb-24">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">{t('navigation.autoDetection')}</h1>
                    <p className="text-muted-foreground mt-1">
                        {t('autoDetection.description', '配置设备自动检测功能，管理检测计划和查看检测日志')}
                    </p>
                </div>

                {/* 可滚动的设置内容区域 */}
                <div className="space-y-6">
                    {/* 自动检测设置 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                    <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle>{t('autoDetection.autoDetectionSettings')}</CardTitle>
                                    <CardDescription>
                                        {t('autoDetection.autoDetectionDesc')}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between py-4 px-4 bg-muted/50 rounded-lg">
                                <div className="space-y-0.5">
                                    <Label htmlFor="auto-detection" className="text-base font-medium">
                                        {t('autoDetection.enableAutoDetection')}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        {settings?.auto_detection_enabled?.description || t('autoDetection.autoDetectionEnabledDesc')}
                                    </p>
                                </div>
                                <Switch
                                    id="auto-detection"
                                    checked={editableSettings.auto_detection_enabled}
                                    onCheckedChange={(checked) =>
                                        setEditableSettings(prev => ({ ...prev, auto_detection_enabled: checked }))
                                    }
                                    disabled={isSaving}
                                />
                            </div>

                            {/* 检测间隔设置 */}
                            <div className="mt-6 pt-6 border-t">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                                        <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium">{t('autoDetection.detectionInterval')}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {t('autoDetection.detectionIntervalDesc')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 py-4 px-4 bg-muted/50 rounded-lg">
                                    <div className="flex-1">
                                        <Label htmlFor="auto-detection-interval" className="text-sm font-medium">
                                            {t('autoDetection.detectionIntervalMinutes')}
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {settings?.auto_detection_interval?.description || t('autoDetection.autoDetectionIntervalDesc')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="auto-detection-interval"
                                            type="number"
                                            min={1}
                                            max={60}
                                            value={String(editableSettings.auto_detection_interval)}
                                            onChange={(e) =>
                                                setEditableSettings(prev => ({
                                                    ...prev,
                                                    auto_detection_interval: parseInt(e.target.value) || 5
                                                }))
                                            }
                                            disabled={isSaving || !editableSettings.auto_detection_enabled}
                                            className="w-20 text-center"
                                        />
                                        <span className="text-sm text-muted-foreground">{t('autoDetection.detectionIntervalUnit')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 text-sm text-muted-foreground">
                                <p>{t('autoDetection.autoDetectionTip')}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 检测状态概览 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                                        <Server className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <CardTitle>{t('autoDetection.detectionStatus')}</CardTitle>
                                        <CardDescription>
                                            {t('autoDetection.detectionStatusDesc')}
                                        </CardDescription>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleManualDetect}
                                    disabled={isDetecting}
                                    className="gap-2"
                                >
                                    {isDetecting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Play className="h-4 w-4" />
                                    )}
                                    {isDetecting ? t('autoDetection.detecting') : t('autoDetection.detectNow')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingLogs ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : detectionStats ? (
                                <div className="space-y-4">
                                    {/* 状态概览 */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-primary">
                                                {detectionStats.today.total}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{t('autoDetection.todayDetectionCount')}</div>
                                        </div>
                                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-green-600">
                                                {detectionStats.today.total_updated}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{t('autoDetection.todayUpdatedDevices')}</div>
                                        </div>
                                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-blue-600">
                                                {detectionStats.last_auto_detection?.total_devices || 0}
                                            </div>
                                            <div className="text-xs text-muted-foreground">{t('autoDetection.lastDetectionDevices')}</div>
                                        </div>
                                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                                            <div className="text-2xl font-bold text-orange-600">
                                                {detectionStats.last_auto_detection?.duration_ms || 0}ms
                                            </div>
                                            <div className="text-xs text-muted-foreground">{t('autoDetection.lastDetectionDuration')}</div>
                                        </div>
                                    </div>

                                    {/* 最后检测时间 */}
                                    <div className="flex items-center gap-4 py-3 px-4 bg-muted/30 rounded-lg">
                                        <div className="flex-1">
                                            <div className="text-sm font-medium">{t('autoDetection.autoDetectionStatus')}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {editableSettings.auto_detection_enabled ? (
                                                    <span className="text-green-600 flex items-center gap-1">
                                                        <CheckCircle className="h-3 w-3" />
                                                        {t('autoDetection.enabled')} ({t('autoDetection.everyMinutes', { minutes: editableSettings.auto_detection_interval })})
                                                    </span>
                                                ) : (
                                                    <span className="text-yellow-600 flex items-center gap-1">
                                                        <AlertCircle className="h-3 w-3" />
                                                        {t('autoDetection.paused')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-medium">
                                                {t('autoDetection.lastAutoDetection')}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {getRelativeTime(detectionStats.last_auto_detection?.created_at || null)}
                                            </div>
                                        </div>
                                        {editableSettings.auto_detection_enabled && detectionStats?.next_scheduled_at && (
                                            <div className="text-right border-l pl-4">
                                                <div className="text-sm font-medium">
                                                    {t('autoDetection.nextDetection')}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {(() => {
                                                        const nextTime = new Date(detectionStats.next_scheduled_at!);
                                                        const now = new Date();
                                                        const diff = nextTime.getTime() - now.getTime();
                                                        if (diff <= 0) return t('autoDetection.aboutToExecute');
                                                        const minutes = Math.floor(diff / 60000);
                                                        if (minutes < 1) return t('autoDetection.aboutToExecute');
                                                        if (minutes < 60) return `${minutes} ${t('autoDetection.minutesLater')}`;
                                                        const hours = Math.floor(minutes / 60);
                                                        const remainingMinutes = minutes % 60;
                                                        return `${hours}小时${remainingMinutes}分钟后`;
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    暂无检测数据
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 检测日志 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                                    <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <CardTitle>{t('autoDetection.detectionLogs')}</CardTitle>
                                    <CardDescription>
                                        {t('autoDetection.detectionStatusDesc')}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingLogs ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : detectionLogs.length > 0 ? (
                                <div className="h-[300px] overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">{t('autoDetection.time')}</TableHead>
                                                <TableHead>{t('autoDetection.type')}</TableHead>
                                                <TableHead>{t('autoDetection.status')}</TableHead>
                                                <TableHead className="text-right">{t('autoDetection.devices')}</TableHead>
                                                <TableHead className="text-right">{t('autoDetection.updated')}</TableHead>
                                                <TableHead className="text-right">{t('autoDetection.duration')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {detectionLogs.map((log) => (
                                                <TableRow key={log.id}>
                                                    <TableCell className="text-xs">
                                                        {formatTime(log.created_at)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={log.type === 'auto' ? 'secondary' : 'default'} className="text-xs">
                                                            {log.type === 'auto' ? t('autoDetection.auto') : t('autoDetection.manual')}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            {getStatusIcon(log.status)}
                                                            <span className="text-xs">{getStatusText(log.status)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs">
                                                        {log.total_devices > 0 ? (
                                                            <span className="text-muted-foreground">
                                                                {log.online_count}/{log.offline_count}/{log.maintenance_count}
                                                            </span>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {log.updated_count > 0 ? (
                                                            <span className="text-green-600 font-medium text-xs">+{log.updated_count}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground">
                                                        {log.duration_ms}ms
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    {t('autoDetection.NoLogs')}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* 底部按钮栏 - 固定在视口底部，避开侧边栏 */}
                <div className="fixed bottom-0 left-0 right-0 md:left-[16rem] bg-background border-t py-4 px-4 z-50 transition-all duration-200">
                    <div className="flex items-center justify-between max-w-4xl mx-auto">
                        <div className="flex items-center gap-2">
                            {hasChanges && (
                                <span className="text-sm text-amber-600 font-medium">
                                    {t('autoDetection.unsavedChanges')}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                onClick={handleRefresh}
                                disabled={isSaving}
                                className="gap-2"
                            >
                                <RotateCcw className="h-4 w-4" />
                                {t('autoDetection.RefreshSettings')}
                            </Button>
                            {hasChanges && (
                                <Button
                                    variant="outline"
                                    onClick={handleReset}
                                    disabled={isSaving}
                                >
                                    {t('autoDetection.ResetSettings')}
                                </Button>
                            )}
                            <Button
                                onClick={handleSave}
                                disabled={isSaving || !hasChanges}
                                className="gap-2 min-w-[100px]"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {t('common.saving')}
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        {t('common.save')}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
