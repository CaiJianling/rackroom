import { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import {
    Activity,
    AlertTriangle,
    CheckCircle,
    Cpu,
    Maximize2,
    Minimize2,
    RefreshCw,
    Server,
    Thermometer,
    Wifi,
    Zap,
    Shield,
    Clock,
    Droplets,
    Layers,
} from 'lucide-react';
import { SciFiCard } from './Cockpit/components/SciFiCard';
import { ServerRoom3D } from './Cockpit/components/ServerRoom3D';

function AutoScroll({ children, className = '', speed = 1 }: { children: React.ReactNode; className?: string; speed?: number }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let animationId: number;
        let position = 0;

        const scroll = () => {
            if (isHovered || !container) return;

            const maxScroll = container.scrollHeight - container.clientHeight;
            if (maxScroll <= 0) return;

            position += speed * 0.5;
            if (position >= maxScroll) {
                position = 0;
            }
            container.scrollTop = position;
            animationId = requestAnimationFrame(scroll);
        };

        animationId = requestAnimationFrame(scroll);

        return () => {
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
        };
    }, [isHovered, speed]);

    return (
        <div
            ref={containerRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`overflow-y-auto ${className}`}
        >
            {children}
        </div>
    );
}

// ============================================================
// 类型定义（与后端接口保持一致）
// ============================================================
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
    avgTemperature: string | number;
    avgHumidity: string | number;
    loadPercent: number;
}

interface DeviceStatus {
    online: number;
    offline: number;
    maintenance: number;
    total: number;
}

interface RackDetail {
    id: number;
    name: string;
    u_count: number;
    power: number;
    device_count: number;
    temperature: string | number;
    humidity: string | number;
}

interface RoomStat {
    id: number;
    name: string;
    racks: number;
    devices: number;
    temperature: string | number;
    humidity: string | number;
    rack_details: RackDetail[];
}

interface AlertItem {
    id: number;
    title: string;
    severity: 'critical' | 'warning' | 'info';
    triggered_at: string;
}

interface RecentDevice {
    id: number;
    name: string;
    model: string;
    status: 'online' | 'offline' | 'maintenance';
    power: number;
    rack_name: string;
    temperature: string | number;
    humidity: string | number;
    type_name: string;
    type_color: string;
}

interface DeviceTypeStat {
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
    recentDevices: RecentDevice[];
    deviceTypes: DeviceTypeStat[];
    timestamp: string;
}

interface Props {
    data: CockpitData;
}

// ============================================================
// 子组件
// ============================================================

/** 数字滚动动画 */
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

    return (
        <span>
            {displayValue.toLocaleString()}
            {suffix}
        </span>
    );
}

/** 环形进度图 */
function RingChart({ percent, value, label, color }: { percent: number; value: number; label: string; color: string }) {
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (percent / 100) * circumference;

    return (
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="transparent" stroke="#0f172a" strokeWidth="5" />
                <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    stroke={color}
                    strokeWidth="5"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_8px_currentColor] transition-all duration-1000"
                />
            </svg>
            <div className="absolute text-center">
                <span className="block text-[9px] uppercase tracking-wider text-gray-400">{label}</span>
                <span className="text-xl font-bold text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]">{value}</span>
            </div>
        </div>
    );
}

/** 告警条目 */
function AlertRow({ alert, className = '' }: { alert: AlertItem; className?: string }) {
    const config = {
        critical: { bg: 'bg-red-950/40 border-red-500/30', badge: 'bg-red-600', text: 'text-red-400', pulse: true },
        warning: { bg: 'bg-amber-950/30 border-amber-500/25', badge: 'bg-amber-600', text: 'text-amber-400', pulse: false },
        info: { bg: 'bg-blue-950/30 border-blue-500/25', badge: 'bg-blue-600', text: 'text-blue-400', pulse: false },
    };
    const c = config[alert.severity] ?? config.info;

    return (
        <div className={`flex items-center gap-2 rounded p-1.5 border text-xs ${c.bg} ${className}`}>
            <span className={`whitespace-nowrap rounded px-1 text-[10px] font-medium text-white ${c.badge}`}>
                {alert.severity === 'critical' ? '严重' : alert.severity === 'warning' ? '警告' : '提示'}
            </span>
            <span className="flex-1 truncate text-slate-300">{alert.title}</span>
            <span className={`whitespace-nowrap font-bold ${c.text}`}>{alert.triggered_at}</span>
        </div>
    );
}

