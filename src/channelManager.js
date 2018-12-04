var Events = require('events');

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
    this.users = {};
  }

  addUserOrUpdate(user) {
    this.users[user.pubkey] = user;
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

  updateUsersState() {
    let currentTime = (new Date().getTime());
    for (let pubkey in this.users) {
      let user = this.users[pubkey];
      if (currentTime - user.lastSeen > 10*1000) {
        user.online = false;
      }
    }
  }

}

class ChannelManager {
  constructor() {
    this.channels = [];
    this.events = new Events();
    this.currentChannel = 0;
    this.allUsers = new Users();
  }

  addChannel(channelName, type, extraData) {
    if(this.getChannel(channelName)) return;

    let channel = {name: channelName, pendingMessages: [], type, ...extraData};
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

      const prefix = c.type === 'channel' ? '#' : '';

      if (c.name === this.channels[this.currentChannel].name) {
        return `${prefix}${c.name}`.green;
      }
      if (c.pendingMessages.length === 0) {
        return `${prefix}${c.name}`;
      }
      return `${prefix}${c.name} (${c.pendingMessages.length})`;
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

module.exports = ChannelManager;
