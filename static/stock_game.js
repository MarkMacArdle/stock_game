var time_limit = 390; //only 390 minutes in a trading day
var stocks_on_screen_at_once = 4;
var moveSpeedFactor = 1000;
var xMove = 0; //only move vertically for now
var minute_of_day = 0;
var game_width = 800;
var game_height = 660;
var game_max_height = -99999;
var game_bottom = game_height; //will be reset in update function as player rises


// create a new scene named "Game"
let gameScene = new Phaser.Scene('Game');

// some parameters for our scene
gameScene.init = function() {
  this.playerSpeed = 1.5;
}

// our game's configuration
let config = {
  type: Phaser.AUTO,
  width: game_width,
  height: game_height,
  scene: gameScene,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 500 },
      debug: false
    }
  }
};

// create the game, and pass it the configuration
let game = new Phaser.Game(config);

function updateStockMovements()
{

// enemy movement and collision
  let enemies = gameScene.enemies.getChildren();
  let numEnemies = enemies.length;

  for (let i = 0; i < numEnemies; i++) {
    $.ajax({
      url: "/quote",
      data: {"stock": enemies[i].name, "minute_of_day": minute_of_day},
      success: function(percentChange) {
        // minus to get stocks moving up on screen when rising
        enemies[i].yMove = -(parseFloat(percentChange) * moveSpeedFactor);
        console.log("stock:", enemies[i].name, "minute_of_day:", minute_of_day, "percentChange:", percentChange, "yMove:", enemies[i].yMove);
      }
    });
  }

  minute_of_day++;
  if (minute_of_day >= 390){
    gameScene.gameOver()
  }
};

function display_new_stock(stock){
  var x = Phaser.Math.Between(50, game_width - 50)
  var y = Phaser.Math.Between(player.y - 400, player.y + 100)

  enemy = gameScene.enemies.create(x, y, stock);

  enemy.name = stock;
  enemy.yMove = 0;
  enemy.setScale = 0.5;
  gameScene.physics.add.collider(enemy, platforms);

  //options that stop stocks falling down due to gravity
  enemy.body.allowGravity = false;
  enemy.body.moves = false;
  enemy.body.velocity.y = 0;
  enemy.setFriction(1, 1);
  enemy.setImmovable(true);
};


// load asset files for our game
gameScene.preload = function() {
  this.load.image('background', '/static/assets/sky.png');
  this.load.image('ground', '/static/assets/platform.png');
  this.load.spritesheet('dude', '/static/assets/dude.png', { frameWidth: 32, frameHeight: 48 });

  //load the logos
  $.ajax({
    url: "/stocks_and_logos",
    async: false, //false as want to be sure all images load in this preload section
    success: function(json) {
      //don't know why but json we want is nested inside returned object
      stocks_and_logos_json = json["stocks_and_logos_json"]

      //load all the logo images
      for (var key in stocks_and_logos_json) {
        //.hasOwnProperty() needed as a json has meta attributes with key-value 
        //pairs too but don't want to loop over them. From here:
        //https://stackoverflow.com/questions/684672/how-do-i-loop-through-or-enumerate-a-javascript-object
        if (stocks_and_logos_json.hasOwnProperty(key)) {
          path = '/static/assets/stock_logos/' + stocks_and_logos_json[key];
          console.log('loading: key:' + key + ', path:' + path);
          gameScene.load.image(key, path);
        };
      };
    },
    error: function(xhr) {
      //Do Something to handle error
    }
  });

  this.load.image('player', '/static/assets/player.png');
  this.load.image('treasure', '/static/assets/stock_logos/AAL.png');



};



