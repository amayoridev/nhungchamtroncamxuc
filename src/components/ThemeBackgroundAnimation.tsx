import React, { useMemo } from 'react';

interface ThemeBackgroundAnimationProps {
  theme?: string;
  effect?: string;
  themeId?: string;
}

export default function ThemeBackgroundAnimation({ theme, effect, themeId }: ThemeBackgroundAnimationProps) {
  // Normalize visual theme identifier (e.g., 'theme_default', 'effect_bubbles', 'theme_green', 'effect_fireworks', 'theme_purple', 'theme_gold')
  const activeId = (themeId || theme || 'theme_default').toLowerCase();

  // Generate randomized particle configurations once for steady rendering
  const themeParticles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.floor((i * 5 + Math.random() * 8) % 98),
      top: Math.floor(Math.random() * 95),
      size: Math.floor(14 + Math.random() * 16),
      duration: Math.floor(18 + Math.random() * 12),
      delay: Math.floor(Math.random() * 12),
      opacity: 0.45 + Math.random() * 0.35,
    }));
  }, []);

  // Enhanced Ocean Bubbles: Varied sizes, iridescent colors and float paths
  const oceanBubbles = useMemo(() => {
    return Array.from({ length: 22 }, (_, i) => {
      const type = i % 4; // 0: large iridescent, 1: medium pastel, 2: small sparkle, 3: cluster
      let size = 24;
      if (type === 0) size = Math.floor(48 + Math.random() * 22); // 48 - 70px
      else if (type === 1) size = Math.floor(26 + Math.random() * 18); // 26 - 44px
      else if (type === 2) size = Math.floor(10 + Math.random() * 12); // 10 - 22px
      else size = Math.floor(18 + Math.random() * 14); // 18 - 32px

      return {
        id: i,
        type,
        left: Math.floor((i * 4.4 + Math.random() * 6) % 96),
        size,
        duration: Math.floor(14 + Math.random() * 14), // 14s - 28s
        delay: Math.floor(Math.random() * 14),
        opacity: type === 0 ? 0.85 : 0.75 + Math.random() * 0.2,
      };
    });
  }, []);

  const fireworkParticles = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      id: i,
      left: Math.floor((i * 4.2 + Math.random() * 9) % 98),
      top: Math.floor(Math.random() * 95),
      size: Math.floor(16 + Math.random() * 18),
      duration: Math.floor(14 + Math.random() * 10),
      delay: Math.floor(Math.random() * 10),
      opacity: 0.55 + Math.random() * 0.35,
    }));
  }, []);

  // Cute Oceanic Fishes Swimming through the screen with optimal swimming lanes
  const oceanFishes = useMemo(() => [
    {
      id: 'whale',
      icon: '🐳',
      name: 'Baby Whale',
      direction: 'ltr' as const,
      topPercent: 15,
      size: 40,
      duration: 25,
      delay: 0,
      hasBlowhole: true,
    },
    {
      id: 'clownfish',
      icon: '🐠',
      name: 'Coral Clownfish',
      direction: 'rtl' as const,
      topPercent: 42,
      size: 34,
      duration: 22,
      delay: 5,
      hasBlowhole: false,
    },
    {
      id: 'guppy',
      icon: '🐟',
      name: 'Aqua Guppy',
      direction: 'rtl' as const,
      topPercent: 62,
      size: 30,
      duration: 19,
      delay: 14,
      hasBlowhole: false,
    },
    {
      id: 'puffer',
      icon: '🐡',
      name: 'Chibi Pufferfish',
      direction: 'ltr' as const,
      topPercent: 82,
      size: 36,
      duration: 28,
      delay: 10,
      hasBlowhole: false,
    },
  ], []);

  // 1. Theme 1 / Default: Sakura Petals (🌸 - Theme Hồng Mộng Mơ)
  if (activeId === 'theme_default' || activeId === 'default' || activeId === 'pink' || activeId === 'sakura') {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" id="theme-bg-sakura">
        {themeParticles.map((p) => (
          <div
            key={p.id}
            className="absolute animate-sakura text-[#FF8E98] select-none"
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          >
            🌸
          </div>
        ))}
      </div>
    );
  }

  // 2. Effect: Ocean Bubbles & Cute Swimming Fish (🫧 & 🐳 🐠 🐡 🐟)
  if (activeId === 'effect_bubbles' || activeId === 'bubbles') {
    return (
      <div 
        className="fixed inset-0 pointer-events-none overflow-hidden select-none" 
        style={{ zIndex: 999 }}
        id="theme-bg-ocean-bubbles"
      >
        {/* Iridescent Rising Ocean Bubbles Layer */}
        {oceanBubbles.map((p) => {
          // Type-based styling for realistic and diverse soap/ocean bubbles
          const isLarge = p.type === 0;
          const isTiny = p.type === 2;

          return (
            <div
              key={`bubble-${p.id}`}
              className="absolute animate-bubble rounded-full pointer-events-none transition-all"
              style={{
                left: `${p.left}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                opacity: p.opacity,
                background: isLarge
                  ? 'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.85) 0%, rgba(175, 220, 241, 0.45) 30%, rgba(255, 215, 213, 0.35) 60%, rgba(196, 181, 253, 0.4) 85%, rgba(175, 220, 241, 0.7) 100%)'
                  : 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9) 0%, rgba(175, 220, 241, 0.5) 45%, rgba(255, 215, 213, 0.3) 80%, rgba(147, 197, 253, 0.6) 100%)',
                border: isLarge 
                  ? '1.5px solid rgba(175, 220, 241, 0.85)' 
                  : '1px solid rgba(255, 255, 255, 0.95)',
                boxShadow: isLarge
                  ? 'inset -3px -3px 8px rgba(175, 220, 241, 0.5), inset 3px 3px 6px rgba(255, 255, 255, 0.9), 0 4px 14px rgba(175, 220, 241, 0.35)'
                  : 'inset -2px -2px 5px rgba(175, 220, 241, 0.4), inset 2px 2px 4px rgba(255, 255, 255, 0.8), 0 2px 8px rgba(175, 220, 241, 0.25)',
                backdropFilter: 'blur(0.5px)',
              }}
            >
              {/* Glossy top-left light reflection sparkle */}
              <div 
                className="absolute rounded-full bg-white/95 shadow-xs" 
                style={{
                  top: isTiny ? '2px' : '15%',
                  left: isTiny ? '2px' : '20%',
                  width: `${Math.max(2, p.size * 0.22)}px`,
                  height: `${Math.max(2, p.size * 0.22)}px`,
                  opacity: 0.9,
                }}
              />

              {/* Secondary soft reflection dot on bottom right */}
              {!isTiny && (
                <div 
                  className="absolute rounded-full bg-white/60"
                  style={{
                    bottom: '18%',
                    right: '22%',
                    width: `${Math.max(1.5, p.size * 0.1)}px`,
                    height: `${Math.max(1.5, p.size * 0.1)}px`,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Cute Swimming Fishes Layer - Swims on top with gentle opacity */}
        {oceanFishes.map((fish) => {
          const isLTR = fish.direction === 'ltr';

          return (
            <div
              key={`fish-${fish.id}`}
              className={`absolute ${isLTR ? 'animate-fish-ltr' : 'animate-fish-rtl'} pointer-events-none flex items-center`}
              style={{
                top: `${fish.topPercent}%`,
                animationDuration: `${fish.duration}s`,
                animationDelay: `${fish.delay}s`,
                opacity: 0.88,
              }}
            >
              <div className="relative group flex items-center">
                {/* Main Cute Fish Icon */}
                <div 
                  className="animate-tail-wag filter drop-shadow-md select-none transform transition-transform"
                  style={{ fontSize: `${fish.size}px` }}
                  title={fish.name}
                >
                  {fish.icon}
                </div>

                {/* Baby Whale Special Water Blowhole Animation */}
                {fish.hasBlowhole && (
                  <div className="absolute -top-3 left-3 text-xs animate-bounce opacity-85 select-none">
                    💦
                  </div>
                )}

                {/* Cute Floating Bubbles Puffing from Fish Mouth */}
                <div 
                  className={`absolute -top-2 ${isLTR ? '-right-2' : '-left-2'} animate-fish-bubble pointer-events-none`}
                >
                  <span className="text-[10px] opacity-80">🫧</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 3. Theme 2: Green Leaves (🌿 - Theme Xanh Tươi Mát)
  if (activeId === 'theme_green' || activeId === 'green') {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" id="theme-bg-leaves">
        {themeParticles.map((p) => (
          <div
            key={p.id}
            className="absolute animate-leaf text-[#A8BD55] select-none"
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          >
            {p.id % 2 === 0 ? '🌿' : '🍃'}
          </div>
        ))}
      </div>
    );
  }

  // 4. Effect: Fireworks Sparkles (🎆 - Hiệu Ứng Pháo Hoa)
  if (activeId === 'effect_fireworks' || activeId === 'fireworks') {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" id="theme-bg-fireworks">
        {fireworkParticles.map((p) => (
          <div
            key={p.id}
            className="absolute animate-gold select-none"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              fontSize: `${p.size}px`,
              opacity: p.opacity,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          >
            {p.id % 3 === 0 ? '🎆' : p.id % 2 === 0 ? '🎉' : '✨'}
          </div>
        ))}
      </div>
    );
  }

  // 5. Theme 3: Twinkling Stars (🌙 - Theme Tím Hoàng Hôn)
  if (activeId === 'theme_purple' || activeId === 'purple') {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" id="theme-bg-purple">
        {themeParticles.map((p) => {
          const starChar = p.id % 4 === 0 ? '🌙' : p.id % 2 === 0 ? '✨' : '⭐';
          return (
            <div
              key={p.id}
              className="absolute animate-star text-[#C4B5FD] select-none"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                fontSize: `${p.size - 2}px`,
                opacity: p.opacity,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            >
              {starChar}
            </div>
          );
        })}
      </div>
    );
  }

  // 6. Theme 4: Golden Bokeh / Sunshine (✨ - Theme Vàng Nắng Ấm)
  if (activeId === 'theme_gold' || activeId === 'gold') {
    return (
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" id="theme-bg-gold">
        {themeParticles.map((p) => {
          const isSparkle = p.id % 3 === 0;
          return isSparkle ? (
            <div
              key={p.id}
              className="absolute animate-gold text-[#E8CF7A] select-none"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                fontSize: `${p.size + 2}px`,
                opacity: p.opacity,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            >
              ✨
            </div>
          ) : (
            <div
              key={p.id}
              className="absolute animate-gold rounded-full bg-gradient-to-r from-[#FFEEB6]/40 to-[#FEE180]/30 blur-[2px] border border-[#FFEEB6]/50"
              style={{
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${p.size * 1.8}px`,
                height: `${p.size * 1.8}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          );
        })}
      </div>
    );
  }

  return null;
}
