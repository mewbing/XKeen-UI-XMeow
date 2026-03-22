import { useState, useEffect, useLayoutEffect, useRef } from 'react'
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
import { useBackendAvailable } from '@/hooks/useBackendAvailable'
import { useRemoteStore } from '@/stores/remote'
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
  const [panelHeight, setPanelHeight] = useState<number | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)
  const hasInitialHeight = useRef(false)
  const mihomoInstalling = useReleasesStore((s) => s.mihomoInstalling)
  const xmeowInstalling = useReleasesStore((s) => s.xmeowInstalling)
  const anyInstalling = mihomoInstalling || xmeowInstalling
  const backendAvailable = useBackendAvailable()
  const isRemote = !!useRemoteStore((s) => s.activeAgentId)
  const showXkeen = backendAvailable || isRemote

  // Sync tab to defaultTab when dialog opens
  // If xkeen tab requested but not available, fall back to mihomo
  useEffect(() => {
    if (open) {
      const tab = (!showXkeen && defaultTab === 'xkeen') ? 'mihomo' : defaultTab
      setActiveTab(tab)
    } else {
      setPanelHeight(null)
      hasInitialHeight.current = false
    }
  }, [open, defaultTab])

  // Initial measurement BEFORE paint — ensures panelHeight is a number
  // before user can interact. auto→px doesn't animate (good).
  useLayoutEffect(() => {
    if (!open || hasInitialHeight.current) return

    const wrapper = panelRef.current
    if (!wrapper) return
    const active = wrapper.querySelector<HTMLElement>(':scope > [data-state="active"]')
    if (active) {
      setPanelHeight(active.scrollHeight + 8)
      hasInitialHeight.current = true
    }
  }, [open, activeTab])

  // Animated measurement on tab switch (rAF lets browser paint old height first → transition)
  // + ResizeObserver for content changes within active tab
  useEffect(() => {
    if (!open || !hasInitialHeight.current) return

    const wrapper = panelRef.current
    if (!wrapper) return

    const measure = () => {
      const active = wrapper.querySelector<HTMLElement>(':scope > [data-state="active"]')
      if (active) setPanelHeight(active.scrollHeight + 8)
    }

    const frame = requestAnimationFrame(measure)

    const active = wrapper.querySelector<HTMLElement>(':scope > [data-state="active"]')
    if (!active) return () => cancelAnimationFrame(frame)

    const ro = new ResizeObserver(measure)
    ro.observe(active)
    Array.from(active.children).forEach((child) => ro.observe(child))

    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [activeTab, open])

  const handleClose = () => {
    if (anyInstalling) return
    onClose()
  }

  const handleTabChange = (value: string) => {
    if (anyInstalling) return
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
          className="!max-w-2xl max-h-[85vh] flex flex-col !top-[15vh] !translate-y-0"
          onInteractOutside={(e) => { if (anyInstalling) e.preventDefault() }}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-center">Управление обновлениями</DialogTitle>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="min-h-0"
          >
            <TabsList className="shrink-0 w-full">
              {showXkeen && (
                <TabsTrigger
                  value="xkeen"
                  className="flex-1"
                  disabled={anyInstalling && activeTab !=='xkeen'}
                >
                  XKeen
                </TabsTrigger>
              )}
              <TabsTrigger
                value="mihomo"
                className="flex-1"
                disabled={anyInstalling && activeTab !=='mihomo'}
              >
                Mihomo
              </TabsTrigger>
              <TabsTrigger
                value="dashboard"
                className="flex-1"
                disabled={anyInstalling && activeTab !=='dashboard'}
              >
                Dashboard
              </TabsTrigger>
            </TabsList>

            {/* Animated height wrapper — smooth resize between tabs */}
            <div
              className="overflow-hidden transition-[height] duration-300 ease-out"
              style={panelHeight !== null ? { height: panelHeight } : undefined}
            >
              <div ref={panelRef}>
                {showXkeen && (
                  <TabsContent
                    value="xkeen"
                    forceMount
                    className="mt-2 data-[state=inactive]:hidden"
                  >
                    <XKeenTab
                      active={activeTab === 'xkeen' && open}
                      onClose={handleClose}
                    />
                  </TabsContent>
                )}

                <TabsContent
                  value="mihomo"
                  forceMount
                  className="mt-2 data-[state=inactive]:hidden"
                >
                  <MihomoTab
                    active={activeTab === 'mihomo' && open}
                    onConfirm={setConfirmAction}
                  />
                </TabsContent>

                <TabsContent
                  value="dashboard"
                  forceMount
                  className="mt-2 data-[state=inactive]:hidden"
                >
                  <DashboardTab
                    active={activeTab === 'dashboard' && open}
                    onClose={handleClose}
                    onConfirm={setConfirmAction}
                    onOverlay={handleOverlay}
                  />
                </TabsContent>
              </div>
            </div>
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
