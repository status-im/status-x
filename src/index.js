var UI = require('./ui.js')
var StatusJS = require('status-js-api')

const DEFAULT_CHANNEL = "mytest";

var ui = new UI();

let channels = [];
ui.availableUsers([{name: "iuri", status: "on"}, {name: "rramos", status: "on"}, {name: "barry", status: "on"}, {name: "satoshi", status: "off"}])

ui.logEntry(`
  Welcome to
    _________ __          __               ____  ___
   /   _____//  |______ _/  |_ __ __  _____\\   \\/  /
   \\_____  \\\\   __\\__  \\\\   __\\  |  \\/  ___/\\     /
   /        \\|  |  / __ \\|  | |  |  /\\___ \\ /     \\
  /_______  /|__| (____  /__| |____//____  >___/\\  \\
          \\/           \\/                \\/      \\_/
  `)

ui.logEntry(`Generating Identify....`)
ui.logEntry(`Connecting to Peers....`)
ui.logEntry(`Rejoining Channels....`)
ui.logEntry(`-----------------------------------------------------------`)

var status = new StatusJS();
status.connect("ws://localhost:8546");

status.joinChat(DEFAULT_CHANNEL, () => {
  ui.logEntry(("Joined #" + DEFAULT_CHANNEL).green.underline)

  channels.push('#' + DEFAULT_CHANNEL);
  ui.availableChannels(channels);

  status.onMessage(DEFAULT_CHANNEL, (err, data) => {
    let msg = JSON.parse(data.payload)[1][0];
    ui.logEntry((data.username + ">").green + " " + msg);
  });
});

ui.events.on('cmd', (cmd) => {
  if (cmd.split(' ')[0] === '/join') {
    let channelName = cmd.split(' ')[1].replace('#','');
    ui.logEntry("joining " + channelName)
    status.joinChat(channelName).then(() => {
      ui.logEntry("joined #" + channelName)

      channels.push('#' + channelName);
      ui.availableChannels(channels);
    })
    return;
  }
  status.sendMessage(DEFAULT_CHANNEL, cmd);
})

