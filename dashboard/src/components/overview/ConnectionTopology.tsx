import { useMemo, useState } from 'react'
import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from 'recharts'
import { Network, Maximize2, Minimize2 } from 'lucide-react'
import { useOverviewStore } from '@/stores/overview'
import { formatBytes } from '@/lib/format'
import type { Connection } from '@/lib/mihomo-api'

// depth: 0=source, 1=rules, 2=groups, 3=outbound
const DEPTH_COLORS: Record<number, string> = {
  0: 'var(--chart-1)',
  1: 'var(--chart-2)',
  2: 'var(--chart-3)',
  3: 'var(--chart-5)',
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

function SankeyNode({
  x,
  y,
  width,
  height,
  index,
  payload,
}: {
  x: number
  y: number
  width: number
  height: number
  index: number
  payload: { name: string; depth: number }
}) {
  const color = DEPTH_COLORS[payload.depth] ?? 'var(--chart-4)'
  const isSource = payload.depth === 0
  const maxLen = payload.depth === 1 ? 28 : 18

  return (
    <Layer key={`node-${index}`}>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        fillOpacity={0.85}
        rx={2}
      />
      {height >= 12 && (
        <text
          x={isSource ? x - 6 : x + width + 6}
          y={y + height / 2}
          textAnchor={isSource ? 'end' : 'start'}
          dominantBaseline="central"
          style={{
            fontSize: 11,
            fontFamily: 'Inter, sans-serif',
            fill: 'var(--foreground)',
          }}
        >
          {truncate(payload.name, maxLen)}
        </text>
      )}
    </Layer>
  )
}

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  fontFamily: 'Inter, sans-serif',
}

interface SankeyData {
  nodes: { name: string }[]
  links: { source: number; target: number; value: number }[]
}

function buildSankeyData(
  connections: Connection[],
  maxRules: number
): SankeyData | null {
  if (connections.length === 0) return null

  // Aggregate per-connection data
  const srcTraffic = new Map<string, number>()
  const groupTraffic = new Map<string, number>()
  const outboundTraffic = new Map<string, number>()
  const srcToRule = new Map<string, Map<string, number>>()
  const ruleToGroup = new Map<string, Map<string, number>>()
  const groupToOut = new Map<string, Map<string, number>>()

  for (const conn of connections) {
    const source = conn.metadata.sourceIP || 'unknown'
    const ruleName =
      conn.rule + (conn.rulePayload ? ': ' + conn.rulePayload : '')
    const chains = conn.chains || []
    const group = chains.length > 0 ? chains[chains.length - 1] : 'DIRECT'
    const outbound = chains.length >= 2 ? chains[chains.length - 2] : group
    const traffic = conn.download + conn.upload

    srcTraffic.set(source, (srcTraffic.get(source) || 0) + traffic)
    groupTraffic.set(group, (groupTraffic.get(group) || 0) + traffic)
    outboundTraffic.set(
      outbound,
      (outboundTraffic.get(outbound) || 0) + traffic
    )

    // src → rule
    if (!srcToRule.has(source)) srcToRule.set(source, new Map())
    const sr = srcToRule.get(source)!
    sr.set(ruleName, (sr.get(ruleName) || 0) + traffic)

    // rule → group
    if (!ruleToGroup.has(ruleName)) ruleToGroup.set(ruleName, new Map())
    const rg = ruleToGroup.get(ruleName)!
    rg.set(group, (rg.get(group) || 0) + traffic)

    // group → outbound
    if (!groupToOut.has(group)) groupToOut.set(group, new Map())
    const go = groupToOut.get(group)!
    go.set(outbound, (go.get(outbound) || 0) + traffic)
  }

  // Top rules by traffic
  const ruleTotal = new Map<string, number>()
  for (const [rule, gmap] of ruleToGroup) {
    let total = 0
    for (const v of gmap.values()) total += v
    ruleTotal.set(rule, total)
  }

  const rules = [...ruleTotal.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxRules)
    .map(([name]) => name)
  const ruleSet = new Set(rules)

  // Sources (all)
  const sources = [...srcTraffic.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)

  // Groups & outbounds referenced by visible rules
  const usedGroups = new Set<string>()
  const usedOutbounds = new Set<string>()

  for (const conn of connections) {
    const ruleName =
      conn.rule + (conn.rulePayload ? ': ' + conn.rulePayload : '')
    if (!ruleSet.has(ruleName)) continue
    const chains = conn.chains || []
    const group = chains.length > 0 ? chains[chains.length - 1] : 'DIRECT'
    const outbound = chains.length >= 2 ? chains[chains.length - 2] : group
    usedGroups.add(group)
    usedOutbounds.add(outbound)
  }

  const groups = [...usedGroups].sort(
    (a, b) => (groupTraffic.get(b) || 0) - (groupTraffic.get(a) || 0)
  )
  const outbounds = [...usedOutbounds].sort(
    (a, b) => (outboundTraffic.get(b) || 0) - (outboundTraffic.get(a) || 0)
  )

  // If groups === outbounds (all DIRECT), use 3 columns instead of 4
  const groupsEqualOutbounds =
    groups.length === outbounds.length &&
    groups.every((g, i) => g === outbounds[i])

  // Build nodes: [sources, rules, groups?, outbounds]
  const nodes: { name: string }[] = groupsEqualOutbounds
    ? [
        ...sources.map((s) => ({ name: s })),
        ...rules.map((r) => ({ name: r })),
        ...outbounds.map((o) => ({ name: o })),
      ]
    : [
        ...sources.map((s) => ({ name: s })),
        ...rules.map((r) => ({ name: r })),
        ...groups.map((g) => ({ name: g })),
        ...outbounds.map((o) => ({ name: o })),
      ]

  // Index maps
  const srcIdx = new Map(sources.map((s, i) => [s, i]))
  const ruleOff = sources.length
  const ruleIdx = new Map(rules.map((r, i) => [r, ruleOff + i]))

  let grpIdx: Map<string, number>
  let outIdx: Map<string, number>

  if (groupsEqualOutbounds) {
    const off = ruleOff + rules.length
    outIdx = new Map(outbounds.map((o, i) => [o, off + i]))
    grpIdx = outIdx
  } else {
    const grpOff = ruleOff + rules.length
    const outOff = grpOff + groups.length
    grpIdx = new Map(groups.map((g, i) => [g, grpOff + i]))
    outIdx = new Map(outbounds.map((o, i) => [o, outOff + i]))
  }

  // Build links
  const linkMap = new Map<string, number>()

  // source → rule
  for (const [source, rmap] of srcToRule) {
    const si = srcIdx.get(source)
    if (si === undefined) continue
    for (const [rule, traffic] of rmap) {
      if (!ruleSet.has(rule)) continue
      const ri = ruleIdx.get(rule)
      if (ri !== undefined) {
        const k = `${si}-${ri}`
        linkMap.set(k, (linkMap.get(k) || 0) + traffic)
      }
    }
  }

  // rule → group (or rule → outbound if collapsed)
  for (const rule of rules) {
    const gmap = ruleToGroup.get(rule)
    if (!gmap) continue
    const ri = ruleIdx.get(rule)
    if (ri === undefined) continue
    for (const [group, traffic] of gmap) {
      const targetIdx = groupsEqualOutbounds
        ? outIdx.get(group)
        : grpIdx.get(group)
      if (targetIdx !== undefined) {
        const k = `${ri}-${targetIdx}`
        linkMap.set(k, (linkMap.get(k) || 0) + traffic)
      }
    }
  }

  // group → outbound (only when 4 columns)
  if (!groupsEqualOutbounds) {
    for (const [group, omap] of groupToOut) {
      const gi = grpIdx.get(group)
      if (gi === undefined) continue
      for (const [outbound, traffic] of omap) {
        const oi = outIdx.get(outbound)
        if (oi !== undefined) {
          const k = `${gi}-${oi}`
          linkMap.set(k, (linkMap.get(k) || 0) + traffic)
        }
      }
    }
  }

  // Log scale so small flows are still visible
  const links = [...linkMap.entries()]
    .map(([key, rawValue]) => {
      const [source, target] = key.split('-').map(Number)
      return { source, target, value: Math.max(Math.log2(rawValue + 1), 1) }
    })
    .filter((l) => l.value > 0)

  if (links.length === 0) return null
  return { nodes, links }
}

