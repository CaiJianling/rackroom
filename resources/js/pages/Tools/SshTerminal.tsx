import { Head, usePage, router } from '@inertiajs/react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import {
    X,
    ChevronLeft,
    ChevronRight,
    Terminal,
    Server,
    Clock,
    Maximize2,
    Minimize2,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';

// 终端输出行类型
type TerminalOutputType = 'plain' | 'command' | 'info' | 'success' | 'error' | 'warning' | 'directory' | 'file' | 'executable' | 'config';

interface TerminalOutputLine {
    text: string;
    type: TerminalOutputType;
}

// 设备数据接口
interface Device {
    id: number;
    name: string;
    ip_address: string | null;
    connection_type: string | null;
    connection_port: number | null;
    status: string;
    description: string | null;
    rack?: {
        id: number;
        name: string;
        room?: {
            id: number;
            name: string;
        };
    };
    device_library?: {
        id: number;
        name: string;
        device_type?: {
            id: number;
            name: string;
            icon: string | null;
        };
    };
}

// SSH 连接配置接口
interface SshConnection {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    description?: string;
    tags?: string[];
}

// 终端会话接口
interface TerminalSession {
    id: string;
    connectionId: string;
    sessionId: string | null;
    title: string;
    user: string;
    host: string;
    port: number;
    isConnected: boolean;
    isConnecting: boolean;
    output: TerminalOutputLine[];
    lastActivity: Date;
    error?: string;
}

// 连接表单数据
interface ConnectFormData {
    host: string;
    port: number;
    username: string;
    password: string;
}

interface PageProps {
    devices: Device[];
    [key: string]: unknown;
}

