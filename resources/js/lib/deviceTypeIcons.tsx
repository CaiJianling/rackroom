import {
    Server,
    Cpu,
    HardDrive,
    Monitor,
    Database,
    Wifi,
    Box,
    Network,
} from 'lucide-react';
import React from 'react';

/**
 * 设备类型图标映射 - 与 /device-types 页面设置保持一致
 * 标准图标: server, cpu, hard-drive, network, monitor, database, wifi, box
 */
export const deviceTypeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    server: Server,
    cpu: Cpu,
    'hard-drive': HardDrive,
    network: Network,
    monitor: Monitor,
    database: Database,
    wifi: Wifi,
    box: Box,
};

/**
 * 获取设备类型图标组件
 * @param iconName - 图标名称
 * @returns 图标组件
 */
export const getDeviceTypeIcon = (iconName: string | null): React.ComponentType<{ className?: string }> => {
    return iconName ? deviceTypeIconMap[iconName] || Server : Server;
};

/**
 * 获取设备类型图标 JSX 元素 (用于内联渲染)
 * @param iconName - 图标名称
 * @param className - 样式类名
 * @returns JSX 元素
 */
export const getDeviceTypeIconElement = (iconName: string | null, className: string = 'h-4 w-4'): React.ReactNode => {
    const IconComponent = getDeviceTypeIcon(iconName);
    return <IconComponent className={className} />;
};
