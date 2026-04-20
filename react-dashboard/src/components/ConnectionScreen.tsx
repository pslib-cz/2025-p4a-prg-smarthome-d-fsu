import { type BLEConnectionStatus } from '../hooks/useBLE';
import bluetoothIcon from '../assets/bluetooth.svg';
import styles from './ConnectionScreen.module.css';

interface ConnectionScreenProps {
  status: BLEConnectionStatus;
  error: string | null;
  isSupported: boolean;
  isAvailable: boolean | null;
  onConnect: () => void;
  onDemoMode?: () => void;
}

export default function ConnectionScreen({ status, error, isSupported, isAvailable, onConnect, onDemoMode }: ConnectionScreenProps) {
  const isConnecting = status === 'connecting';
  const isReconnecting = status === 'reconnecting';

  if (!isSupported) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.errorIcon}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className={styles.title}>Bluetooth není podporován</h1>
          <p className={styles.description}>
            Váš prohlížeč nepodporuje Web Bluetooth API. Prosím použijte Chrome, Edge nebo Opera na počítači
            nebo Android zařízení.
          </p>
          <div className={styles.errorMessage}>
            <svg className={styles.errorMessageIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Web Bluetooth API není k dispozici</span>
          </div>

          {onDemoMode && (
            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={styles.demoButton}
                onClick={onDemoMode}
              >
                <svg className={styles.demoButtonIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 12L10 17V7L15 12Z" fill="currentColor"/>
                </svg>
                Vyzkoušet demo
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isAvailable === false) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.errorIcon}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className={styles.title}>Bluetooth není k dispozici</h1>
          <p className={styles.description}>
            Vaše zařízení nemá Bluetooth nebo je vypnutý. Ujistěte se, že máte Bluetooth adapter a je zapnutý.
          </p>
          <div className={styles.errorMessage}>
            <svg className={styles.errorMessageIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Bluetooth hardware není detekovaný</span>
          </div>

          {onDemoMode && (
            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={styles.demoButton}
                onClick={onDemoMode}
              >
                <svg className={styles.demoButtonIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 12L10 17V7L15 12Z" fill="currentColor"/>
                </svg>
                Vyzkoušet demo
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Animated Bluetooth Icon */}
        <div className={`${styles.icon} ${(isConnecting || isReconnecting) ? styles.iconAnimating : ''}`}>
          <img src={bluetoothIcon} alt="Bluetooth" />
        </div>

        <h1 className={styles.title}>
          {isReconnecting ? 'Signál ztracen' : isConnecting ? 'Připojování...' : 'Připojení k RC modelu'}
        </h1>

        {isReconnecting ? (
          <div className={styles.reconnectingMessage}>
            <svg className={styles.reconnectingIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <div>
              <p className={styles.reconnectingTitle}>Obnovování spojení...</p>
              <p className={styles.reconnectingText}>Přibližte ESP32 k zařízení. Spojení bude obnoveno automaticky.</p>
            </div>
          </div>
        ) : error && (
          <div className={styles.errorMessage}>
            <svg className={styles.errorMessageIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {!isReconnecting && (
          <>
            <div className={styles.instructions}>
              <h2 className={styles.instructionsTitle}>Jak se připojit:</h2>
              <ol className={styles.instructionsList}>
                <li>Ujistěte se, že je RC model zapnutý</li>
                <li>Klikněte na tlačítko "Připojit" níže</li>
                <li>V dialogu vyberte ESP32 zařízení</li>
                <li>Potvrďte párování</li>
              </ol>
            </div>

            <div className={styles.buttonGroup}>
              <button
                type="button"
                className={styles.connectButton}
                onClick={onConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <span className={styles.spinner} />
                    Připojování...
                  </>
                ) : (
                  <>
                    <img src={bluetoothIcon} alt="" className={styles.buttonIcon} />
                    Připojit
                  </>
                )}
              </button>

              {onDemoMode && (
                <button
                  type="button"
                  className={styles.demoButton}
                  onClick={onDemoMode}
                >
                  <svg className={styles.demoButtonIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 12L10 17V7L15 12Z" fill="currentColor"/>
                  </svg>
                  Vyzkoušet demo
                </button>
              )}
            </div>
          </>
        )}

        <div className={styles.footer}>
          <p className={styles.footerText}>
            Používáte prohlížeč s podporou Web Bluetooth API
          </p>
          <div className={styles.supportedBrowsers}>
            <span>Chrome</span>
            <span>•</span>
            <span>Edge</span>
            <span>•</span>
            <span>Opera</span>
          </div>
        </div>
      </div>
    </div>
  );
}
