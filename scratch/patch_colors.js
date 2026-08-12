const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../Tenant-v2/src/components/SchedulerGrid.tsx');
let content = fs.readFileSync(file, 'utf8');

// Define palette
const paletteCode = `
const CHAIN_COLORS = [
  { border: 'border-purple-400/80', ring: 'ring-purple-400/80', shadow: 'shadow-purple-500/20', text: 'text-purple-500/90' },
  { border: 'border-cyan-400/80', ring: 'ring-cyan-400/80', shadow: 'shadow-cyan-500/20', text: 'text-cyan-500/90' },
  { border: 'border-emerald-400/80', ring: 'ring-emerald-400/80', shadow: 'shadow-emerald-500/20', text: 'text-emerald-500/90' },
  { border: 'border-pink-400/80', ring: 'ring-pink-400/80', shadow: 'shadow-pink-500/20', text: 'text-pink-500/90' },
  { border: 'border-blue-400/80', ring: 'ring-blue-400/80', shadow: 'shadow-blue-500/20', text: 'text-blue-500/90' },
  { border: 'border-orange-400/80', ring: 'ring-orange-400/80', shadow: 'shadow-orange-500/20', text: 'text-orange-500/90' },
  { border: 'border-rose-400/80', ring: 'ring-rose-400/80', shadow: 'shadow-rose-500/20', text: 'text-rose-500/90' },
  { border: 'border-teal-400/80', ring: 'ring-teal-400/80', shadow: 'shadow-teal-500/20', text: 'text-teal-500/90' }
];

const getChainColor = (sessionId: string) => {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = sessionId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHAIN_COLORS[Math.abs(hash) % CHAIN_COLORS.length];
};

`;

content = content.replace("export function SchedulerGrid(", paletteCode + "export function SchedulerGrid(");

// Replace chainedSessionIds
const oldChainedSessionIds = `  const chainedSessionIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of positionedEvents) {
        if (ev.kind !== 'appointment' || !ev.raw?.bookingSessionId) continue;
        const sid = ev.raw.bookingSessionId;
        counts.set(sid, (counts.get(sid) || 0) + 1);
    }
    const chained = new Set<string>();
    for (const [sid, count] of counts.entries()) {
        if (count > 1) chained.add(sid);
    }
    return chained;
  }, [positionedEvents]);`;

const newChainedSessionColors = `  const chainedSessionColors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of positionedEvents) {
        if (ev.kind !== 'appointment' || !ev.raw?.bookingSessionId) continue;
        const sid = ev.raw.bookingSessionId;
        counts.set(sid, (counts.get(sid) || 0) + 1);
    }
    const chained = new Map<string, typeof CHAIN_COLORS[0]>();
    for (const [sid, count] of counts.entries()) {
        if (count > 1) {
            chained.set(sid, getChainColor(sid));
        }
    }
    return chained;
  }, [positionedEvents]);`;

content = content.replace(oldChainedSessionIds, newChainedSessionColors);


// Update lines Type in chainConnectors
content = content.replace(
`    const lines: Array<{
      key: string;
      x1: number; y1: number;
      x2: number; y2: number;
      isSameColumn: boolean;
    }> = [];`,
`    const lines: Array<{
      key: string;
      x1: number; y1: number;
      x2: number; y2: number;
      isSameColumn: boolean;
      color: typeof CHAIN_COLORS[0];
    }> = [];`
);

// Update lines push in chainConnectors
content = content.replace(
`        // Sort chronologically
        group.sort((a,b) => a.startMinutes - b.startMinutes);
        
        for (let i = 0; i < group.length - 1; i++) {`,
`        // Sort chronologically
        group.sort((a,b) => a.startMinutes - b.startMinutes);
        const sid = group[0].raw.bookingSessionId;
        const color = getChainColor(sid);
        
        for (let i = 0; i < group.length - 1; i++) {`
);

content = content.replace(
`                y2,
                isSameColumn: colIdx1 === colIdx2
            });`,
`                y2,
                isSameColumn: colIdx1 === colIdx2,
                color
            });`
);

