import { useState, useCallback, type FormEvent } from 'react';
import styles from './AuthScreen.module.css';

interface AuthScreenProps {
  onAuthenticate: (password: string) => Promise<boolean>;
}

export default function AuthScreen({ onAuthenticate }: AuthScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    try {
      const success = await onAuthenticate(password.trim());
      if (!success) {
        setError('Nesprávné heslo. Zkuste to znovu.');
        setPassword('');
      }
    } catch {
      setError('Chyba při ověřování. Zkuste to znovu.');
    } finally {
      setIsLoading(false);
    }
  }, [password, isLoading, onAuthenticate]);

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Lock Icon */}
        <div className={styles.lockIcon}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="16" r="1.5" fill="currentColor" />
          </svg>
        </div>

        <h1 className={styles.title}>Ověření přístupu</h1>
        <p className={styles.subtitle}>
          Pro přístup k dashboardu zadejte heslo RC modelu.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputWrapper}>
            <input
              type="password"
              className={styles.passwordInput}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Zadejte heslo"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className={styles.errorMessage}>
              <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner} />
                Ověřuji...
              </>
            ) : (
              'Ověřit'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
