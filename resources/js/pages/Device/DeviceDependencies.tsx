import { Head, usePage } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowRight,
    Circle,
    Database,
    Edit2,
    GitBranch,
    Link2,
    Loader2,
    Network,
    Plus,
    Power,
    RefreshCw,
    Server,
    Trash2,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
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
import {
    Input
} from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/layouts/app-layout';

interface PageProps {
    errors?: Record<string, string>;
    flash?: {
        success?: string;
        error?: string;
        warning?: string;
        info?: string;
    };
}

interface Device {
    id: number;
    name: string;
    ip_address: string | null;
    status: string;
    type: string;
    rack_name: string | null;
}

interface Dependency {
    id: number;
    source_device_id: number;
    target_device_id: number;
    dependency_type: string;
    description: string | null;
    source_device?: Device;
    target_device?: Device;
}

interface TopologyNode {
    id: number;
    name: string;
    type: string;
    ip: string | null;
    status: string;
    x?: number;
    y?: number;
}

interface TopologyEdge {
    source: number;
    target: number;
    type: string;
    description: string | null;
}

interface ImpactResult {
    device: {
        id: number;
        name: string;
        type: string;
        ip_address: string | null;
        status: string;
    };
    directly_affected: Array<{
        device_id: number;
        device_name: string;
        device_type: string;
        ip_address: string | null;
        dependency_type: string;
        description: string | null;
        level: string;
    }>;
    second_level_affected: Array<{
        device_id: number;
        device_name: string;
        device_type: string;
        ip_address: string | null;
        dependency_type: string;
        description: string | null;
        level: string;
    }>;
    total_affected: number;
}

const BREADCRUMBS = [
    { title: '设备管理', href: '#' },
    { title: '设备依赖关系', href: '/device-dependencies' },
];

const DEPENDENCY_TYPE_OPTIONS = [
    { value: 'network', label: '网络连接', icon: Network, color: 'text-blue-600' },
    { value: 'power', label: '电源连接', icon: Power, color: 'text-yellow-600' },
    { value: 'storage', label: '存储连接', icon: Database, color: 'text-purple-600' },
    { value: 'application', label: '应用依赖', icon: GitBranch, color: 'text-green-600' },
    { value: 'other', label: '其他', icon: Link2, color: 'text-gray-600' },
];

const DEPENDENCY_TYPE_COLORS: Record<string, string> = {
    network: 'bg-blue-100 text-blue-800 border-blue-300',
    power: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    storage: 'bg-purple-100 text-purple-800 border-purple-300',
    application: 'bg-green-100 text-green-800 border-green-300',
    other: 'bg-gray-100 text-gray-800 border-gray-300',
};

const DEVICE_STATUS_COLORS: Record<string, string> = {
    online: 'bg-green-100 text-green-800',
    offline: 'bg-red-100 text-red-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
};

