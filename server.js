// server.js - Backend server for leaderboard persistence
import express from 'express';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const LEADERBOARD_FILE = join(__dirname, 'leaderboard.json');

// Middleware
app.use(cors()); // Enable CORS for frontend communication
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('.')); // Serve static files from current directory

// Initialize leaderboard file if it doesn't exist
async function initializeLeaderboard() {
  try {
    await fs.access(LEADERBOARD_FILE);
  } catch (error) {
    // File doesn't exist, create it with empty array
    await fs.writeFile(LEADERBOARD_FILE, JSON.stringify([]));
    console.log('Created new leaderboard.json file');
  }
}

// Load leaderboard from file
async function loadLeaderboard() {
  try {
    const data = await fs.readFile(LEADERBOARD_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading leaderboard:', error);
    return [];
  }
}

// Save leaderboard to file
async function saveLeaderboard(leaderboard) {
  try {
    await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
  } catch (error) {
    console.error('Error saving leaderboard:', error);
    throw error;
  }
}

// API Routes

// GET /api/leaderboard - Retrieve leaderboard data
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await loadLeaderboard();
    // Sort by score (highest first) and limit to top 10
    const sortedLeaderboard = leaderboard
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    res.json({
      success: true,
      leaderboard: sortedLeaderboard
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to load leaderboard'
    });
  }
});

// POST /api/leaderboard - Submit new score
app.post('/api/leaderboard', async (req, res) => {
  try {
    const { playerName, score, wave } = req.body;
    
    // Validate input
    if (!playerName || typeof score !== 'number' || typeof wave !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input: playerName (string), score (number), and wave (number) required'
      });
    }
    
    // Sanitize player name
    const sanitizedName = playerName.trim().substring(0, 20); // Limit to 20 characters
    
    if (sanitizedName.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Player name cannot be empty'
      });
    }
    
    // Load current leaderboard
    const leaderboard = await loadLeaderboard();
    
    // Create new entry
    const newEntry = {
      playerName: sanitizedName,
      score: score,
      wave: wave,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random() // Simple unique ID
    };
    
    // Add to leaderboard
    leaderboard.push(newEntry);
    
    // Save updated leaderboard
    await saveLeaderboard(leaderboard);
    
    // Return success with updated leaderboard position
    const sortedLeaderboard = leaderboard
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    const playerPosition = sortedLeaderboard.findIndex(entry => entry.id === newEntry.id) + 1;
    
    res.json({
      success: true,
      message: 'Score submitted successfully',
      playerPosition: playerPosition <= 10 ? playerPosition : null,
      leaderboard: sortedLeaderboard
    });
    
  } catch (error) {
    console.error('Error submitting score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit score'
    });
  }
});

// POST /api/leaderboard/update - Update score for existing player during game
app.post('/api/leaderboard/update', async (req, res) => {
  try {
    const { playerName, score, wave } = req.body;
    
    if (!playerName || typeof score !== 'number' || typeof wave !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Invalid input'
      });
    }
    
    const leaderboard = await loadLeaderboard();
    
    // Find existing entry for this player (most recent)
    const existingEntryIndex = leaderboard
      .map((entry, index) => ({ ...entry, originalIndex: index }))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .find(entry => entry.playerName === playerName.trim())?.originalIndex;
    
    if (existingEntryIndex !== undefined) {
      // Update existing entry if new score is higher
      if (leaderboard[existingEntryIndex].score < score) {
        leaderboard[existingEntryIndex].score = score;
        leaderboard[existingEntryIndex].wave = wave;
        leaderboard[existingEntryIndex].timestamp = new Date().toISOString();
        
        await saveLeaderboard(leaderboard);
      }
    } else {
      // Create new entry for new player
      const newEntry = {
        playerName: playerName.trim().substring(0, 20),
        score: score,
        wave: wave,
        timestamp: new Date().toISOString(),
        id: Date.now() + Math.random()
      };
      
      leaderboard.push(newEntry);
      await saveLeaderboard(leaderboard);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error updating score:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update score'
    });
  }
});

// Start server
async function startServer() {
  await initializeLeaderboard();
  
  app.listen(PORT, () => {
    console.log(`🚀 Leaderboard server running on http://localhost:${PORT}`);
    console.log(`📊 Leaderboard API available at http://localhost:${PORT}/api/leaderboard`);
    console.log(`🎮 Game available at http://localhost:${PORT}/index.html`);
  });
}

startServer().catch(console.error);
