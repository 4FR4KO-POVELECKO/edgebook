import { HugeiconsIcon, type HugeiconsIconProps } from '@hugeicons/react'

/** Hugeicons with app defaults: inherits text color, decorative for screen readers. */
export function Icon({ size = 18, strokeWidth = 1.8, ...rest }: HugeiconsIconProps) {
  return <HugeiconsIcon size={size} strokeWidth={strokeWidth} color="currentColor" aria-hidden="true" {...rest} />
}
