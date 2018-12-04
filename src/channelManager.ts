const Events = require("events");
import Users from "./users";
import colors from "colors";

class ChannelManager {
  public channels: any[];
  public events: any;
  public allUsers: Users;
  private currentChannel: number;

  constructor() {
    this.channels = [];
    this.events = new Events();
    this.currentChannel = 0;
    this.allUsers = new Users();
  }

  public addChannel(channelName: string, type: string, extraData?: any) {
    if (this.getChannel(channelName)) {
      return;
    }

    const channel = {name: channelName, pendingMessages: [], type, ...extraData};
    channel.users = new Users();
    this.channels.push(channel);
    this.events.emit("update");
  }

  public getChannel(channelName: string) {
    return this.channels.find((c) => c.name === channelName);
  }

  public getCurrentChannel() {
    return this.channels[this.currentChannel];
  }

  public addMessage(channelName: string, message: string, pubkey: string, username: string) {
    const channel = this.getChannel(channelName);
    if (channelName !== this.channels[this.currentChannel].name) {
      channel.pendingMessages.push({pubkey, username, message});
    } else {
      this.events.emit("newMessage", channelName, username, message);
    }
    const user = this.allUsers.addOrUpdateUserKey(pubkey, username);
    channel.users.addUserOrUpdate(user);

    this.events.emit("update");
  }

  public dumpPendingMessages() {
    const messages = this.channels[this.currentChannel].pendingMessages.slice(0);
    this.channels[this.currentChannel].pendingMessages = [];
    return messages;
  }

  public switchChannelIndex(index: number) {
    if (index < 0) {
      return;
    }
    if (index >= this.channels.length) {
      return;
    }
    this.currentChannel = index;
    this.events.emit("update");
    this.events.emit("channelSwitch");
  }

  public getChannelList() {
    return this.channels.map((c) => {
      const prefix = c.type === "channel" ? "#" : "";

      if (c.name === this.channels[this.currentChannel].name) {
        return colors.green(`${prefix}${c.name}`);
      }
      if (c.pendingMessages.length === 0) {
        return `${prefix}${c.name}`;
      }
      return `${prefix}${c.name} (${c.pendingMessages.length})`;
    });
  }

  public getUsersInCurrentChannel() {
    const channel = this.getCurrentChannel();
    const userKeys = channel.users.getUsers();
    const users = userKeys.map((pubkey: string) => {
      return this.allUsers.users[pubkey];
    });
    return users;
  }
}

export default ChannelManager;