const COMPACT_RULES = 10
const EXPANDED_RULES = 30

export function ConnectionTopologyCard() {
  const connections = useOverviewStore((s) => s.connections)
  const [expanded, setExpanded] = useState(false)

  const maxRules = expanded ? EXPANDED_RULES : COMPACT_RULES

  const sankeyData = useMemo(
    () => buildSankeyData(connections, maxRules),
    [connections, maxRules]
  )

  const chartHeight = useMemo(() => {
    if (!sankeyData) return 200
    if (!expanded) return 280
    return Math.max(400, Math.min(sankeyData.nodes.length * 18, 700))
  }, [sankeyData, expanded])

  return (
    <div className="rounded-xl border bg-card p-4 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <Network className="size-4" />
        <span className="text-sm font-medium">Топология соединений</span>
        {sankeyData && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto p-1 rounded-md hover:bg-accent text-muted-foreground transition-colors"
            title={expanded ? 'Свернуть' : 'Развернуть'}
          >
            {expanded ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </button>
        )}
      </div>
      {!sankeyData ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Нет активных соединений
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <Sankey
            data={sankeyData}
            nodeWidth={8}
            nodePadding={expanded ? 5 : 8}
            linkCurvature={0.4}
            iterations={64}
            margin={{ left: 100, right: 110, top: 4, bottom: 4 }}
            node={
              <SankeyNode
                x={0}
                y={0}
                width={0}
                height={0}
                index={0}
                payload={{ name: '', depth: 0 }}
              />
            }
            link={{ stroke: 'var(--muted-foreground)', strokeOpacity: 0.12 }}
          >
            <Tooltip
              formatter={((value: number | undefined) => [
                formatBytes(Math.pow(2, value ?? 0) - 1),
                'Трафик',
              ]) as never}
              contentStyle={TOOLTIP_STYLE}
            />
          </Sankey>
        </ResponsiveContainer>
      )}
    </div>
  )
}
