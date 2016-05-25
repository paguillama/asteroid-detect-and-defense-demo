'use strict';

var five = require('johnny-five');

var MIN_DISTANCE = 10;
var MAX_DISTANCE = 30;
var BREAKPOINT_PERCENTAGE = 50;

var DEFENSE_OFF = 'off';
var DEFENSE_READY = 'blink';
var DEFENSE_SHOOT = 'on';

var DISTANCE_RANGE = MAX_DISTANCE - MIN_DISTANCE; // 20
var BREAKPOINT_CMS = MIN_DISTANCE + DISTANCE_RANGE * BREAKPOINT_PERCENTAGE / 100; // 20

var distance = null;

// DETECT
var detectBoard = new five.Board({
  port: '/dev/ttyACM0'
});
detectBoard.on('ready', function() {
  // Asteroid detector
  var proximity = new five.Proximity({
    controller: 'GP2Y0A21YK',
    pin: 'A0',
    board: detectBoard
  });

  // Alarm light
  var alarmRGB = new five.Led.RGB({
    pins: [6, 5, 3],
    isAnode: true,
    board: detectBoard
  });

  // Listen proximity changes
  proximity.on('change', function() {
    distance = this.cm;
    alarmRGB.color(convertToColor(this.cm));
    updateDefense();
  });

});

// DEFENSE
var laser = null,
  shooting = false;
var defenseBoard = new five.Board({
  port: '/dev/ttyACM1'
});
defenseBoard.on('ready', function() {
  // Laser shoot
  laser = new five.Led({
    pin: 8,
    board: defenseBoard
  });

  // Laser shoot control
  var button = new five.Button({
    pin: 2,
    board: defenseBoard
  });

  // Laser pan/tilt
  var xServo = new five.Servo({
    pin: 9,
    board: defenseBoard
  });
  var yServo = new five.Servo({
    pin: 10,
    board: defenseBoard
  });

  // Laser pan/tilt control
  var joystick = new five.Joystick({
    pins: ['A0', 'A1'],
    board: defenseBoard
  });

  // Binds joystick movements to servos
  joystick.on('change', function() {
    if (defenseState && defenseState !== DEFENSE_OFF) {
      xServo.to(90 - this.x * 180);
      yServo.to(90 + this.y * 180);
    }
  });

  button.on('press', function() {
    shooting = true;
    updateDefense();
  });

  button.on('release', function() {
    shooting = false;
    updateDefense();
  });

});

var defenseState = null;
function updateDefense() {
  var newState = defenseState;

  if (distance === null || distance > BREAKPOINT_CMS) {
    newState = DEFENSE_OFF;
  } else {
    newState = shooting ? DEFENSE_SHOOT : DEFENSE_READY;
  }

  if (laser && newState !== defenseState) {
    laser.stop();
    defenseState = newState;
    laser[newState](); // laser.off() | laser.blink() | laser.on()
  }

  console.log('distance: ' + Math.floor(distance) + ' button: ' + shooting);
}

function convertToColor (cm) {
  // MIN_DISTANCE cms -> #00FF00 | BREAKPOINT_PERCENTAGE cms -> #FFFF00 | MAX_DISTANCE cms -> #FF0000

  var onRangeValue = cm > MAX_DISTANCE && DISTANCE_RANGE || cm - MIN_DISTANCE > 0 && cm - MIN_DISTANCE || 0,
    percentage = onRangeValue * 100 / DISTANCE_RANGE,
    percentageDiff = BREAKPOINT_PERCENTAGE - percentage,
    r = percentageDiff <= 0 ? 255 + percentageDiff * 255 / (100 - BREAKPOINT_PERCENTAGE) : 255,
    g = percentageDiff <= 0 ? 255 : 255 - percentageDiff * 255 / BREAKPOINT_PERCENTAGE;

  return '#' + toHex(r) + toHex(g) + '00';
}

function toHex (number) {
  return (number < 16 ? '0' : '') + Math.floor(number).toString(16);
}