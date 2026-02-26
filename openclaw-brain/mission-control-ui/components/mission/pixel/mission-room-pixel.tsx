"use client"

import { useRef, useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { AgentCharacterPixel } from "./agent-character-pixel"
import { PixelMountains, PixelBuildings, ModularDesk, PixelCrate } from "./pixel-assets"
import { TimePhase, getThemeColors, getAgentLoadout } from "./pixel-engine"
import type { AgentHealth, Assignee } from "@/lib/mission/types"

type Props = {
  health: AgentHealth[]
  queueSize: number
  focusedAssignee?: Assignee
  onFocusAssignee: (assignee: Assignee) => void
}

const DESK_SPACING = 300 // Increased spacing for larger desks

export function MissionRoomPixel({ health, queueSize, focusedAssignee, onFocusAssignee }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  // Day/Night Cycle State
  const [timePhase, setTimePhase] = useState<TimePhase>('day')

  useEffect(() => {
    const updateTime = () => {
      const hour = new Date().getHours()
      if (hour >= 20 || hour < 6) setTimePhase('night')
      else if (hour >= 18) setTimePhase('evening')
      else if (hour >= 6 && hour < 8) setTimePhase('morning')
      else setTimePhase('day')
    }
    updateTime()
    const interval = setInterval(updateTime, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [])

  const totalWidth = Math.max(1200, health.length * DESK_SPACING + 200)

  useEffect(() => {
    if (focusedAssignee && scrollRef.current) {
      const index = health.findIndex(a => a.assignee === focusedAssignee)
      if (index !== -1) {
        const deskX = index * DESK_SPACING + 100
        const container = scrollRef.current
        const scrollLeft = deskX - container.clientWidth / 2 + 48 // 48 is half of new agent width
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
      }
    }
  }, [focusedAssignee, health])

  // Return null if no agents to render
  if (!health.length) return null

  const colors = getThemeColors(timePhase, isDark)

  return (
    <div 
      className="fixed bottom-0 left-0 w-full h-[240px] z-50 pointer-events-none overflow-x-auto overflow-y-hidden select-none custom-scrollbar transition-colors duration-1000" 
      ref={scrollRef}
      style={{ 
        imageRendering: "pixelated",
        background: `linear-gradient(to top, ${colors.bg} 0%, ${colors.bg} 60%, transparent 100%)`
      }}
    >
      <style>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .pixel-bob { animation: bob 0.4s infinite steps(2); }
        
        @keyframes belt-move {
          from { background-position: 0 0; }
          to { background-position: 64px 0; }
        }
        .animate-belt { animation: belt-move 3s linear infinite; }
        
        @keyframes move-crate {
          from { transform: translateX(0); }
          to { transform: translateX(${totalWidth + 200}px); }
        }
        .animate-crate { animation: move-crate 40s linear infinite; }
        
        /* Hide scrollbar since it's an overlay */
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .custom-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      {/* Container to hold the wide scrolling content */}
      <div className="relative h-full" style={{ width: `${totalWidth}px` }}>
        {/* Background Layers */}
        <div className="absolute top-0 left-0 h-full w-full pointer-events-none">
          <div className="absolute top-[10%] left-0 w-full h-[50%] opacity-40">
            <PixelMountains phase={timePhase} isDark={isDark} />
          </div>
          <div className="absolute top-[30%] left-0 w-full h-[40%] opacity-60">
            <PixelBuildings phase={timePhase} isDark={isDark} />
          </div>
        </div>

        {/* Conveyor Belt Ground */}
        <div 
          className="absolute bottom-0 left-0 h-[20%] w-full border-t-[4px] pointer-events-none transition-colors duration-1000 z-0" 
          style={{ backgroundColor: isDark ? '#111' : '#ccc', borderColor: colors.buildings }}
        >
          {/* Belt texture */}
          <div 
            className="absolute top-2 left-0 w-full h-2 opacity-40 animate-belt" 
            style={{ 
              backgroundImage: `linear-gradient(to right, ${colors.primary} 50%, transparent 50%)`, 
              backgroundSize: '64px 100%',
            }} 
          />
          <div 
            className="absolute top-6 left-0 w-full h-1 opacity-20 animate-belt" 
            style={{ 
              backgroundImage: `linear-gradient(to right, ${colors.primary} 50%, transparent 50%)`, 
              backgroundSize: '32px 100%',
            }} 
          />
        </div>

        {/* Global Queue: Moving Crates on Conveyor Belt */}
        {Array.from({ length: Math.min(queueSize, 15) }).map((_, i) => (
          <div 
            key={`queue-crate-${i}`} 
            className="absolute bottom-2 w-8 h-8 opacity-90 animate-crate z-10"
            style={{ 
              animationDelay: `${i * -3.7}s`,
              left: '-50px', // Start offscreen left
            }}
          >
            <PixelCrate isDark={isDark} />
          </div>
        ))}

        {/* Agent Todo Piles (Stacked next to their desks) */}
        <div className="absolute bottom-[20%] left-0 h-24 w-full pointer-events-none z-10">
          {health.map((agent, i) => {
            const deskX = i * DESK_SPACING + 100
            const todoCount = agent.taskCounts.todo
            return Array.from({ length: Math.min(todoCount, 12) }).map((_, j) => {
              const row = j % 3
              const col = Math.floor(j / 3)
              return (
                <div 
                  key={`agent-${agent.assignee}-crate-${j}`} 
                  className="absolute w-8 h-8 opacity-90"
                  style={{ 
                    left: deskX - 48 + row * 16 + (col % 2) * 8, 
                    bottom: col * 20,
                    zIndex: 20 - col
                  }}
                >
                  <PixelCrate isDark={isDark} />
                </div>
              )
            })
          })}
        </div>

        {/* Desks Layer */}
        <div className="absolute bottom-[20%] left-0 h-24 w-full pointer-events-none z-20">
          {health.map((agent, i) => {
            const deskX = i * DESK_SPACING + 100
            const loadout = getAgentLoadout(agent.assignee)
            return (
              <div key={`desk-${agent.assignee}`} className="absolute bottom-0 w-24 h-24 opacity-90" style={{ left: deskX }}>
                <ModularDesk level={loadout.level} todoCount={agent.taskCounts.todo} isDark={isDark} />
              </div>
            )
          })}
        </div>

        {/* Agents Layer - Must be pointer-events-auto to catch clicks */}
        <div className="absolute bottom-[20%] left-0 h-24 w-full pointer-events-none z-30">
          {health.map((agent, i) => {
            const deskX = i * DESK_SPACING + 100
            return (
              <AgentCharacterPixel
                key={agent.assignee}
                agent={agent}
                focused={focusedAssignee === agent.assignee}
                onFocus={() => onFocusAssignee(agent.assignee)}
                deskX={deskX}
                totalWidth={totalWidth}
                isDark={isDark}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
