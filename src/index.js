var UI = require('./ui.js')
var StatusJS = require('status-js-api')
var Events = require('events');

const DEFAULT_CHANNEL = "mytest";

var ui = new UI();

class User {
  constructor(pubkey) {
    this.pubkey = pubkey;
    this.username = username;
    this.online = false;
    this.lastSeen = 0;
  }
}

class Users {
  constructor() {
    this.users = {}
  }

  addUser(user) {
    this.users[user.pubkey] = user
  }
}

class ChannelManager {
  constructor() {
    this.channels = [];
    this.events = new Events();
    this.currentChannel = 0;
  }

  addChannel(channelName) {
    this.channels.push({name: channelName, pendingMessages: []});
    this.events.emit("update");
  }

  getChannel(channelName) {
    return this.channels.find(c => c.name === channelName);
  }

  getCurrentChannel() {
    return this.channels[this.currentChannel];
  }

  addMessage(channelName, message) {
    let channel = this.getChannel(channelName);
    if (channelName !== this.channels[this.currentChannel].name) {
      channel.pendingMessages.push(message);
    }

    this.events.emit("update");
  }

  dumpPendingMessages() {
    let messages = this.channels[this.currentChannel].pendingMessages.slice(0);
    this.channels[this.currentChannel].pendingMessages = [];
    return messages;
  }

  switchChannelIndex(index) {
    if (index < 0) return;
    if (index >= this.channels.length) return;
    this.currentChannel = index;
    this.events.emit("update");
    this.events.emit("channelSwitch");
  }

  getChannelList() {
    return this.channels.map((c) => {
      if (c.name === this.channels[this.currentChannel].name) {
        return `#${c.name}`.green;
      }
      if (c.pendingMessages.length === 0) {
        return `#${c.name}`;
      }
      return `#${c.name} (${c.pendingMessages.length})`;
    });
  }
}

var channels = new ChannelManager();
channels.events.on('update', () => {
  ui.availableChannels(channels.getChannelList());
})
channels.events.on('channelSwitch', () => {
  ui.logEntry("-------------------");
  ui.logEntry("now viewing #" + channels.getCurrentChannel().name);
  channels.dumpPendingMessages().forEach((message) => {
    ui.logEntry(message);
  });
});

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

  channels.addChannel(DEFAULT_CHANNEL);

  status.onMessage(DEFAULT_CHANNEL, (err, data) => {
    let msg = JSON.parse(data.payload)[1][0];
    let message = (data.username + ">").green + " " + msg ;

    channels.addMessage(DEFAULT_CHANNEL, message)
    ui.logEntry(message);
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
        let message = (data.username + ">").green + " " + msg ;

        channels.addMessage(channelName, message)
      });

    })
    return;
  }
  if (cmd.split(' ')[0] === '/s') {
    let channelNumber = cmd.split(' ')[1];
    channels.switchChannelIndex(parseInt(channelNumber, 10));
    return;
  }

  status.sendMessage(DEFAULT_CHANNEL, cmd);
})

