'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export type LogoVariant = 'full' | 'icon' | 'white';

export interface EduConnectLogoProps {
  variant?: LogoVariant;
  className?: string;
  width?: number;
  height?: number;
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  showTagline?: boolean;
  priority?: boolean;
}

export default function EduConnectLogo({
  variant = 'full',
  className = '',
  width,
  height,
  size,
  href,
  showTagline = false,
  priority = false,
}: EduConnectLogoProps) {
  const isIconOnly = variant === 'icon';

  // Preset dimension sizing
  const sizePresets = {
    icon: {
      sm: { w: 24, h: 24 },
      md: { w: 36, h: 36 },
      lg: { w: 48, h: 48 },
    },
    full: {
      sm: { w: 110, h: 32 },
      md: { w: 140, h: 42 },
      lg: { w: 180, h: 52 },
    },
  };

  const preset = isIconOnly
    ? sizePresets.icon[size || 'md']
    : sizePresets.full[size || 'md'];

  const targetWidth = width ?? preset.w;
  const targetHeight = height ?? preset.h;

  const logoSrc = isIconOnly ? '/img/logo_raw.png' : '/img/logo.png';

  const imageElement = (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src={logoSrc}
        alt="EduConnect Logo"
        width={targetWidth}
        height={targetHeight}
        priority={priority}
        className={`object-contain ${variant === 'white' ? 'brightness-0 invert' : ''}`}
      />
      {showTagline && !isIconOnly && (
        <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase border-l border-slate-700/60 pl-2 select-none">
          Connect • Learn • Grow
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center transition-opacity hover:opacity-90">
        {imageElement}
      </Link>
    );
  }

  return imageElement;
}
