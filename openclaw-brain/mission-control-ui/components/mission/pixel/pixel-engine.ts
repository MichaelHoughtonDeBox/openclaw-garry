export type TimePhase = 'day' | 'night' | 'morning' | 'evening';

export function getThemeColors(phase: TimePhase, isDarkMode: boolean) {
  // We maintain the stark monochrome/grayscale vibe, but shift the values based on time of day.
  if (phase === 'night') {
    return {
      bg: isDarkMode ? '#050505' : '#111111',
      sky: isDarkMode ? '#0a0a0a' : '#1a1a1a',
      mountains: isDarkMode ? '#111' : '#222',
      buildings: isDarkMode ? '#1a1a1a' : '#2a2a2a',
      windows: '#ffffff', // Glowing white windows at night
      ground: isDarkMode ? '#080808' : '#151515',
      primary: '#ffffff',
      secondary: '#888888',
    }
  }
  if (phase === 'evening' || phase === 'morning') {
    return {
      bg: isDarkMode ? '#111' : '#d4d4d4',
      sky: isDarkMode ? '#151515' : '#cccccc',
      mountains: isDarkMode ? '#222' : '#a3a3a3',
      buildings: isDarkMode ? '#333' : '#737373',
      windows: isDarkMode ? '#555' : '#e5e5e5',
      ground: isDarkMode ? '#1a1a1a' : '#b5b5b5',
      primary: isDarkMode ? '#eee' : '#222',
      secondary: isDarkMode ? '#777' : '#555',
    }
  }
  // Day
  return {
    bg: isDarkMode ? '#1a1a1a' : '#f9fafb',
    sky: isDarkMode ? '#222' : '#f3f4f6',
    mountains: isDarkMode ? '#333' : '#e5e7eb',
    buildings: isDarkMode ? '#444' : '#d1d5db',
    windows: isDarkMode ? '#222' : '#f9fafb',
    ground: isDarkMode ? '#2a2a2a' : '#e5e5e5',
    primary: isDarkMode ? '#fff' : '#000',
    secondary: isDarkMode ? '#888' : '#666',
  }
}

export function hashString(str: string) {
  return Math.abs(str.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0));
}

export function getAgentLoadout(assigneeId: string) {
  const hash = hashString(assigneeId);
  
  // This deterministic loadout simulates an "inventory" or "upgrade" system.
  // In the future, this could be fetched from a database where agents earn currency to buy these!
  return {
    level: (hash % 5) + 1, // 1 to 5
    bodyType: hash % 4,    // 0: Bipedal, 1: Tread, 2: Hover, 3: Spider
    headType: (hash >> 2) % 5, // 0: Visor, 1: Cyclops, 2: TV, 3: Brain-Jar, 4: Cat-Ears
    accessory: (hash >> 4) % 4, // 0: None, 1: Backpack, 2: Cape, 3: Antenna
    shadeOffset: (hash >> 6) % 3, // Slight color variations
  }
}
