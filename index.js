'use strict';

var five = require('johnny-five');

// LASER STATE CONSTANTS
var DEFENSE_OFF = 'off',
  DEFENSE_READY = 'blink',
  DEFENSE_SHOOT = 'on';

// DISTANCES
var MIN_DISTANCE = 10,
  MAX_DISTANCE = 30,
  BREAKPOINT_PERCENTAGE = 50,
  DISTANCE_RANGE = MAX_DISTANCE - MIN_DISTANCE, // 20
  BREAKPOINT_CMS = MIN_DISTANCE + DISTANCE_RANGE * BREAKPOINT_PERCENTAGE / 100; // 20

// STATE
var distance = null,
  shooting = false,
  defenseState = null,
  laser = null;

// DETECT
var detectBoard = new five.Board({
  port: '/dev/ttyACM0'
});
detectBoard.on('ready', function() {

  // asteroid proximity sensor
  var proximity = new five.Proximity({
    controller: 'GP2Y0A21YK',
    pin: 'A0',
    board: detectBoard
  });

  // alarm LED
  var alarmRGB = new five.Led.RGB({
    pins: [6, 5, 3],
    isAnode: true,
    board: detectBoard
  });

  // listen to proximity changes
  proximity.on('change', function() {
    distance = this.cm;
    alarmRGB.color(convertToColor(this.cm));
    updateDefense();
  });

});

// DEFENSE
var defenseBoard = new five.Board({
  port: '/dev/ttyACM1'
});
defenseBoard.on('ready', function() {

  // laser shoot
  laser = new five.Led({
    pin: 8,
    board: defenseBoard
  });

  // laser shoot control
  var button = new five.Button({
    pin: 2,
    board: defenseBoard
  });

  // laser pan/tilt
  var xServo = new five.Servo({
    pin: 9,
    board: defenseBoard
  });
  var yServo = new five.Servo({
    pin: 10,
    board: defenseBoard
  });

  // laser pan/tilt control
  var joystick = new five.Joystick({
    pins: ['A0', 'A1'],
    board: defenseBoard
  });

  // binds joystick movements to servos
  joystick.on('change', function() {

    if (defenseState && defenseState !== DEFENSE_OFF) {
      // we are defending
      xServo.to(90 - this.x * 180);
      yServo.to(90 + this.y * 180);
    }

  });

  // Binds button state to shooting flag
  button.on('press', function() {
    shooting = true;
    updateDefense();
  });
  button.on('release', function() {
    shooting = false;
    updateDefense();
  });

});

function updateDefense() {

  // Sets the new state
  var newState;
  if (distance === null || distance > BREAKPOINT_CMS) {
    // if asteroid is far away sets state to OFF
    newState = DEFENSE_OFF;
  } else {
    // if asteroid is close

    // if shooting sets state to SHOOT, else sets it to READY
    newState = shooting ? DEFENSE_SHOOT : DEFENSE_READY;
  }

  if (laser && newState !== defenseState) {
    // if there was a state change

    // stops any laser animation (if they are)
    laser.stop();

    // sets the new state
    defenseState = newState;

    // changes the laser state laser.off() | laser.blink() | laser.on()
    laser[newState]();
  }

  console.log('distance: ' + Math.floor(distance) + ' button: ' + shooting);
}

function convertToColor (cm) {
  // MIN_DISTANCE cms -> #00FF00 | BREAKPOINT_PERCENTAGE cms -> #FFFF00 | MAX_DISTANCE cms -> #FF0000

  // gets the value between 0 and the distance range (30 - 10 = 20cms)
  var onRangeValue = cm > MAX_DISTANCE && DISTANCE_RANGE || cm - MIN_DISTANCE > 0 && cm - MIN_DISTANCE || 0,
  
    // gets the distance percentage
    percentage = onRangeValue * 100 / DISTANCE_RANGE,
    // gets the difference between the distance percentage and the breakpoint percentage (50%)
    percentageDiff = BREAKPOINT_PERCENTAGE - percentage,

    // percentageDiff <= 0 only happens when the distance percentage is greater or equal than breakpoint percentage
    // that means that the asteroid is far away (from green to yellow), we are safe
    // percentageDiff > 0 means that the asteroid is really close (from yellow to red)

    // if the asteroid the far away sets redColor from 0 to 255 (green needs no red, but yellow uses red 255)
    // else sets it to 255 (yellow and red uses red 255)
    redColor = percentageDiff <= 0 ? 255 + percentageDiff * 255 / (100 - BREAKPOINT_PERCENTAGE) : 255,

    // if the asteroid the far away sets greenColor to 255 (green and yellow uses green 255)
    // else sets it from 255 to 0 (yellow uses green 255, but red uses no green)
    greenColor = percentageDiff <= 0 ? 255 : 255 - percentageDiff * 255 / BREAKPOINT_PERCENTAGE;

  return '#' + toHex(redColor) + toHex(greenColor) + '00';
}

function toHex (number) {
  return (number < 16 ? '0' : '') + Math.floor(number).toString(16);
}