import 'phaser';

export default class PreGameScene extends Phaser.Scene {
  constructor() {
    super('PreGame');
  }

  preload() {
    // All assets loading - this part is fine
    this.load.image('platform', 'assets/objects/platform2.png');

    this.load.spritesheet('player', 'assets/objects/player-all50.png', {
      frameWidth: 50,
      frameHeight: 48,
    });

    this.load.spritesheet('coin', 'assets/objects/gem20.png', {
      frameWidth: 20,
      frameHeight: 20,
    });

    this.load.spritesheet('fire', 'assets/objects/frog60.png', {
      frameWidth: 60,
      frameHeight: 70,
    });

    this.load.spritesheet('mountain', 'assets/objects/mountain5.png', {
      frameWidth: 512,
      frameHeight: 512,
    });
    
    // ===== ADD LOADING INDICATOR FOR MOBILE =====
    const { width, height } = this.cameras.main;
    
    // Show loading text on mobile
    const loadingText = this.add.text(width / 2, height / 2, 'Loading Game...', {
      fontSize: '24px',
      fill: '#ffffff',
      fontFamily: 'monospace'
    });
    loadingText.setOrigin(0.5, 0.5);
    
    // Loading progress bar
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0xffffff, 0.2);
    progressBox.fillRect(width / 2 - 160, height / 2 + 40, 320, 20);
    
    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0x00BFFF, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 + 45, 310 * value, 10);
    });
    
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }

  create() {
    // ===== CREATE ANIMATIONS =====
    this.anims.create({
      key: 'run',
      frames: this.anims.generateFrameNumbers('player', {
        start: 0,
        end: 5,
      }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'poison',
      frames: [{ key: 'player', frame: 7 }],
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'rotate',
      frames: this.anims.generateFrameNumbers('coin', {
        start: 0,
        end: 4,
      }),
      frameRate: 15,
      yoyo: true,
      repeat: -1,
    });

    this.anims.create({
      key: 'burn',
      frames: this.anims.generateFrameNumbers('fire', {
        start: 0,
        end: 3,
      }),
      frameRate: 8,
      repeat: -1,
    });

    // ===== START GAME =====
    this.scene.start('Game');
  }
}
