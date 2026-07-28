import React from 'react';

const SIZE_PAD = { sm: 'p-2.5 text-sm', md: 'p-3 text-sm' };

export default function Select({ size = 'md', className = '', children, ...rest }) {
  return (
    <select
      className={`w-full bg-surface-hover border border-border-light rounded-xl text-text-main outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all disabled:opacity-50 ${SIZE_PAD[size] || SIZE_PAD.md} ${className}`.trim()}
      {...rest}
    >
      {children}
    </select>
  );
}
