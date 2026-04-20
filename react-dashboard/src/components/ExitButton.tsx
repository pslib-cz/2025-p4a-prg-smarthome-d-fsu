import { useNavigate } from 'react-router-dom';
import styles from './ExitButton.module.css';

interface ExitButtonProps {
  to?: string;
}

export default function ExitButton({ to = '/' }: ExitButtonProps) {
  const navigate = useNavigate();

  const handleExit = () => {
    navigate(to);
  };

  return (
    <button 
      className={styles.button}
      onClick={handleExit}
      aria-label="Zpět na hlavní stránku"
    >
      <svg className={styles.icon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="16,17 21,12 16,7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}
