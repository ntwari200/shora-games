// ========================================
// TitleScene.js - FULLY MOBILE RESPONSIVE
// ========================================

import * as Phaser from 'phaser';
import config from '../Config/config.js';
import Button from '../Objects/Button.js';
import gameOptions from '../Config/gameOptions.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  // ❌ REMOVE preload() - Images already loaded in PreloaderScene
  // preload() {
  //   this.add.image(400, 300, 'bgTitle');
  // }

  create() {
    const { width, height } = this.cameras.main;
    
    // === RESPONSIVE BACKGROUND ===
    // Add background that fills the entire screen
    const bg = this.add.image(width / 2, height / 2, 'bgTitle');
    bg.setDisplaySize(width, height);
    bg.setDepth(0);

    // === RESPONSIVE BUTTON SCALING ===
    // Calculate scale based on screen size (reference: 800x600)
    const scaleX = width / 800;
    const scaleY = height / 600;
    const scale = Math.min(scaleX, scaleY, 1.2); // Cap at 1.2x for very large screens
    
    // Button spacing - scaled
    const buttonSpacing = 100 * scale;
    const centerY = height / 2;
    
    // Create buttons with responsive positioning
    this.gameButton = new Button(
      this, 
      width / 2, 
      centerY - buttonSpacing * 0.5, 
      'greenButton1', 
      'greenButton2', 
      'Play', 
      'PreGame'
    );

    this.optionsButton = new Button(
      this, 
      width / 2, 
      centerY + buttonSpacing * 0.5, 
      'redButton1', 
      'redButton2', 
      'Options', 
      'Options'
    );

    this.creditsButton = new Button(
      this, 
      width / 2, 
      centerY + buttonSpacing * 1.5, 
      'yellowButton1', 
      'yellowButton2', 
      'Credits', 
      'Credits'
    );

    this.recordsButton = new Button(
      this, 
      width / 2, 
      centerY + buttonSpacing * 2.5, 
      'blueButton1', 
      'blueButton2', 
      'Records', 
      'HallOfFame'
    );

    // === AUDIO - FIXED AUTOPLAY ===
    this.model = this.sys.game.globals.model;
    
    // Wait for user interaction before playing audio
    this.input.on('pointerdown', () => {
      if (this.model.musicOn === true && this.model.bgMusicPlaying === false) {
        this.bgMusic = this.sound.add('bgMusic', { volume: 0.5, loop: true });
        this.bgMusic.play();
        this.model.bgMusicPlaying = true;
        this.sys.game.globals.bgMusic = this.bgMusic;
        console.log('🎵 Background music started');
      }
    });

    // === SCORES - FIXED CORS ===
    this.getScores();

    console.log('🎮 TitleScene: Created successfully!');
  }

  // ============================================================
  // GET SCORES - WITH CORS FALLBACK
  // ============================================================
  getScores = async () => {
    // Fallback data if API fails
    const fallbackScores = {
      result: [
        { user: '🏆 Champion', score: 1500 },
        { user: '🥈 Runner Up', score: 1200 },
        { user: '🥉 Third Place', score: 900 },
        { user: 'Player4', score: 700 },
        { user: 'Player5', score: 500 }
      ]
    };

    try {
      console.log('📊 Fetching scores from API...');
      const response = await fetch(
        'https://us-central1-js-capstone-backend.cloudfunctions.net/api/games/FCThSszjJRKvlp5DfYXN/scores'
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      gameOptions.scoreList = await response.json();
      console.log('✅ Scores loaded from API');

    } catch (error) {
      console.warn('⚠️ API failed, using fallback scores:', error.message);
      gameOptions.scoreList = fallbackScores;
    }

    // Process scores
    try {
      const arr = gameOptions.scoreList.result || [];
      
      // Reset placeholders
      gameOptions.firstPlace = { user: 'none', score: 0 };
      gameOptions.secondPlace = { user: 'none', score: 0 };
      gameOptions.thirdPlace = { user: 'none', score: 0 };

      // Sort scores (highest first)
      const sorted = [...arr].sort((a, b) => b.score - a.score);

      // Assign top 3
      if (sorted.length > 0) {
        gameOptions.firstPlace = sorted[0] || { user: 'none', score: 0 };
      }
      if (sorted.length > 1) {
        gameOptions.secondPlace = sorted[1] || { user: 'none', score: 0 };
      }
      if (sorted.length > 2) {
        gameOptions.thirdPlace = sorted[2] || { user: 'none', score: 0 };
      }

      console.log('🏆 Top Scores:', {
        first: gameOptions.firstPlace,
        second: gameOptions.secondPlace,
        third: gameOptions.thirdPlace
      });

    } catch (error) {
      console.warn('⚠️ Error processing scores:', error.message);
    }
  }
}
