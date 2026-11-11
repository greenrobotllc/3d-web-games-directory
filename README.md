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
- The page doesn't use misleading ads, such as ads styled as "Play" or "Continue" buttons. Listings that pick these up later are removed.

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

Three GitHub Actions workflows handle everything:

- **Validate games** (`.github/workflows/validate.yml`) runs on every pull request. It checks each `game.json` (required fields, `https://` URL, category, no HTML, no duplicates) and adds annotations to the PR explaining what to fix. It also warns if a submission changes files other than its `game.json`.
- **Process games** (`.github/workflows/process-games.yml`) runs when a `game.json` lands on `main`. It takes the screenshot and thumbnail, rebuilds `index.json` and `categories/*.md`, and commits the result. The browser that opens contributor URLs runs with a read-only token. A separate job with write access commits only the generated files. If a game's site is down or returns an error, its existing screenshot is kept (a new game gets a grey placeholder). When a game is removed, it rebuilds the index without it. To redo a screenshot, run the workflow by hand from the Actions tab and enter the game ids, or leave the field blank to redo every game.
- **Audit games** (`.github/workflows/audit-games.yml`) runs monthly and opens an issue for listings that have gone offline or changed. See [Monthly audit](#monthly-audit) below.

So adding a game is: **review the PR → merge**. 3dwebgames.com picks up the new `index.json` the next time its update script runs.

### Monthly audit

**Audit games** (`.github/workflows/audit-games.yml`) runs on the 1st of each month, or by hand from the Actions tab. It opens every listed game in a browser and grades it:

- **down**: the domain is gone, the server refuses connections, the certificate is invalid, or the page returns 404/410/5xx.
- **needs a look**: the address now goes to a different site or away from the game's page, the page title no longer mentions the game, the page is blank or looks parked, or the site blocked the request.
- **ok**: everything else.

When anything is flagged, it opens an issue titled "Game audit: games that need a look" (or adds a comment to the open one) with the list and reasons. Screenshots of every game are in the run's `audit-report` artifact; the contact sheets (`sheet-1.jpg`, ...) are the quickest way to spot a site that still responds but is no longer the game. Nothing is removed automatically: fix or delete the listing in a pull request.

"Needs a look" is often a healthy site that blocks automated visitors. Once you've confirmed a game is fine, add it to [`scripts/audit-ignore.json`](scripts/audit-ignore.json) as `"game-id": "reason"` and it stops being flagged unless it actually goes down.

GitHub pauses scheduled workflows in a repository with no activity for 60 days, and emails you first. Re-enable it from the Actions tab if that happens.

Run it locally with `npm run audit` (add `-- game-id` for specific games, or `-- --no-browser` for a quick HTTP-only check). The report goes to `audit-report/`. `npm run audit:docker` does the same inside a container that has no access to your files, which is the safer way to open sites you don't know; it needs Docker running.

### Monthly search for new games

A scheduled Claude task on the maintainer's computer searches the web once a month for new 3D browser games and opens one pull request with candidates for you to prune. It loads candidate sites only inside a locked-down Docker container (`npm run audit:docker`), never in a browser on the computer itself. It follows [`docs/finding-new-games.md`](docs/finding-new-games.md), which lists what qualifies, where it looks and what it must not do (it never merges). Games it rejected, and games you drop from its pull requests, go in [`scripts/search-declined.json`](scripts/search-declined.json) so they aren't proposed again. To suggest games yourself, such as ones you saw on social media, open an issue titled "Games to check" and paste the links; the next search picks them up.

### Images

Each game has two images, both made by `scripts/take-screenshots.js` from the page's `og:image` (or a screenshot when there isn't one, or it's under 600px wide):

- the **cover** in `games/<id>/screenshots/`: up to 1200px wide, shown in the store's game panel and in social previews;
- the **card** at `games/<id>/images/thumb.jpg`: exactly 800x420, shown on the list pages at 3dwebgames.com/games. Square or tall art is fitted on a blurred copy of itself rather than cropped.

`npm run images` rebuilds every card (and re-encodes any cover that isn't a JPEG up to 1200px wide) from the covers already in the repo, without visiting any site. Run it after changing `scripts/lib/images.js`. To replace a weak cover, put a better image in the game's `screenshots/` folder under the same file name and run `npm run images -- <id>`.

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