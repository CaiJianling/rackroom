import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';

interface RackDetail {
    id: number;
    name: string;
    u_count: number;
    power: number;
    device_count: number;
    temperature: string | number;
    humidity: string | number;
}

interface ServerRoom3DProps {
    temp: number;
    rackCount?: number;
    racks?: RackDetail[];
}

function RackCabinet({
    position,
    rowIndex,
    temp,
    rackData
}: {
    position: [number, number, number];
    rowIndex: number;
    temp: number;
    rackData?: RackDetail;
}) {
    const rackTemp = typeof rackData?.temperature === 'number' ? rackData.temperature : temp;
    const lightColor = rackTemp > 24.5 ? '#f97316' : '#06b6d4';
    const zDir = rowIndex === 0 ? 1 : -1;
    const deviceCount = rackData?.device_count || Math.floor(Math.random() * 8) + 2;

    return (
        <group position={position}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={[1, 2.4, 1.1]} />
                <meshStandardMaterial color="#0b1329" roughness={0.4} metalness={0.8} />
            </mesh>

            <mesh position={[0, 0, zDir * 0.56]}>
                <boxGeometry args={[0.82, 2.2, 0.02]} />
                <meshStandardMaterial color="#020617" emissive={lightColor} emissiveIntensity={1.8} />
            </mesh>

            {Array.from({ length: deviceCount }).map((_, ledIndex) => {
                const xPos = ledIndex % 2 === 0 ? 0.2 : -0.2;
                const yPos = 0.8 - Math.floor(ledIndex / 2) * 0.5;
                return (
                    <ReactSlot
                        key={ledIndex}
                        position={[xPos, yPos, zDir * 0.57]}
                        color={rackData ? '#10b981' : (Math.random() > 0.3 ? '#10b981' : '#ef4444')}
                    />
                );
            })}
        </group>
    );
}

function ReactSlot({ position, color }: { position: [number, number, number]; color: string }) {
    return (
        <mesh position={position}>
            <boxGeometry args={[0.08, 0.04, 0.02]} />
            <meshBasicMaterial color={color} />
        </mesh>
    );
}

export function ServerRoom3D({ temp, rackCount = 6, racks = [] }: ServerRoom3DProps) {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.05) * 0.08;
        }
    });

    const rows = 2;
    const cols = Math.max(Math.ceil(rackCount / rows), 3);

    return (
        <group ref={groupRef}>
            {Array.from({ length: rows }).map((_, rowIndex) => {
                const zPos = rowIndex === 0 ? -1.8 : 1.8;
                return (
                    <group key={rowIndex}>
                        {Array.from({ length: cols }).map((_, colIndex) => {
                            const rackIndex = rowIndex * cols + colIndex;
                            if (rackIndex >= rackCount) return null;
                            const xPos = (colIndex - (cols - 1) / 2) * 1.5;
                            const rackData = racks[rackIndex];
                            return (
                                <RackCabinet
                                    key={colIndex}
                                    position={[xPos, 1.2, zPos]}
                                    rowIndex={rowIndex}
                                    temp={temp}
                                    rackData={rackData}
                                />
                            );
                        })}
                    </group>
                );
            })}

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <planeGeometry args={[9, 1.5]} />
                <meshStandardMaterial color="#000" emissive="#00e5ff" emissiveIntensity={3} transparent opacity={0.7} />
            </mesh>

            <Grid
                position={[0, -0.01, 0]}
                args={[30, 30]}
                cellSize={0.5}
                cellThickness={0.5}
                cellColor="#082f49"
                sectionSize={2}
                sectionThickness={1}
                sectionColor="#0e7490"
                fadeDistance={20}
                infiniteGrid
            />
        </group>
    );
}
