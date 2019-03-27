var time_limit = 390; //only 390 minutes in a trading day
var stocks_on_screen_at_once = 4;
var moveSpeedFactor = 1000;
var jump_height = -500;
var minute_of_day = 0;
var trading_date_str;
var game_width = 600;
var game_height = 600;
var game_max_height = -99999; //just a big number that user will never get up to
var game_bottom = game_height; //will be reset in update function as player rises
var score_money = 0;
var score_height = 0;
var hi_score_money = 0;
var hi_score_height = 0;
var score_text;
var hi_score_text;
var datetime_text;


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

function updateStockMovements(){
  //update yMove (the amount a stock gets moved by in each update loop) of each on screen stock

  stocks.getChildren().forEach(function(stock){
    //the child will be undefined if this stock has just been 
    //off screened (and removed from group) but everything hasn't caught up yet.
    if (stock !== undefined){
      $.ajax({
        url: "/quote",
        data: {"stock": stock.name, "minute_of_day": minute_of_day},
        success: function(percentChange) {
          // minus to get stocks moving up on screen when rising
          stock.yMove = -(parseFloat(percentChange) * moveSpeedFactor);
          console.log("stock:", stock.name, 
                      "minute_of_day:", minute_of_day, 
                      "percentChange:", percentChange, 
                      "yMove:", stock.yMove);
        }
      });
    }
  });

  minute_of_day++;
  if (minute_of_day >= 390){
    gameScene.gameOver()
  }
};


function display_new_stock(){
    //get a stock that isn't currently on screen
    $.ajax({
      url: "/next_stock",
      async: false,
      success: function(stock_name) {
        var x = Phaser.Math.Between(50, game_width - 50);
        var y = Phaser.Math.Between(player.y - 100, player.y + 100);

        stock = stocks.create(x, y, stock_name).setScale(0.75);

        stock.name = stock_name;
        stock.yMove = 0;
        gameScene.physics.add.collider(stock, platforms);

        //options that stop stocks falling down due to gravity
        stock.body.allowGravity = false;
        stock.body.moves = false;
        stock.body.velocity.y = 0;
        stock.setFriction(1, 1);
        stock.setImmovable(true);
      }
    });
};


function stop_displaying_stock(stock){
  $.ajax({
    url: "/off_screened_stock",
    data: {"stock": stock.name}
  });
  stocks.remove(stock, true, true); //two trues to remove from scene and destroy child
};


function update_score_text(){
  score_text.setText('Gains: $ ' + Phaser.Math.RoundTo(score_money) 
                     + '\nHeight: ' + score_height + 'm'); 
  hi_score_text.setText('High Scores:\nGains: $ ' + Phaser.Math.RoundTo(hi_score_money) 
                        + '\nHeight: ' + hi_score_height + 'm'); 
};


function update_datetime_text(){
  //trading day goes from 09.30 to 16.00
  var dt = new Date(trading_date_str.slice(0,4) 
                    + '-'
                    + trading_date_str.slice(4,6) 
                    + '-'
                    + trading_date_str.slice(6,8)
                    + 'T09:30:00');
  dt = new Date(dt.getTime() + minute_of_day*60000);

  //from https://stackoverflow.com/questions/14638018/current-time-formatting-with-javascript
  var options = {  
    weekday: "short", year: "numeric", month: "numeric",  
    day: "numeric", hour: "2-digit", minute: "2-digit"  
  };  
  datetime_text.setText(dt.toLocaleTimeString('en-gb', options));
};

// load asset files for our game
gameScene.preload = function() {
  this.load.image('background', '/static/assets/sky.png');
  this.load.image('ground', '/static/assets/platform.png');
  this.load.spritesheet('dude', '/static/assets/dude.png', { frameWidth: 32, frameHeight: 48 });

  //get date server is using
  $.ajax({
    url: "/trading_day",
    success: function(last_trading_date_str){
      trading_date_str = last_trading_date_str;
    }
  });

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
  });
};



// executed once, after assets were loaded
gameScene.create = function() {

  //allow camera to scroll up, but not past start downward or sideways past width of game
  this.cameras.main.setBounds(0, game_max_height, game_width, -game_max_height + game_height);
  this.physics.world.setBounds(0, game_max_height, game_width, -game_max_height + game_height);

  //background color will only be seen if users scroll past tiles
  this.cameras.main.setBackgroundColor('#33B8FF') //#33B8FF is a light blue color

  // background
  //create 200 tiles stacked on top of each other, figure users will never get above that
  var bg_height = 600;
  for (var i=0; i < 200; i++){
    //flip images in Y for every odd i so they blend into each other
    this.add.image(0, -bg_height * i, 'background').setOrigin(0).setFlipY(i%2!=0);
  };

  //create ground and a helper platform for the start
  platforms = this.physics.add.staticGroup();
  platforms.create(game_width /2 , 
                   game_height - 32, 
                   'ground').setScale(2).refreshBody();
  platforms.create(game_width + 100, game_height - 250, 'ground');


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

  // player is alive
  this.isPlayerAlive = true;

  //  Input Events
  cursors = this.input.keyboard.createCursorKeys();

  // group of stocks
  stocks = this.physics.add.group();

  //create 4 new stock symbols
  for (var i = 0; i < stocks_on_screen_at_once; i++) {
    display_new_stock();
  };

  //function that will update stock movements
  timedEvent = this.time.addEvent({delay: 500, 
                                   callback: updateStockMovements, 
                                   callbackScope: this, 
                                   loop: true});

  this.physics.add.collider(player, stocks);

  //have camera follow player
  this.cameras.main.startFollow(player, true, 0.05, 0.05);

  //add score board
  score_text = this.add.text(10, 10, '',
                             {fontFamily: 'Arial, sans-serif',
                              fontSize: '22px', 
                              fill: '#000'
                             }).setScrollFactor(0);
  hi_score_text = this.add.text(10, 62, '', 
                                {fontFamily: 'Arial, sans-serif',
                                 fontSize: '18px',
                                 //backgroundColor: '#7FFFFFFF',
                                 color: '#757575'
                                }).setScrollFactor(0);
  update_score_text();

  //display used date and time
  datetime_text = this.add.text(game_width-235, 10, '',
                                {fontFamily: 'Arial, sans-serif',
                                 fontSize: '22px',
                                 //backgroundColor: '#7FFFFFFF', 
                                 fill: '#000'
                                }).setScrollFactor(0);
  update_datetime_text();
};



