import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { Login } from './components/auth/Login'
import { AdminAudit } from './components/admin/AdminAudit'
import { AccountManager } from './components/admin/AccountManager'
import { Dashboard } from './components/dashboard/Dashboard'
import { CustomerManager } from './components/customers/CustomerManager'
import { Inventory } from './components/inventory/Inventory'
import { Orders } from './components/orders/Orders'
import { Shell } from './components/layout/Shell'
import { Statistics } from './components/statistics/Statistics'
import { appStore } from './stores/appStore'

const pages = {
  dashboard: Dashboard,
  inventory: Inventory,
  outbound: props => <Orders {...props} type="Outbound" />,
  inbound: props => <Orders {...props} type="Inbound" />,
  statistics: Statistics,
  customers: CustomerManager,
  accounts: AccountManager,
  'admin-audit': AdminAudit,
}

const App = observer(() => {
  useEffect(() => {
    const stopAuth = appStore.initializeAuth()
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
    return () => {
      stopAuth?.()
      appStore.stopSync()
    }
  }, [])

  if (!appStore.authReady) return <main className="login-page"><div className="login-card"><div className="brand-mark">K</div><p className="muted">Đang kết nối Firebase…</p></div></main>
  if (!appStore.session) return <Login onLogin={credentials => appStore.login(credentials)} />
  const adminPage = appStore.nav === 'accounts' || appStore.nav === 'admin-audit'
  const Page = adminPage && !appStore.isSuperAdmin ? Dashboard : pages[appStore.nav] || Dashboard
  return <Shell nav={appStore.nav} session={appStore.session} connected={appStore.connected} error={appStore.error} onNavigate={nav => appStore.setNav(nav)} onLogout={() => appStore.logout()}><Page store={appStore} /></Shell>
})

export default App
