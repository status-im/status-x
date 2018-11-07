var UI = require('./ui.js');
var StatusJS = require('status-js-api');
var ChannelManager = require('./channelManager.js');

const DEFAULT_CHANNEL = "mytest";

var ui = new UI();

var channels = new ChannelManager();

let usersTyping = {};

channels.events.on('update', () => {
  ui.availableChannels(channels.getChannelList());
});

channels.events.on('channelSwitch', () => {
  ui.logEntry("-------------------");
  ui.logEntry("now viewing #" + channels.getCurrentChannel().name);
  channels.dumpPendingMessages().forEach((message) => {
  let msg = (message.username + ">").green + " " + message.message;
    ui.logEntry(msg);
  });
});

channels.events.on('newMessage', (channelName, username, message) => {
  let msg = (username + ">").green + " " + message;
  ui.logEntry(msg);
});

var updateUsers = function() {
  let users = channels.getUsersInCurrentChannel().map((x) => {
    return {name: x.username, status: (x.online ? "on" : "offline")}
  });
  //ui.availableUsers([{name: "iuri", status: "on"}, {name: "rramos", status: "on"}, {name: "barry", status: "on"}, {name: "satoshi", status: "off"}])
  ui.availableUsers(users)
}

var handleProtocolMessages = function(channelName, data) {
  // TODO: yes this is ugly, can be moved to the lib level
 let msg = JSON.parse(JSON.parse(data.payload)[1][0]);
  let fromUser = data.data.sig;

  if (msg.type === 'ping') {
    let user = channels.allUsers.addOrUpdateUserKey(fromUser, data.username);
    let channel = channels.getChannel(channelName);
    channel.users.addUserOrUpdate(user);
    channels.events.emit("update");
 }

  if (msg.type === 'typing') {
    usersTyping[fromUser] = (new Date().getTime());
  }
}

channels.events.on('update', updateUsers);
channels.events.on('channelSwitch', updateUsers);

setInterval(function() {
  let typingUsers = [];
  let currentTime = (new Date().getTime());
  for (let pubkey in usersTyping) {
    let lastTyped = usersTyping[pubkey];
  if (currentTime - lastTyped > 5*1000 || currentTime < lastTyped) {
      delete usersTyping[pubkey];
  } else {
   if (channels.allUsers.users[pubkey]) {
     typingUsers.push(channels.allUsers.users[pubkey].username);
      }
  }
  }

 if (typingUsers.length === 0) {
   ui.consoleState.setContent("");
  return;
 }
  if (typingUsers.length === 1) {
   ui.consoleState.setContent(typingUsers[0] + " is typing");
    return;
  }

 ui.consoleState.setContent(typingUsers.join(', ') + " are typing");
}, 3*1000);

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

setInterval(function() {
  status.sendJsonMessage(channels.getCurrentChannel().name, {type: "ping"});

  channels.allUsers.updateUsersState();
}, 5 * 1000);

status.joinChat(DEFAULT_CHANNEL, () => {
  ui.logEntry(("Joined #" + DEFAULT_CHANNEL).green.underline)

  channels.addChannel(DEFAULT_CHANNEL);

  status.onMessage(DEFAULT_CHANNEL, (err, data) => {
    let msg = JSON.parse(data.payload)[1][0];

    if (JSON.parse(data.payload)[1][1] === 'content/json') {
      handleProtocolMessages(DEFAULT_CHANNEL, data);
    } else {
      channels.addMessage(DEFAULT_CHANNEL, msg, data.data.sig, data.username)
    }
  });
});

ui.events.on('cmd', (cmd) => {
  if (cmd.split(' ')[0] === '/join') {
    let channelName = cmd.split(' ')[1].replace('#','');
    ui.logEntry("joining " + channelName)
    status.joinChat(channelName).then(() => {
      ui.logEntry("joined #" + channelName)

      channels.addChannel(channelName);

      status.onMessage(channelName, (err, data) => {
        let msg = JSON.parse(data.payload)[1][0];

        if (JSON.parse(data.payload)[1][1] === 'content/json') {
          handleProtocolMessages(channelName, data);
        } else {
          channels.addMessage(channelName, msg, data.data.sig, data.username)
        }
      });

    })
    return;
  }
  if (cmd.split(' ')[0] === '/s') {
    let channelNumber = cmd.split(' ')[1];
    channels.switchChannelIndex(parseInt(channelNumber, 10));
    return;
  }

  status.sendMessage(channels.getCurrentChannel().name, cmd);
});

ui.events.on('typing', () => {
  // TODO: use async.cargo instead and/or a to avoid unnecessary requests
 status.sendJsonMessage(channels.getCurrentChannel().name, {type: "typing"});
});