export default function SshTerminal() {
    const { devices } = usePage<PageProps>().props;

    // 将设备转换为 SSH 连接配置
    const sshConnections: SshConnection[] = devices
        .filter((device) => device.connection_type === 'ssh' && device.ip_address)
        .map((device) => ({
            id: String(device.id),
            name: device.name,
            host: device.ip_address!,
            port: device.connection_port || 22,
            username: 'root',
            description: device.description || `${device.rack?.room?.name || ''} ${device.rack?.name || ''}`.trim(),
            tags: device.device_library?.device_type?.name ? [device.device_library.device_type.name] : undefined,
        }));

    const [sessions, setSessions] = useState<TerminalSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [tabScrollOffset, setTabScrollOffset] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [command, setCommand] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);

    // 连接对话框状态
    const [connectDialogOpen, setConnectDialogOpen] = useState(false);
    const [selectedConnection, setSelectedConnection] = useState<SshConnection | null>(null);
    const [connectForm, setConnectForm] = useState<ConnectFormData>({
        host: '',
        port: 22,
        username: 'root',
        password: '',
    });
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectError, setConnectError] = useState('');

    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const terminalContentRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const breadcrumbs = [
        { title: '小工具', href: '#' },
        { title: 'SSH远程工具', href: '/tools/ssh-terminal' },
    ];

    // 过滤连接
    const filteredConnections = sshConnections.filter(
        (conn) =>
            conn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            conn.host.includes(searchTerm) ||
            conn.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // 打开连接对话框
    const openConnectDialog = useCallback((connection: SshConnection) => {
        setSelectedConnection(connection);
        setConnectForm({
            host: connection.host,
            port: connection.port,
            username: connection.username,
            password: '',
        });
        setConnectError('');
        setConnectDialogOpen(true);
    }, []);

    // 建立 SSH 连接
    const handleConnect = useCallback(async () => {
        if (!selectedConnection) return;

        setIsConnecting(true);
        setConnectError('');

        try {
            const response = await axios.post('/tools/ssh-terminal/connect', {
                host: connectForm.host,
                port: connectForm.port,
                username: connectForm.username,
                password: connectForm.password,
                deviceId: selectedConnection.id,
            });

            if (response.data.success) {
                const sessionId = `session-${Date.now()}`;
                const newSession: TerminalSession = {
                    id: sessionId,
                    connectionId: selectedConnection.id,
                    sessionId: response.data.sessionId,
                    title: selectedConnection.name,
                    user: connectForm.username,
                    host: connectForm.host,
                    port: connectForm.port,
                    isConnected: true,
                    isConnecting: false,
                    output: [
                        { text: `连接到 ${connectForm.username}@${connectForm.host}:${connectForm.port}...`, type: 'info' },
                        { text: '', type: 'plain' },
                        ...(response.data.output ? response.data.output.split('\n').map((line: string) => ({ text: line, type: 'plain' as TerminalOutputType })) : []),
                    ],
                    lastActivity: new Date(),
                };

                setSessions((prev) => [...prev, newSession]);
                setActiveSessionId(sessionId);
                setConnectDialogOpen(false);

                // 开始轮询输出
                startPolling(sessionId, response.data.sessionId);
            }
        } catch (error: any) {
            setConnectError(error.response?.data?.message || '连接失败，请检查主机地址、端口和凭据');
        } finally {
            setIsConnecting(false);
        }
    }, [selectedConnection, connectForm]);

    // 开始轮询输出
    const startPolling = useCallback((sessionId: string, sshSessionId: string) => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        pollingIntervalRef.current = setInterval(async () => {
            try {
                const response = await axios.get('/tools/ssh-terminal/output', {
                    params: { sessionId: sshSessionId },
                });

                if (response.data.success && response.data.output) {
                    const lines = response.data.output.split('\n').filter((line: string) => line.trim() !== '');
                    if (lines.length > 0) {
                        setSessions((prev) =>
                            prev.map((s) =>
                                s.id === sessionId
                                    ? {
                                          ...s,
                                          output: [...s.output, ...lines.map((line: string) => ({ text: line, type: 'plain' as TerminalOutputType }))],
                                          lastActivity: new Date(),
                                      }
                                    : s
                            )
                        );
                    }
                }
            } catch (error: any) {
                if (error.response?.status === 410) {
                    // 会话过期
                    setSessions((prev) =>
                        prev.map((s) =>
                            s.id === sessionId
                                ? {
                                      ...s,
                                      isConnected: false,
                                      error: '会话已过期',
                                      output: [...s.output, { text: '', type: 'plain' }, { text: '连接已断开', type: 'error' }],
                                  }
                                : s
                        )
                    );
                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                    }
                }
            }
        }, 1000); // 每秒轮询一次
    }, []);

    // 关闭会话
    const closeSession = useCallback(async (sessionId: string) => {
        const session = sessions.find((s) => s.id === sessionId);
        if (session?.sessionId) {
            try {
                await axios.post('/tools/ssh-terminal/disconnect', {
                    sessionId: session.sessionId,
                });
            } catch (error) {
                // 忽略断开连接的错误
            }
        }

        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
            const remaining = sessions.filter((s) => s.id !== sessionId);
            setActiveSessionId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
        }

        if (pollingIntervalRef.current && sessions.length <= 1) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, [activeSessionId, sessions]);

    // 发送命令
    const sendCommand = useCallback(async () => {
        if (!command.trim() || !activeSessionId || isExecuting) return;

        const activeSession = sessions.find((s) => s.id === activeSessionId);
        if (!activeSession || !activeSession.isConnected || !activeSession.sessionId) return;

        const cmd = command.trim();
        setIsExecuting(true);

        // 添加命令到输出
        const prompt = `${activeSession.user}@${activeSession.host}:~$ `;
        setSessions((prev) =>
            prev.map((s) =>
                s.id === activeSessionId
                    ? {
                          ...s,
                          output: [...s.output, { text: prompt + cmd, type: 'command' }],
                          lastActivity: new Date(),
                      }
                    : s
            )
        );

        try {
            const response = await axios.post('/tools/ssh-terminal/execute', {
                sessionId: activeSession.sessionId,
                command: cmd,
            });

            if (response.data.success) {
                if (response.data.closed) {
                    // 会话已关闭
                    setSessions((prev) =>
                        prev.map((s) =>
                            s.id === activeSessionId
                                ? {
                                      ...s,
                                      isConnected: false,
                                      output: [...s.output, { text: response.data.output || '', type: 'plain' }, { text: '', type: 'plain' }, { text: '连接已关闭', type: 'info' }],
                                  }
                                : s
                        )
                    );
                } else if (response.data.output) {
                    const lines = response.data.output.split('\n');
                    setSessions((prev) =>
                        prev.map((s) =>
                            s.id === activeSessionId
                                ? {
                                      ...s,
                                      output: [...s.output, ...lines.map((line: string) => ({ text: line, type: 'plain' as TerminalOutputType }))],
                                      lastActivity: new Date(),
                                  }
                                : s
                        )
                    );
                }
            } else {
                setSessions((prev) =>
                    prev.map((s) =>
                        s.id === activeSessionId
                            ? {
                                  ...s,
                                  output: [...s.output, { text: `错误: ${response.data.message}`, type: 'error' }],
                              }
                            : s
                    )
                );
            }
        } catch (error: any) {
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === activeSessionId
                        ? {
                              ...s,
                              output: [...s.output, { text: `错误: ${error.response?.data?.message || '命令执行失败'}`, type: 'error' }],
                          }
                        : s
                )
            );
        } finally {
            setIsExecuting(false);
            setCommand('');
        }
    }, [command, activeSessionId, sessions, isExecuting]);

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            sendCommand();
        }
    };

    // 滚动到终端底部
    useEffect(() => {
        if (terminalContentRef.current) {
            terminalContentRef.current.scrollTop = terminalContentRef.current.scrollHeight;
        }
    }, [sessions, activeSessionId]);

    // 清理轮询
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
            // 断开所有会话
            sessions.forEach((session) => {
                if (session.sessionId) {
                    axios.post('/tools/ssh-terminal/disconnect', {
                        sessionId: session.sessionId,
                    }).catch(() => {});
                }
            });
        };
    }, []);

    // 标签页滚动
    const scrollTabs = (direction: 'left' | 'right') => {
        if (tabsContainerRef.current) {
            const scrollAmount = 200;
            const newOffset =
                direction === 'left'
                    ? Math.max(0, tabScrollOffset - scrollAmount)
                    : tabScrollOffset + scrollAmount;
            setTabScrollOffset(newOffset);
            tabsContainerRef.current.scrollLeft = newOffset;
        }
    };

    // 获取活动会话
    const activeSession = sessions.find((s) => s.id === activeSessionId);

    // 渲染终端文本（带高亮）
    const renderTerminalLine = (line: TerminalOutputLine, index: number) => {
        const colorClasses: Record<TerminalOutputType, string> = {
            info: 'text-cyan-400',
            success: 'text-green-400',
            error: 'text-red-400',
            warning: 'text-yellow-400',
            command: 'text-white',
            directory: 'text-blue-400 font-medium',
            file: 'text-gray-300',
            executable: 'text-green-400 font-medium',
            config: 'text-purple-400',
            plain: 'text-gray-300',
        };

        return (
            <div key={index} className={cn('font-mono text-sm whitespace-pre-wrap', colorClasses[line.type] || 'text-gray-300')}>
                {line.text}
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="SSH远程工具" />
            <TooltipProvider>
                <div className={cn('flex h-[calc(100vh-8rem)] gap-4', isFullscreen && 'fixed inset-0 z-50 bg-background p-4 h-screen')}>
                    {/* 左侧终端区域 */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* 标签栏 */}
                        <div className="flex items-center bg-muted border-b border-border">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => scrollTabs('left')}
                                disabled={tabScrollOffset === 0}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div
                                ref={tabsContainerRef}
                                className="flex-1 flex overflow-x-hidden scroll-smooth"
                                style={{ scrollBehavior: 'smooth' }}
                            >
                                {sessions.map((session) => (
                                    <div
                                        key={session.id}
                                        onClick={() => setActiveSessionId(session.id)}
                                        className={cn(
                                            'flex items-center gap-2 px-3 py-2 cursor-pointer border-r border-border min-w-[160px] max-w-[200px] select-none',
                                            activeSessionId === session.id
                                                ? 'bg-background text-foreground'
                                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                        )}
                                    >
                                        <Terminal className="h-3.5 w-3.5 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium truncate">
                                                {session.user}@{session.host}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground truncate">
                                                :{session.port}
                                            </div>
                                        </div>
                                        {session.isConnecting && (
                                            <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                                        )}
                                        {session.isConnected && (
                                            <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                                        )}
                                        {!session.isConnected && !session.isConnecting && (
                                            <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                closeSession(session.id);
                                            }}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => scrollTabs('right')}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 border-l border-border"
                                onClick={() => setIsFullscreen(!isFullscreen)}
                            >
                                {isFullscreen ? (
                                    <Minimize2 className="h-4 w-4" />
                                ) : (
                                    <Maximize2 className="h-4 w-4" />
                                )}
                            </Button>
                        </div>

                        {/* 终端内容区 */}
                        <div className="flex-1 bg-black text-white font-mono overflow-hidden flex flex-col">
                            {activeSession ? (
                                <>
                                    {/* 终端输出 */}
                                    <div
                                        ref={terminalContentRef}
                                        className="flex-1 overflow-y-auto p-4 space-y-0.5"
                                    >
                                        {activeSession.output.map((line, idx) =>
                                            renderTerminalLine(line, idx)
                                        )}
                                        {/* 当前提示符 */}
                                        {activeSession.isConnected && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-400">
                                                    {activeSession.user}@{activeSession.host}:~$
                                                </span>
                                                <Input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={command}
                                                    onChange={(e) => setCommand(e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    disabled={isExecuting}
                                                    className="flex-1 bg-transparent border-none text-white font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto disabled:opacity-50"
                                                    placeholder=""
                                                    autoFocus
                                                />
                                                {isExecuting && (
                                                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                )}
                                            </div>
                                        )}
                                        {!activeSession.isConnected && activeSession.error && (
                                            <div className="flex items-center gap-2 text-red-400 mt-2">
                                                <AlertCircle className="h-4 w-4" />
                                                <span>{activeSession.error}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 状态栏 */}
                                    <div className="h-7 bg-gray-900 border-t border-gray-800 flex items-center px-3 gap-4 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <div
                                                className={cn(
                                                    'h-2 w-2 rounded-full',
                                                    activeSession.isConnected ? 'bg-green-500' : activeSession.isConnecting ? 'bg-yellow-400' : 'bg-red-500'
                                                )}
                                            />
                                            <span className="text-gray-400">
                                                {activeSession.isConnected ? '已连接' : activeSession.isConnecting ? '连接中...' : '已断开'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-gray-400">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                                上次活动: {activeSession.lastActivity.toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="ml-auto text-gray-500">
                                            {activeSession.user}@{activeSession.host}:{activeSession.port}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
                                    <Terminal className="h-16 w-16 opacity-30" />
                                    {filteredConnections.length > 0 ? (
                                        <>
                                            <p className="text-lg">双击右侧设备开始连接</p>
                                            <p className="text-sm opacity-60">共 {filteredConnections.length} 个 SSH 设备</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-lg">暂无配置 SSH 的设备</p>
                                            <p className="text-sm opacity-60">请在设备管理中配置 SSH 连接</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 右侧快捷连接区域 */}
                    <Card className="w-80 shrink-0 flex flex-col">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Server className="h-4 w-4" />
                                SSH 设备列表
                                <Badge variant="secondary" className="ml-auto text-xs">
                                    {filteredConnections.length}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col gap-3 p-4 pt-0">
                            {/* 搜索 */}
                            <Input
                                placeholder="搜索设备..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-9"
                            />

                            {/* 设备列表 */}
                            <ScrollArea className="flex-1 -mx-2 px-2">
                                <div className="space-y-2">
                                    {filteredConnections.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground text-sm">
                                            {sshConnections.length === 0 ? (
                                                <p>暂无配置 SSH 的设备</p>
                                            ) : (
                                                <p>未找到匹配的设备</p>
                                            )}
                                        </div>
                                    ) : (
                                        filteredConnections.map((conn) => (
                                            <Tooltip key={conn.id}>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        onDoubleClick={() => openConnectDialog(conn)}
                                                        className={cn(
                                                            'p-3 rounded-lg border cursor-pointer transition-all',
                                                            'hover:border-primary hover:shadow-sm hover:bg-muted/50',
                                                            sessions.some((s) => s.connectionId === conn.id)
                                                                ? 'border-green-500/30 bg-green-500/5'
                                                                : 'border-border bg-card'
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Terminal className="h-4 w-4 text-muted-foreground" />
                                                                <span className="font-medium text-sm">
                                                                    {conn.name}
                                                                </span>
                                                            </div>
                                                            {sessions.some(
                                                                (s) => s.connectionId === conn.id
                                                            ) && (
                                                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                                            )}
                                                        </div>
                                                        <div className="mt-1.5 text-xs text-muted-foreground pl-6">
                                                            <div>{conn.username}@{conn.host}</div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span>端口: {conn.port}</span>
                                                                {conn.tags?.map((tag) => (
                                                                    <Badge
                                                                        key={tag}
                                                                        variant="secondary"
                                                                        className="text-[10px] h-4 px-1"
                                                                    >
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        {conn.description && (
                                                            <div className="mt-1.5 text-xs text-muted-foreground/70 pl-6 truncate">
                                                                {conn.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="left">
                                                    <p>双击连接</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {conn.host}:{conn.port}
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>

                            {/* 提示信息 */}
                            <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                                设备配置请前往
                                <a href="/devices" className="text-primary hover:underline ml-1">
                                    设备管理
                                </a>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 连接对话框 */}
                <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>SSH 连接</DialogTitle>
                            <DialogDescription>
                                连接到 {selectedConnection?.name} ({selectedConnection?.host})
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="host" className="text-right">
                                    主机
                                </Label>
                                <Input
                                    id="host"
                                    value={connectForm.host}
                                    onChange={(e) => setConnectForm({ ...connectForm, host: e.target.value })}
                                    className="col-span-3"
                                    disabled={isConnecting}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="port" className="text-right">
                                    端口
                                </Label>
                                <Input
                                    id="port"
                                    type="number"
                                    value={connectForm.port}
                                    onChange={(e) => setConnectForm({ ...connectForm, port: parseInt(e.target.value) || 22 })}
                                    className="col-span-3"
                                    disabled={isConnecting}
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="username" className="text-right">
                                    用户名
                                </Label>
                                <Input
                                    id="username"
                                    value={connectForm.username}
                                    onChange={(e) => setConnectForm({ ...connectForm, username: e.target.value })}
                                    className="col-span-3"
                                    disabled={isConnecting}
                                    autoComplete="username"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="password" className="text-right">
                                    密码
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={connectForm.password}
                                    onChange={(e) => setConnectForm({ ...connectForm, password: e.target.value })}
                                    className="col-span-3"
                                    disabled={isConnecting}
                                    autoComplete="current-password"
                                />
                            </div>
                            {connectError && (
                                <div className="flex items-center gap-2 text-red-500 text-sm p-2 bg-red-50 rounded">
                                    <AlertCircle className="h-4 w-4" />
                                    <span>{connectError}</span>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setConnectDialogOpen(false)} disabled={isConnecting}>
                                取消
                            </Button>
                            <Button onClick={handleConnect} disabled={isConnecting || !connectForm.password}>
                                {isConnecting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        连接中...
                                    </>
                                ) : (
                                    '连接'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </TooltipProvider>
        </AppLayout>
    );
}
