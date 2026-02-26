import { useRef, useState, useEffect } from "react"
import { getAssigneeProfile } from "@/lib/mission/presentation"
import type { AgentHealth } from "@/lib/mission/types"
import { ModularAgent } from "./pixel-assets"
import { getAgentLoadout } from "./pixel-engine"

type Props = {
  agent: AgentHealth
  focused: boolean
  onFocus: () => void
  deskX: number
  totalWidth: number
  isDark: boolean
}

export function AgentCharacterPixel({ agent, focused, onFocus, deskX, totalWidth, isDark }: Props) {
  const profile = getAssigneeProfile(agent.assignee)
  const isWorking = !agent.stale || agent.taskCounts.in_progress > 0
  const loadout = getAgentLoadout(agent.assignee)

  const containerRef = useRef<HTMLDivElement>(null)
  
  // Animation state refs for the loop
  const xRef = useRef(deskX)
  const targetXRef = useRef(deskX)
  const waitFramesRef = useRef(0)
  const requestRef = useRef<number>()

  // React state for rendering the correct SVG frame and label
  const animStateRef = useRef({ action: isWorking ? 'working' : 'idle', facingRight: true })
  const [animState, setAnimState] = useState(animStateRef.current)

  // Reaction bubble state
  const [showReaction, setShowReaction] = useState(false)
  const [reactionMessage, setReactionMessage] = useState("")
  const prevActivityRef = useRef(agent.lastActivityAt)

  useEffect(() => {
    // Show speech bubble if activity updates
    if (agent.lastActivityAt && agent.lastActivityAt !== prevActivityRef.current) {
      setShowReaction(true)
      setReactionMessage(agent.lastActivityMessage || "Working...")
      const t = setTimeout(() => setShowReaction(false), 5000)
      
      prevActivityRef.current = agent.lastActivityAt
      
      return () => clearTimeout(t)
    }
  }, [agent.lastActivityAt, agent.lastActivityMessage])

  const updateAnimState = (action: 'working' | 'walking' | 'idle', facingRight: boolean) => {
    if (animStateRef.current.action !== action || animStateRef.current.facingRight !== facingRight) {
      animStateRef.current = { action, facingRight }
      setAnimState(animStateRef.current)
    }
  }

  useEffect(() => {
    const loop = () => {
      if (isWorking) {
        targetXRef.current = deskX
        if (Math.abs(xRef.current - deskX) > 2) {
          // Walk slightly faster if we have a reaction bubble
          const speed = showReaction ? 4 : 3
          xRef.current += xRef.current < deskX ? speed : -speed
          updateAnimState('walking', xRef.current < deskX)
        } else {
          xRef.current = deskX
          updateAnimState('working', true) // Face right towards desk
        }
      } else {
        // Roaming logic
        if (waitFramesRef.current > 0) {
          waitFramesRef.current--
          updateAnimState('idle', animStateRef.current.facingRight)
        } else {
          if (Math.abs(xRef.current - targetXRef.current) > 2) {
            const speed = showReaction ? 2 : 1
            xRef.current += xRef.current < targetXRef.current ? speed : -speed
            updateAnimState('walking', xRef.current < targetXRef.current)
          } else {
            // Reached target, wait a bit, then pick a new target
            waitFramesRef.current = 60 + Math.random() * 240 // 1 to 5 seconds
            // Pick a new target within bounds, up to 400px away
            const newTarget = xRef.current + (Math.random() - 0.5) * 800
            targetXRef.current = Math.max(50, Math.min(totalWidth - 100, newTarget))
            updateAnimState('idle', animStateRef.current.facingRight)
          }
        }
      }

      if (containerRef.current) {
        containerRef.current.style.transform = `translateX(${xRef.current}px)`
      }
      requestRef.current = requestAnimationFrame(loop)
    }

    requestRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(requestRef.current!)
  }, [isWorking, deskX, totalWidth, showReaction])

  const activityText = !isWorking
    ? "ROAMING"
    : agent.lastActivityMessage
      ? agent.lastActivityMessage.length > 28
        ? `${agent.lastActivityMessage.slice(0, 28)}...`
        : agent.lastActivityMessage
      : "WORKING"

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-0 flex flex-col items-center cursor-pointer group w-24 pointer-events-auto"
      style={{ zIndex: focused ? 50 : 10 }}
      onClick={onFocus}
    >
      {/* Speech Bubble (when they do something) */}
      {showReaction && (
        <div 
          className="absolute -top-20 z-50 animate-bounce bg-white border-[2px] border-black dark:border-white px-3 py-2" 
          style={{ 
            imageRendering: "pixelated", 
            boxShadow: "4px 4px 0 rgba(0,0,0,0.5)",
            minWidth: "120px",
            maxWidth: "200px",
          }}
        >
          <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-b-[2px] border-r-[2px] border-black dark:border-white transform rotate-45" />
          
          <span className="font-mono text-[9px] font-bold uppercase text-black leading-tight line-clamp-3 whitespace-pre-wrap block text-center relative z-10">
            {reactionMessage}
          </span>
        </div>
      )}

      {/* UI Label (Centered above the agent) */}
      <div 
        className={`absolute bottom-24 flex flex-col items-center p-2 border-[2px] transition-colors ${
          focused 
            ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white z-10' 
            : 'bg-white text-black border-gray-300 dark:bg-black dark:text-white dark:border-[#555] group-hover:border-black dark:group-hover:border-white z-0'
        }`} 
        style={{ imageRendering: "pixelated", boxShadow: "4px 4px 0 rgba(0,0,0,0.2)" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase whitespace-nowrap">{profile.displayName}</span>
          <span className="font-mono text-[8px] bg-gray-200 dark:bg-gray-800 text-black dark:text-white px-1 rounded">LVL {loadout.level}</span>
        </div>
        {(focused || isWorking) && (
          <span className={`font-mono text-[9px] uppercase mt-1 whitespace-nowrap max-w-[140px] overflow-hidden text-ellipsis ${
            focused ? 'text-gray-300 dark:text-[#333]' : 'text-gray-500 dark:text-[#888]'
          }`}>
            {activityText}
          </span>
        )}
      </div>

      {/* Character Sprite */}
      <div 
        className={`relative w-24 h-24 flex items-end justify-center transition-transform duration-75 ${
          animState.facingRight ? '' : '-scale-x-100'
        } ${animState.action === 'walking' ? 'pixel-bob' : ''}`}
      >
        <ModularAgent 
          action={animState.action as 'working' | 'walking' | 'idle'} 
          focused={focused} 
          loadout={loadout}
          isDark={isDark}
        />
        
        {/* Selection Marker */}
        {focused && (
          <div className="absolute -bottom-2 w-6 h-1 bg-black dark:bg-white animate-pulse" />
        )}
      </div>
    </div>
  )
}
