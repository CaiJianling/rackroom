import { useState, useEffect, useCallback } from 'react';
import {
    Activity,
    AlertTriangle,
    Building2,
    Cpu,
    Maximize2,
    Minimize2,
    RefreshCw,
    Server,
    Thermometer,
    Wifi,
    WifiOff,
    Zap,
    Shield,
    Clock,
} from 'lucide-react';

interface SummaryData {
    rooms: number;
    racks: number;
    devices: number;
    alerts: number;
    power: number;
    onlineDevices: number;
    offlineDevices: number;
    maintenanceDevices: number;
    criticalAlerts: number;
    warningAlerts: number;
}

interface DeviceStatus {
    online: number;
    offline: number;
    maintenance: number;
    total: number;
}

interface RoomStat {
    id: number;
    name: string;
    racks: number;
    devices: number;
    temperature: string | number;
    humidity: string | number;
}

interface AlertItem {
    id: number;
    title: string;
    severity: 'critical' | 'warning' | 'info';
    triggered_at: string;
}

interface DeviceTypeData {
    id: number;
    name: string;
    color: string;
    count: number;
}

interface CockpitData {
    summary: SummaryData;
    deviceStatus: DeviceStatus;
    roomStats: RoomStat[];
    recentAlerts: AlertItem[];
    deviceTypes: DeviceTypeData[];
    timestamp: string;
}

interface Props {
    data: CockpitData;
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        const duration = 800;
        const steps = 30;
        const increment = (value - displayValue) / steps;
        let current = displayValue;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            current += increment;
            if (step >= steps) {
                setDisplayValue(value);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.round(current));
            }
        }, duration / steps);

        return () => clearInterval(timer);
    }, [value]);

    return <span>{displayValue.toLocaleString()}{suffix}</span>;
}

function GlowCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`relative overflow-hidden rounded-xl bg-gray-900/60 border border-cyan-500/30 backdrop-blur-sm ${className}`}
            style={{
                boxShadow: '0 0 20px rgba(6, 182, 212, 0.15), inset 0 0 60px rgba(6, 182, 212, 0.05)',
            }}
        >
            <div className="absolute top-0 left-0 w-32 h-32 opacity-20">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/50 to-transparent rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">{children}</div>
        </div>
    );
}

function TechHeader() {
    return (
        <div className="relative flex items-center justify-between py-4 mb-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                        <Server className="h-6 w-6 text-white" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                        数据中心驾驶舱
                    </h1>
                    <p className="text-sm text-cyan-400/60 flex items-center gap-2">
                        <Activity className="h-3 w-3" />
                        实时监控 · 智能运维
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
                    <Clock className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm text-gray-300">系统运行正常</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
            </div>
        </div>
    );
}

