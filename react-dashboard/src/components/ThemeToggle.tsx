import { useTheme } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button 
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
    >
      {theme === 'light' ? (
        <svg className={styles.icon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg className={styles.icon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
          <circle cx="12" cy="12" r="4" fill="white" />
          <line x1="12" y1="1" x2="12" y2="4" strokeWidth="2" stroke="white" strokeLinecap="round" />
          <line x1="12" y1="20" x2="12" y2="23" strokeWidth="2" stroke="white" strokeLinecap="round" />
          <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" strokeWidth="2" stroke="white" strokeLinecap="round" />
          <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" strokeWidth="2" stroke="white" strokeLinecap="round" />
          <line x1="1" y1="12" x2="4" y2="12" strokeWidth="2" stroke="white" strokeLinecap="round" />
          <line x1="20" y1="12" x2="23" y2="12" strokeWidth="2" stroke="white" strokeLinecap="round" />
          <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" strokeWidth="2" stroke="white" strokeLinecap="round" />
          <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" strokeWidth="2" stroke="white" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
