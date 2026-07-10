import { useCallback, useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

interface ConfirmOptions {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

// Promise-based confirmation, a styled drop-in for window.confirm. Render the
// returned `dialog` once in the component, then `await confirm({...})` at the
// call site — it resolves true if the user confirms, false if they cancel.
//
//   const { confirm, dialog } = useConfirm()
//   const onDelete = async () => {
//     if (await confirm({ title: 'Delete?', message: '…', danger: true })) del.mutate(id)
//   }
//   return <>… {dialog}</>
export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  // Resolver for the in-flight confirm() promise; called on confirm/cancel.
  const resolver = useRef<((ok: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = null
    setOpts(null)
  }, [])

  const dialog = opts ? (
    <ConfirmDialog
      open
      title={opts.title}
      message={opts.message}
      confirmLabel={opts.confirmLabel}
      cancelLabel={opts.cancelLabel}
      danger={opts.danger}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null

  return { confirm, dialog }
}
