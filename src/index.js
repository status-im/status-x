var UI = require('./ui.js')
var StatusJS = require('status-js-api')
var Events = require('events');

const DEFAULT_CHANNEL = "mytest";

var ui = new UI();

class User {
  constructor(pubkey, username) {
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

  addUserOrUpdate(user) {
    this.users[user.pubkey] = user
  }

  addOrUpdateUserKey(pubkey, username) {
    if (!this.users[pubkey]) {
      this.users[pubkey] = new User(pubkey, username);
    }
    this.users[pubkey].lastSeen = (new Date().getTime());
    this.users[pubkey].online = true;
    return this.users[pubkey];
  }

	getUsers() {
    let userList = [];
		for (let pubkey in this.users) {
      userList.push(pubkey);
    }
    return userList;
	}
}

class ChannelManager {
  constructor() {
    this.channels = [];
    this.events = new Events();
    this.currentChannel = 0;
    this.allUsers = new Users();
  }

  addChannel(channelName) {
    let channel = {name: channelName, pendingMessages: []};
    channel.users = new Users();
    this.channels.push(channel);
    this.events.emit("update");
  }

  getChannel(channelName) {
    return this.channels.find(c => c.name === channelName);
  }

  getCurrentChannel() {
    return this.channels[this.currentChannel];
  }

  addMessage(channelName, message, pubkey, username) {
    let channel = this.getChannel(channelName);
    if (channelName !== this.channels[this.currentChannel].name) {
      channel.pendingMessages.push({pubkey, username, message});
    } else {
      this.events.emit("newMessage", channelName, username, message);
    }
    let user = this.allUsers.addOrUpdateUserKey(pubkey, username);
    channel.users.addUserOrUpdate(user);

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

	getUsersInCurrentChannel() {
    let channel = this.getCurrentChannel();
    let user_keys = channel.users.getUsers();
		let users = user_keys.map((pubkey) => {
      return this.allUsers.users[pubkey];
		});
    return users;
	}
}

var channels = new ChannelManager();

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

channels.events.on('update', updateUsers);
channels.events.on('channelSwitch', updateUsers);


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

    channels.addMessage(DEFAULT_CHANNEL, msg, data.data.sig, data.username)
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

        channels.addMessage(channelName, msg, data.data.sig, data.username)
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
})

