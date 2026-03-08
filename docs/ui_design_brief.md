# Baker Street Tasks — UI Design Brief

AI-first single-user task management system. Personal productivity tool with dark mode default, mobile-responsive layout, and AI-created content indicators.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), React 19 |
| Styling | Tailwind CSS 4 (CSS-first config), OKLCH color space |
| Components | shadcn/ui primitives (21 components) |
| Font | Inter (Google Fonts), `font-sans antialiased` |
| Icons | lucide-react (only) |
| Dark Mode | next-themes, CSS variable swapping, defaults to dark |
| Drag & Drop | @dnd-kit (Kanban board) |
| Virtual Scroll | @tanstack/react-virtual (TaskList) |

## Color System (OKLCH)

All colors use CSS custom properties in OKLCH color space. Light/dark mode swap via `.dark` class.

### Light Mode

| Token | OKLCH Value | Usage |
|-------|-------------|-------|
| `--background` | oklch(1 0 0) | Page background (white) |
| `--foreground` | oklch(0.145 0 0) | Primary text (near-black) |
| `--primary` | oklch(0.205 0 0) | Primary actions (dark gray) |
| `--primary-foreground` | oklch(0.985 0 0) | Text on primary |
| `--secondary` | oklch(0.965 0 0) | Secondary surfaces (light gray) |
| `--muted` | oklch(0.965 0 0) | Muted backgrounds |
| `--muted-foreground` | oklch(0.556 0 0) | Muted text |
| `--accent` | oklch(0.965 0 0) | Hover/selected states |
| `--destructive` | oklch(0.577 0.245 27.325) | Delete/danger actions (red) |
| `--border` | oklch(0.922 0 0) | Borders and dividers |
| `--ring` | oklch(0.708 0 0) | Focus rings |
| `--sidebar-background` | oklch(0.985 0 0) | Sidebar bg |

### Dark Mode

| Token | OKLCH Value | Usage |
|-------|-------------|-------|
| `--background` | oklch(0.145 0 0) | Page background (near-black) |
| `--foreground` | oklch(0.985 0 0) | Primary text (near-white) |
| `--primary` | oklch(0.985 0 0) | Primary actions (near-white) |
| `--primary-foreground` | oklch(0.205 0 0) | Text on primary |
| `--secondary` | oklch(0.269 0 0) | Secondary surfaces |
| `--muted` | oklch(0.269 0 0) | Muted backgrounds |
| `--muted-foreground` | oklch(0.708 0 0) | Muted text |
| `--accent` | oklch(0.269 0 0) | Hover/selected states |
| `--destructive` | oklch(0.396 0.141 25.723) | Danger (dark red) |
| `--border` | oklch(0.269 0 0) | Borders |
| `--ring` | oklch(0.439 0 0) | Focus rings |
| `--sidebar-background` | oklch(0.175 0 0) | Sidebar bg (very dark) |

### Border Radius

| Token | Value |
|-------|-------|
| `--radius` | 0.625rem (10px) |
| `--radius-sm` | 6px |
| `--radius-md` | 8px |
| `--radius-lg` | 10px |
| `--radius-xl` | 14px |

## Semantic Colors (Status & Priority)

### Task Status Colors
| Status | Light | Dark |
|--------|-------|------|
| Inbox | Gray (neutral) | Gray |
| Active | Blue | Blue |
| Someday | Purple | Purple |
| Done | Green | Green |
| Archived | Gray | Gray |

### Priority Colors
| Priority | Color | Label |
|----------|-------|-------|
| P0 | Red | Urgent |
| P1 | Orange | High |
| P2 | Blue | Medium |
| P3 | Gray | Low |

### Special Indicators
- **AI Badge**: Violet background, Bot icon + "AI" label
- **Focus Star**: Yellow filled star icon
- **Overdue Date**: Red text
- **Due Today**: Orange text

## Layout Architecture

