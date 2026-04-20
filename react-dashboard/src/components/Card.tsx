import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export default function Card({ children, className, noPadding }: CardProps) {
  const classes = [
    styles.card,
    noPadding ? styles.noPadding : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
}