export default function DeviceDependencies({ breadcrumbs = BREADCRUMBS }: { breadcrumbs?: Array<{ title: string; href: string }> }) {
    const { flash } = usePage().props as PageProps;
    const { showToast } = useToast();

    const [activeTab, setActiveTab] = useState('topology');
    const [loading, setLoading] = useState(false);
    const [dependencies, setDependencies] = useState<Dependency[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);

    const [topologyData, setTopologyData] = useState<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>({ nodes: [], edges: [] });
    const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
    const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);

    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [editingDependency, setEditingDependency] = useState<Dependency | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [dependencyToDelete, setDependencyToDelete] = useState<Dependency | null>(null);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        source_device_id: '',
        target_device_id: '',
        dependency_type: 'network',
        description: '',
    });

    const [filterDevice, setFilterDevice] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('');

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    useEffect(() => {
        loadDevices();
        loadDependencies();
        loadTopology();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (flash?.success) {
            showToast(flash.success, 'success');
        }
        if (flash?.error) {
            showToast(flash.error, 'error');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flash]);

    const loadDevices = async () => {
        try {
            const response = await fetch('/api/device-dependencies/devices');
            const data = await response.json();
            if (data.success) {
                setDevices(data.data);
            }
        } catch (error) {
            console.error('Failed to load devices:', error);
        }
    };

    const loadDependencies = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterDevice) params.append('device_id', filterDevice);
            if (filterType) params.append('dependency_type', filterType);

            const response = await fetch(`/api/device-dependencies?${params.toString()}`);
            const data = await response.json();
            if (data.success) {
                setDependencies(data.data);
            }
        } catch (error) {
            console.error('Failed to load dependencies:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTopology = async (deviceId?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (deviceId) params.append('device_id', deviceId);

            const response = await fetch(`/api/device-dependencies/topology?${params.toString()}`);
            const data = await response.json();
            if (data.success) {
                const positionedData = positionTopologyNodes(data.data.nodes, data.data.edges);
                setTopologyData(positionedData);
            }
        } catch (error) {
            console.error('Failed to load topology:', error);
        } finally {
            setLoading(false);
        }
    };

    const positionTopologyNodes = (nodes: TopologyNode[], edges: TopologyEdge[]): { nodes: TopologyNode[]; edges: TopologyEdge[] } => {
        if (nodes.length === 0) return { nodes: [], edges };

        const levels = new Map<number, number>();

        const findLevel = (nodeId: number, level = 0) => {
            if (levels.has(nodeId)) {
                const existingLevel = levels.get(nodeId)!;
                if (level < existingLevel) {
                    levels.set(nodeId, level);
                }
            } else {
                levels.set(nodeId, level);
            }
        };

        nodes.forEach(node => {
            const outgoingEdges = edges.filter(e => e.source === node.id);
            if (outgoingEdges.length === 0 && !levels.has(node.id)) {
                levels.set(node.id, 0);
            }
        });

        edges.forEach(edge => {
            if (levels.has(edge.source)) {
                findLevel(edge.target, levels.get(edge.source)! + 1);
            }
        });

        const maxLevel = Math.max(...Array.from(levels.values()), 0);
        const levelGroups = new Map<number, TopologyNode[]>();

        nodes.forEach(node => {
            const level = levels.get(node.id) ?? maxLevel;
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level)!.push(node);
        });

        const nodeWidth = 180;
        const nodeHeight = 80;
        const horizontalGap = 100;
        const verticalGap = 120;
        const containerPadding = 60;

        const positionedNodes = nodes.map(node => {
            const level = levels.get(node.id) ?? maxLevel;
            const group = levelGroups.get(level) ?? [];
            const index = group.findIndex(n => n.id === node.id);
            const groupSize = group.length;

            const totalWidth = groupSize * nodeWidth + (groupSize - 1) * horizontalGap;
            const startX = (containerPadding + (maxLevel + 1) * (nodeWidth + horizontalGap) - totalWidth) / 2;

            return {
                ...node,
                x: startX + index * (nodeWidth + horizontalGap),
                y: containerPadding + level * (nodeHeight + verticalGap),
            };
        });

        return { nodes: positionedNodes, edges };
    };

    const loadImpactAnalysis = async (deviceId: number) => {
        try {
            const response = await fetch(`/api/device-dependencies/impact/${deviceId}`);
            const data = await response.json();
            if (data.success) {
                setImpactResult(data.data);
            }
        } catch (error) {
            console.error('Failed to load impact analysis:', error);
        }
    };

    const handleNodeClick = (node: TopologyNode) => {
        setSelectedNode(node);
        loadImpactAnalysis(node.id);
    };

    const openAddDialog = () => {
        setFormData({
            source_device_id: '',
            target_device_id: '',
            dependency_type: 'network',
            description: '',
        });
        setEditingDependency(null);
        setAddDialogOpen(true);
    };

    const openEditDialog = (dependency: Dependency) => {
        setFormData({
            source_device_id: dependency.source_device_id.toString(),
            target_device_id: dependency.target_device_id.toString(),
            dependency_type: dependency.dependency_type,
            description: dependency.description || '',
        });
        setEditingDependency(dependency);
        setAddDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.source_device_id || !formData.target_device_id) {
            showToast('请选择源设备和目标设备', 'warning');
            return;
        }

        if (formData.source_device_id === formData.target_device_id) {
            showToast('源设备和目标设备不能相同', 'warning');
            return;
        }

        setSaving(true);
        try {
            const url = editingDependency
                ? `/api/device-dependencies/${editingDependency.id}`
                : '/api/device-dependencies';
            const method = editingDependency ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken || '',
                },
                body: JSON.stringify({
                    source_device_id: formData.source_device_id,
                    target_device_id: formData.target_device_id,
                    dependency_type: formData.dependency_type,
                    description: formData.description,
                }),
            });

            const data = await response.json();
            if (data.success) {
                showToast(data.message, 'success');
                setAddDialogOpen(false);
                loadDependencies();
                loadTopology();
            } else {
                showToast(data.message || '保存失败', 'error');
            }
        } catch (error) {
            console.error('Failed to save dependency:', error);
            showToast('保存失败', 'error');
        } finally {
            setSaving(false);
        }
    };

    const openDeleteDialog = (dependency: Dependency) => {
        setDependencyToDelete(dependency);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!dependencyToDelete) return;

        setSaving(true);
        try {
            const response = await fetch(`/api/device-dependencies/${dependencyToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': csrfToken || '',
                },
            });

            const data = await response.json();
            if (data.success) {
                showToast('删除成功', 'success');
                setDeleteDialogOpen(false);
                loadDependencies();
                loadTopology();
            } else {
                showToast(data.message || '删除失败', 'error');
            }
        } catch (error) {
            console.error('Failed to delete dependency:', error);
            showToast('删除失败', 'error');
        } finally {
            setSaving(false);
        }
    };

    const filteredDependencies = useMemo(() => {
        return dependencies.filter(dep => {
            if (filterDevice && dep.source_device_id.toString() !== filterDevice && dep.target_device_id.toString() !== filterDevice) {
                return false;
            }
            if (filterType && dep.dependency_type !== filterType) {
                return false;
            }
            return true;
        });
    }, [dependencies, filterDevice, filterType]);

    const getDependencyLabel = (type: string) => {
        const option = DEPENDENCY_TYPE_OPTIONS.find(o => o.value === type);
        return option ? option.label : type;
    };

    const renderTopology = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            );
        }

        if (topologyData.nodes.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                    <Network className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium">暂无依赖关系数据</p>
                    <p className="text-sm">点击"添加依赖"按钮创建设备之间的依赖关系</p>
                </div>
            );
        }

        const containerWidth = Math.max(...topologyData.nodes.map(n => (n.x || 0) + 200)) + 200;
        const containerHeight = Math.max(...topologyData.nodes.map(n => (n.y || 0) + 100)) + 200;

        return (
            <div className="overflow-auto border rounded-lg" style={{ height: '600px' }}>
                <div className="relative overflow-visible p-8" style={{ width: `${containerWidth}px`, height: `${containerHeight}px`, minWidth: '100%' }}>
                    <svg className="absolute inset-0 overflow-visible" style={{ width: '100%', height: '100%', minHeight: '600px' }}>
                        {topologyData.edges.map((edge, index) => {
                            const sourceNode = topologyData.nodes.find(n => n.id === edge.source);
                            const targetNode = topologyData.nodes.find(n => n.id === edge.target);
                            if (!sourceNode || !targetNode) return null;

                            const x1 = (sourceNode.x || 0) + 90;
                            const y1 = (sourceNode.y || 0) + 40;
                            const x2 = (targetNode.x || 0) + 90;
                            const y2 = (targetNode.y || 0) + 40;

                            const midX = (x1 + x2) / 2;
                            const midY = (y1 + y2) / 2;

                            return (
                                <g key={`edge-${index}`}>
                                    <path
                                        d={`M ${x1} ${y1} Q ${midX} ${y1} ${midX} ${midY} Q ${midX} ${y2} ${x2} ${y2}`}
                                        fill="none"
                                        stroke={selectedNode?.id === edge.source || selectedNode?.id === edge.target ? '#3b82f6' : '#94a3b8'}
                                        strokeWidth="2"
                                        markerEnd="url(#arrowhead)"
                                    />
                                    <text
                                        x={midX}
                                        y={midY - 10}
                                        textAnchor="middle"
                                        className="text-xs fill-muted-foreground"
                                    >
                                        {getDependencyLabel(edge.type)}
                                    </text>
                                </g>
                            );
                        })}
                        <defs>
                            <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="7"
                                refX="9"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                            </marker>
                        </defs>
                    </svg>

                    {topologyData.nodes.map((node) => (
                        <div
                            key={node.id}
                            className={`absolute cursor-pointer transition-all duration-200 ${
                                selectedNode?.id === node.id ? 'scale-110 z-10' : 'hover:scale-105'
                            }`}
                            style={{
                                left: `${node.x}px`,
                                top: `${node.y}px`,
                                width: '180px',
                            }}
                            onClick={() => handleNodeClick(node)}
                        >
                            <div className={`p-3 rounded-lg border-2 ${
                                selectedNode?.id === node.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
                            } shadow-sm`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <Server className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm truncate">{node.name}</span>
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                    {node.ip || '无IP'}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="text-xs">
                                        {node.type}
                                    </Badge>
                                    <Badge className={`text-xs ${DEVICE_STATUS_COLORS[node.status] || 'bg-gray-100 text-gray-800'}`}>
                                        {node.status}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="设备依赖关系管理" />

            <div className="flex flex-col gap-6 p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Link2 className="h-6 w-6" />
                            设备依赖关系管理
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            可视化设备之间的依赖拓扑，分析故障影响范围
                        </p>
                    </div>
                    <Button onClick={openAddDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        添加依赖
                    </Button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="topology">拓扑视图</TabsTrigger>
                        <TabsTrigger value="list">列表视图</TabsTrigger>
                        <TabsTrigger value="impact" disabled={!selectedNode}>
                            故障影响分析
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="topology" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>依赖拓扑图</CardTitle>
                                <CardDescription>
                                    点击节点查看设备详情和故障影响分析
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {renderTopology()}
                            </CardContent>
                        </Card>

                        {selectedNode && impactResult && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>故障影响分析 - {selectedNode.name}</CardTitle>
                                    <CardDescription>
                                        如果 {selectedNode.name} 发生故障，将影响以下设备
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4 p-4 bg-red-50 rounded-lg border border-red-200">
                                            <AlertTriangle className="h-8 w-8 text-red-600" />
                                            <div>
                                                <p className="font-medium text-red-800">
                                                    受影响设备总数：{impactResult.total_affected}
                                                </p>
                                                <p className="text-sm text-red-600">
                                                    直接影响 {impactResult.directly_affected.length} 台，间接影响 {impactResult.second_level_affected.length} 台
                                                </p>
                                            </div>
                                        </div>

                                        {impactResult.directly_affected.length > 0 && (
                                            <div>
                                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                                    <ArrowRight className="h-4 w-4 text-orange-500" />
                                                    直接影响
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {impactResult.directly_affected.map((device) => (
                                                        <div key={device.device_id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                                            <div className="font-medium">{device.device_name}</div>
                                                            <div className="text-sm text-muted-foreground">{device.ip_address || '无IP'}</div>
                                                            <Badge variant="outline" className="mt-2">
                                                                {getDependencyLabel(device.dependency_type)}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {impactResult.second_level_affected.length > 0 && (
                                            <div>
                                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                                    <Circle className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                                    间接影响
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {impactResult.second_level_affected.map((device) => (
                                                        <div key={device.device_id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                                            <div className="font-medium">{device.device_name}</div>
                                                            <div className="text-sm text-muted-foreground">{device.ip_address || '无IP'}</div>
                                                            <Badge variant="outline" className="mt-2">
                                                                {getDependencyLabel(device.dependency_type)}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="list" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>依赖关系列表</CardTitle>
                                <CardDescription>
                                    管理设备之间的依赖关系
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-4 mb-4">
                                    <div className="flex-1">
                                        <Select value={filterDevice || 'all'} onValueChange={(v) => setFilterDevice(v === 'all' ? '' : v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="筛选设备" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">全部设备</SelectItem>
                                                {devices.map((device) => (
                                                    <SelectItem key={device.id} value={device.id.toString()}>
                                                        {device.name} {device.ip_address ? `(${device.ip_address})` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-48">
                                        <Select value={filterType || 'all'} onValueChange={(v) => setFilterType(v === 'all' ? '' : v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="依赖类型" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">全部类型</SelectItem>
                                                {DEPENDENCY_TYPE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button variant="outline" onClick={loadDependencies}>
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>源设备</TableHead>
                                            <TableHead>目标设备</TableHead>
                                            <TableHead>依赖类型</TableHead>
                                            <TableHead>描述</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8">
                                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredDependencies.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    暂无依赖关系数据
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredDependencies.map((dep) => (
                                                <TableRow key={dep.id}>
                                                    <TableCell>
                                                        <div className="font-medium">{dep.source_device?.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {dep.source_device?.ip_address || '无IP'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="font-medium">{dep.target_device?.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {dep.target_device?.ip_address || '无IP'}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={DEPENDENCY_TYPE_COLORS[dep.dependency_type]}>
                                                            {getDependencyLabel(dep.dependency_type)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px] truncate">
                                                        {dep.description || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => openEditDialog(dep)}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => openDeleteDialog(dep)}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="impact">
                        <Card>
                            <CardHeader>
                                <CardTitle>故障影响分析</CardTitle>
                                <CardDescription>
                                    选择拓扑视图中的一个节点查看故障影响范围
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center py-8 text-muted-foreground">
                                    请先在拓扑视图中点击一个设备节点
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingDependency ? '编辑依赖关系' : '添加依赖关系'}
                        </DialogTitle>
                        <DialogDescription>
                            建立设备之间的依赖关系
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>源设备 *</Label>
                            <Select
                                value={formData.source_device_id}
                                onValueChange={(value) => setFormData({ ...formData, source_device_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择源设备" />
                                </SelectTrigger>
                                <SelectContent>
                                    {devices.map((device) => (
                                        <SelectItem key={device.id} value={device.id.toString()}>
                                            {device.name} {device.ip_address ? `(${device.ip_address})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex justify-center">
                            <ArrowRight className="h-6 w-6 text-muted-foreground" />
                        </div>

                        <div className="space-y-2">
                            <Label>目标设备 *</Label>
                            <Select
                                value={formData.target_device_id}
                                onValueChange={(value) => setFormData({ ...formData, target_device_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择目标设备" />
                                </SelectTrigger>
                                <SelectContent>
                                    {devices.map((device) => (
                                        <SelectItem
                                            key={device.id}
                                            value={device.id.toString()}
                                            disabled={device.id.toString() === formData.source_device_id}
                                        >
                                            {device.name} {device.ip_address ? `(${device.ip_address})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>依赖类型 *</Label>
                            <Select
                                value={formData.dependency_type}
                                onValueChange={(value) => setFormData({ ...formData, dependency_type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEPENDENCY_TYPE_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            <div className="flex items-center gap-2">
                                                <option.icon className={`h-4 w-4 ${option.color}`} />
                                                {option.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>描述</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="可选的依赖描述"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                            取消
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '保存'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>确认删除</DialogTitle>
                        <DialogDescription>
                            确定要删除 {dependencyToDelete?.source_device?.name} → {dependencyToDelete?.target_device?.name} 的依赖关系吗？此操作无法撤销。
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            取消
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '删除'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}