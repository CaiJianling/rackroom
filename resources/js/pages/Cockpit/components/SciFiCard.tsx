import type { LucideIcon } from 'lucide-react';

interface SciFiCardProps {
    title: string;
    icon: LucideIcon;
    children: React.ReactNode;
    className?: string;
}

export function SciFiCard({ title, icon: Icon, children, className = '' }: SciFiCardProps) {
    return (
        <div
            className={`relative flex flex-col rounded-xl border border-cyan-500/20 bg-gradient-to-b from-[#031127]/80 to-[#010612]/95 p-3 shadow-[0_0_20px_rgba(6,182,212,0.1)] backdrop-blur-md transition-all duration-300 hover:border-cyan-400/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.18)] ${className}`}
        >
            {/* 左上角切角装饰 */}
            <div className="absolute top-0 left-0 h-[1px] w-3 bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
            <div className="absolute top-0 left-0 h-3 w-[1px] bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
            {/* 右上角切角装饰 */}
            <div className="absolute top-0 right-0 h-[1px] w-3 bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
            <div className="absolute top-0 right-0 h-3 w-[1px] bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
            {/* 左下角切角装饰 */}
            <div className="absolute bottom-0 left-0 h-[1px] w-3 bg-cyan-400/60" />
            <div className="absolute bottom-0 left-0 h-3 w-[1px] bg-cyan-400/60" />
            {/* 右下角切角装饰 */}
            <div className="absolute bottom-0 right-0 h-[1px] w-3 bg-cyan-400/60" />
            <div className="absolute bottom-0 right-0 h-3 w-[1px] bg-cyan-400/60" />

            {/* 卡片头部 */}
            <div className="mb-2 flex items-center gap-1.5 border-b border-cyan-500/10 pb-1.5 text-xs font-bold tracking-wider text-slate-200">
                <Icon className="h-3.5 w-3.5 text-cyan-400 drop-shadow-[0_0_3px_#06b6d4]" />
                <span>{title}</span>
                <div className="ml-auto flex gap-1">
                    <span className="h-1 w-1 rounded-full bg-cyan-500/50" />
                    <span className="h-1 w-1 rounded-full bg-cyan-500/50" />
                </div>
            </div>

            {/* 卡片内容 */}
            <div className="min-h-0 flex-1">{children}</div>
        </div>
    );
}
