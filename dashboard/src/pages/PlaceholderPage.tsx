import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface PlaceholderPageProps {
  title: string
  description: string
  icon: LucideIcon
}

export function PlaceholderPage({ title, description, icon: Icon }: PlaceholderPageProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md border-dashed">
        <CardContent className="flex flex-col items-center text-center gap-4 pt-2">
          <div className="rounded-xl bg-muted p-4">
            <Icon className="size-10 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            В разработке
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
