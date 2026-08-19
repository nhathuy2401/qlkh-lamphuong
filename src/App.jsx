import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { Login } from './components/auth/Login'
import { Dashboard } from './components/dashboard/Dashboard'
import { CustomerManager } from './components/customers/CustomerManager'
import { Inventory } from './components/inventory/Inventory'
import { Organization } from './components/organization/Organization'
import { Orders } from './components/orders/Orders'
import { Shell } from './components/layout/Shell'
import { Statistics } from './components/statistics/Statistics'
import { appStore } from './stores/appStore'

const pages = {
  dashboard: Dashboard,
  inventory: Inventory,
  outbound: (props) => <Orders {...props} type="Outbound" />,
  inbound: (props) => <Orders {...props} type="Inbound" />,
  statistics: Statistics,
  customers: CustomerManager,
  organization: Organization,
}

const App = observer(() => {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  if (!appStore.session) return <Login onLogin={(session) => appStore.login(session)} />
  const Page = pages[appStore.nav] || Dashboard
  return <Shell nav={appStore.nav} onNavigate={(nav) => appStore.setNav(nav)} onLogout={() => appStore.logout()}><Page store={appStore} /></Shell>
})

export default App