```
┌─────────────────────────────────────────────────┐
│  Desktop (md: and up)                           │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ Sidebar  │  Main Content Area                   │
│ (collap- │  ┌──────────────┬──────────────────┐ │
│  sible)  │  │ List View    │ Detail Sidebar   │ │
│          │  │ (scrollable) │ (selected item)  │ │
│ - Nav    │  │              │                  │ │
│ - Views  │  │              │                  │ │
│ - Tags   │  │              │                  │ │
│          │  └──────────────┴──────────────────┘ │
├──────────┴──────────────────────────────────────┤

┌─────────────────────────────────────────────────┐
│  Mobile (below md:)                             │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ Mobile Header (h-12)                        │ │
│ │ [☰] Baker Street Tasks           [🌙]      │ │
│ ├─────────────────────────────────────────────┤ │
│ │                                             │ │
│ │  Full-width content                         │ │
│ │  (list OR detail, not both)                 │ │
│ │                                             │ │
│ ├─────────────────────────────────────────────┤ │
│ │            [+] FAB (bottom-20 right-4)      │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Bottom Nav (fixed)                          │ │
│ │ [Dashboard] [Tasks] [Kanban]                │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Sidebar Structure
- **Header**: Logo ("I" badge) + "Baker Street Tasks" title + Theme toggle + Context toggle (All/Home/Work)
- **Navigation**: Dashboard, Tasks, Kanban, Search, Settings (lucide icons)
- **Saved Views**: Expandable section (conditional, shows custom views)
- **Tags**: Expandable section (conditional, clickable tag links with color dots)
- **Rail**: Collapse/expand affordance
- Collapsible to icon-only mode (`collapsible="icon"`)

## Pages

### Dashboard (`/`)
Grid layout: `grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

6 card blocks, each with:
- Header: icon + title + count badge + "View all" link
- Content: list of TaskRow items, or empty state message

| Block | Icon | Color |
|-------|------|-------|
| Overdue | AlertTriangle | Red |
| Due Today | Calendar | Orange |
| Next Up | ListChecks | Blue |
| High Priority | Flame | Orange |
| Focus 3 | Star (filled) | Yellow |
| Inbox | Inbox | Gray |

### Tasks (`/tasks`)
- **List panel** (left): Virtualized task list with sort dropdown (Due Date / Priority / Created / Manual Order)
- **Detail panel** (right, desktop) or separate page (mobile): Full task editor
- URL-driven filters: `?context=`, `?sort=`, `?status=`, `?tag=`, `?taskId=`
- New task button opens TaskCreateDialog

### Kanban (`/kanban`)
- Horizontal scrollable board with 3 columns: **Inbox** | **Active** | **Done**
- Column header with status name + count badge, color-coded top border
- Cards: draggable with grip handle, show title/priority/due date/subtask progress/tags
- Drag overlay feedback: `opacity-50 shadow-lg ring-2 ring-primary`
- Drop zone: `ring-2 ring-primary ring-offset-2`
- Empty column: dashed border "Drop tasks here"
- Column width: `w-80`

### Search (`/search`)
- Full-text search across tasks
- Debounced input with URL persistence (`?q=`)

### Settings (`/settings`)
- Tag management (CRUD operations)

## Data Model

### Task
```
id, title, notes, status (Inbox|Active|Someday|Done|Archived),
context (Home|Work|null), priority (P0|P1|P2|P3),
dueAt, startAt, completedAt, estimate (hours),
orderIndex (fractional string), isFocus (boolean),
createdBy (web_ui|mcp), agentId, reason,
subtasks[], tags[]
```

### Tag
```
id, name, color (hex|null)
```

### Subtask
```
id, taskId, title, done (boolean),
orderIndex (fractional string for drag-drop)
```

## Component Patterns

### Shared Row Components
- **TaskRow**: Checkbox + Title (with star if focus) + Priority badge + Due date + Subtask progress + Tags (first 2, +N) + AI badge

### Interactive States
- Hover: `hover:bg-accent/50`
- Selected: `bg-accent` background
- Focus: Ring via `--ring` color
- Dragging: `opacity-50 shadow-lg ring-2 ring-primary`
- Disabled: `opacity-50 cursor-not-allowed`
- Transitions: `transition-colors`, `duration-300`

### Empty States
- Icon + heading + descriptive message
- Examples: "No tasks found", "Drop tasks here"

### Loading States
- Skeleton placeholders with `animate-pulse` and `bg-muted`

## Design Constraints

- **OKLCH only**: No hex/rgb/hsl colors — use CSS variables
- **Dark mode always paired**: Every light color must have a dark variant
- **lucide-react only**: No other icon libraries
- **shadcn/ui primitives**: Build on existing components, don't introduce new UI libraries
- **Mobile-first**: Bottom nav + FAB on mobile, sidebar on desktop
- **Single user**: No auth UI, no user avatars, no collaboration features
- **AI awareness**: AI-created items show violet "AI" badge; task detail shows AI metadata panel
