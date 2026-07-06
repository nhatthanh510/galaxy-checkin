import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppSettings, AppSettingsRow } from '../../types'
import { getSupabase } from '../supabase'

export const settingsKey = ['app-settings'] as const

const DEFAULTS: AppSettings = { birthdayDaysBefore: 7, birthdayDaysAfter: 7 }

// App-wide settings (single row). Readable by anon (kiosk needs the birthday
// window); only admins can update (RLS). Falls back to defaults if unset.
export function useSettings() {
  return useQuery<AppSettings>({
    queryKey: settingsKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('app_settings')
        .select('birthday_days_before, birthday_days_after')
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return DEFAULTS
      const row = data as AppSettingsRow
      return {
        birthdayDaysBefore: row.birthday_days_before,
        birthdayDaysAfter: row.birthday_days_after,
      }
    },
    staleTime: 60 * 1000,
  })
}

// Admin: update the birthday window.
export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation<AppSettings, Error, AppSettings>({
    mutationFn: async (input) => {
      const { error } = await getSupabase()
        .from('app_settings')
        .update({
          birthday_days_before: input.birthdayDaysBefore,
          birthday_days_after: input.birthdayDaysAfter,
          updated_at: new Date().toISOString(),
        })
        .eq('id', true)
      if (error) throw error
      return input
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKey }),
  })
}
