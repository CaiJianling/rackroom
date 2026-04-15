import { Head, router } from '@inertiajs/react';
import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import {
    Download,
    Upload,
    Play,
    FileSpreadsheet,
    Trash2,
    History,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Calendar,
    RefreshCw,
    Eye,
    EyeOff,
} from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface SwitchInfo {
    ip_address: string;
    port: number;
    username: string;
    old_password: string;
    new_password: string;
    status: string;
    message?: string;
}

interface LogEntry {
    id: number;
    ip_address: string;
    port: number;
    username: string;
    status: string;
    message: string;
    user?: { name: string };
    executed_at: string;
}

interface LogsResponse {
    success: boolean;
    logs: {
        data: LogEntry[];
        current_page: number;
        last_page: number;
        total: number;
    };
}

export default function H3cPassword() {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [switches, setSwitches] = useState<SwitchInfo[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [showResultDialog, setShowResultDialog] = useState(false);
    const [executionResults, setExecutionResults] = useState<{
        results: { ip_address: string; success: boolean; message: string }[];
        summary: { total: number; success: number; failed: number };
    } | null>(null);
    const [showLogsDialog, setShowLogsDialog] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [logsPage, setLogsPage] = useState(1);
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
    const [logsTotalPages, setLogsTotalPages] = useState(1);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [showClearLogsDialog, setShowClearLogsDialog] = useState(false);

    // 下载模板
    const handleDownloadTemplate = () => {
        window.location.href = '/tools/h3c-password/template';
    };

    // 上传文件
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setStatusText('正在解析文件...');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(
                '/tools/h3c-password/upload',
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            if (response.data.success) {
                setSwitches(response.data.data);
                setStatusText(`已加载 ${response.data.total} 台交换机`);
            }
        } catch (error: any) {
            setStatusText(error.response?.data?.message || '上传失败');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // 执行批量修改
    const handleExecute = async () => {
        if (switches.length === 0) {
            setStatusText('请先上传Excel文件');
            return;
        }

        setIsExecuting(true);
        setProgress(0);
        setStatusText('正在执行批量修改...');

        try {
            const response = await axios.post(
                '/tools/h3c-password/execute',
                {
                    switches: switches.map((s) => ({
                        ip_address: s.ip_address,
                        port: s.port,
                        username: s.username,
                        old_password: s.old_password,
                        new_password: s.new_password,
                    })),
                }
            );

            if (response.data.success) {
                setExecutionResults(response.data);
                setShowResultDialog(true);
                setStatusText(
                    `执行完成：成功 ${response.data.summary.success} 台，失败 ${response.data.summary.failed} 台`
                );

                // 更新交换机状态
                interface ExecutionResult {
                    ip_address: string;
                    success: boolean;
                    message: string;
                }
                const updatedSwitches = switches.map((sw) => {
                    const result = (response.data.results as ExecutionResult[]).find(
                        (r) => r.ip_address === sw.ip_address
                    );
                    if (result) {
                        return {
                            ...sw,
                            status: result.success ? '已完成' : '失败',
                            message: result.message,
                        };
                    }
                    return sw;
                });
                setSwitches(updatedSwitches);
            }
        } catch (error: any) {
            setStatusText(error.response?.data?.message || '执行失败');
        } finally {
            setIsExecuting(false);
            setProgress(100);
        }
    };

    // 清空交换机列表
    const handleClearSwitches = () => {
        setSwitches([]);
        setStatusText('');
        setProgress(0);
    };

    // 加载日志
    const loadLogs = useCallback(async (page = 1) => {
        setIsLoadingLogs(true);
        try {
            const response = await axios.get<LogsResponse>(
                `/tools/h3c-password/logs?page=${page}`
            );

            if (response.data.success) {
                setLogs(response.data.logs.data);
                setLogsPage(response.data.logs.current_page);
                setLogsTotalPages(response.data.logs.last_page);
            }
        } catch (error) {
            console.error('加载日志失败:', error);
        } finally {
            setIsLoadingLogs(false);
        }
    }, []);

    // 打开日志对话框
    const handleOpenLogs = () => {
        setShowLogsDialog(true);
        loadLogs(1);
    };

    // 清空所有日志
    const handleClearLogs = async () => {
        try {
            await axios.delete('/tools/h3c-password/logs/clear');
            setLogs([]);
            setShowClearLogsDialog(false);
        } catch (error) {
            console.error('清空日志失败:', error);
        }
    };

    // 获取状态颜色
    const getStatusColor = (status: string) => {
        switch (status) {
            case '已完成':
            case '成功':
                return 'bg-green-100 text-green-800';
            case '失败':
                return 'bg-red-100 text-red-800';
            case '待处理':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // 获取状态图标
    const getStatusIcon = (status: string) => {
        switch (status) {
            case '已完成':
            case '成功':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case '失败':
                return <XCircle className="h-4 w-4 text-red-600" />;
            case '待处理':
                return <Clock className="h-4 w-4 text-yellow-600" />;
            default:
                return <AlertCircle className="h-4 w-4 text-gray-600" />;
        }
    };

    return (
        <AppLayout breadcrumbs={[
            { title: '小工具', href: '#' },
            { title: '批量修改H3C交换机密码', href: '/tools/h3c-password' },
        ]}>
            <Head title="批量修改H3C交换机密码" />

            <div className="container mx-auto py-6 px-4">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">
                        批量修改H3C交换机密码
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        导入Excel文件批量修改H3C交换机管理密码
                    </p>
                </div>

                {/* 操作按钮区域 */}
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <div className="flex flex-wrap gap-4 items-center">
                            <Button
                                variant="outline"
                                onClick={handleDownloadTemplate}
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                下载Excel模板
                            </Button>

                            <div className="relative">
                                <Input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="excel-upload"
                                />
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        document
                                            .getElementById('excel-upload')
                                            ?.click()
                                    }
                                    disabled={isUploading}
                                    className="gap-2"
                                >
                                    <Upload className="h-4 w-4" />
                                    {isUploading
                                        ? '上传中...'
                                        : '上传Excel文件'}
                                </Button>
                            </div>

                            <Button
                                onClick={handleExecute}
                                disabled={
                                    isExecuting ||
                                    switches.length === 0
                                }
                                className="gap-2"
                            >
                                <Play className="h-4 w-4" />
                                {isExecuting ? '执行中...' : '开始修改密码'}
                            </Button>

                            {switches.length > 0 && (
                                <Button
                                    variant="destructive"
                                    onClick={handleClearSwitches}
                                    disabled={isExecuting}
                                    className="gap-2"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    清空列表
                                </Button>
                            )}

                            <Button
                                variant="secondary"
                                onClick={handleOpenLogs}
                                className="gap-2 ml-auto"
                            >
                                <History className="h-4 w-4" />
                                查看日志
                            </Button>
                        </div>

                        {/* 进度显示 */}
                        {(statusText || isExecuting || progress > 0) && (
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span>{statusText}</span>
                                    {switches.length > 0 && (
                                        <span className="text-muted-foreground">
                                            共 {switches.length} 台交换机
                                        </span>
                                    )}
                                </div>
                                <Progress value={progress} className="h-2" />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 交换机列表表格 */}
                {switches.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5" />
                                交换机列表
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>IP地址</TableHead>
                                            <TableHead>端口</TableHead>
                                            <TableHead>用户名</TableHead>
                                            <TableHead>密码</TableHead>
                                            <TableHead>新密码</TableHead>
                                            <TableHead>状态</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {switches.map((sw, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-mono">
                                                    {sw.ip_address}
                                                </TableCell>
                                                <TableCell>{sw.port}</TableCell>
                                                <TableCell>
                                                    {sw.username}
                                                </TableCell>
                                                <TableCell>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPasswords(prev => ({ ...prev, [`${index}-old`]: !prev[`${index}-old`] }))}
                                                        className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
                                                    >
                                                        {showPasswords[`${index}-old`] ? (
                                                            <>
                                                                <EyeOff className="h-3 w-3" />
                                                                <span className="font-mono">{sw.old_password}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Eye className="h-3 w-3" />
                                                                <span className="text-muted-foreground">********</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </TableCell>
                                                <TableCell>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPasswords(prev => ({ ...prev, [`${index}-new`]: !prev[`${index}-new`] }))}
                                                        className="flex items-center gap-1 text-sm hover:text-primary transition-colors"
                                                    >
                                                        {showPasswords[`${index}-new`] ? (
                                                            <>
                                                                <EyeOff className="h-3 w-3" />
                                                                <span className="font-mono">{sw.new_password}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Eye className="h-3 w-3" />
                                                                <span className="text-muted-foreground">********</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="secondary"
                                                        className={getStatusColor(
                                                            sw.status
                                                        )}
                                                    >
                                                        <span className="flex items-center gap-1">
                                                            {getStatusIcon(
                                                                sw.status
                                                            )}
                                                            {sw.status}
                                                        </span>
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* 结果展示对话框 */}
                <Dialog
                    open={showResultDialog}
                    onOpenChange={setShowResultDialog}
                >
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                        <DialogHeader>
                            <DialogTitle>执行结果</DialogTitle>
                            <DialogDescription>
                                批量修改密码执行完成
                            </DialogDescription>
                        </DialogHeader>

                        {executionResults && (
                            <div className="space-y-4 overflow-hidden flex flex-col">
                                {/* 统计信息 */}
                                <div className="grid grid-cols-3 gap-4">
                                    <Card>
                                        <CardContent className="pt-4">
                                            <div className="text-2xl font-bold">
                                                {
                                                    executionResults.summary
                                                        .total
                                                }
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                总计
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="pt-4">
                                            <div className="text-2xl font-bold text-green-600">
                                                {
                                                    executionResults.summary
                                                        .success
                                                }
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                成功
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card>
                                        <CardContent className="pt-4">
                                            <div className="text-2xl font-bold text-red-600">
                                                {
                                                    executionResults.summary
                                                        .failed
                                                }
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                失败
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* 详细结果列表 */}
                                <div className="border rounded-md overflow-auto flex-1">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>IP地址</TableHead>
                                                <TableHead>状态</TableHead>
                                                <TableHead>消息</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {executionResults.results.map(
                                                (result, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-mono">
                                                            {result.ip_address}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant="secondary"
                                                                className={
                                                                    result.success
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'bg-red-100 text-red-800'
                                                                }
                                                            >
                                                                {result.success
                                                                    ? '成功'
                                                                    : '失败'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm">
                                                            {result.message}
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        onClick={() =>
                                            setShowResultDialog(false)
                                        }
                                    >
                                        关闭
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>

                {/* 日志查看对话框 */}
                <Dialog
                    open={showLogsDialog}
                    onOpenChange={setShowLogsDialog}
                >
                    <DialogContent className="w-[95vw] h-[90vh] max-h-[900px] p-0 flex flex-col overflow-hidden" style={{ maxWidth: '1400px' }}>
                        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                            <DialogTitle>修改日志</DialogTitle>
                            <DialogDescription>
                                查看历史密码修改记录
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col flex-1 min-h-0 p-6 gap-4">
                            {/* 操作按钮 */}
                            <div className="flex justify-end gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadLogs(logsPage)}
                                    disabled={isLoadingLogs}
                                    className="gap-1"
                                >
                                    <RefreshCw
                                        className={`h-4 w-4 ${
                                            isLoadingLogs ? 'animate-spin' : ''
                                        }`}
                                    />
                                    刷新
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setShowClearLogsDialog(true)}
                                    disabled={logs.length === 0}
                                >
                                    清空日志
                                </Button>
                            </div>

                            {/* 日志列表 - 独立滚动区域 */}
                            <div className="border rounded-md flex-1 min-h-0 overflow-auto">
                                <div className="min-w-[1200px]">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background z-10">
                                            <TableRow>
                                                <TableHead className="w-[160px]">时间</TableHead>
                                                <TableHead className="w-[120px]">IP地址</TableHead>
                                                <TableHead className="w-[80px]">端口</TableHead>
                                                <TableHead className="w-[100px]">用户名</TableHead>
                                                <TableHead className="w-[80px]">状态</TableHead>
                                                <TableHead className="min-w-[200px]">消息</TableHead>
                                                <TableHead className="w-[100px]">操作人</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {logs.length === 0 ? (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={7}
                                                        className="text-center py-8 text-muted-foreground"
                                                    >
                                                        暂无日志记录
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                logs.map((log) => (
                                                    <TableRow key={log.id}>
                                                        <TableCell className="text-sm whitespace-nowrap">
                                                            {format(
                                                                new Date(
                                                                    log.executed_at
                                                                ),
                                                                'yyyy-MM-dd HH:mm:ss',
                                                                { locale: zhCN }
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-mono whitespace-nowrap">
                                                            {log.ip_address}
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap">
                                                            {log.port}
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap">
                                                            {log.username}
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap">
                                                            <Badge
                                                                variant="secondary"
                                                                className={
                                                                    log.status ===
                                                                    '成功'
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'bg-red-100 text-red-800'
                                                                }
                                                            >
                                                                {log.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm break-all">
                                                            {log.message}
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap">
                                                            {log.user?.name || '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {/* 分页和关闭按钮 */}
                            <div className="flex items-center justify-between shrink-0 pt-2 border-t">
                                <div className="text-sm text-muted-foreground">
                                    {logsTotalPages > 1 ? (
                                        <>第 {logsPage} / {logsTotalPages} 页</>
                                    ) : (
                                        <>共 {logs.length} 条记录</>
                                    )}
                                </div>
                                <div className="flex items-center gap-4">
                                    {logsTotalPages > 1 && (
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    loadLogs(logsPage - 1)
                                                }
                                                disabled={
                                                    logsPage === 1 ||
                                                    isLoadingLogs
                                                }
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    loadLogs(logsPage + 1)
                                                }
                                                disabled={
                                                    logsPage === logsTotalPages ||
                                                    isLoadingLogs
                                                }
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                    <Button
                                        onClick={() => setShowLogsDialog(false)}
                                    >
                                        关闭
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* 清空日志确认对话框 */}
                <AlertDialog
                    open={showClearLogsDialog}
                    onOpenChange={setShowClearLogsDialog}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>确认清空日志</AlertDialogTitle>
                            <AlertDialogDescription>
                                此操作将删除所有密码修改日志记录，无法恢复。是否继续？
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleClearLogs}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                确认清空
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </AppLayout>
    );
}