// Render Connectors
const oldConnectorRender = `                    {/* First vertical segment down from y1 */}
                    <div 
                        className="absolute border-l-2 border-dashed border-amber-400 z-10"
                        style={{
                            ...(isRtl ? { right: \`\${line.x1}px\` } : { left: \`\${line.x1}px\` }),
                            top: \`\${line.y1}px\`,
                            height: \`\${isZShape ? (yMid - line.y1) : (line.y2 - line.y1)}px\`,
                            width: '0px'
                        }}
                    />
                    
                    {/* Horizontal segment if Z-shape */}
                    {isZShape && (
                        <div 
                            className="absolute border-t-2 border-dashed border-amber-400 z-10"
                            style={{
                                ...(isRtl ? { right: \`\${Math.min(line.x1, line.x2)}px\` } : { left: \`\${Math.min(line.x1, line.x2)}px\` }),
                                top: \`\${yMid}px\`,
                                width: \`\${Math.abs(line.x2 - line.x1)}px\`,
                                height: '0px'
                            }}
                        />
                    )}
                    
                    {/* Second vertical segment down to y2 if Z-shape */}
                    {isZShape && (
                        <div 
                            className="absolute border-l-2 border-dashed border-amber-400 z-10"
                            style={{
                                ...(isRtl ? { right: \`\${line.x2}px\` } : { left: \`\${line.x2}px\` }),
                                top: \`\${yMid}px\`,
                                height: \`\${line.y2 - yMid}px\`,
                                width: '0px'
                            }}
                        />
                    )}
                    
                    {/* Arrowhead at destination */}
                    <div 
                        className="absolute z-10 text-amber-500 flex items-center justify-center"`;

const newConnectorRender = `                    {/* First vertical segment down from y1 */}
                    <div 
                        className={\`absolute border-l-2 border-dashed \${line.color.border} z-10\`}
                        style={{
                            ...(isRtl ? { right: \`\${line.x1}px\` } : { left: \`\${line.x1}px\` }),
                            top: \`\${line.y1}px\`,
                            height: \`\${isZShape ? (yMid - line.y1) : (line.y2 - line.y1)}px\`,
                            width: '0px'
                        }}
                    />
                    
                    {/* Horizontal segment if Z-shape */}
                    {isZShape && (
                        <div 
                            className={\`absolute border-t-2 border-dashed \${line.color.border} z-10\`}
                            style={{
                                ...(isRtl ? { right: \`\${Math.min(line.x1, line.x2)}px\` } : { left: \`\${Math.min(line.x1, line.x2)}px\` }),
                                top: \`\${yMid}px\`,
                                width: \`\${Math.abs(line.x2 - line.x1)}px\`,
                                height: '0px'
                            }}
                        />
                    )}
                    
                    {/* Second vertical segment down to y2 if Z-shape */}
                    {isZShape && (
                        <div 
                            className={\`absolute border-l-2 border-dashed \${line.color.border} z-10\`}
                            style={{
                                ...(isRtl ? { right: \`\${line.x2}px\` } : { left: \`\${line.x2}px\` }),
                                top: \`\${yMid}px\`,
                                height: \`\${line.y2 - yMid}px\`,
                                width: '0px'
                            }}
                        />
                    )}
                    
                    {/* Arrowhead at destination */}
                    <div 
                        className={\`absolute z-10 \${line.color.text} flex items-center justify-center\`}`;

content = content.replace(oldConnectorRender, newConnectorRender);

// Replace isPartOfChain
content = content.replace(
`            const isPartOfChain = event.kind === 'appointment' && event.raw?.bookingSessionId && chainedSessionIds.has(event.raw.bookingSessionId);`,
`            const chainColor = (event.kind === 'appointment' && event.raw?.bookingSessionId) ? chainedSessionColors.get(event.raw.bookingSessionId) : null;`
);

// Replace classname for ring
content = content.replace(
`className={\`pointer-events-auto relative flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-2 shadow-xs transition-all \${statusTheme.shell} \${isEditable && event.kind !== 'blocked' ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'} \${isPartOfChain ? 'ring-2 ring-amber-400/80 shadow-amber-500/20' : ''}\`}`,
`className={\`pointer-events-auto relative flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-2 shadow-xs transition-all \${statusTheme.shell} \${isEditable && event.kind !== 'blocked' ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'} \${chainColor ? \`ring-2 \${chainColor.ring} \${chainColor.shadow}\` : ''}\`}`
);

// Replace Link2
content = content.replace(
`                    {isPartOfChain && (
                        <div className={\`absolute top-0 \${isRtl ? 'left-0' : 'right-0'} text-amber-500/80 -mt-1 -mr-1\`} title="Chained Journey">`,
`                    {chainColor && (
                        <div className={\`absolute top-0 \${isRtl ? 'left-0' : 'right-0'} \${chainColor.text} -mt-1 -mr-1\`} title="Chained Journey">`
);

fs.writeFileSync(file, content, 'utf8');

