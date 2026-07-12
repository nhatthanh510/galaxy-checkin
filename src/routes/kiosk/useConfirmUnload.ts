import { useEffect } from 'react'

// Warn the customer before a refresh / tab-close that would lose their in-progress
// kiosk flow (the flow is in-memory, so a reload resets to the start — see the
// refresh guards on the kiosk steps). Pass `when` = true only while there's real
// progress to lose, so we don't nag on the empty phone screen.
//
// NOTE: modern browsers show a GENERIC confirmation ("Leave site? Changes may not
// be saved") and ignore any custom message, for security — the text can't be
// customised. Returning a string + preventDefault is what triggers the prompt.
export function useConfirmUnload(when: boolean) {
  useEffect(() => {
    if (!when) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Legacy requirement: some browsers need returnValue set to show the prompt.
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [when])
}
