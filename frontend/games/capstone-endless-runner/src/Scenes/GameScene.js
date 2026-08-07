import 'phaser';
import gameOptions from '../Objects/gameOptions';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  preload() {
    // Use center of screen instead of fixed 400, 300
    const { width, height } = this.cameras.main;
    this.add.image(width / 2, height / 2, 'bgPreloader');
    this.score = 0;
    this.model = this.sys.game.globals.model;
  }

  create() {
    const { width, height } = this.cameras.main;
    
    // Scale factors based on original 800x600 design
    const scaleX = width / 800;
    const scaleY = height / 600;
    const scale = Math.min(scaleX, scaleY);
    
    // Store scale for use in other methods
    this.gameScale = scale;

    this.mountainGroup = this.add.group();
    this.platformGroup = this.add.group({
      removeCallback: (platform) => {
        platform.scene.platformPool.add(platform);
      },
    });
    this.platformPool = this.add.group({
      removeCallback: (platform) => {
        platform.scene.platformGroup.add(platform);
      },
    });
    this.coinGroup = this.add.group({
      removeCallback: (coin) => {
        coin.scene.coinPool.add(coin);
      },
    });
    this.coinPool = this.add.group({
      removeCallback: (coin) => {
        coin.scene.coinGroup.add(coin);
      },
    });
    this.fireGroup = this.add.group({
      removeCallback: (fire) => {
        fire.scene.firePool.add(fire);
      },
    });
    this.firePool = this.add.group({
      removeCallback: (fire) => {
        fire.scene.fireGroup.add(fire);
      },
    });

    this.addMountains();

    this.addedPlatforms = 0;
    this.playerJumps = 0;

    // Dynamic platform spawning based on screen size
    const platformY = height * gameOptions.platformVerticalLimit[1];
    this.addPlatform(width, width / 2, platformY);

    // Player starts at 20% of width, 70% of height
    const playerStartX = width * 0.2;
    const playerStartY = height * 0.7;
    this.player = this.physics.add.sprite(playerStartX, playerStartY, 'player');
    this.player.setGravityY(gameOptions.playerGravity * scale);
    this.player.setDepth(2);
    this.player.setScale(scale);

    this.dying = false;

    this.platformCollider = this.physics.add.collider(this.player, this.platformGroup, () => {
      if (!this.player.anims.isPlaying) {
        this.player.anims.play('run');
      }
    }, null, this);

    // Coin collection
    this.physics.add.overlap(this.player, this.coinGroup, (player, coin) => {
      coin.disableBody(true, false);
      this.score += 10;
      if (this.model.soundOn === true) {
        this.bgMusic = this.sound.add('coin', { volume: 0.5, loop: false }).play();
      }

      // Scale score text size
      const fontSize = Math.max(20, 32 * scale);
      this.scoreText.setFontSize(fontSize);
      this.scoreText.setText(`${gameOptions.playerName}'s Score: ${this.score}`);

      this.tweens.add({
        targets: coin,
        y: coin.y - 100 * scale,
        alpha: 0,
        duration: 800,
        ease: 'Cubic.easeOut',
        callbackScope: this,
        onComplete: () => {
          this.coinGroup.killAndHide(coin);
          this.coinGroup.remove(coin);
        },
      });
    }, null, this);

    // Fire collision
    this.physics.add.overlap(this.player, this.fireGroup, () => {
      this.dying = true;
      this.player.anims.play('poison');
      this.player.setFrame(2);
      this.player.body.setVelocityY(-200 * scale);
      this.physics.world.removeCollider(this.platformCollider);
    }, null, this);

    // Touch/click input
    this.input.on('pointerdown', this.jump, this);

    // Score text - positioned dynamically
    const fontSize = Math.max(20, 32 * scale);
    const t = `${gameOptions.playerName}'s Score: 0`;
    this.scoreText = this.add.text(16 * scale, 16 * scale, t, { 
      fontSize: `${fontSize}px`, 
      fill: '#000',
      fontFamily: 'monospace'
    });
  }

  addMountains() {
    const { width, height } = this.cameras.main;
    const rightmostMountain = this.getRightmostMountain();
    if (rightmostMountain < width * 2) {
      const mountain = this.physics.add.sprite(
        rightmostMountain + Phaser.Math.Between(100 * this.gameScale, 350 * this.gameScale), 
        height + Phaser.Math.Between(0, 100 * this.gameScale), 
        'mountain'
      );
      mountain.setOrigin(0.5, 1);
      mountain.body.setVelocityX(gameOptions.mountainSpeed * -1 * this.gameScale);
      mountain.setScale(this.gameScale);
      this.mountainGroup.add(mountain);
      if (Phaser.Math.Between(0, 1)) {
        mountain.setDepth(1);
      }
      mountain.setFrame(Phaser.Math.Between(0, 3));
      this.addMountains();
    }
  }

  getRightmostMountain() {
    let rightmostMountain = -200 * this.gameScale;
    this.mountainGroup.getChildren().forEach((mountain) => {
      rightmostMountain = Math.max(rightmostMountain, mountain.x);
    });
    return rightmostMountain;
  }

  addPlatform(platformWidth, posX, posY) {
    const { width, height } = this.cameras.main;
    const scale = this.gameScale || 1;
    
    this.addedPlatforms += 1;
    let platform;
    if (this.platformPool.getLength()) {
      platform = this.platformPool.getFirst();
      platform.x = posX;
      platform.y = posY;
      platform.active = true;
      platform.visible = true;
      this.platformPool.remove(platform);
      platform.displayWidth = platformWidth;
      platform.tileScaleX = 1 / platform.scaleX;
    } else {
      platform = this.add.tileSprite(posX, posY, platformWidth, 32 * scale, 'platform');
      this.physics.add.existing(platform);
      platform.body.setImmovable(true);
      platform.body.setVelocityX(Phaser.Math.Between(
        gameOptions.platformSpeedRange[0] * scale,
        gameOptions.platformSpeedRange[1] * scale
      ) * -1);
      platform.setDepth(2);
      platform.setScale(scale);
      this.platformGroup.add(platform);
    }
    
    this.nextPlatformDistance = Phaser.Math.Between(
      gameOptions.spawnRange[0] * scale,
      gameOptions.spawnRange[1] * scale
    );

    if (this.addedPlatforms > 1) {
      // Coins
      if (Phaser.Math.Between(1, 100) <= gameOptions.coinPercent) {
        if (this.coinPool.getLength()) {
          const coin = this.coinPool.getFirst();
          coin.x = posX;
          coin.y = posY - 96 * scale;
          coin.alpha = 1;
          coin.active = true;
          coin.visible = true;
          this.coinPool.remove(coin);
          coin.setScale(scale);
        } else {
          const coin = this.physics.add.sprite(posX, posY - 96 * scale, 'coin');
          coin.setImmovable(true);
          coin.setVelocityX(platform.body.velocity.x);
          coin.anims.play('rotate');
          coin.setDepth(2);
          coin.setScale(scale);
          this.coinGroup.add(coin);
        }
      }

      // Fire obstacles
      if (Phaser.Math.Between(1, 100) <= gameOptions.firePercent) {
        if (this.firePool.getLength()) {
          const fire = this.firePool.getFirst();
          fire.x = posX - platformWidth / 2 + Phaser.Math.Between(1 * scale, platformWidth);
          fire.y = posY - 46 * scale;
          fire.alpha = 1;
          fire.active = true;
          fire.visible = true;
          this.firePool.remove(fire);
          fire.setScale(scale);
        } else {
          const fire = this.physics.add.sprite(
            posX - platformWidth / 2 + Phaser.Math.Between(1 * scale, platformWidth), 
            posY - 46 * scale, 
            'fire'
          );
          fire.setImmovable(true);
          fire.setVelocityX(platform.body.velocity.x);
          fire.setSize(8 * scale, 2 * scale, true);
          fire.anims.play('burn');
          fire.setDepth(2);
          fire.setScale(scale);
          this.fireGroup.add(fire);
        }
      }
    }
  }

  jump() {
    const { height } = this.cameras.main;
    const scale = this.gameScale || 1;
    
    if ((!this.dying) && (this.player.body.touching.down
      || (this.playerJumps > 0 && this.playerJumps < gameOptions.jumps))) {
      if (this.player.body.touching.down) {
        this.playerJumps = 0;
      }
      this.player.setVelocityY(gameOptions.jumpForce * -1 * scale);
      this.playerJumps += 1;

      this.player.anims.stop();
      if (this.model.soundOn === true) {
        this.bgMusic = this.sound.add('jump', { volume: 0.5, loop: false }).play();
      }
    }
  }

  update() {
    const { width, height } = this.cameras.main;
    const scale = this.gameScale || 1;

    if (this.player.y > height) {
      gameOptions.actualScore = this.score;
      this.scene.start('GameOver');
      this.insertScore();
    }

    this.player.x = width * 0.2;

    let minDistance = width;
    let rightmostPlatformHeight = 0;
    this.platformGroup.getChildren().forEach((platform) => {
      const platformDistance = width - platform.x - platform.displayWidth / 2;
      if (platformDistance < minDistance) {
        minDistance = platformDistance;
        rightmostPlatformHeight = platform.y;
      }
      if (platform.x < -platform.displayWidth / 2) {
        this.platformGroup.killAndHide(platform);
        this.platformGroup.remove(platform);
      }
    }, this);

    this.coinGroup.getChildren().forEach((coin) => {
      if (coin.x < -coin.displayWidth / 2) {
        this.coinGroup.killAndHide(coin);
        this.coinGroup.remove(coin);
      }
    }, this);

    this.fireGroup.getChildren().forEach((fire) => {
      if (fire.x < -fire.displayWidth / 2) {
        this.fireGroup.killAndHide(fire);
        this.fireGroup.remove(fire);
      }
    }, this);

    this.mountainGroup.getChildren().forEach((mountain) => {
      if (mountain.x < -mountain.displayWidth) {
        const rightmostMountain = this.getRightmostMountain();
        mountain.x = rightmostMountain + Phaser.Math.Between(100 * scale, 350 * scale);
        mountain.y = height + Phaser.Math.Between(0, 100 * scale);
        mountain.setFrame(Phaser.Math.Between(0, 3));
        if (Phaser.Math.Between(0, 1)) {
          mountain.setDepth(1);
        }
      }
    }, this);

    if (minDistance > this.nextPlatformDistance) {
      const nextPlatformWidth = Phaser.Math.Between(
        gameOptions.platformSizeRange[0] * scale,
        gameOptions.platformSizeRange[1] * scale
      );
      const platformRandomHeight = gameOptions.platformHeighScale * Phaser.Math.Between(
        gameOptions.platformHeightRange[0] * scale,
        gameOptions.platformHeightRange[1] * scale
      );
      const nextPlatformGap = rightmostPlatformHeight + platformRandomHeight;
      const minPlatformHeight = height * gameOptions.platformVerticalLimit[0];
      const maxPlatformHeight = height * gameOptions.platformVerticalLimit[1];
      const nextPlatformHeight = Phaser.Math.Clamp(
        nextPlatformGap, minPlatformHeight, maxPlatformHeight
      );
      this.addPlatform(
        nextPlatformWidth,
        width + nextPlatformWidth / 2,
        nextPlatformHeight
      );
    }
  }

  insertScore = async () => {
    const response = '';
    if (this.score > gameOptions.thirdPlace.score) {
      try {
        const settings = {
          method: 'POST',
          mode: 'cors',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ user: gameOptions.playerName, score: this.score }),
        };
        this.response = await fetch('https://us-central1-js-capstone-backend.cloudfunctions.net/api/games/FCThSszjJRKvlp5DfYXN/scores', settings);
      } catch (error) {
        this.response = 'Error!';
      }
    }
    return response;
  }
}
