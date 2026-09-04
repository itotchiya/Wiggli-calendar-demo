# Wiggli UI Kit (`src/components/ui/`)

Shared primitives for new pages, tables, and drawers. Everything reuses the
existing `globals.css` classes — these are behavior/logic extractions only.

| Export | File | What it does |
|---|---|---|
| `Avatar` | `avatar.tsx` | Round initials/photo avatar, deterministic color |
| `AvatarStack` | `avatar.tsx` | Overlapping avatars + portal name tooltip + "+N" |
| `avatarColor`, `initialsOf` | `avatar.tsx` | Palette + initials helpers |
| `StatusPill` | `status-pill.tsx` | Outline status pill (Draft/Scheduled/Overdue/Completed/Canceled) |
| `usePortalMenu` | `portal-menu.tsx` | Hook: trigger ref, pos tracking, outside-close |
| `PortalMenuList` | `portal-menu.tsx` | Portal menu surface; items with icon/danger/group headers |
| `DrawerShell` | `drawer-shell.tsx` | Scrim + sliding `.event-drawer` + heading with close |
| `SearchToolbar` | `toolbar.tsx` | Search input + filter button + right actions slot |
| `Pagination` | `pagination.tsx` | Rows-per-page + numbered pages |
| `DetailTabs` | `detail-tabs.tsx` | Underline tablist, `contact` / `job` variants, NEW badges |
| `DetailTopbar` | `detail-topbar.tsx` | Back button + prev/next arrows |
| `LocationTypeCell` | `location-cells.tsx` | Location type icon + label |
| `MeetingPlaceIcon` | `location-cells.tsx` | Provider logo tile (Google/Wiggli/Teams/Zoom/manual) |

## Typical new page

```tsx
<Header kicker={<><span className="kicker-muted">Permanent / </span>My page</>} />
<main className="jobs-page">
  <SearchToolbar placeholder="Search…" value={q} onChange={setQ} filterLabel="Filters">
    <button className="primary-button">New</button>
  </SearchToolbar>
  <div className="jobs-table-wrap"><table className="jobs-table">…</table></div>
  <Pagination page={page} pages={[1, 2, 3]} onPage={setPage} />
</main>
```

## Typical new drawer

```tsx
<DrawerShell open={open} onClose={close} title="Progress in job">
  <div className="vacancy-drawer-body">…content…</div>
</DrawerShell>
```

## Typical More menu

```tsx
const menu = usePortalMenu();
<button ref={menu.triggerRef} onClick={() => { menu.alignMenu(224, "right"); menu.setOpen((v) => !v); }}>More</button>
<PortalMenuList open={menu.open} pos={menu.pos} menuRef={menu.menuRef} onClose={() => menu.setOpen(false)} items={[
  { label: "Schedule a meeting", icon: CalendarPlus, action: schedule },
  { label: "Delete", icon: Trash2, danger: true, group: "Danger zone" },
]} />
```

Notes:
- `meetings-table.tsx` re-exports `StatusPill` / `LocationTypeCell` / `MeetingPlaceIcon` from the kit for backwards compatibility — import from `ui/` in new code.
- Global `button { color: inherit }` beats Tailwind `text-*` on buttons — for colored text on `<button>`, prefer kit components or a CSS class (see `notetaker.module.css` pattern).
