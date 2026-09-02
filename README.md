# Morning Star Cricket - Attendance Tracker

A simple attendance tracking app for the Morning Star cricket team. Track practice and match attendance, view player stats, and manage the team roster. Hosted free on GitHub Pages.

## Features

- **Home Page** - Team stats overview, attendance leaderboard, recent sessions
- **Admin Panel** - Mark attendance, manage players, view session history
- **My Stats (Member)** - Players can look up their own attendance by phone number (read-only)
- **Responsive** - Works on mobile, tablet, and desktop
- **No backend** - Uses browser localStorage, no server needed

## Pages

| Page | URL | Access | Description |
|------|-----|--------|-------------|
| Home | `index.html` | Everyone | Leaderboard, stats, recent sessions |
| Admin | `admin.html` | Team admin | Mark attendance, manage players |
| My Stats | `member.html` | Players | View personal attendance (read-only) |

## Quick Start

### Open locally
1. Download or clone this repo
2. Open `index.html` in your browser
3. Sample data loads automatically

### Host on GitHub Pages
1. Create a new repo on GitHub
2. Push this code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/morning-star-cricket.git
   git push -u origin main
   ```
3. Go to **Settings > Pages**
4. Set source to **main** branch, **/ (root)**
5. Your app is live at `https://YOUR_USERNAME.github.io/morning-star-cricket/`

## Project Structure

```
morning-star-cricket/
├── index.html          # Home / landing page
├── admin.html          # Admin panel
├── member.html         # Player stats (read-only)
├── css/
│   └── style.css       # All styles
├── js/
│   ├── store.js        # localStorage data layer
│   ├── utils.js        # Shared utilities
│   ├── admin.js        # Admin page logic
│   └── member.js       # Member page logic
└── README.md
```

## How to Use

### As Admin
1. Go to **Admin** page
2. **Mark Attendance** tab: Select date, click players who are present, save
3. **Manage Players** tab: Add/edit/deactivate players
4. **Session History** tab: View past sessions, edit or delete

### As Player
1. Go to **My Stats** page
2. Enter your registered phone number
3. View your attendance percentage, session history, and monthly stats

## Sample Data

Sample players and sessions load on first visit. To reset:
```javascript
Store.clearAll();
location.reload();
```

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- localStorage (no database, no backend)
- Zero dependencies

## License

MIT
