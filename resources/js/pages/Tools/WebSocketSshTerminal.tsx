import { Head, usePage } from '@inertiajs/react';
import {
    Terminal,
    Server,
    Maximize2,
    Minimize2,
    AlertCircle,
    Loader2,
    Power,
    Settings2,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import 'xterm/css/xterm.css';

interface Device {
    id: number;
    name: string;
    ip_address: string | null;
    connection_type: string | null;
    connection_port: number | null;
    status: string;
    description: string | null;
    u_position: number | null;
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
        u_height?: number | null;
        device_type?: {
            id: number;
            name: string;
            icon: string | null;
        };
    };
}

interface SshConnection {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    description?: string;
    tags?: string[];
    u_position?: number | null;
    u_height?: number | null;
}

interface TerminalSession {
    id: string;
    connectionId: string;
    title: string;
    user: string;
    host: string;
    port: number;
    isConnected: boolean;
    isConnecting: boolean;
    lastActivity: Date;
}

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

export default function WebSocketSshTerminal() {
    const { t } = useTranslation();
    const { devices } = usePage<PageProps>().props;
    const wsUrl = `ws://${window.location.hostname}:${import.meta.env.VITE_WEBSOCKET_PORT || 8901}`;

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
            u_position: device.u_position,
            u_height: device.device_library?.u_height,
        }));

    const [sessions, setSessions] = useState<TerminalSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<
    string | null>(null);
    const activeSessionIdRef = useRef<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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

    // WebSocket 和终端引用
    const wsRef = useRef<WebSocket | null>(null);
    const termRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const terminalContainerRef = useRef<HTMLDivElement>(null);
    const sessionWsMap = useRef<Map<string, WebSocket>>(new Map());
    const closingSessionIds = useRef<Set<string>>(new Set());
    const sessionBufferMap = useRef<Map<string, string>>(new Map());

    const STORAGE_KEY = 'ssh_terminal_buffers';

    const saveBufferToStorage = useCallback((sessionId: string, buffer: string) => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            const buffers = stored ? JSON.parse(stored) : {};
            buffers[sessionId] = buffer;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(buffers));
        } catch (e) {
            console.error('保存终端内容失败:', e);
        }
    }, []);

    const getBufferFromStorage = useCallback((sessionId: string): string | null => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;
            const buffers = JSON.parse(stored);
            return buffers[sessionId] || null;
        } catch (e) {
            console.error('读取终端内容失败:', e);
            return null;
        }
    }, []);

    const clearBufferFromStorage = useCallback((sessionId: string) => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return;
            const buffers = JSON.parse(stored);
            delete buffers[sessionId];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(buffers));
        } catch (e) {
            console.error('清除终端内容失败:', e);
        }
    }, []);

    const breadcrumbs = [
        { title: t('navigation.tools'), href: '#' },
        { title: t('sshTerminal.title'), href: '/tools/ssh-terminal-ws' },
    ];

    const filteredConnections = sshConnections.filter(
        (conn) =>
            conn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            conn.host.includes(searchTerm) ||
            conn.tags?.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // 初始化终端
    const initTerminal = useCallback(() => {
        if (!terminalContainerRef.current || termRef.current) return;

        const term = new XTerm({
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 14,
            cursorBlink: true,
            cursorStyle: 'block',
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#ffffff',
                selectionBackground: '#ffffff40',
            },
            scrollback: 10000,
            rows: 30,
            cols: 100,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        term.open(terminalContainerRef.current);
        fitAddon.fit();

        term.writeln(`\x1b[32m${t('sshTerminal.welcomeMessage')}\x1b[0m`);
        term.writeln(`\x1b[33m${t('sshTerminal.connectionHint')}\x1b[0m`);
        term.writeln('');

        termRef.current = term;
        fitAddonRef.current = fitAddon;

        // 处理窗口大小调整
        const handleResize = () => {
            fitAddon.fit();
            const dims = fitAddon.proposeDimensions();
            if (dims && activeSessionIdRef.current) {
                const ws = sessionWsMap.current.get(activeSessionIdRef.current);
                if (ws?.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'resize',
                        cols: dims.cols,
                        rows: dims.rows,
                    }));
                }
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // 处理URL参数，自动打开连接对话框
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const deviceId = params.get('device_id');
        const ipAddress = params.get('ip_address');
        const deviceName = params.get('device_name');
        const connectionType = params.get('connection_type');
        const connectionPort = params.get('connection_port');
        const rackName = params.get('rack_name');
        const roomName = params.get('room_name');

        if (deviceId && ipAddress) {
            // 清理URL参数
            window.history.replaceState({}, '', '/tools/ssh-terminal-ws');

            // 创建连接对象
            const connection: SshConnection = {
                id: String(deviceId),
                name: deviceName || ipAddress,
                host: ipAddress,
                port: connectionPort ? parseInt(connectionPort, 10) : 22,
                username: 'root',
                description: `${roomName || ''} ${rackName || ''}`.trim(),
                tags: connectionType ? [connectionType] : undefined,
            };

            // 自动打开连接对话框
            setSelectedConnection(connection);
            setConnectForm({
                host: connection.host,
                port: connection.port,
                username: connection.username,
                password: '',
            });
            setConnectError('');
            setConnectDialogOpen(true);
        }
    }, []);

    // 切换标签时恢复终端内容
    useEffect(() => {
        if (!termRef.current || !activeSessionId) return;

        // 检查是否有保存的缓冲区
        const savedBuffer = sessionBufferMap.current.get(activeSessionId);
        if (savedBuffer && savedBuffer.length > 0) {
            termRef.current.clear();
            termRef.current.write(savedBuffer);
        } else {
            termRef.current.clear();
            termRef.current.writeln(`\x1b[32m${t('sshTerminal.welcomeMessage')}\x1b[0m`);
            termRef.current.writeln(`\x1b[33m${t('sshTerminal.connectionHint')}\x1b[0m`);
        }

        // 聚焦终端
        termRef.current.focus();
    }, [activeSessionId, getBufferFromStorage]);

    useEffect(() => {
        const cleanup = initTerminal();

        // 页面加载时恢复会话
        const restoreSessions = () => {
            try {
                const storedSessions = localStorage.getItem('ssh_sessions');
                if (storedSessions) {
                    const sessions = JSON.parse(storedSessions);
                    if (Array.isArray(sessions) && sessions.length > 0) {
                        setSessions(sessions);
                        // 恢复第一个会话为活动会话
                        if (sessions.length > 0) {
                            setActiveSessionId(sessions[0].id);
                            activeSessionIdRef.current = sessions[0].id;
                        }
                    }
                }
            } catch (e) {
                console.error('恢复会话失败:', e);
            }
        };

        // 延迟恢复，确保终端已初始化
        setTimeout(restoreSessions, 100);

        return () => {
            cleanup?.();
            // 清理所有 WebSocket 连接
            sessionWsMap.current.forEach((ws) => ws.close());
            termRef.current?.dispose();
        };
    }, []);

    // 连接 WebSocket
    const connectWebSocket = useCallback((sessionId: string, creds: ConnectFormData) => {
        if (sessionWsMap.current.has(sessionId)) {
            sessionWsMap.current.get(sessionId)?.close();
        }

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log(`WebSocket 连接已建立: ${sessionId}`);
            // 发送认证信息
            ws.send(JSON.stringify({
                type: 'auth',
                host: creds.host,
                port: creds.port,
                username: creds.username,
                password: creds.password,
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // 检查 session 是否还存在
                if (sessionWsMap.current.has(sessionId)) {
                    handleWebSocketMessage(sessionId, data);
                }
            } catch (e) {
                console.error('解析消息失败:', e);
            }
        };

        ws.onerror = (error) => {
            console.error(`WebSocket 错误 [${sessionId}]:`, error);
            updateSessionStatus(sessionId, false);
            // 暂时不显示连接错误，避免重复
        };

        ws.onclose = (event) => {
            console.log(`WebSocket 连接已关闭: ${sessionId}, wasClean: ${event.wasClean}, 主动关闭: ${closingSessionIds.current.has(sessionId)}`);
            updateSessionStatus(sessionId, false);
            sessionWsMap.current.delete(sessionId);

            // 如果是主动关闭，不需要显示"连接错误"
            if (closingSessionIds.current.has(sessionId)) {
                console.log('主动关闭，跳过显示错误');
                closingSessionIds.current.delete(sessionId);
                return;
            }

            console.log('非主动关闭，显示连接错误');
            // 显示连接错误
            if (termRef.current) {
                termRef.current.writeln(`\r\n\x1b[31m${t('sshTerminal.connectionError')}\x1b[0m`);
            }
        };

        sessionWsMap.current.set(sessionId, ws);
    }, [wsUrl]);

    // 处理 WebSocket 消息
    const handleWebSocketMessage = useCallback((sessionId: string, data: any) => {
        switch (data.type) {
            case 'connected':
                console.log('WebSocket 已连接:', data.message);
                break;

            case 'auth_success':
                updateSessionStatus(sessionId, true);
                termRef.current?.clear();
                termRef.current?.writeln(`\x1b[32m${data.message}\x1b[0m\r\n`);

                // 发送终端尺寸
                const dims = fitAddonRef.current?.proposeDimensions();
                if (dims) {
                    const ws = sessionWsMap.current.get(sessionId);
                    ws?.send(JSON.stringify({
                        type: 'resize',
                        cols: dims.cols,
                        rows: dims.rows,
                    }));
                }
                break;

            case 'auth_failed':
                updateSessionStatus(sessionId, false);
                termRef.current?.writeln(`\r\n\x1b[31m${data.message}\x1b[0m`);
                setConnectError(data.message);
                break;

            case 'output':
                console.log('收到输出，长度:', data.data?.length);
                console.log('当前活动会话:', activeSessionIdRef.current, '消息会话:', sessionId);

                // 保存内容到缓冲区
                if (data.data) {
                    const buffer = sessionBufferMap.current.get(sessionId) || '';
                    sessionBufferMap.current.set(sessionId, buffer + data.data);
                }

                if (activeSessionIdRef.current === sessionId) {
                    if (data.data) {
                        termRef.current?.write(data.data);
                        console.log('已写入终端');
                    }
                } else {
                    // 即使不是当前活动会话也写入（调试用）
                    console.log('会话不匹配，但尝试写入');
                    termRef.current?.write(data.data);
                }
                break;

            case 'disconnect':
                break;

            case 'error':
                termRef.current?.writeln(`\r\n\x1b[31m${t('sshTerminal.errorMessage', { message: data.message })}\x1b[0m`);
                break;

            case 'pong':
                // 心跳响应
                break;
        }
    }, [activeSessionId]);

    // 更新会话状态
    const updateSessionStatus = useCallback((sessionId: string, isConnected: boolean) => {
        setSessions((prev) =>
            prev.map((s) =>
                s.id === sessionId
                    ? { ...s, isConnected, isConnecting: false, lastActivity: new Date() }
                    : s
            )
        );
    }, []);

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

    // 处理连接
    const handleConnect = useCallback(async () => {
        if (!selectedConnection) return;

        setIsConnecting(true);
        setConnectError('');

        const sessionId = `session-${Date.now()}`;
        const newSession: TerminalSession = {
            id: sessionId,
            connectionId: selectedConnection.id,
            title: selectedConnection.name,
            user: connectForm.username,
            host: connectForm.host,
            port: connectForm.port,
            isConnected: false,
            isConnecting: true,
            lastActivity: new Date(),
        };

        setSessions((prev) => [...prev, newSession]);
        setActiveSessionId(sessionId);
        activeSessionIdRef.current = sessionId;
        setConnectDialogOpen(false);

        // 建立 WebSocket 连接
        connectWebSocket(sessionId, connectForm);
        setIsConnecting(false);
    }, [selectedConnection, connectForm, connectWebSocket]);

    // 关闭会话
    const closeSession = useCallback((sessionId: string) => {
        const ws = sessionWsMap.current.get(sessionId);

        // 保存终端内容到 localStorage
        const buffer = sessionBufferMap.current.get(sessionId);
        if (buffer) {
            saveBufferToStorage(sessionId, buffer);
        }

        // 标记为正在主动关闭，避免 onclose 中显示"连接错误"
        closingSessionIds.current.add(sessionId);

        // 发送断开连接消息到服务端
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'disconnect', sessionId }));
        }

        if (ws) {
            ws.close();
        }
        sessionWsMap.current.delete(sessionId);

        setSessions((prev) => prev.filter((s) => s.id !== sessionId));

        // 保存会话列表到 localStorage
        const remainingSessions = sessions.filter((s) => s.id !== sessionId);
        if (remainingSessions.length > 0) {
            const sessionData = remainingSessions.map(s => ({
                id: s.id,
                connectionId: s.connectionId,
                title: s.title,
                user: s.user,
                host: s.host,
                port: s.port,
                isConnected: false,
            }));
            localStorage.setItem('ssh_sessions', JSON.stringify(sessionData));
        } else {
            localStorage.removeItem('ssh_sessions');
        }

        if (activeSessionId === sessionId) {
            const remaining = sessions.filter((s) => s.id !== sessionId);
            setActiveSessionId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
            activeSessionIdRef.current = remaining.length > 0 ? remaining[remaining.length - 1].id : null;

            // 清空终端并显示欢迎信息
            if (termRef.current) {
                termRef.current.clear();
                termRef.current.reset();
                termRef.current.writeln(`\x1b[32m${t('sshTerminal.welcomeMessage')}\x1b[0m`);
                termRef.current.writeln(`\x1b[33m${t('sshTerminal.connectionHint')}\x1b[0m`);
            }
        }
    }, [activeSessionId, sessions, saveBufferToStorage]);

    // 处理终端输入 - 在终端初始化后立即绑定
    useEffect(() => {
        if (!termRef.current) return;

        const disposable = termRef.current.onData((data) => {
            console.log('终端输入:', JSON.stringify(data));
            if (activeSessionId) {
                const ws = sessionWsMap.current.get(activeSessionId);
                if (ws?.readyState === WebSocket.OPEN) {
                    console.log('发送输入到 WebSocket:', JSON.stringify(data));
                    ws.send(JSON.stringify({ type: 'input', data }));
                } else {
                    console.log('WebSocket 未连接，无法发送输入');
                }
            }
        });

        return () => disposable.dispose();
    }, [activeSessionId]);

    // 确保终端获取焦点
    useEffect(() => {
        if (termRef.current && activeSessionId) {
            setTimeout(() => {
                termRef.current?.focus();
            }, 100);
        }
    }, [activeSessionId]);

    // 心跳保活
    useEffect(() => {
        const interval = setInterval(() => {
            sessionWsMap.current.forEach((ws, sessionId) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'ping' }));
                }
            });
        }, 30000); // 每30秒发送一次心跳

        return () => clearInterval(interval);
    }, []);

    const activeSession = sessions.find((s) => s.id === activeSessionId);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('sshTerminal.title')} />
            <div className={cn('flex h-[calc(100vh-8rem)] gap-4', isFullscreen && 'fixed inset-0 z-50 bg-background p-4 h-screen')}>
                {/* 左侧终端区域 */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                    {/* 标签栏 */}
                    <div className="flex items-center bg-muted border-b border-border">
                        <div className="flex-1 flex overflow-x-auto">
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
                                        <div className="text-xs font-medium truncate">{session.user}@{session.host}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">:{session.port}</div>
                                    </div>
                                    {session.isConnecting && <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />}
                                    {session.isConnected && <div className="h-2 w-2 rounded-full bg-green-500 shrink-0" />}
                                    {!session.isConnected && !session.isConnecting && <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 shrink-0"
                                        onClick={(e) => { e.stopPropagation(); closeSession(session.id); }}
                                    >
                                        <Power className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 border-l border-border"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                        >
                            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                    </div>

                    {/* 终端内容区 */}
                    <div className="flex-1 flex flex-col bg-black min-h-0 overflow-hidden">
                        <div ref={terminalContainerRef} className="flex-1 overflow-hidden" />

                        {/* 状态栏 */}
                        <div className="h-7 bg-gray-900 border-t border-gray-800 flex items-center px-3 gap-4 text-xs shrink-0">
                            <div className="flex items-center gap-1.5">
                                <div className={cn('h-2 w-2 rounded-full', activeSession?.isConnected ? 'bg-green-500' : activeSession?.isConnecting ? 'bg-yellow-400' : 'bg-gray-500')} />
                                <span className="text-gray-400">
                                    {activeSession?.isConnected ? t('sshTerminal.connected') : activeSession?.isConnecting ? t('sshTerminal.connecting') : t('sshTerminal.disconnected')}
                                </span>
                            </div>
                            {activeSession && (
                                <>
                                    <div className="flex items-center gap-1.5 text-gray-400">
                                        <Settings2 className="h-3 w-3" />
                                        <span>WebSocket</span>
                                    </div>
                                    <div className="ml-auto text-gray-500">
                                        {activeSession.user}@{activeSession.host}:{activeSession.port}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* 右侧设备列表 */}
                <Card className="w-80 shrink-0 flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            {t('sshTerminal.deviceList')}
                            <Badge variant="secondary" className="ml-auto text-xs">{filteredConnections.length}</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-3 p-4 pt-0">
                        <Input placeholder={t('sshTerminal.searchPlaceholder')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9" />
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {filteredConnections.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    {sshConnections.length === 0 ? <p>{t('sshTerminal.noSshDevices')}</p> : <p>{t('sshTerminal.noMatchingDevices')}</p>}
                                </div>
                            ) : (
                                filteredConnections.map((conn) => (
                                    <div
                                        key={conn.id}
                                        onDoubleClick={() => openConnectDialog(conn)}
                                        className={cn(
                                            'p-3 rounded-lg border cursor-pointer transition-all',
                                            'hover:border-primary hover:shadow-sm hover:bg-muted/50',
                                            sessions.some((s) => s.connectionId === conn.id) ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-card'
                                        )}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <Terminal className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium text-sm">{conn.name}</span>
                                            </div>
                                            {sessions.some((s) => s.connectionId === conn.id && s.isConnected) && <div className="h-2 w-2 rounded-full bg-green-500" />}
                                        </div>
                                        <div className="mt-1.5 text-xs text-muted-foreground pl-6">
                                            <div>{conn.username}@{conn.host}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span>{t('sshTerminal.port')}: {conn.port}</span>
                                                {conn.tags?.map((tag) => <Badge key={tag} variant="secondary" className="text-[10px] h-4 px-1">{tag}</Badge>)}
                                            </div>
                                        </div>
                                        {conn.description && <div className="mt-1.5 text-xs text-muted-foreground/70 pl-6 truncate">{conn.description} |{conn.u_position && ` ${conn.u_height && conn.u_height > 1 ? `${conn.u_position}U-${conn.u_position + conn.u_height - 1}U` : `${conn.u_position}U`}`}</div>}
                                        {!conn.description && conn.u_position && <div className="mt-1.5 text-xs text-muted-foreground/70 pl-6">{conn.u_height && conn.u_height > 1 ? `${conn.u_position}U-${conn.u_position + conn.u_height - 1}U` : `${conn.u_position}U`}</div>}
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                            {t('sshTerminal.deviceConfigHint')}<a href="/devices" className="text-primary hover:underline ml-1">{t('navigation.devices')}</a>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 连接对话框 */}
            <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{t('sshTerminal.sshConnection')}</DialogTitle>
                        <DialogDescription>{t('sshTerminal.connectTo', { name: selectedConnection?.name, host: selectedConnection?.host })}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="host" className="text-right">{t('sshTerminal.host')}</Label>
                            <Input id="host" value={connectForm.host} onChange={(e) => setConnectForm({ ...connectForm, host: e.target.value })} className="col-span-3" disabled={isConnecting} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="port" className="text-right">{t('sshTerminal.port')}</Label>
                            <Input id="port" type="number" value={connectForm.port} onChange={(e) => setConnectForm({ ...connectForm, port: parseInt(e.target.value) })} className="col-span-3" disabled={isConnecting} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="username" className="text-right">{t('sshTerminal.username')}</Label>
                            <Input id="username" value={connectForm.username} onChange={(e) => setConnectForm({ ...connectForm, username: e.target.value })} className="col-span-3" disabled={isConnecting} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="password" className="text-right">{t('sshTerminal.password')}</Label>
                            <Input id="password" type="password" value={connectForm.password} onChange={(e) => setConnectForm({ ...connectForm, password: e.target.value })} className="col-span-3" disabled={isConnecting} />
                        </div>
                        {connectError && (
                            <div className="flex items-center gap-2 text-red-500 text-sm p-2 bg-red-50 rounded">
                                <AlertCircle className="h-4 w-4" />
                                <span>{connectError}</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConnectDialogOpen(false)} disabled={isConnecting}>{t('sshTerminal.cancel')}</Button>
                        <Button onClick={handleConnect} disabled={isConnecting || !connectForm.password}>
                            {isConnecting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('sshTerminal.connecting')}</> : t('sshTerminal.connect')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
