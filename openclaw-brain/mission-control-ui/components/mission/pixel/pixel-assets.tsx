import { TimePhase, getThemeColors } from "./pixel-engine"

export function PixelMountains({ phase, isDark, className }: { phase: TimePhase, isDark: boolean, className?: string }) {
  const colors = getThemeColors(phase, isDark)
  return (
    <svg className={`w-full h-full ${className || ""}`} width="100%" height="100%">
      <defs>
        <pattern id="mountains" width="128" height="64" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
          <path d="M0,64 L0,32 L8,32 L8,24 L16,24 L16,16 L32,16 L32,24 L40,24 L40,32 L56,32 L56,16 L64,16 L64,8 L80,8 L80,16 L88,16 L88,24 L104,24 L104,32 L112,32 L112,40 L128,40 L128,64 Z" fill={colors.mountains} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mountains)" />
    </svg>
  )
}

export function PixelBuildings({ phase, isDark, className }: { phase: TimePhase, isDark: boolean, className?: string }) {
  const colors = getThemeColors(phase, isDark)
  const winColor = colors.windows
  const bldgColor = colors.buildings

  return (
    <svg className={`w-full h-full ${className || ""}`} width="100%" height="100%">
      <defs>
        <pattern id="buildings" width="256" height="64" patternUnits="userSpaceOnUse" patternTransform="scale(2)">
          {/* Building 1 */}
          <rect x="16" y="32" width="32" height="32" fill={bldgColor} />
          <rect x="24" y="24" width="16" height="8" fill={bldgColor} />
          <rect x="20" y="40" width="8" height="8" fill={winColor} />
          <rect x="36" y="40" width="8" height="8" fill={winColor} />
          
          {/* Building 2 */}
          <rect x="100" y="16" width="48" height="48" fill={bldgColor} />
          <rect x="108" y="8" width="16" height="8" fill={bldgColor} />
          <rect x="112" y="24" width="8" height="8" fill={winColor} />
          <rect x="132" y="24" width="8" height="8" fill={winColor} />
          <rect x="112" y="40" width="8" height="8" fill={winColor} />
          <rect x="132" y="40" width="8" height="8" fill={winColor} />
          
          {/* Building 3 */}
          <rect x="190" y="24" width="24" height="40" fill={bldgColor} />
          <rect x="196" y="16" width="12" height="8" fill={bldgColor} />
          <rect x="196" y="32" width="12" height="8" fill={winColor} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#buildings)" />
    </svg>
  )
}

export function PixelCrate({ isDark, className }: { isDark: boolean, className?: string }) {
  const main = isDark ? "#4b5563" : "#9ca3af";
  const border = isDark ? "#1f2937" : "#4b5563";
  const highlight = isDark ? "#6b7280" : "#d1d5db";
  return (
    <svg className={className} width="100%" height="100%" viewBox="0 0 16 16" shapeRendering="crispEdges">
      <rect x="0" y="0" width="16" height="16" fill={border} />
      <rect x="1" y="1" width="14" height="14" fill={main} />
      <rect x="1" y="1" width="14" height="1" fill={highlight} />
      <rect x="1" y="1" width="1" height="14" fill={highlight} />
      {/* X pattern */}
      <rect x="2" y="2" width="2" height="2" fill={border} />
      <rect x="4" y="4" width="2" height="2" fill={border} />
      <rect x="6" y="6" width="4" height="4" fill={border} />
      <rect x="10" y="10" width="2" height="2" fill={border} />
      <rect x="12" y="12" width="2" height="2" fill={border} />
      <rect x="12" y="2" width="2" height="2" fill={border} />
      <rect x="10" y="4" width="2" height="2" fill={border} />
      <rect x="4" y="10" width="2" height="2" fill={border} />
      <rect x="2" y="12" width="2" height="2" fill={border} />
    </svg>
  )
}

