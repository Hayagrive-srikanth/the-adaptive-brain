'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Intensity = 'small' | 'medium' | 'large';

interface CelebrationEffectsProps {
  intensity: Intensity;
  trigger: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  shape: 'circle' | 'square' | 'triangle';
}

const COLORS = ['#6C63FF', '#FF6B35', '#22C55E', '#FBBF24', '#EC4899', '#8B5CF6', '#06B6D4'];

const PARTICLE_COUNTS: Record<Intensity, number> = {
  small: 15,
  medium: 40,
  large: 80,
};

function generateParticles(intensity: Intensity): Particle[] {
  const count = PARTICLE_COUNTS[intensity];
  return Array.from({ length: count }, (_, i) => {
    const isLarge = intensity === 'large';
    const spreadX = isLarge ? window.innerWidth : 300;
    const startX = isLarge ? Math.random() * window.innerWidth : window.innerWidth / 2;

    return {
      id: i,
      x: startX,
      y: -20,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 4 + Math.random() * 8,
      rotation: Math.random() * 360,
      velocityX: (Math.random() - 0.5) * spreadX * 0.01,
      velocityY: 2 + Math.random() * 5,
      shape: (['circle', 'square', 'triangle'] as const)[Math.floor(Math.random() * 3)],
    };
  });
}

function ConfettiParticle({ particle, intensity }: { particle: Particle; intensity: Intensity }) {
  const duration = intensity === 'small' ? 1.5 : intensity === 'medium' ? 2.5 : 3.5;
  const fallDistance = intensity === 'small' ? 200 : intensity === 'medium' ? 400 : window.innerHeight;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: particle.x,
        top: particle.y,
        width: particle.size,
        height: particle.size,
        backgroundColor: particle.shape !== 'triangle' ? particle.color : 'transparent',
        borderRadius: particle.shape === 'circle' ? '50%' : '0',
        borderLeft: particle.shape === 'triangle' ? `${particle.size / 2}px solid transparent` : undefined,
        borderRight: particle.shape === 'triangle' ? `${particle.size / 2}px solid transparent` : undefined,
        borderBottom: particle.shape === 'triangle' ? `${particle.size}px solid ${particle.color}` : undefined,
      }}
      initial={{
        opacity: 1,
        y: 0,
        x: 0,
        rotate: 0,
        scale: 0,
      }}
      animate={{
        opacity: [1, 1, 0],
        y: fallDistance,
        x: particle.velocityX * 100,
        rotate: particle.rotation + Math.random() * 720,
        scale: [0, 1.2, 1, 0.5],
      }}
      transition={{
        duration,
        ease: 'easeOut',
        delay: Math.random() * 0.5,
      }}
    />
  );
}

export default function CelebrationEffects({ intensity, trigger }: CelebrationEffectsProps) {
  const [active, setActive] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger) {
      setParticles(generateParticles(intensity));
      setActive(true);

      const duration = intensity === 'small' ? 2000 : intensity === 'medium' ? 3000 : 4000;
      const timer = setTimeout(() => setActive(false), duration);
      return () => clearTimeout(timer);
    }
  }, [trigger, intensity]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 z-[90] pointer-events-none overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {particles.map((particle) => (
            <ConfettiParticle key={particle.id} particle={particle} intensity={intensity} />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
