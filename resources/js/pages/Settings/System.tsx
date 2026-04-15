import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { useToast } from '@/hooks/use-toast';
import { Activity, Loader2, Clock, RotateCcw, Save } from 'lucide-react';
import { Input } from '@/components/ui/input';

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

    // 加载系统设置
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const response = await fetch('/api/system-settings', {
                    headers: {
                        'Accept': 'application/json',
                    },
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
                showToast('加载设置失败', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, []);

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
                        description: prev.auto_detection_enabled?.description || '自动检测功能开关',
                    },
                    auto_detection_interval: {
                        value: editableSettings.auto_detection_interval,
                        type: 'integer',
                        description: prev.auto_detection_interval?.description || '自动检测时间间隔（分钟）',
                    },
                };
            });
            
            setHasChanges(false);
            showToast('设置已保存', 'success');
        } catch (error) {
            console.error('保存设置失败:', error);
            showToast('保存失败', 'error');
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
        showToast('已重置为当前保存的设置', 'info');
    };

    // 刷新页面
    const handleRefresh = () => {
        window.location.reload();
    };

    if (isLoading) {
        return (
            <AppLayout>
                <Head title="系统设置" />
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
            { title: '系统', href: '#' },
            { title: '系统设置', href: '/settings/system' },
        ]}>
            <Head title="系统设置" />

            <div className="container mx-auto py-6 px-4 max-w-4xl">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">系统设置</h1>
                    <p className="text-muted-foreground mt-1">
                        管理系统全局配置和自动化功能
                    </p>
                </div>

                {/* 可滚动的设置内容区域 */}
                <div className="space-y-6 pb-24">
                    {/* 自动检测设置 */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                    <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <CardTitle>自动检测</CardTitle>
                                    <CardDescription>
                                        控制设备自动检测功能的开启和关闭
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between py-4 px-4 bg-muted/50 rounded-lg">
                                <div className="space-y-0.5">
                                    <Label htmlFor="auto-detection" className="text-base font-medium">
                                        启用自动检测
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        {settings?.auto_detection_enabled?.description || '自动检测设备在线状态'}
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
                                        <h3 className="font-medium">检测间隔</h3>
                                        <p className="text-sm text-muted-foreground">
                                            设置自动检测的刷新时间间隔
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 py-4 px-4 bg-muted/50 rounded-lg">
                                    <div className="flex-1">
                                        <Label htmlFor="auto-detection-interval" className="text-sm font-medium">
                                            检测间隔时间（分钟）
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {settings?.auto_detection_interval?.description || '自动检测的刷新间隔'}
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
                                        <span className="text-sm text-muted-foreground">分钟</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 text-sm text-muted-foreground">
                                <p>提示：关闭自动检测后，系统将不再自动更新设备的在线状态，需要手动进行批量检测。</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 固定在底部的按钮栏 */}
                <div className="fixed bottom-0 left-0 right-0 bg-background border-t py-4 px-4 z-50">
                    <div className="container mx-auto max-w-4xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {hasChanges && (
                                <span className="text-sm text-amber-600 font-medium">
                                    有未保存的更改
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
                                刷新设置
                            </Button>
                            {hasChanges && (
                                <Button
                                    variant="outline"
                                    onClick={handleReset}
                                    disabled={isSaving}
                                >
                                    重置
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
                                        保存中...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4" />
                                        保存
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
