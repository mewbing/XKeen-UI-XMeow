import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { UpdateOverlay } from '@/components/update/UpdateOverlay'
import { useReleasesStore } from '@/stores/releases'
import { XKeenTab } from './XKeenTab'
import { MihomoTab } from './MihomoTab'
import { DashboardTab } from './DashboardTab'

interface VersionsDialogProps {
  open: boolean
  defaultTab: string
  onClose: () => void
}

interface ConfirmAction {
  fn: () => void
  title: string
  description: string
}

export function VersionsDialog({ open, defaultTab, onClose }: VersionsDialogProps) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayMode, setOverlayMode] = useState<'server' | 'dist'>('server')

  const mihomoInstalling = useReleasesStore((s) => s.mihomoInstalling)

  // Sync tab to defaultTab when dialog opens (Pitfall 6 prevention)
  useEffect(() => {
    if (open) setActiveTab(defaultTab)
  }, [open, defaultTab])

  const handleClose = () => {
    if (mihomoInstalling) return
    onClose()
  }

  const handleTabChange = (value: string) => {
    if (mihomoInstalling) return
    setActiveTab(value)
  }

  const handleOverlay = (mode: 'server' | 'dist') => {
    setOverlayMode(mode)
    setOverlayOpen(true)
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => { if (!o) handleClose() }}
      >
        <DialogContent
          className="!max-w-2xl max-h-[85vh] flex flex-col"
          onInteractOutside={(e) => { if (mihomoInstalling) e.preventDefault() }}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Версии и обновления</DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="flex-1 min-h-0 flex flex-col"
          >
            <TabsList className="shrink-0">
              <TabsTrigger
                value="xkeen"
                disabled={mihomoInstalling && activeTab !== 'xkeen'}
              >
                XKeen
              </TabsTrigger>
              <TabsTrigger
                value="mihomo"
                disabled={mihomoInstalling && activeTab !== 'mihomo'}
              >
                Mihomo
              </TabsTrigger>
              <TabsTrigger
                value="dashboard"
                disabled={mihomoInstalling && activeTab !== 'dashboard'}
              >
                Dashboard
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="xkeen"
              forceMount
              className="flex-1 min-h-0 data-[state=inactive]:hidden"
            >
              <XKeenTab
                active={activeTab === 'xkeen' && open}
                onClose={handleClose}
              />
            </TabsContent>

            <TabsContent
              value="mihomo"
              forceMount
              className="flex-1 min-h-0 data-[state=inactive]:hidden"
            >
              <MihomoTab
                active={activeTab === 'mihomo' && open}
                onConfirm={setConfirmAction}
              />
            </TabsContent>

            <TabsContent
              value="dashboard"
              forceMount
              className="flex-1 min-h-0 data-[state=inactive]:hidden"
            >
              <DashboardTab
                active={activeTab === 'dashboard' && open}
                onClose={handleClose}
                onConfirm={setConfirmAction}
                onOverlay={handleOverlay}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Shared AlertDialog -- separate portal */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(o) => { if (!o) setConfirmAction(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              confirmAction?.fn()
              setConfirmAction(null)
            }}>
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* UpdateOverlay -- global fullscreen, triggered from DashboardTab */}
      <UpdateOverlay
        open={overlayOpen}
        mode={overlayMode}
        onClose={() => setOverlayOpen(false)}
      />
    </>
  )
}
