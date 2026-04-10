import { Head, router } from '@inertiajs/react';
import {
    BarChart3,
    Calendar,
    CheckCircle2,
    Download,
    FileJson,
    FileSpreadsheet,
    FileText,
    Filter,
    Loader2,
    PieChart,
    Play,
    RefreshCw,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import AppLayout from '@/layouts/app-layout';

interface Room {
    id: number;
    name: string;
}

interface FilterOptions {
    rooms: Room[];
    categories: string[];
    deviceStatuses: string[];
}

interface GeneratedReport {
    id: number;
    name: string;
    report_type: string;
    format: string;
    status: 'processing' | 'completed' | 'failed';
    file_size_for_humans: string;
    started_at: string;
    completed_at: string | null;
    template: { name: string } | null;
}

interface ReportTemplate {
    id: number;
    name: string;
    report_type: string;
    is_shared: boolean;
}

interface ChartData {
    name: string;
    value: number;
}

interface Props {
    templates: ReportTemplate[];
    generatedReports: GeneratedReport[];
    filterOptions: FilterOptions;
    breadcrumbs?: Array<{ title: string; href: string }>;
}

export default function ReportIndex({ templates, generatedReports, filterOptions, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState('generate');
    const [generating, setGenerating] = useState(false);
    const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [showPreview, setShowPreview] = useState(false);

    // 报表配置
    const [reportConfig, setReportConfig] = useState({
        name: '',
        report_type: 'inventory',
        format: 'csv',
        filters: {
            room_id: 'all',
            category: 'all',
            status: 'all',
            date_from: '',
            date_to: '',
        },
        include_charts: true,
    });

    // 保存模板对话框
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDesc, setTemplateDesc] = useState('');

    const generateReport = async () => {
        setGenerating(true);
        try {
            const response = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify(reportConfig),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('Generate API error:', response.status, text);
                setGenerating(false);
                return;
            }

            const data = await response.json();
            if (data.success) {
                router.reload();
            }
        } catch (error) {
            console.error('Failed to generate report:', error);
        }
        setGenerating(false);
    };

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
        return meta?.content || '';
    };

    const previewReport = async () => {
        try {
            const response = await fetch('/api/reports/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    report_type: reportConfig.report_type,
                    filters: reportConfig.filters,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('Preview API error:', response.status, text);
                return;
            }

            const data = await response.json();
            setPreviewData(data.data);
            setShowPreview(true);

            // 同时获取图表数据
            fetchChartData();
        } catch (error) {
            console.error('Failed to preview report:', error);
        }
    };

    const fetchChartData = async () => {
        try {
            const chartType = reportConfig.report_type === 'status' ? 'status_distribution' : 'category_distribution';
            const response = await fetch('/api/reports/chart-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    chart_type: chartType,
                    filters: reportConfig.filters,
                }),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('Chart API error:', response.status, text);
                return;
            }

            const data = await response.json();
            setChartData(data);
        } catch (error) {
            console.error('Failed to fetch chart data:', error);
        }
    };

    const saveTemplate = async () => {
        try {
            const response = await fetch('/api/reports/templates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    name: templateName,
                    description: templateDesc,
                    report_type: reportConfig.report_type,
                    filters: reportConfig.filters,
                    columns: [],
                    is_shared: false,
                }),
            });
            if (response.ok) {
                setShowSaveTemplate(false);
                setTemplateName('');
                setTemplateDesc('');
                router.reload();
            } else {
                const text = await response.text();
                console.error('Save template API error:', response.status, text);
            }
        } catch (error) {
            console.error('Failed to save template:', error);
        }
    };

    const downloadReport = (reportId: number) => {
        window.location.href = `/api/reports/${reportId}/download`;
    };

    const deleteReport = async (reportId: number) => {
        if (!confirm(t('report.deleteConfirm'))) return;
        try {
            const response = await fetch(`/api/reports/${reportId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'Accept': 'application/json',
                },
            });
            if (response.ok) {
                router.reload();
            } else {
                const text = await response.text();
                console.error('Delete API error:', response.status, text);
            }
        } catch (error) {
            console.error('Failed to delete report:', error);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="mr-1 h-3 w-3" />{t('report.completed')}</Badge>;
            case 'processing':
                return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />{t('report.processing')}</Badge>;
            case 'failed':
                return <Badge variant="destructive">{t('report.failed')}</Badge>;
            default:
                return <Badge variant="outline">-</Badge>;
        }
    };

    const getFormatIcon = (format: string) => {
        switch (format) {
            case 'csv':
                return <FileText className="h-4 w-4" />;
            case 'excel':
                return <FileSpreadsheet className="h-4 w-4" />;
            case 'json':
                return <FileJson className="h-4 w-4" />;
            default:
                return <FileText className="h-4 w-4" />;
        }
    };

    const getReportTypeLabel = (type: string) => {
        switch (type) {
            case 'inventory':
                return t('report.inventory');
            case 'status':
                return t('report.statusReport');
            case 'usage':
                return t('report.usageReport');
            default:
                return type;
        }
    };

    // 简单的颜色生成器
    const getChartColor = (index: number) => {
        const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899'];
        return colors[index % colors.length];
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="报表生成" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                {/* 页面标题 */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">报表生成</h1>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                    <TabsList className="grid w-full max-w-md grid-cols-3">
                        <TabsTrigger value="generate">生成报表</TabsTrigger>
                        <TabsTrigger value="templates">报表模板</TabsTrigger>
                        <TabsTrigger value="history">生成历史</TabsTrigger>
                    </TabsList>

                    {/* 生成报表 */}
                    <TabsContent value="generate" className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-3">
                            {/* 报表配置 */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>报表配置</CardTitle>
                                    <CardDescription>配置报表参数和筛选条件</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* 基本设置 */}
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>报表名称 *</Label>
                                            <Input
                                                placeholder="输入报表名称"
                                                value={reportConfig.name}
                                                onChange={(e) => setReportConfig({ ...reportConfig, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>报表类型 *</Label>
                                            <Select
                                                value={reportConfig.report_type}
                                                onValueChange={(v) => setReportConfig({ ...reportConfig, report_type: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="inventory">资产清单</SelectItem>
                                                    <SelectItem value="status">状态报表</SelectItem>
                                                    <SelectItem value="usage">使用率报表</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* 筛选条件 */}
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Filter className="h-4 w-4" />
                                            筛选条件
                                        </Label>
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                            <Select
                                                value={reportConfig.filters.room_id}
                                                onValueChange={(v) => setReportConfig({
                                                    ...reportConfig,
                                                    filters: { ...reportConfig.filters, room_id: v }
                                                })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="选择机房" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">全部机房</SelectItem>
                                                    {filterOptions.rooms.map((room) => (
                                                        <SelectItem key={room.id} value={room.id.toString()}>{room.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Select
                                                value={reportConfig.filters.category}
                                                onValueChange={(v) => setReportConfig({
                                                    ...reportConfig,
                                                    filters: { ...reportConfig.filters, category: v }
                                                })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="选择分类" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">全部分类</SelectItem>
                                                    {filterOptions.categories.map((cat) => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Select
                                                value={reportConfig.filters.status}
                                                onValueChange={(v) => setReportConfig({
                                                    ...reportConfig,
                                                    filters: { ...reportConfig.filters, status: v }
                                                })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="选择状态" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">全部状态</SelectItem>
                                                    {filterOptions.deviceStatuses.map((status) => (
                                                        <SelectItem key={status} value={status}>
                                                            {t(`deviceManagement.statuses.${status}`, status)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>

                                            <Select
                                                value={reportConfig.format}
                                                onValueChange={(v) => setReportConfig({ ...reportConfig, format: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="导出格式" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="csv">CSV</SelectItem>
                                                    <SelectItem value="excel">Excel</SelectItem>
                                                    <SelectItem value="json">JSON</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* 操作按钮 */}
                                    <div className="flex flex-wrap gap-2">
                                        <Button variant="outline" onClick={previewReport}>
                                            <BarChart3 className="mr-2 h-4 w-4" />
                                            预览数据
                                        </Button>
                                        <Button variant="outline" onClick={() => setShowSaveTemplate(true)}>
                                            <Save className="mr-2 h-4 w-4" />
                                            保存为模板
                                        </Button>
                                        <Button
                                            onClick={generateReport}
                                            disabled={!reportConfig.name || generating}
                                        >
                                            {generating ? (
                                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />生成中...</>
                                            ) : (
                                                <><Play className="mr-2 h-4 w-4" />生成报表</>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 统计概览 */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>数据概览</CardTitle>
                                    <CardDescription>当前筛选条件下的数据统计</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">报表类型</span>
                                        <Badge variant="outline">{getReportTypeLabel(reportConfig.report_type)}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">导出格式</span>
                                        <div className="flex items-center gap-1">
                                            {getFormatIcon(reportConfig.format)}
                                            <span className="text-sm uppercase">{reportConfig.format}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">包含图表</span>
                                        <Checkbox
                                            checked={reportConfig.include_charts}
                                            onCheckedChange={(c) => setReportConfig({ ...reportConfig, include_charts: c as boolean })}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">机房筛选</span>
                                        <span className="text-sm">
                                            {reportConfig.filters.room_id
                                                ? filterOptions.rooms.find(r => r.id.toString() === reportConfig.filters.room_id)?.name
                                                : '全部机房'}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* 预览区域 */}
                        {showPreview && previewData.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle>数据预览</CardTitle>
                                            <CardDescription>共 {previewData.length} 条数据</CardDescription>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="max-h-[400px] overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {Object.keys(previewData[0]).map((key) => (
                                                        <TableHead key={key}>{key}</TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {previewData.slice(0, 10).map((row, idx) => (
                                                    <TableRow key={idx}>
                                                        {Object.values(row).map((val, i) => (
                                                            <TableCell key={i}>{String(val)}</TableCell>
                                                        ))}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {previewData.length > 10 && (
                                        <p className="mt-2 text-center text-sm text-muted-foreground">
                                            还有 {previewData.length - 10} 条数据...
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    {/* 报表模板 */}
                    <TabsContent value="templates">
                        <Card>
                            <CardHeader>
                                <CardTitle>报表模板</CardTitle>
                                <CardDescription>保存的报表配置模板</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {templates.length === 0 ? (
                                    <div className="py-8 text-center text-muted-foreground">
                                        暂无保存的模板
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>模板名称</TableHead>
                                                <TableHead>报表类型</TableHead>
                                                <TableHead>共享状态</TableHead>
                                                <TableHead className="text-right">操作</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {templates.map((template) => (
                                                <TableRow key={template.id}>
                                                    <TableCell className="font-medium">{template.name}</TableCell>
                                                    <TableCell>{getReportTypeLabel(template.report_type)}</TableCell>
                                                    <TableCell>
                                                        {template.is_shared ? (
                                                            <Badge variant="secondary">共享</Badge>
                                                        ) : (
                                                            <Badge variant="outline">私有</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => {
                                                                setReportConfig({
                                                                    ...reportConfig,
                                                                    report_type: template.report_type,
                                                                });
                                                                setActiveTab('generate');
                                                            }}
                                                        >
                                                            使用
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* 生成历史 */}
                    <TabsContent value="history">
                        <Card>
                            <CardHeader>
                                <CardTitle>生成历史</CardTitle>
                                <CardDescription>最近生成的报表记录</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {generatedReports.length === 0 ? (
                                    <div className="py-8 text-center text-muted-foreground">
                                        暂无生成记录
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>报表名称</TableHead>
                                                <TableHead>类型</TableHead>
                                                <TableHead>格式</TableHead>
                                                <TableHead>状态</TableHead>
                                                <TableHead>大小</TableHead>
                                                <TableHead>生成时间</TableHead>
                                                <TableHead className="text-right">操作</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {generatedReports.map((report) => (
                                                <TableRow key={report.id}>
                                                    <TableCell className="font-medium">{report.name}</TableCell>
                                                    <TableCell>{getReportTypeLabel(report.report_type)}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            {getFormatIcon(report.format)}
                                                            <span className="uppercase">{report.format}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                                                    <TableCell>{report.file_size_for_humans}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {new Date(report.started_at).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {report.status === 'completed' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => downloadReport(report.id)}
                                                            >
                                                                <Download className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => deleteReport(report.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* 保存模板对话框 */}
            <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>保存报表模板</DialogTitle>
                        <DialogDescription>将当前配置保存为模板以便重复使用</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>模板名称 *</Label>
                            <Input
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder="输入模板名称"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>描述</Label>
                            <Input
                                value={templateDesc}
                                onChange={(e) => setTemplateDesc(e.target.value)}
                                placeholder="输入模板描述（可选）"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveTemplate(false)}>取消</Button>
                        <Button onClick={saveTemplate} disabled={!templateName}>
                            <Save className="mr-2 h-4 w-4" />
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
