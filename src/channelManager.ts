const Events = require("events");
import colors from "colors";

class ChannelManager {
  public channels: any[];
  public events: any;
  private currentChannel: number;

  constructor() {
    this.channels = [];
    this.events = new Events();
    this.currentChannel = 0;
  }

  public addChannel(channelName: string, channelObject: any) {
    const channel = {name: channelName, pendingMessages: [], channel: channelObject, users: [], typingUsers: []};
    this.channels.push(channel);
    this.currentChannel = this.channels.length;
    this.events.emit("channelSwitch");
    this.events.emit("updateChannels", this.getChannelList());
  }

  public getChannel(channelName: string) {
    return this.channels.find((c) => c.name === channelName);
  }

  public updateChannelUsers(channelName: string, users: any) {
    this.getChannel(channelName).users = users;
    this.events.emit("updateUsers", channelName, users);
  }

  public updateChannelTypingUsers(channelName: string, typingUsers: any) {
    this.getChannel(channelName).typingUsers = typingUsers;
    this.events.emit("updateTypingUsers", channelName, typingUsers);
  }

  public getCurrentChannel() {
    return this.channels[this.currentChannel - 1];
  }

  public addMessage(channelName: string, message: string, pubkey: string, username: string) {
    const channel = this.getChannel(channelName);
    if (channelName !== this.getCurrentChannel().name) {
      channel.pendingMessages.push({pubkey, username, message});
    } else {
      this.events.emit("newMessage", channelName, username, message);
    }
    this.events.emit("update");
  }

  public dumpPendingMessages() {
    const messages = this.getCurrentChannel().pendingMessages.slice(0);
    this.getCurrentChannel().pendingMessages = [];
    return messages;
  }

  public switchChannelIndex(index: number) {
    if (index <= 0) {
      return;
    }
    if (index > this.channels.length) {
      return;
    }
    this.currentChannel = index;
    this.events.emit("channelSwitch");
    this.events.emit("updateChannels", this.getChannelList());
  }

  public getChannelList() {
    return this.channels.map((c) => {
      const prefix = c.type === "channel" ? "#" : "";

      if (c.name === this.getCurrentChannel().name) {
        return colors.green(`${prefix}${c.name}`);
      }
      if (c.pendingMessages.length === 0) {
        return `${prefix}${c.name}`;
      }
      return `${prefix}${c.name} (${c.pendingMessages.length})`;
    });
  }
}

export default ChannelManager;

