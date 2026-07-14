// Per-device branch identity. A kiosk tablet is (optionally) assigned to one
// physical branch; that assignment lives in this device's localStorage, so it
// survives refreshes/restarts and is independent per tablet. We store the branch
// `slug` (a stable id) rather than the uuid, so a renamed branch still resolves
// and a stale slug can be detected. Null/absent = unassigned (branchless).
//
// Mirrors the localStorage precedent in src/routes/admin/AdminLayout.tsx.

const BRANCH_SLUG_KEY = 'kiosk-branch-slug'

// The branch slug this tablet is assigned to, or null if unassigned.
export function getDeviceBranchSlug(): string | null {
  return localStorage.getItem(BRANCH_SLUG_KEY)
}

// Assign this tablet to a branch, or clear the assignment (slug = null).
export function setDeviceBranchSlug(slug: string | null): void {
  if (slug) localStorage.setItem(BRANCH_SLUG_KEY, slug)
  else localStorage.removeItem(BRANCH_SLUG_KEY)
}

// Derive a stable kebab-case slug from a branch name. Used when an admin creates
// a branch (they type only the name). "Kings Meadows" -> "kings-meadows".
export function slugifyBranchName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
