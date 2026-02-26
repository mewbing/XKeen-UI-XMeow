import { FileCode } from 'lucide-react'
import { PlaceholderPage } from './PlaceholderPage'

export default function ConfigEditorPage() {
  return (
    <PlaceholderPage
      title="Редактор конфига"
      description="YAML-редактор с подсветкой синтаксиса"
      icon={FileCode}
      phase="5"
    />
  )
}