export function ModularDesk({ level, todoCount, isDark }: { level: number, todoCount: number, isDark: boolean }) {
  // Higher resolution 32x32 grid for desks
  const deskColor = isDark ? "#333" : "#9ca3af"
  const legColor = isDark ? "#111" : "#4b5563"
  const screenColor = isDark ? "#555" : "#d1d5db"
  const screenGlow = isDark ? "#fff" : "#fff"
  const codeColor = isDark ? "#000" : "#9ca3af"
  const serverColor = isDark ? "#222" : "#6b7280"
  const ledColor = "#10b981" // Green LED

  return (
    <svg width="96" height="96" viewBox="0 0 32 32" shapeRendering="crispEdges">
      {/* Base Desk (scales with level) */}
      <rect x={16 - level * 2} y="16" width={level * 4} height="4" fill={deskColor} />
      <rect x={16 - level * 2 + 2} y="20" width="2" height="12" fill={legColor} />
      <rect x={16 + level * 2 - 4} y="20" width="2" height="12" fill={legColor} />

      {/* Level 1: Basic Monitor */}
      {level >= 1 && (
        <>
          <rect x="14" y="14" width="4" height="2" fill={legColor} />
          <rect x="10" y="6" width="12" height="8" fill={screenColor} />
          <rect x="11" y="7" width="10" height="6" fill={screenGlow} />
          <rect x="12" y="8" width="6" height="1" fill={codeColor} />
          <rect x="12" y="10" width="4" height="1" fill={codeColor} />
        </>
      )}

      {/* Level 2: Dual Monitor */}
      {level >= 2 && (
        <>
          <rect x="23" y="14" width="2" height="2" fill={legColor} />
          <rect x="22" y="8" width="8" height="6" fill={screenColor} />
          <rect x="23" y="9" width="6" height="4" fill={screenGlow} />
          <rect x="24" y="10" width="4" height="1" fill={codeColor} />
        </>
      )}

      {/* Level 3: Server Rack Under Desk */}
      {level >= 3 && (
        <>
          <rect x={16 - level * 2 + 4} y="20" width="6" height="12" fill={serverColor} />
          <rect x={16 - level * 2 + 5} y="22" width="1" height="1" fill={ledColor} />
          <rect x={16 - level * 2 + 7} y="22" width="1" height="1" fill={ledColor} />
          <rect x={16 - level * 2 + 5} y="26" width="4" height="1" fill={legColor} />
        </>
      )}

      {/* Level 4: Vertical Hacker Monitor */}
      {level >= 4 && (
        <>
          <rect x="5" y="14" width="2" height="2" fill={legColor} />
          <rect x="2" y="4" width="8" height="10" fill={screenColor} />
          <rect x="3" y="5" width="6" height="8" fill={screenGlow} />
          <rect x="4" y="6" width="4" height="1" fill={codeColor} />
          <rect x="4" y="8" width="2" height="1" fill={codeColor} />
          <rect x="4" y="10" width="4" height="1" fill={codeColor} />
        </>
      )}

      {/* Level 5: Holographic Emitters */}
      {level >= 5 && (
        <>
          <rect x="0" y="15" width="2" height="1" fill={ledColor} />
          <rect x="30" y="15" width="2" height="1" fill={ledColor} />
          {/* Holo screens (transparent/dotted) */}
          <rect x="0" y="0" width="8" height="6" fill={ledColor} opacity="0.3" />
          <rect x="24" y="0" width="8" height="6" fill={ledColor} opacity="0.3" />
        </>
      )}

      {/* Clutter based on Todo Count */}
      {todoCount > 0 && (
        <>
          <rect x="11" y="14" width="2" height="2" fill="#fff" /> {/* Coffee cup */}
        </>
      )}
      {todoCount > 2 && (
        <>
          <rect x={16 + level * 2 - 6} y="13" width="4" height="3" fill="#fff" /> {/* Papers */}
          <rect x={16 + level * 2 - 5} y="14" width="2" height="1" fill={codeColor} />
        </>
      )}
      {todoCount > 5 && (
        <>
          <rect x={16 - level * 2 + 1} y="10" width="5" height="6" fill="#fff" /> {/* Huge stack */}
          <rect x={16 - level * 2 + 2} y="11" width="3" height="1" fill={codeColor} />
          <rect x={16 - level * 2 + 2} y="13" width="3" height="1" fill={codeColor} />
        </>
      )}
    </svg>
  )
}

