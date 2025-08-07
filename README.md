# 3D Car Survival Game with Leaderboard

A Three.js-based 3D game where players control a car to avoid falling bombs and survive as long as possible. Features a persistent leaderboard system.

## Features

- 3D car movement and camera controls
- Dynamic falling bomb objects
- Ghost enemies that follow the player
- Wave-based progression system
- Persistent leaderboard with player rankings
- Real-time scoring system
- Medal awards (Gold, Silver, Bronze)

## Tech Stack

- **Frontend**: Three.js, HTML, CSS, JavaScript (ES Modules)
- **Backend**: Node.js, Express.js
- **Build Tool**: Vite
- **Deployment**: Render (or any Node.js hosting platform)

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Start the backend server:
```bash
npm run server
```

4. Open `http://localhost:5173` in your browser

## Production Deployment (Render)

### Prerequisites
- Git repository pushed to GitHub/GitLab
- Render account

### Deployment Steps

1. **Connect Repository**: Connect your Git repository to Render

2. **Service Configuration**:
   - Service Type: Web Service
   - Environment: Node
   - Build Command: `npm run build`
   - Start Command: `npm start`

3. **Environment Variables**:
   - Set `NODE_ENV` to `production`

4. **Auto-Deploy**: Enable auto-deploy from your main branch

### Manual Deployment to Other Platforms

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist` folder and `server.js` to your hosting platform

3. Set environment variables:
   - `NODE_ENV=production`
   - `PORT` (if required by platform)

4. Start with: `node server.js`

## File Structure

```
├── index.html          # Main game HTML
├── main.js            # Game logic and Three.js code
├── style.css          # Game styling
├── server.js          # Express backend for leaderboard
├── vite.config.js     # Vite build configuration
├── package.json       # Dependencies and scripts
└── public/            # Static assets
    ├── sky.jpg
    ├── blinky_from_pacman.glb
    ├── car/
    └── bomb/
```

## Game Controls

- **WASD** or **Arrow Keys**: Move the car
- **Mouse**: Look around (camera rotation)
- **Spacebar**: Start game
- **Enter**: Submit leaderboard entry

## API Endpoints

- `GET /api/leaderboard` - Fetch leaderboard data
- `POST /api/leaderboard` - Submit new score

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
