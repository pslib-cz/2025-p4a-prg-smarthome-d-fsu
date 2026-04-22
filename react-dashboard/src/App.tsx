import { useCallback, useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useBLE } from './hooks/useBLE'
import { useDemoTelemetry } from './hooks/useDemoTelemetry'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import ConnectionScreen from './components/ConnectionScreen'
import AuthScreen from './components/AuthScreen'
import DfsuDashboard, { DfsuDemoDashboard } from './components/DfsuDashboard'
import ModeSelectScreen from './components/ModeSelectScreen'
import './App.css'

// Props for pages sharing the BLE connection
interface BlePageProps {
  ble: ReturnType<typeof useBLE>;
}

// Connection page component
function ConnectionPage({ ble }: BlePageProps) {
  const { status, error, connect, isSupported, isAvailable } = ble
  const navigate = useNavigate()

  const handleConnect = useCallback(async () => {
    await connect()
  }, [connect])

  const handleDemoMode = useCallback(() => {
    navigate('/demo')
  }, [navigate])

  // Navigate to auth screen when connected (not directly to dashboard)
  useEffect(() => {
    if (status === 'connected') {
      navigate('/auth')
    }
  }, [status, navigate])

  return (
    <ConnectionScreen
      status={status}
      error={error}
      isSupported={isSupported}
      isAvailable={isAvailable}
      onConnect={handleConnect}
      onDemoMode={handleDemoMode}
    />
  )
}

// Auth page - shown after BLE connect, before dashboard
function AuthPage({ ble }: BlePageProps) {
  const { status, authenticate, isAuthenticated } = ble
  const navigate = useNavigate()

  // Redirect to dashboard when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  // Redirect to home if not connected
  useEffect(() => {
    if (status === 'disconnected' || status === 'error') {
      navigate('/car')
    }
  }, [status, navigate])

  return <AuthScreen onAuthenticate={authenticate} />
}

// Dashboard page with real BLE connection
function DashboardPage({ ble }: BlePageProps) {
  const { status, error, data, connect, sendData, isSupported, isAvailable, isAuthenticated } = ble
  const navigate = useNavigate()
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false)

  const handleSendCommand = useCallback(async (message: string) => {
    try {
      await sendData(message)
    } catch (err) {
      console.error('Command send failed', err)
    }
  }, [sendData])

  useEffect(() => {
    if (status === 'connected') {
      setHasConnectedOnce(true)
    }
  }, [status])

  // Redirect to home if never connected
  useEffect(() => {
    if (status === 'disconnected' && !hasConnectedOnce) {
      navigate('/car')
    }
  }, [status, hasConnectedOnce, navigate])

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (status === 'connected' && !isAuthenticated) {
      navigate('/auth')
    }
  }, [status, isAuthenticated, navigate])

  const shouldShowOverlay = hasConnectedOnce && status !== 'connected'
  const telemetryReady = Boolean(data)

  return (
    <div className="app">
      <Header showExit />
      <main>
        {telemetryReady ? (
          <Dashboard telemetry={data} onSendCommand={handleSendCommand} />
        ) : (
          <div className="telemetry-placeholder">
            <h2>Čekání na telemetrii</h2>
            <p>Dashboard se zobrazí hned po doručení prvních dat z ESP32.</p>
          </div>
        )}
      </main>
      {shouldShowOverlay && (
        <div className="connection-overlay">
          <ConnectionScreen 
            status={status} 
            error={error} 
            isSupported={isSupported} 
            isAvailable={isAvailable} 
            onConnect={connect} 
          />
        </div>
      )}
    </div>
  )
}

// Demo page with animated demo data
function DemoPage() {
  const demoTelemetry = useDemoTelemetry()

  const handleSendCommand = useCallback(async (message: string) => {
    console.log('[Demo] Command sent:', message)
  }, [])

  return (
    <div className="app">
      <Header showExit />
      <main>
        <Dashboard telemetry={demoTelemetry} onSendCommand={handleSendCommand} />
      </main>
    </div>
  )
}

// Main App with routing
function App() {
  const location = useLocation()
  const ble = useBLE()
  
  // Log route changes for debugging
  useEffect(() => {
    console.log('[Router] Current path:', location.pathname)
  }, [location])

  return (
    <Routes>
      <Route path="/" element={<ModeSelectScreen />} />
      <Route path="/car" element={<ConnectionPage ble={ble} />} />
      <Route path="/auth" element={<AuthPage ble={ble} />} />
      <Route path="/dashboard" element={<DashboardPage ble={ble} />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/dfsu" element={<DfsuDashboard />} />
      <Route path="/dfsu-demo" element={<DfsuDemoDashboard />} />
    </Routes>
  )
}

export default App