// executed once, after assets were loaded
gameScene.create = function() {

  // background
  let bg = this.add.sprite(0, 0, 'background');
  bg.setOrigin(0, 0);


  //allow camera to scroll up, but not past start downward or sideways past width of game
  //this.cameras.main.setPosition(0,0);
  this.cameras.main.setBounds(0, game_max_height, game_width, -game_max_height + game_height);
  this.physics.world.setBounds(0, game_max_height, game_width, -game_max_height + game_height);

  // reset camera
  this.cameras.main.resetFX();

  //  Here we create the ground.
  platforms = this.physics.add.staticGroup();
  platforms.create(game_width /2 , 
                   game_height - 32, 
                   'ground').setScale(2).refreshBody(); 

  // player
  player = this.physics.add.sprite(40, game_height / 2, 'dude');
  player.setCollideWorldBounds(true);
  this.physics.add.collider(player, platforms);

  //  Our player animations, turning, walking left and walking right.
  this.anims.create({
    key: 'left',
    frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
  });

  this.anims.create({
    key: 'turn',
    frames: [ { key: 'dude', frame: 4 } ],
    frameRate: 20
  });

  this.anims.create({
    key: 'right',
    frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
    frameRate: 10,
    repeat: -1
  });

  //  Input Events
  cursors = this.input.keyboard.createCursorKeys();

  // goal
  this.treasure = this.add.sprite(game_width - 80, game_height / 2, 'treasure');
  this.treasure.setScale(0.6);


  // group of enemies
  this.enemies = this.physics.add.group();

  //create 4 new stock symbols
  for (var i = 0; i < stocks_on_screen_at_once; i++) {
    //get a stock that isn't currently on screen
    $.ajax({
      url: "/next_stock",
      success: function(stock) {
        display_new_stock(stock)
      }
    });
  };
  
  //Phaser.Actions.ScaleXY(this.enemies.getChildren(), -0.4, -0.4);

  this.physics.add.collider(player, this.enemies);

  // player is alive
  this.isPlayerAlive = true;

  //have camera follow player
  this.cameras.main.startFollow(player, true, 0.05, 0.05);  


  //function that will update stock movements
  timedEvent = this.time.addEvent({delay: 500, 
                                   callback: updateStockMovements, 
                                   callbackScope: this, 
                                   loop: true});
};



// executed on every frame (60 times per second)
gameScene.update = function() {

  // only if the player is alive
  if (!this.isPlayerAlive) {
    return;
  }

  //game ends if player hits bottom of screen
  if(player.body.bottom >= game_bottom){
    this.gameOver()
  }


  if (cursors.left.isDown)
  {
    player.setVelocityX(-160);
    player.anims.play('left', true);
  }
  else if (cursors.right.isDown)
  {
    player.setVelocityX(160);
    player.anims.play('right', true);
  }
  else
  {
    player.setVelocityX(0);
    player.anims.play('turn');
  }

  if (cursors.up.isDown && player.body.touching.down)
  {
    player.setVelocityY(-700);
  }

  //allow players speed up their fall by holding the down button
  if (cursors.down.isDown && !player.body.touching.down)
  {
    //increase their existing velocity
    player.setVelocityY(player.body.velocity.y + 15);
  }

  // treasure collision
  if (Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), this.treasure.getBounds())) {
    this.gameOver();
  }

  // enemy movement and collision
  let enemies = this.enemies.getChildren();
  let numEnemies = enemies.length;

  for (let i = 0; i < numEnemies; i++) {
    //check if stock still on screen


    // move enemies
    //enemies[i].speed = yMove;
    enemies[i].allowGravity = false;
    enemies[i].body.velocity.y = 0;

    //if a player is on this stock move them with it
    if (Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), enemies[i].getBounds())) {
      player.y += enemies[i].yMove;
    };
    
    enemies[i].y += enemies[i].yMove;

    // enemy collision
    //if (Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), enemies[i].getBounds())) {
    //  this.gameOver();
    //  break;
    //}
  };

  //move up bottom of world up to so you can't fall all the way back down
  if (player.y < game_height/2 && this.cameras.main.worldView.bottom < game_bottom){
    game_bottom = this.cameras.main.worldView.bottom;
    console.log('updated game_bottom to:', game_bottom);
    this.cameras.main.setBounds(0, 
                                game_max_height, 
                                game_width, 
                                -game_max_height + game_bottom);
    this.physics.world.setBounds(0, 
                                 game_max_height, 
                                 game_width, 
                                 -game_max_height + game_bottom);
  };

};

gameScene.gameOver = function() {

  // flag to set player is dead
  this.isPlayerAlive = false;

  // shake the camera
  this.cameras.main.shake(500);

  // fade camera
  this.time.delayedCall(250, function() {
    this.cameras.main.fade(250);
  }, [], this);

  // restart game
  this.time.delayedCall(500, function() {
    minute_of_day = 0;
    game_bottom = game_height;
    this.scene.restart();
  }, [], this);
};




