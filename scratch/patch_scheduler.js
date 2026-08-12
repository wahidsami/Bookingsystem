const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../Tenant-v2/src/components/SchedulerGrid.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add Link2 to lucide-react import
content = content.replace(
  "import { Users, ChevronDown } from 'lucide-react';",
  "import { Users, ChevronDown, Link2 } from 'lucide-react';"
);

if (content.includes("Link2") && !content.includes("ChevronDown, Link2")) {
    content = content.replace(
      "import { Users, ChevronDown }",
      "import { Users, ChevronDown, Link2 }"
    );
}

// 2. Add chain computation
const chainComputationCode = `    return positioned;
  }, [columns, events, slotMinutes]);

  const chainedSessionIds = useMemo(() => {
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
  }, [positionedEvents]);

  const chainConnectors = useMemo(() => {
    const groups = new Map<string, typeof positionedEvents>();
    for (const ev of positionedEvents) {
        if (ev.kind !== 'appointment' || !ev.raw?.bookingSessionId) continue;
        const sid = ev.raw.bookingSessionId;
        if (!groups.has(sid)) groups.set(sid, []);
        groups.get(sid)!.push(ev);
    }
    
    const lines: Array<{
      key: string;
      x1: number; y1: number;
      x2: number; y2: number;
      isSameColumn: boolean;
    }> = [];
    
    Array.from(groups.values()).forEach(group => {
        if (group.length <= 1) return;
        
        // Sort chronologically
        group.sort((a,b) => a.startMinutes - b.startMinutes);
        
        for (let i = 0; i < group.length - 1; i++) {
            const ev1 = group[i];
            const ev2 = group[i+1];
            
            const colIdx1 = getColumnIndex(ev1.columnId);
            const colIdx2 = getColumnIndex(ev2.columnId);
            if (colIdx1 === -1 || colIdx2 === -1) continue;
            
            const cellWidth = Math.max(50, staffColumnWidth);
            
            // Calc x1, y1
            const top1 = (Math.max(0, ev1.startMinutes) / slotMinutes) * slotHeight;
            const height1 = Math.max(slotHeight, (Math.max(ev1.durationMinutes, slotMinutes) / slotMinutes) * slotHeight);
            const laneWidthPx1 = cellWidth / Math.max(1, ev1.laneCount);
            const eventCardWidth1 = laneWidthPx1 - 8;
            const inlineStart1 = (colIdx1 * cellWidth) + (ev1.laneIndex * laneWidthPx1);
            const cx1 = inlineStart1 + (eventCardWidth1 / 2);
            const y1 = top1 + height1;
            
            // Calc x2, y2
            const top2 = (Math.max(0, ev2.startMinutes) / slotMinutes) * slotHeight;
            const laneWidthPx2 = cellWidth / Math.max(1, ev2.laneCount);
            const eventCardWidth2 = laneWidthPx2 - 8;
            const inlineStart2 = (colIdx2 * cellWidth) + (ev2.laneIndex * laneWidthPx2);
            const cx2 = inlineStart2 + (eventCardWidth2 / 2);
            const y2 = top2;
            
            lines.push({
                key: \`chain-\${ev1.id}-\${ev2.id}\`,
                x1: cx1,
                y1,
                x2: cx2,
                y2,
                isSameColumn: colIdx1 === colIdx2
            });
        }
    });
    
    return lines;
  }, [positionedEvents, slotMinutes, slotHeight, staffColumnWidth, getColumnIndex]);

  return (`;
content = content.replace(
`    return positioned;
  }, [columns, events, slotMinutes]);

  return (`, chainComputationCode);

// 3. Render connectors
const connectorRenderCode = `
        <div
          className="pointer-events-none absolute inset-y-0 z-20 overflow-hidden"
          style={eventLayerInsetStyle}
        >
          {chainConnectors.map(line => {
            const yMid = line.y1 + Math.max(10, (line.y2 - line.y1) / 2);
            const isZShape = !line.isSameColumn;
            
            return (
                <div key={line.key} className="pointer-events-none absolute inset-0">
                    {/* First vertical segment down from y1 */}
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
                        className="absolute z-10 text-amber-500 flex items-center justify-center"
                        style={{
                            ...(isRtl ? { right: \`\${line.x2 - 6}px\` } : { left: \`\${line.x2 - 6}px\` }),
                            top: \`\${line.y2 - 6}px\`,
                            width: '12px',
                            height: '12px'
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 10l5 5 5-5z" />
                        </svg>
                    </div>
                </div>
            );
          })}
`;
content = content.replace(
`        <div
          className="pointer-events-none absolute inset-y-0 z-20 overflow-hidden"
          style={eventLayerInsetStyle}
        >`, connectorRenderCode);

// 4. Update Event card rendering to highlight chain
const highlightLogicCode = `
            const isCompact = height < 42;
            const isMedium = height >= 42 && height < 64;
            const showStatusMeta = showAppointmentStatusBadges;
            
            const isPartOfChain = event.kind === 'appointment' && event.raw?.bookingSessionId && chainedSessionIds.has(event.raw.bookingSessionId);

            return (
`;
content = content.replace(
`            const isCompact = height < 42;
            const isMedium = height >= 42 && height < 64;
            const showStatusMeta = showAppointmentStatusBadges;

            return (`, highlightLogicCode);

// 5. Update card CSS
const cardCSSCode = `className={\`pointer-events-auto relative flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-2 shadow-xs transition-all \${statusTheme.shell} \${isEditable && event.kind !== 'blocked' ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'} \${isPartOfChain ? 'ring-2 ring-amber-400/80 shadow-amber-500/20' : ''}\`}`;
content = content.replace(
`className={\`pointer-events-auto relative flex h-full min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-2 shadow-xs transition-all \${statusTheme.shell} \${isEditable && event.kind !== 'blocked' ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'cursor-default'}\`}`,
cardCSSCode
);

// 6. Add Link icon to card top right
const topBarCode = `                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <div className={\`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[10px] font-black \${statusTheme.staffAvatar}\`}>`;

const replacementTopBar = `                  <div className="flex min-w-0 items-start justify-between gap-2 relative">
                    {isPartOfChain && (
                        <div className={\`absolute top-0 \${isRtl ? 'left-0' : 'right-0'} text-amber-500/80 -mt-1 -mr-1\`} title="Chained Journey">
                             <Link2 size={14} />
                        </div>
                    )}
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <div className={\`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[10px] font-black \${statusTheme.staffAvatar}\`}>`;

content = content.replace(topBarCode, replacementTopBar);

fs.writeFileSync(file, content, 'utf8');
