'use client';

import { useEffect, useRef } from 'react';

interface Props extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

function fit(element: HTMLTextAreaElement) {
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

export function AutoTextarea({ className, rows = 1, value, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) fit(ref.current);
  }, [value]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      fit(element);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
