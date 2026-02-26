import { Home } from 'lucide-react'
import { PlaceholderPage } from './PlaceholderPage'

export default function OverviewPage() {
  return (
    <PlaceholderPage
      title="Обзор"
      description="Мониторинг системы, трафик и управление сервисом"
      icon={Home}
      phase="2"
    />
  )
}