function Room3DVisualization({ rooms }: { rooms: RoomStat[] }) {
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setRotation((prev) => (prev + 0.5) % 360);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    const racksPerRoom = Math.min(rooms.length * 3, 9);

    return (
        <div className="relative h-full min-h-[350px] flex items-center justify-center">
            <div className="absolute inset-0 overflow-hidden">
                <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#06b6d4" strokeWidth="0.5" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                <div
                    className="absolute w-[600px] h-[600px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%)',
                        transform: `rotate(${rotation}deg)`,
                        transition: 'transform 0.1s linear',
                    }}
                />
                <div
                    className="absolute w-[400px] h-[400px] rounded-full border border-cyan-500/20"
                    style={{
                        borderStyle: 'dashed',
                        transform: `rotate(${-rotation * 0.5}deg)`,
                        transition: 'transform 0.1s linear',
                    }}
                />
                <div
                    className="absolute w-[200px] h-[200px] rounded-full border border-cyan-500/30"
                    style={{
                        borderStyle: 'dashed',
                        transform: `rotate(${rotation * 0.3}deg)`,
                        transition: 'transform 0.1s linear',
                    }}
                />
            </div>

            <div className="relative z-10 perspective-1000">
                <div className="relative transform-style-3d" style={{ transform: 'rotateX(15deg) rotateY(-15deg)' }}>
                    <div className="relative">
                        <div className="grid grid-cols-3 gap-4">
                            {Array.from({ length: racksPerRoom }).map((_, i) => {
                                const roomIndex = Math.floor(i / 3);
                                const room = rooms[roomIndex] || { temperature: '--' };
                                const isOnline = Math.random() > 0.1;
                                return (
                                    <div
                                        key={i}
                                        className="relative"
                                        style={{
                                            transform: `translateZ(${Math.sin(i * 0.5) * 20}px)`,
                                            animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
                                        }}
                                    >
                                        <div
                                            className="relative w-20 h-32 rounded-lg bg-gradient-to-b from-gray-800 to-gray-900 border border-cyan-500/40"
                                            style={{
                                                boxShadow: isOnline
                                                    ? '0 0 15px rgba(6, 182, 212, 0.4), inset 0 0 20px rgba(6, 182, 212, 0.1)'
                                                    : '0 0 10px rgba(239, 68, 68, 0.3)',
                                            }}
                                        >
                                            <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full"
                                                style={{ backgroundColor: isOnline ? '#10b981' : '#ef4444' }}
                                            />
                                            <div className="absolute inset-x-2 top-4 bottom-4 flex flex-col justify-between py-1">
                                                {Array.from({ length: 6 }).map((_, j) => (
                                                    <div key={j} className="flex gap-0.5">
                                                        {Array.from({ length: 4 }).map((_, k) => (
                                                            <div
                                                                key={k}
                                                                className="w-1 h-1 rounded-full"
                                                                style={{
                                                                    backgroundColor: isOnline && Math.random() > 0.3 ? '#06b6d4' : '#374151',
                                                                    opacity: isOnline ? 0.8 + Math.random() * 0.2 : 0.3,
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="absolute bottom-1 left-1 right-1 text-center">
                                                <span className="text-[8px] text-cyan-400/60">
                                                    {room.temperature !== '--' ? `${room.temperature}°C` : ''}
                                                </span>
                                            </div>
                                        </div>
                                        <div
                                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 rounded-full"
                                            style={{
                                                background: 'rgba(6, 182, 212, 0.2)',
                                                filter: 'blur(4px)',
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div
                            className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[280px] h-8 rounded-lg border border-cyan-500/30"
                            style={{
                                background: 'linear-gradient(180deg, rgba(6, 182, 212, 0.1) 0%, transparent 100%)',
                                transform: 'rotateX(-90deg)',
                                transformOrigin: 'top',
                            }}
                        />
                    </div>

                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-gray-800/80 border border-cyan-500/40">
                        <span className="text-sm font-medium text-cyan-400">数据中心机房</span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-8px); }
                }
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
            `}</style>
        </div>
    );
}

function DeviceStatusOverview({ data }: { data: DeviceStatus }) {
    const onlinePercent = data.total > 0 ? Math.round((data.online / data.total) * 100) : 0;
    const circumference = 2 * Math.PI * 60;
    const offset = circumference - (onlinePercent / 100) * circumference;

    return (
        <GlowCard className="p-6">
            <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Cpu className="h-4 w-4 text-cyan-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">设备状态概览</h3>
            </div>

            <div className="flex items-center justify-center gap-6">
                <div className="relative">
                    <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                            cx="64"
                            cy="64"
                            r="60"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
                            strokeWidth="8"
                        />
                        <circle
                            cx="64"
                            cy="64"
                            r="60"
                            fill="none"
                            stroke="url(#statusGradient)"
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            className="transition-all duration-1000"
                        />
                        <defs>
                            <linearGradient id="statusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#06b6d4" />
                                <stop offset="100%" stopColor="#8b5cf6" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-white">{data.online}</span>
                        <span className="text-xs text-cyan-400">在线设备</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-gray-300">在线</span>
                        <span className="text-xl font-bold text-green-400 ml-auto">{data.online}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-gray-300">离线</span>
                        <span className="text-xl font-bold text-red-400 ml-auto">{data.offline}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-gray-300">维护中</span>
                        <span className="text-xl font-bold text-yellow-400 ml-auto">{data.maintenance}</span>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
                <Wifi className="h-4 w-4 text-cyan-400" />
                <span className="text-sm text-gray-400">设备在线率</span>
                <div className="flex-1 h-2 rounded-full bg-gray-700/50 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000"
                        style={{ width: `${onlinePercent}%` }}
                    />
                </div>
                <span className="text-lg font-bold text-cyan-400">{onlinePercent}%</span>
            </div>
        </GlowCard>
    );
}

function RealTimeAlerts({ alerts, criticalCount, warningCount }: { alerts: AlertItem[]; criticalCount: number; warningCount: number }) {
    return (
        <div className="space-y-4">
            <GlowCard className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-white">实时告警</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                            严重 {criticalCount}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
                            警告 {warningCount}
                        </span>
                    </div>
                </div>
            </GlowCard>

            <GlowCard className="p-4">
                <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                    {alerts.slice(0, 6).map((alert, index) => {
                        const severityColors = {
                            critical: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-400' },
                            warning: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-400' },
                            info: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400' },
                        };
                        const colors = severityColors[alert.severity] || severityColors.info;
                        return (
                            <div
                                key={alert.id}
                                className={`flex items-center gap-3 rounded-lg ${colors.bg} border ${colors.border} p-3 transition-all hover:scale-[1.02]`}
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                <div className={`w-2 h-2 rounded-full ${alert.severity === 'critical' ? 'bg-red-500 animate-pulse' : alert.severity === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="truncate text-sm font-medium text-white">{alert.title}</p>
                                </div>
                                <span className="text-xs text-gray-400">{alert.triggered_at}</span>
                            </div>
                        );
                    })}
                    {alerts.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                            <Shield className="h-10 w-10 mb-3 opacity-50" />
                            <p className="text-sm">暂无告警</p>
                            <p className="text-xs">系统运行正常</p>
                        </div>
                    )}
                </div>
            </GlowCard>
        </div>
    );
}

function BottomStats({ summary }: { summary: SummaryData }) {
    const stats = [
        { label: '总功率', value: summary.power, suffix: 'W', icon: Zap, color: '#f59e0b' },
        { label: '活跃告警', value: summary.alerts, suffix: '', icon: AlertTriangle, color: '#ef4444' },
        { label: '设备总数', value: summary.devices, suffix: '', icon: Server, color: '#10b981' },
        { label: '机柜数量', value: summary.racks, suffix: '', icon: Building2, color: '#3b82f6' },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                    <GlowCard key={index} className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
                                <p className="text-2xl font-bold" style={{ color: stat.color }}>
                                    <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                                </p>
                            </div>
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${stat.color}20` }}
                            >
                                <Icon className="h-5 w-5" style={{ color: stat.color }} />
                            </div>
                        </div>
                    </GlowCard>
                );
            })}
        </div>
    );
}

function RoomStats({ rooms }: { rooms: RoomStat[] }) {
    return (
        <GlowCard className="p-4">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">机房状态</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
                {rooms.map((room) => (
                    <div
                        key={room.id}
                        className="rounded-lg bg-gray-800/50 border border-gray-700/50 p-3 hover:border-cyan-500/50 transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white text-sm">{room.name}</span>
                            <div className="flex items-center gap-1 text-xs text-cyan-400">
                                <Thermometer className="h-3 w-3" />
                                <span>{room.temperature}°C</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span>{room.racks} 机柜</span>
                            <span>{room.devices} 设备</span>
                        </div>
                    </div>
                ))}
                {rooms.length === 0 && (
                    <div className="col-span-2 text-center py-4 text-gray-500">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">暂无数据</p>
                    </div>
                )}
            </div>
        </GlowCard>
    );
}

export default function Cockpit({ data }: Props) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cockpitData, setCockpitData] = useState<CockpitData>(data);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const refreshData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const response = await fetch('/api/cockpit/data');
            const result = await response.json();
            if (result.success) {
                setCockpitData(result.data);
            }
        } catch (error) {
            console.error('Failed to refresh cockpit data:', error);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(refreshData, 30000);
        return () => clearInterval(interval);
    }, [refreshData]);

    return (
        <div
            className={`min-h-screen text-white transition-all duration-300 ${isFullscreen ? '' : 'p-4'}`}
            style={{
                background: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)',
            }}
        >
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <svg className="absolute inset-0 w-full h-full opacity-5">
                    <defs>
                        <pattern id="grid-bg" width="60" height="60" patternUnits="userSpaceOnUse">
                            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#06b6d4" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid-bg)" />
                </svg>

                <div
                    className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-30"
                    style={{
                        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.3) 0%, transparent 70%)',
                        filter: 'blur(60px)',
                    }}
                />
                <div
                    className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-20"
                    style={{
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
                        filter: 'blur(60px)',
                    }}
                />
            </div>

            <div className="relative z-10 max-w-[1920px] mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <TechHeader />
                    <div className="flex items-center gap-3">
                        <button
                            onClick={refreshData}
                            className="px-4 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 transition-all flex items-center gap-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            刷新
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="px-4 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/50 hover:bg-cyan-600/30 transition-all flex items-center gap-2"
                        >
                            {isFullscreen ? (
                                <>
                                    <Minimize2 className="h-4 w-4" />
                                    退出全屏
                                </>
                            ) : (
                                <>
                                    <Maximize2 className="h-4 w-4" />
                                    全屏显示
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-3 space-y-4">
                        <DeviceStatusOverview data={cockpitData.deviceStatus} />
                        <RoomStats rooms={cockpitData.roomStats} />
                    </div>

                    <div className="lg:col-span-6">
                        <GlowCard className="p-6 h-full">
                            <Room3DVisualization rooms={cockpitData.roomStats} />
                        </GlowCard>
                    </div>

                    <div className="lg:col-span-3">
                        <RealTimeAlerts
                            alerts={cockpitData.recentAlerts}
                            criticalCount={cockpitData.summary.criticalAlerts}
                            warningCount={cockpitData.summary.warningAlerts}
                        />
                    </div>
                </div>

                <div className="mt-4">
                    <BottomStats summary={cockpitData.summary} />
                </div>

                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <span>最后更新: {cockpitData.timestamp}</span>
                    <span className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        系统运行正常
                    </span>
                </div>
            </div>
        </div>
    );
}
