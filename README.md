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

To add your game to the directory:

1. Fork this repository
2. Create a new directory for your game under the `games` directory:
   ```bash
   games/
   └── your-game-name/
       └── game.json
   ```

3. Add a `game.json` file with your game's information:
   ```json
   {
     "title": "Your Game Title",
     "url": "https://your-game-url.com",
     "description": "A detailed description of your game",
     "how_to_play": "Instructions on how to play your game (controls, objectives, etc.)",
     "category": "One of: FPS, Action, Adventure, Racing, Puzzle, Other"
   }
   ```

4. Create a pull request to the main branch

That's it! Once your PR is submitted, I will:
- Generate screenshots automatically
- Update the game index
- Review and merge your PR

You don't need to worry about screenshots or thumbnails - these will be generated automatically when processing your PR.

### Game.json Fields

Required fields:
- `title`: The name of your game
- `url`: The URL where your game can be played
- `description`: A detailed description of your game
- `how_to_play`: Instructions for playing your game
- `category`: The game's category (FPS, Action, Adventure, Racing, Puzzle, Other)

Example game.json:
```json
{
  "title": "Bruno Simon Portfolio",
  "url": "https://bruno-simon.com/",
  "description": "An interactive 3D portfolio where you drive a car through a playful environment",
  "how_to_play": "Use WASD or arrow keys to drive the car. Click and drag to look around. On mobile, use the virtual joystick!",
  "category": "Other"
}
```

The following fields will be added automatically:
- `cover_image`: Screenshot of your game (generated automatically)
- `thumbnail`: Thumbnail version of the screenshot (generated automatically)

## View the Games 🎲

- 🎨 3D Interface: https://3dwebgames.com
- 📑 Category Pages: Browse the categories above
- 📖 Full Index: [View All Games](categories/all-games.md)

## Code of Conduct 📜

Please be respectful and constructive when submitting games or interacting with the community. All submissions must be appropriate for a general audience and comply with our guidelines.

## License 📄

MIT License. See [LICENSE](LICENSE) for details.

## Local Automation Setup

Instead of using GitHub Actions, you can run the screenshot generation and updates locally. Here's how to set it up:

### Prerequisites
- Linux/Unix system with cron
- Node.js (v20.19.0 or later recommended)
- Git
- Puppeteer dependencies (on Ubuntu/Debian: `sudo apt-get install -y libgbm-dev gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget`)

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/3d-web-games-directory.git
   cd 3d-web-games-directory
   ```

2. Install Node.js dependencies:
   ```bash
   npm install puppeteer sharp
   ```

3. Set up the cron job to run hourly:
   ```bash
   # Open crontab editor
   crontab -e
   
   # Add this line to run every hour
   0 * * * * cd /path/to/3d-web-games-directory && ./scripts/update-games.sh >> /path/to/3d-web-games-directory/cron.log 2>&1
   ```

### How It Works

The local automation:
1. Pulls the latest changes from the main branch
2. Detects any new or modified game.json files
3. Generates screenshots for new/modified games
4. Updates the game.json files with new screenshot paths

The script keeps track of the last processed commit to avoid reprocessing unchanged games.

### Troubleshooting

- Check the cron.log file for any errors
- Ensure all prerequisites are installed
- Verify the repository path in the cron job is correct
- Make sure the scripts/update-games.sh file is executable (`chmod +x scripts/update-games.sh`) 


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