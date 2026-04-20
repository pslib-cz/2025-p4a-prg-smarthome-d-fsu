import ThemeToggle from './ThemeToggle';
import ExitButton from './ExitButton';
import styles from './Header.module.css';

interface HeaderProps {
  showExit?: boolean;
}

export default function Header({ showExit = false }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Ovládací centrum RC</h1>
      <div className={styles.actions}>
        {showExit && <ExitButton />}
        <ThemeToggle />
      </div>
    </header>
  );
}
