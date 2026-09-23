'use client';

import { useEffect, useRef } from 'react';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function AutoTextarea({ className, rows = 1, value, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={ref}
      rows={rows}
      value={value}
      className={`overflow-hidden resize-none ${className ?? ''}`}
    />
  );
}
