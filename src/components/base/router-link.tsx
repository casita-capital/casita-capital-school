'use client';

import Link from 'next/link';
import type { ComponentProps, FC } from 'react';

export const RouterLink: FC<ComponentProps<typeof Link>> = (props) => {
  return <Link {...props} />;
};
