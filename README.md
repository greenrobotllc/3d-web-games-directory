# 3D Web Games Directory 🎮

Welcome to the 3D Web Games Directory! This repository serves two purposes:
1. Data source for the interactive 3D game browser at https://3dwebgames.com
2. Traditional directory listing organized by category (see below)

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

## How to Add Your Game 🎯

### 1. Prepare Your Game Files

Create a new directory in `games` with your game's name:
```
games/
└── your-game-name/
    └── game.json
```

### 2. Game Information (game.json)

```json
{
  "title": "Your Game Title",
  "url": "https://your-game-url.com",
  "description": "A brief description of your game",
  "how_to_play": "Instructions on how to play your game",
  "category": "FPS"
}
```

That's it! The system will automatically:
- Take a mobile-friendly screenshot of your game
- Generate a thumbnail
- Update your game.json with the image paths
- Add the images to your PR

### 3. Categories 📑

Choose one category for your game:
- Action
- Adventure
- Battle Royale
- Card & Board
- Death Match
- Fighting
- First Person Shooter (FPS)
- Horror
- MMO
- Platformer
- Puzzle
- Racing
- Real Time Strategy (RTS)
- Role Playing Game (RPG)
- Sandbox
- Shooter
- Simulator
- Sports
- Strategy
- Survival
- Other

### 4. Submit Your Game 🚀

1. Fork this repository
2. Add your game directory with the game.json file
3. Create a pull request
4. Wait for review and approval

The system will automatically:
- Take screenshots of your game
- Generate thumbnails
- Update the category pages
- Update the main index
- Rebuild the texture atlas

## View the Games 🎲

- 🎨 3D Interface: https://3dwebgames.com
- 📑 Category Pages: Browse the categories above
- 📖 Full Index: [View All Games](categories/all-games.md)

## Code of Conduct 📜

Please be respectful and constructive when submitting games or interacting with the community. All submissions must be appropriate for a general audience and comply with our guidelines.

## License 📄

MIT License. See [LICENSE](LICENSE) for details. 