/** 底部统计条 */
function BottomBar({ summary }: { summary: SummaryData }) {
    const items = [
        { label: '总功率', value: summary.power, suffix: ' W', icon: Zap, color: 'text-cyan-400' },
        { label: '活跃告警', value: summary.alerts, suffix: '', icon: AlertTriangle, color: 'text-red-400' },
        { label: '设备总数', value: summary.devices, suffix: '', icon: Server, color: 'text-emerald-400' },
        { label: '机柜数量', value: summary.racks, suffix: '', icon: Cpu, color: 'text-blue-400' },
    ];

    return (
        <div className="grid grid-cols-4 gap-3">
            {items.map((item) => {
                const Icon = item.icon;
                return (
                    <div
                        key={item.label}
                        className="flex items-center justify-between rounded-xl border border-cyan-500/15 bg-cyan-950/20 px-4 py-2 backdrop-blur-md"
                    >
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-gray-400">{item.label}</div>
                            <div className={`text-lg font-bold ${item.color}`}>
                                <AnimatedNumber value={item.value} suffix={item.suffix} />
                            </div>
                        </div>
                        <Icon className={`h-5 w-5 opacity-40 ${item.color}`} />
                    </div>
                );
            })}
        </div>
    );
}

// ============================================================
// 主组件
// ============================================================
export default function Cockpit({ data }: Props) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cockpitData, setCockpitData] = useState<CockpitData>(data);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
    const [isAutoSwitching, setIsAutoSwitching] = useState(true);
    const [refreshCountdown, setRefreshCountdown] = useState(30);

    const { summary, deviceStatus, roomStats, recentAlerts, recentDevices, deviceTypes } = cockpitData;
    const selectedRoom = roomStats[selectedRoomIndex];
    const onlinePercent = deviceStatus.total > 0 ? Math.round((deviceStatus.online / deviceStatus.total) * 100) : 0;

    const liveTemp = typeof summary.avgTemperature === 'number' ? summary.avgTemperature : '--';
    const liveHumidity = typeof summary.avgHumidity === 'number' ? summary.avgHumidity : '--';
    const loadPercent = typeof summary.loadPercent === 'number' ? summary.loadPercent : 0;

    useEffect(() => {
        if (!isAutoSwitching || roomStats.length <= 1) return;
        const timer = setInterval(() => {
            setSelectedRoomIndex((prev) => (prev + 1) % roomStats.length);
        }, 5 * 60 * 1000);
        return () => clearInterval(timer);
    }, [isAutoSwitching, roomStats.length]);

    const handleRoomClick = (index: number) => {
        setSelectedRoomIndex(index);
        setIsAutoSwitching(false);
    };

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
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handler);
        return () => document.removeEventListener('fullscreenchange', handler);
    }, []);

    const refreshData = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch('/api/cockpit/data');
            const json = await res.json();
            if (json.success) {
                setCockpitData(json.data);
                if (selectedRoomIndex >= json.data.roomStats.length) {
                    setSelectedRoomIndex(0);
                }
            }
        } catch {
            // 静默失败
        } finally {
            setIsRefreshing(false);
        }
    }, [selectedRoomIndex]);

    useEffect(() => {
        const timer = setInterval(refreshData, 30000);
        return () => clearInterval(timer);
    }, [refreshData]);

    useEffect(() => {
        const timer = setInterval(() => {
            setRefreshCountdown((prev) => {
                if (prev <= 1) {
                    return 30;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        setRefreshCountdown(30);
    }, [cockpitData.timestamp]);

    return (
        <div
            className={`relative flex h-screen flex-col overflow-hidden bg-[#020617] font-mono text-cyan-400 select-none ${
                isFullscreen ? '' : 'p-2'
            }`}
        >
            {/* ============ 背景层 ============ */}
            {/* 径向渐变底色 */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#071630] via-[#020813] to-[#010409]" />

            {/* 网格线 */}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-30 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

            {/* 动态光晕 */}
            <div className="pointer-events-none absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[100px]" />
            <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[100px]" />

            {/* ============ 主体内容 ============ */}
            <div className="relative z-10 mx-auto flex w-full max-w-[1920px] flex-1 flex-col overflow-hidden">
                {/* ------ 顶部 Header ------ */}
                <header className="relative shrink-0 border-b border-cyan-500/15 bg-gradient-to-b from-[#0b2545]/30 to-transparent py-2 text-center backdrop-blur-sm">
                    <div className="absolute left-1/2 top-0 h-[2px] w-[40%] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee]" />
                    <h1 className="text-2xl font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-200 to-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                        数据中心驾驶舱
                    </h1>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-blue-400/60">
                        Real-time Monitoring & Intelligent Operation
                    </p>

                    {/* 右上角操作按钮 */}
                    <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
                        <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/20 bg-black/40 px-2.5 py-1 backdrop-blur">
                            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                            <span className="text-[11px] text-slate-300">系统正常</span>
                        </div>
                        <button
                            onClick={refreshData}
                            className="rounded-lg border border-cyan-500/25 bg-black/40 p-1.5 backdrop-blur transition hover:bg-cyan-950/40"
                            title="刷新数据"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={toggleFullscreen}
                            className="rounded-lg border border-cyan-500/25 bg-black/40 p-1.5 backdrop-blur transition hover:bg-cyan-950/40"
                            title={isFullscreen ? '退出全屏' : '全屏显示'}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="h-3.5 w-3.5 text-cyan-400" />
                            ) : (
                                <Maximize2 className="h-3.5 w-3.5 text-cyan-400" />
                            )}
                        </button>
                    </div>
                </header>

                {/* ------ 三栏主体布局 ------ */}
                <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 py-2">
                    {/* ======== 左栏 ======== */}
                    <div className="col-span-3 flex flex-col gap-3 overflow-hidden">
                        {/* 设备状态概览 */}
                        <SciFiCard title="设备状态概览" icon={Cpu}>
                            <div className="flex items-center justify-center gap-4 py-1">
                                <RingChart
                                    percent={onlinePercent}
                                    value={deviceStatus.online}
                                    label="在线设备"
                                    color="url(#cyanGrad)"
                                />
                                <svg width="0" height="0">
                                    <defs>
                                        <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#a855f7" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
                                        <span className="text-slate-300">温度</span>
                                        <span className="ml-auto font-bold text-white">{liveTemp === '--' ? '--' : `${liveTemp}°C`}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-purple-500 shadow-[0_0_6px_#a855f7]" />
                                        <span className="text-slate-300">湿度</span>
                                        <span className="ml-auto font-bold text-white">{liveHumidity === '--' ? '--' : `${liveHumidity}%`}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                                        <span className="text-slate-300">在线率</span>
                                        <span className="ml-auto font-bold text-emerald-400">{onlinePercent}%</span>
                                    </div>
                                </div>
                            </div>
                            {/* 在线率进度条 */}
                            <div className="mt-1.5 flex items-center gap-2">
                                <Wifi className="h-3 w-3 text-cyan-400" />
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-1000"
                                        style={{ width: `${onlinePercent}%` }}
                                    />
                                </div>
                                <span className="text-[11px] font-bold text-cyan-400">{onlinePercent}%</span>
                            </div>
                        </SciFiCard>

                        {/* 运行设备统计 */}
                        <SciFiCard title="运行设备统计" icon={Activity}>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative overflow-hidden rounded-lg border border-cyan-500/10 bg-blue-950/15 p-2 backdrop-blur-sm transition hover:border-cyan-500/30">
                                    <div className="text-[9px] uppercase tracking-wider text-blue-400">在线</div>
                                    <div className="text-xl font-bold text-cyan-400">{deviceStatus.online}</div>
                                    <Cpu className="absolute -bottom-1 -right-1 h-7 w-7 opacity-10" />
                                </div>
                                <div className="relative overflow-hidden rounded-lg border border-red-500/10 bg-red-950/15 p-2 backdrop-blur-sm transition hover:border-red-500/30">
                                    <div className="text-[9px] uppercase tracking-wider text-red-400">离线</div>
                                    <div className="text-xl font-bold text-red-500">{deviceStatus.offline}</div>
                                </div>
                                <div className="relative overflow-hidden rounded-lg border border-amber-500/10 bg-amber-950/15 p-2 backdrop-blur-sm transition hover:border-amber-500/30">
                                    <div className="text-[9px] uppercase tracking-wider text-amber-400">维护中</div>
                                    <div className="text-xl font-bold text-amber-500">{deviceStatus.maintenance}</div>
                                </div>
                                <div className="relative overflow-hidden rounded-lg border border-purple-500/10 bg-purple-950/15 p-2 backdrop-blur-sm transition hover:border-purple-500/30">
                                    <div className="text-[9px] uppercase tracking-wider text-purple-400">机房数</div>
                                    <div className="text-xl font-bold text-purple-400">{summary.rooms}</div>
                                </div>
                            </div>
                        </SciFiCard>

                        {/* 机房列表 */}
                        <SciFiCard title="机房状态" icon={Server} className="flex-1">
                            <AutoScroll className="space-y-1.5 max-h-[180px] pr-1">
                                {roomStats.map((room, index) => (
                                    <div
                                        key={room.id}
                                        onClick={() => handleRoomClick(index)}
                                        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] transition cursor-pointer ${
                                            index === selectedRoomIndex
                                                ? 'border-cyan-500/50 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                                : 'border-cyan-500/10 bg-slate-900/40 hover:border-cyan-500/30'
                                        }`}
                                    >
                                        <div>
                                            <div className="font-medium text-white flex items-center gap-1.5">
                                                {index === selectedRoomIndex && (
                                                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                                )}
                                                {room.name}
                                            </div>
                                            <div className="text-slate-400">
                                                {room.racks} 机柜 · {room.devices} 设备
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-0.5 text-cyan-400">
                                                <Thermometer className="h-3 w-3" />
                                                <span>{room.temperature}°C</span>
                                            </div>
                                            <div className="flex items-center gap-0.5 text-blue-400">
                                                <Droplets className="h-3 w-3" />
                                                <span>{room.humidity}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {roomStats.length === 0 && (
                                    <div className="py-6 text-center text-xs text-slate-500">暂无机房数据</div>
                                )}
                            </AutoScroll>
                            {roomStats.length > 1 && (
                                <div className="mt-2 pt-1.5 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-slate-500">
                                    <span>自动切换: {isAutoSwitching ? '开' : '关'}</span>
                                    <button
                                        onClick={() => setIsAutoSwitching(!isAutoSwitching)}
                                        className="px-2 py-0.5 rounded border border-cyan-500/20 bg-cyan-950/10 hover:bg-cyan-950/30 transition"
                                    >
                                        {isAutoSwitching ? '暂停' : '恢复'}
                                    </button>
                                </div>
                            )}
                        </SciFiCard>
                    </div>

                    {/* ======== 中栏 - 3D 机房 ======== */}
                    <div className="col-span-6 relative flex flex-col overflow-hidden rounded-xl border border-cyan-500/10 bg-gradient-to-b from-[#020b18]/60 to-[#01050e]/95 shadow-[inset_0_0_40px_rgba(6,182,212,0.04)]">
                        {/* 悬浮状态标签 */}
                        <div className="pointer-events-none absolute left-3 top-3 z-20 flex gap-3">
                            <div className="rounded-lg border border-cyan-500/30 bg-black/50 px-2.5 py-1 backdrop-blur-md">
                                <span className="block text-[9px] uppercase tracking-wider text-gray-400">机房均温</span>
                                <span className="text-sm font-bold text-cyan-300">
                                    {typeof summary.avgTemperature === 'number' ? summary.avgTemperature : '--'} °C
                                </span>
                            </div>
                            <div className="rounded-lg border border-purple-500/30 bg-black/50 px-2.5 py-1 backdrop-blur-md">
                                <span className="block text-[9px] uppercase tracking-wider text-gray-400">当前负载</span>
                                <span className="text-sm font-bold text-purple-300">{loadPercent} %</span>
                            </div>
                        </div>

                        {/* 选中机房名称标签 */}
                        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-lg border border-cyan-500/20 bg-black/50 px-2.5 py-1 backdrop-blur-md">
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                                {selectedRoom?.name || '数据中心'}
                            </div>
                        </div>

                        {/* WebGL 画布 */}
                        <div className="h-full w-full cursor-grab active:cursor-grabbing">
                            <Canvas
                                camera={{ position: [0, 10, 15], fov: 45 }}
                                gl={{ antialias: true, alpha: true }}
                            >
                                <ambientLight intensity={0.35} />
                                <pointLight position={[10, 15, 10]} intensity={2} color="#06b6d4" />
                                <pointLight position={[-10, 10, -10]} intensity={1} color="#a855f7" />
                                <spotLight position={[0, 15, 0]} intensity={0.5} color="#ffffff" />

                                <ServerRoom3D
                                    temp={liveTemp}
                                    rackCount={selectedRoom?.racks || 6}
                                    racks={selectedRoom?.rack_details || []}
                                />

                                <OrbitControls
                                    maxPolarAngle={Math.PI / 2 - 0.05}
                                    minDistance={5}
                                    maxDistance={25}
                                    enableDamping
                                    dampingFactor={0.1}
                                />

                                <Environment preset="city" />
                            </Canvas>
                        </div>

                        {/* 底部三列数据 */}
                        <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-20 grid grid-cols-3 gap-3">
                            <div className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-950/30 px-3 py-1.5 backdrop-blur-md">
                                <div>
                                    <span className="block text-[9px] uppercase tracking-wider text-gray-400">总功耗</span>
                                    <span className="text-base font-bold text-white">
                                        <AnimatedNumber value={summary.power} suffix=" W" />
                                    </span>
                                </div>
                                <Zap className="h-4 w-4 animate-pulse text-cyan-400" />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-950/30 px-3 py-1.5 backdrop-blur-md">
                                <div>
                                    <span className="block text-[9px] uppercase tracking-wider text-gray-400">活跃告警</span>
                                    <span className="text-base font-bold text-red-400">{summary.alerts} 件</span>
                                </div>
                                <AlertTriangle className="h-4 w-4 text-red-400" />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-950/30 px-3 py-1.5 backdrop-blur-md">
                                <div>
                                    <span className="block text-[9px] uppercase tracking-wider text-gray-400">设备总数</span>
                                    <span className="text-base font-bold text-emerald-400">{summary.devices} 台</span>
                                </div>
                                <CheckCircle className="h-4 w-4 text-emerald-400" />
                            </div>
                        </div>
                    </div>

                    {/* ======== 右栏 ======== */}
                    <div className="col-span-3 flex flex-col gap-3 overflow-hidden">
                        {/* 告警监测 */}
                        <SciFiCard title="实时告警监测" icon={AlertTriangle}>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
                                    严重 {summary.criticalAlerts}
                                </span>
                                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                                    警告 {summary.warningAlerts}
                                </span>
                            </div>
                            <AutoScroll className="space-y-1.5 max-h-[180px] pr-1">
                                {recentAlerts.slice(0, 6).map((alert) => (
                                    <AlertRow
                                        key={alert.id}
                                        alert={alert}
                                        className={alert.severity === 'critical' ? 'animate-pulse' : ''}
                                    />
                                ))}
                                {recentAlerts.length === 0 && (
                                    <div className="flex flex-col items-center py-8 text-slate-500">
                                        <Shield className="mb-2 h-10 w-10 opacity-30" />
                                        <span className="text-xs">暂无告警</span>
                                    </div>
                                )}
                            </AutoScroll>
                        </SciFiCard>

                        {/* 系统运行状态 */}
                        <SciFiCard title="系统运行状态" icon={CheckCircle}>
                            <div className="flex flex-col items-center justify-center py-2">
                                <div className="relative flex items-center justify-center">
                                    <div className="absolute h-16 w-16 animate-ping rounded-full bg-cyan-500/10" />
                                    <div className="absolute h-24 w-24 animate-pulse rounded-full bg-cyan-500/5" />
                                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-cyan-400 bg-cyan-950/80 shadow-[0_0_16px_#06b6d4]">
                                        <CheckCircle className="h-7 w-7 text-cyan-400" />
                                    </div>
                                </div>
                                <div className="mt-3 text-center">
                                    <div className="text-xs font-bold tracking-widest text-white">系统运行状态：优</div>
                                    <div className="mt-0.5 text-[10px] text-slate-500">持续安全运行：412 天 08 小时</div>
                                </div>
                            </div>
                        </SciFiCard>

                        {/* 设备类型分布 */}
                        <SciFiCard title="设备类型" icon={Layers}>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {deviceTypes.map((t) => (
                                    <div
                                        key={t.id}
                                        className="flex items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-2 py-1 text-[10px] backdrop-blur"
                                    >
                                        <span
                                            className="h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: t.color }}
                                        />
                                        <span className="text-slate-300">{t.name}</span>
                                        <span className="font-bold text-white">{t.count}</span>
                                    </div>
                                ))}
                            </div>
                        </SciFiCard>

                        {/* 设备状态列表 */}
                        <SciFiCard title="设备状态" icon={Cpu} className="flex-1">
                            <AutoScroll className="space-y-1.5 max-h-[180px] pr-1">
                                {recentDevices.map((device) => {
                                    const statusColors = {
                                        online: 'bg-emerald-500/20 border-emerald-500/30',
                                        offline: 'bg-red-500/20 border-red-500/30',
                                        maintenance: 'bg-amber-500/20 border-amber-500/30',
                                    };
                                    const statusDot = {
                                        online: 'bg-emerald-400',
                                        offline: 'bg-red-400',
                                        maintenance: 'bg-amber-400',
                                    };
                                    return (
                                        <div
                                            key={device.id}
                                            className={`flex items-center gap-2 rounded-lg border p-1.5 text-[10px] ${statusColors[device.status]}`}
                                        >
                                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot[device.status]} ${device.status === 'online' ? 'animate-pulse' : ''}`} />
                                            <span
                                                className="h-2 w-2 rounded-sm flex-shrink-0"
                                                style={{ backgroundColor: device.type_color }}
                                                title={device.type_name}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1 truncate">
                                                    <span className="text-white font-medium truncate">{device.name}</span>
                                                    <span className="text-slate-500 flex-shrink-0">|</span>
                                                    <span className="text-slate-400 flex-shrink-0 truncate">{device.type_name}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-right">
                                                <div className="flex items-center gap-0.5 text-cyan-400">
                                                    <Thermometer className="h-2.5 w-2.5" />
                                                    <span>{device.temperature}°</span>
                                                </div>
                                                <div className="flex items-center gap-0.5 text-blue-400">
                                                    <Droplets className="h-2.5 w-2.5" />
                                                    <span>{device.humidity}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {recentDevices.length === 0 && (
                                    <div className="py-4 text-center text-xs text-slate-500">暂无设备数据</div>
                                )}
                            </AutoScroll>
                        </SciFiCard>
                    </div>
                </div>

                {/* ------ 底部统计条 ------ */}
                <div className="shrink-0 pt-2">
                    <BottomBar summary={summary} />
                </div>

                {/* ------ 页脚 ------ */}
                <div className="shrink-0 flex items-center justify-between py-1.5 text-[10px] text-slate-500">
                    <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>最后更新: {cockpitData.timestamp}</span>
                        <span className="text-slate-600">|</span>
                        <span>自动刷新: <span className="text-cyan-400 font-bold">{refreshCountdown}s</span></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                        <Activity className="h-3 w-3 text-green-500" />
                        <span>所有系统运行正常</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
