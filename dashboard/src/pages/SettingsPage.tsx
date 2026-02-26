import { Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">
          <Settings className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Настройки будут добавлены в Task 2</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Выбор стартовой страницы, информация о подключении и сброс настроек.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
