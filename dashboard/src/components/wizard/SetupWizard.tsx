import { useState } from 'react'
import StepSelectType from './StepSelectType'
import StepTestConnection from './StepTestConnection'
import StepSuccess from './StepSuccess'
import { getApiUrls } from '@/lib/api'
import { useSettingsStore } from '@/stores/settings'
import { cn } from '@/lib/utils'

interface WizardState {
  currentStep: 1 | 2 | 3
  installationType: 'local' | 'cdn' | null
  routerIp: string
  mihomoUrl: string
  configUrl: string
  mihomoVersion: string
  mihomoSecret: string
}

const steps = [
  { number: 1, label: 'Тип установки' },
  { number: 2, label: 'Подключение' },
  { number: 3, label: 'Готово' },
] as const

export default function SetupWizard() {
  const setConfigured = useSettingsStore((s) => s.setConfigured)

  const [state, setState] = useState<WizardState>({
    currentStep: 1,
    installationType: null,
    routerIp: '',
    mihomoUrl: '',
    configUrl: '',
    mihomoVersion: '',
    mihomoSecret: '',
  })

  function handleSelectType(type: 'local' | 'cdn', routerIp?: string, secret?: string) {
    const urls = getApiUrls(type, routerIp)
    setState((prev) => ({
      ...prev,
      currentStep: 2,
      installationType: type,
      routerIp: routerIp || '',
      mihomoUrl: urls.mihomoUrl,
      configUrl: urls.configUrl,
      mihomoSecret: secret || '',
    }))
  }

  function handleTestSuccess(results: { mihomoVersion: string; mihomoSecret: string }) {
    setState((prev) => ({
      ...prev,
      currentStep: 3,
      mihomoVersion: results.mihomoVersion,
      mihomoSecret: results.mihomoSecret,
    }))
  }

  function handleBack() {
    setState((prev) => ({
      ...prev,
      currentStep: 1,
    }))
  }

  function handleFinish() {
    setConfigured({
      type: state.installationType!,
      mihomoUrl: state.mihomoUrl,
      mihomoSecret: state.mihomoSecret,
      configUrl: state.configUrl,
    })
    // After setConfigured, App.tsx will re-render with BrowserRouter
    // and StartPageRedirect will navigate to /overview
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-6">
      <div className="w-full max-w-[520px] space-y-8">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    state.currentStep === step.number
                      ? 'bg-primary text-primary-foreground'
                      : state.currentStep > step.number
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {state.currentStep > step.number ? '\u2713' : step.number}
                </div>
                <span
                  className={cn(
                    'text-sm hidden sm:inline',
                    state.currentStep === step.number
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-px w-8 transition-colors',
                    state.currentStep > step.number
                      ? 'bg-green-300 dark:bg-green-700'
                      : 'bg-border'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content card */}
        <div className="rounded-2xl border bg-card p-6 shadow-lg">
          {state.currentStep === 1 && (
            <StepSelectType
              initialType={state.installationType}
              initialRouterIp={state.routerIp}
              initialSecret={state.mihomoSecret}
              onNext={handleSelectType}
            />
          )}

          {state.currentStep === 2 && (
            <StepTestConnection
              mihomoUrl={state.mihomoUrl}
              configUrl={state.configUrl}
              mihomoSecret={state.mihomoSecret}
              onSuccess={handleTestSuccess}
              onBack={handleBack}
            />
          )}

          {state.currentStep === 3 && (
            <StepSuccess
              installationType={state.installationType!}
              mihomoVersion={state.mihomoVersion}
              mihomoUrl={state.mihomoUrl}
              configUrl={state.configUrl}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  )
}