export function ModularAgent({ 
  action, 
  focused, 
  loadout, 
  isDark 
}: { 
  action: 'working' | 'walking' | 'idle', 
  focused: boolean, 
  loadout: any,
  isDark: boolean
}) {
  // Higher resolution 32x32 grid for characters
  const isWorking = action === 'working';
  
  // Base colors
  const primary = focused ? (isDark ? "#fff" : "#000") : (isDark ? "#aaa" : "#555");
  const secondary = focused ? (isDark ? "#ccc" : "#333") : (isDark ? "#666" : "#888");
  const accent = focused ? "#10b981" : (isDark ? "#444" : "#ccc");
  const eyeColor = isDark ? "#000" : "#fff";

  // Animation offsets
  const bobY = action === 'walking' ? 1 : 0;
  const armX = isWorking ? 4 : 0;
  const armY = isWorking ? -2 : 0;

  return (
    <svg width="96" height="96" viewBox="0 0 32 32" shapeRendering="crispEdges">
      <g transform={`translate(0, ${bobY})`}>
        
        {/* ACCESSORY (Backpack/Cape) rendered behind body */}
        {loadout.accessory === 1 && (
          <rect x="6" y="12" width="4" height="8" fill={secondary} /> // Backpack
        )}
        {loadout.accessory === 2 && (
          <rect x="6" y="12" width="6" height="12" fill={accent} /> // Cape
        )}

        {/* BODY TYPE */}
        {loadout.bodyType === 0 && ( // Bipedal
          <>
            <rect x="10" y="12" width="12" height="10" fill={primary} />
            <rect x="10" y="22" width="4" height="6" fill={secondary} />
            <rect x="18" y="22" width="4" height="6" fill={secondary} />
          </>
        )}
        {loadout.bodyType === 1 && ( // Tread (Tank)
          <>
            <rect x="10" y="12" width="12" height="10" fill={primary} />
            <rect x="8" y="22" width="16" height="6" fill={secondary} />
            <rect x="10" y="24" width="2" height="2" fill={accent} />
            <rect x="15" y="24" width="2" height="2" fill={accent} />
            <rect x="20" y="24" width="2" height="2" fill={accent} />
          </>
        )}
        {loadout.bodyType === 2 && ( // Hover
          <>
            <rect x="10" y="12" width="12" height="10" fill={primary} />
            <rect x="12" y="22" width="8" height="4" fill={secondary} />
            <rect x="14" y="26" width="4" height="4" fill="#f59e0b" /> {/* Flame */}
          </>
        )}
        {loadout.bodyType === 3 && ( // Spider
          <>
            <rect x="10" y="14" width="12" height="8" fill={primary} />
            <rect x="6" y="20" width="4" height="2" fill={secondary} />
            <rect x="6" y="22" width="2" height="6" fill={secondary} />
            <rect x="22" y="20" width="4" height="2" fill={secondary} />
            <rect x="24" y="22" width="2" height="6" fill={secondary} />
            <rect x="12" y="22" width="2" height="6" fill={secondary} />
            <rect x="18" y="22" width="2" height="6" fill={secondary} />
          </>
        )}

        {/* HEAD TYPE */}
        <g transform="translate(0, -2)">
          {loadout.headType === 0 && ( // Visor
            <>
              <rect x="10" y="4" width="12" height="10" fill={primary} />
              <rect x="14" y="6" width="10" height="4" fill={eyeColor} />
            </>
          )}
          {loadout.headType === 1 && ( // Cyclops
            <>
              <rect x="12" y="4" width="8" height="10" fill={primary} />
              <rect x="14" y="6" width="6" height="6" fill={eyeColor} />
              <rect x="16" y="8" width="2" height="2" fill={accent} />
            </>
          )}
          {loadout.headType === 2 && ( // TV Screen
            <>
              <rect x="8" y="4" width="16" height="10" fill={primary} />
              <rect x="10" y="6" width="12" height="6" fill={accent} />
              <rect x="12" y="8" width="2" height="2" fill={eyeColor} />
              <rect x="18" y="8" width="2" height="2" fill={eyeColor} />
            </>
          )}
          {loadout.headType === 3 && ( // Brain in Jar
            <>
              <rect x="10" y="4" width="12" height="10" fill={accent} opacity="0.6" />
              <rect x="12" y="6" width="8" height="6" fill="#ec4899" /> {/* Pink brain */}
              <rect x="10" y="14" width="12" height="2" fill={secondary} />
            </>
          )}
          {loadout.headType === 4 && ( // Cat Ears
            <>
              <rect x="10" y="2" width="4" height="4" fill={primary} />
              <rect x="18" y="2" width="4" height="4" fill={primary} />
              <rect x="10" y="6" width="12" height="8" fill={primary} />
              <rect x="12" y="8" width="2" height="2" fill={eyeColor} />
              <rect x="18" y="8" width="2" height="2" fill={eyeColor} />
            </>
          )}
        </g>

        {/* ACCESSORY (Front) */}
        {loadout.accessory === 3 && ( // Antenna on head
          <>
            <rect x="14" y="-4" width="2" height="6" fill={secondary} />
            <rect x="14" y="-6" width="2" height="2" fill="#10b981" />
          </>
        )}

        {/* ARM (Reaches out when working) */}
        <rect x={14 + armX} y={14 + armY} width="8" height="4" fill={primary} />
        
        {/* Tiny Crate being held/worked on */}
        {isWorking && (
          <g transform={`translate(${16 + armX}, ${8 + armY})`}>
            <rect x="0" y="0" width="8" height="8" fill={isDark ? "#4b5563" : "#9ca3af"} />
            <rect x="0" y="0" width="8" height="8" fill="none" stroke={isDark ? "#1f2937" : "#4b5563"} strokeWidth="1" />
            <path d="M0,0 L8,8 M8,0 L0,8" stroke={isDark ? "#1f2937" : "#4b5563"} strokeWidth="1" />
          </g>
        )}
        
      </g>
    </svg>
  )
}
