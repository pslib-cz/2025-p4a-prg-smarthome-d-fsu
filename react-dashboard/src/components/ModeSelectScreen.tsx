import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import carIcon from '../assets/car-side-view.svg';
import caseIcon from '../assets/case-svgrepo-com.svg';
import styles from './ModeSelectScreen.module.css';

// Landing screen — user picks which project to look at.
// - Car → BLE-driven RC dashboard (existing flow at /car)
// - Box → HA-driven D-FSU public dashboard (/dfsu)

export default function ModeSelectScreen() {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <span className={styles.brand}>
          Deimling <span className={styles.brandAccent}>·</span> 2026
        </span>
        <ThemeToggle />
      </div>

      <main className={styles.main}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>Ovládací centrum</span>
          <h1 className={styles.headline}>Vyberte zařízení</h1>
          <p className={styles.sub}>
            Dva propojené projekty — RC model řízený přes Bluetooth a inteligentní přepravní box
            napojený na Home Assistant. Vyberte, na co se chcete podívat.
          </p>
        </div>

        <div className={styles.tiles}>
          <button
            type="button"
            className={styles.tile}
            onClick={() => navigate('/car')}
          >
            <div className={styles.tileTop}>
              <span className={styles.tileTag}>Projekt 01 · RC</span>
            </div>
            <img src={carIcon} alt="" className={styles.tileIcon} />
            <h2 className={styles.tileTitle}>RC Model</h2>
            <p className={styles.tileDesc}>
              Živá telemetrie, řízení jízdních režimů, výšky podvozku a asistenčních systémů.
              Připojení přes Web Bluetooth k ESP32 ve voze.
            </p>
            <span className={styles.tileCta}>
              Připojit
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/>
              </svg>
            </span>
          </button>

          <button
            type="button"
            className={styles.tile}
            onClick={() => navigate('/dfsu')}
          >
            <div className={styles.tileTop}>
              <span className={styles.tileTag}>Projekt 02 · D-FSU</span>
              <span className={styles.tileLive}>
                <span className={styles.liveDot} />
                Live
              </span>
            </div>
            <img src={caseIcon} alt="" className={styles.tileIcon} />
            <h2 className={styles.tileTitle}>Přepravní box</h2>
            <p className={styles.tileDesc}>
              Veřejný dashboard — teplota, vlhkost, baterie, stav pouzdra a nárazy
              v reálném čase. Data z ESP32 přes Home Assistant a Cloudflare tunel.
            </p>
            <span className={styles.tileCta}>
              Zobrazit
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="square"/>
              </svg>
            </span>
          </button>
        </div>

        <div className={styles.demoRow}>
          <button
            type="button"
            className={styles.demoLink}
            onClick={() => navigate('/dfsu-demo')}
          >
            Box · demo režim
          </button>
        </div>
      </main>

      <footer className={styles.footer}>
        Školní projekty P4A/MPA + P4A/PRG · Průmyslovka Liberec
      </footer>
    </div>
  );
}