// executed on every frame (60 times per second)
gameScene.update = function() {

  // only if the player is alive
  if (!this.isPlayerAlive) {
    return;
  }

  //clear any tinting on player. It will be reapplied if needed
  player.clearTint();

  //game ends if player hits bottom of screen
  if(player.body.bottom >= game_bottom){
    player.setTintFill(0xff0000); //turn player solid red
    this.gameOver();
    return
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
    player.setVelocityY(jump_height);
  }

  //allow jumping up side of stocks
  /*
  if ((cursors.up.isDown && player.body.touching.left) 
      || (cursors.up.isDown && player.body.touching.right)){
    player.setVelocityY(jump_height/3);

    //push player off surface
    if(player.body.touching.left){
      player.setVelocityX(-jump_height*5)
    } else if (player.body.touching.right){
      player.setVelocityX(jump_height*5)
    }
  }
  */

  //speed up a player's fall if down button held
  if (cursors.down.isDown && !player.body.touching.down)
  {
    player.setVelocityY(player.body.velocity.y + 15);
  }

  //move stocks
  stocks.getChildren().forEach(function(stock){
    //the child will be undefined if this stock has just been 
    //off screened (and removed from group) but everything hasn't caught up yet.
    if (stock !== undefined){

      //check if a player is on this stock
      if (Phaser.Geom.Intersects.RectangleToRectangle(player.getBounds(), stock.getBounds())) {
        //move player with stock
        player.y += stock.yMove;

        //check if stock moving up or down
        if(stock.yMove < 0){
          player.setTint(0x00ff00); //tint green
          score_money += -stock.yMove;
        } else if (stock.yMove > 0){
          player.setTint(0xff0000); //tint red
          score_money -= stock.yMove;
        }
        
      };
      
      stock.y += stock.yMove;

      //if this stock has gone off screen then delete it and create a new one
      if (stock.y >= game_bottom + 20 || stock.y < gameScene.cameras.main.worldView.top - 100){
        stop_displaying_stock(stock);
        display_new_stock();
      };
    };
  });

  //move up bottom of world up to so you can't fall all the way back down
  if (player.y < game_height/2 && this.cameras.main.worldView.bottom < game_bottom){
    //round up as number is negative
    game_bottom = Phaser.Math.CeilTo(this.cameras.main.worldView.bottom);
    this.cameras.main.setBounds(0, 
                                game_max_height, 
                                game_width, 
                                -game_max_height + game_bottom);
    this.physics.world.setBounds(0, 
                                 game_max_height, 
                                 game_width, 
                                 -game_max_height + game_bottom);
    
    score_height = -(game_bottom - game_height)
  };

  update_score_text();
  update_datetime_text();
};

gameScene.gameOver = function() {

  // flag to set player is dead
  this.isPlayerAlive = false;

  // shake the camera
  this.cameras.main.shake(500);

  // fade camera
  //this.time.delayedCall(300, function() {
  // this.cameras.main.fade(700);
  //}, [], this);

  //show end screen
  this.time.delayedCall(1000, function(){
    end_screen_text = this.add.text(
      -64, -30, 
      ('Your score:\nGains: $ ' + Phaser.Math.RoundTo(score_money) 
       + '\nHeight: ' + score_height + 'm'
       + '\n\n\nRestarting...'),
      {fontFamily: 'Arial, sans-serif',
       fontSize: '22px',
       backgroundColor: '#000000',
       fill: '#fff',
       align: 'center',
       padding: 300
      }).setScrollFactor(0);
  }, [], this);

  // restart game
  this.time.delayedCall(5000, function() {
    //update hi scores
    if(score_money > hi_score_money){
      hi_score_money = score_money;
    };
    if(score_height > hi_score_height){
      hi_score_height = score_height;
    };

    //reset defaults
    minute_of_day = 0;
    game_bottom = game_height;
    score_money = 0;
    score_height = 0;
    end_screen_text.visible = false;
    
    this.scene.restart();
  }, [], this);
};




