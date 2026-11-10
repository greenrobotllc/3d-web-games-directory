# 3D Web Games Directory 🎮

Welcome to the 3D Web Games Directory! This repository serves two purposes:
1. Data source for the interactive 3D game browser at https://3dwebgames.com
2. Traditional directory listing organized by category (see below)

## 📖 Full Index: [View All Games](categories/all-games.md)

## Game Categories 📂

### Action & Combat
- [Death Match Games](categories/death-match.md)
- [Fighting Games](categories/fighting.md)
- [First Person Shooters](categories/fps.md)
- [Battle Royale](categories/battle-royale.md)

### Strategy & Simulation
- [Real Time Strategy (RTS)](categories/rts.md)
- [Simulators](categories/simulator.md)
- [Strategy Games](categories/strategy.md)

### Adventure & RPG
- [Adventure Games](categories/adventure.md)
- [Role Playing Games](categories/rpg.md)
- [Platformers](categories/platformer.md)

### Other Categories
- [Card & Board Games](categories/card-and-board.md)
- [Horror Games](categories/horror.md)
- [MMO Games](categories/mmo.md)
- [Puzzle Games](categories/puzzle.md)
- [Racing Games](categories/racing.md)
- [Sandbox Games](categories/sandbox.md)
- [Sports Games](categories/sports.md)
- [Survival Games](categories/survival.md)
- [Other Games](categories/other.md)

## Adding Your Game 🎮

You only need to add **one file**. You can do it entirely in the GitHub website, no git required:

1. Open the [`games`](games) folder and click **Add file → Create new file**.
2. Name the file `games/your-game-name/game.json`. Use lowercase letters, numbers, dots and dashes for the folder name, for example `games/space-racer/game.json`.
3. Paste this in and fill it out:
   ```json
   {
     "title": "Your Game Title",
     "url": "https://your-game-url.com/",
     "description": "What the game is and why it's fun (20-600 characters).",
     "how_to_play": "Controls and goal, e.g. WASD to move, mouse to aim (10-600 characters).",
     "category": "Action"
   }
   ```
4. Click **Commit changes → Propose changes**, then **Create pull request**.

An automatic check runs on your pull request and comments on anything that needs fixing. After the PR is merged, a screenshot and thumbnail are generated automatically, and the game shows up on [3dwebgames.com](https://3dwebgames.com).

### game.json fields

| Field | Required | Notes |
|---|---|---|
| `title` | yes | 2-80 characters |
| `url` | yes | Must start with `https://` |
| `description` | yes | 20-600 characters, plain text (no HTML) |
| `how_to_play` | yes | 10-600 characters, plain text (no HTML) |
| `category` | yes | One of: `Action`, `Adventure`, `Battle Royale`, `Card & Board`, `Death Match`, `Fighting`, `FPS`, `Horror`, `MMO`, `Platformer`, `Puzzle`, `Racing`, `RPG`, `RTS`, `Sandbox`, `Shooter`, `Simulator`, `Sports`, `Strategy`, `Survival`, `Other` |

Don't add `screenshot` or `thumbnail`. They are generated for you. If your page has an `og:image` meta tag, it is used as the cover. Otherwise a screenshot of the page is taken.

### Requirements

- It's a 3D game that runs in a modern browser, with no download required.
- It's appropriate for a general audience.
- The URL goes straight to the game (or its landing page), not to an app store.

Example `game.json`:
```json
{
  "title": "Bruno Simon Portfolio",
  "url": "https://bruno-simon.com/",
  "description": "An interactive 3D portfolio where you drive a car through a playful environment",
  "how_to_play": "Use WASD or arrow keys to drive the car. Click and drag to look around. On mobile, use the virtual joystick!",
  "category": "Other"
}
```

## View the Games 🎲

- 🎨 3D Interface: https://3dwebgames.com
- 📑 Category Pages: Browse the categories above
- 📖 Full Index: [View All Games](categories/all-games.md)

## Code of Conduct 📜

Please be respectful and constructive when submitting games or interacting with the community. All submissions must be appropriate for a general audience and comply with our guidelines.

## License 📄

MIT License. See [LICENSE](LICENSE) for details.

## Maintainers: How Games Get Processed

Two GitHub Actions workflows handle everything:

- **Validate games** (`.github/workflows/validate.yml`) runs on every pull request. It checks each `game.json` (required fields, `https://` URL, category, no HTML, no duplicates) and adds annotations to the PR explaining what to fix. It also warns if a submission changes files other than its `game.json`.
- **Process games** (`.github/workflows/process-games.yml`) runs when a `game.json` lands on `main`. It takes the screenshot and thumbnail, rebuilds `index.json` and `categories/*.md`, and commits the result. The browser that opens contributor URLs runs with a read-only token. A separate job with write access commits only the generated files. To redo a screenshot, run the workflow by hand from the Actions tab and enter the game ids, or leave the field blank to redo every game.

So adding a game is: **review the PR → merge**. 3dwebgames.com picks up the new `index.json` the next time its update script runs.

### Running it locally

Requires Node.js 20+ and PHP 8+.

```bash
npm install
npx puppeteer browsers install chrome   # first time only
npm run validate                        # check every game.json
npm run process -- space-racer          # validate + screenshot + rebuild index for one or more games
```

`scripts/update-games.sh` (pull `main`, process games changed since `.last_processed_commit`, rebuild the index) still works for cron-style local runs, but the GitHub workflow makes it unnecessary.

The category list lives in [`scripts/categories.json`](scripts/categories.json) and is shared by the validator and the category page generator.


### Sponsored by GreenRobot LLC

**GreenRobot Sites:**

- [GreenRobot LLC Homepage](https://greenrobot.com) - GreenRobot LLC Homepage
- [Robot Designs](https://robots.greenrobot.com) - Check out thousands of robot designs
- [AI Careers](https://aicareers.greenrobot.com) - Find thousands of Artificial Intelligence and Machine Learning (AI/ML) careers. Updated every few hours with new jobs from VC funded companies.
- [Longevity](https://longevity.greenrobot.com) - Information, research and interactive tools focused on longevity.
- [Launch Day](https://launchday.greenrobot.com) - Get your site ready for launch with this collaborative marketing and tech validation check list.
- [Remote Dev Jobs](https://remotedevjobs.greenrobot.com) - Find thousands of Remote Developer/Engineer jobs. Updated every few hours with new jobs from VC funded companies.
- [Mental Health Lawyers](https://mentalhealthlawyers.greenrobot.com) - Directory of Mental Health Lawyers in the USA for involuntary commitment and guardianship issues.
- [3D Web Games](https://3dwebgames.com) - Discover 3D web games in this curated directory in the style of a video game store/Blockbuster.
- [3D Tank Battle](https://3dtankbattle.com) - Fun free tank survival game. No login or app required.
- [Cartoonify](https://cartoonify.greenrobot.com) - Turn Yourself Into A Cartoon for Free.
- [Job Search](https://jobsearch.greenrobot.com) - Discover jobs at portfolio companies backed by Venture Capitalists
- [Wizard Writer](https://wizardwriter.greenrobot.com) - Automatically write blog posts
- [Pirate Game](https://pirates.greenrobot.com) - Ahoy! Sail the high seas in this pirate game.
- [Open Space Game](https://openspace.greenrobot.com) - Explore space in this open source space game for iOS and Mac.