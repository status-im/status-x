import StatusJSClient from "./status-js-client/index";
import UI from "./ui";
import ChannelManager from "./channelManager";

const ui = new UI();

ui.logEntry(`
  Welcome to
    _________ __          __               ____  ___
   /   _____//  |______ _/  |_ __ __  _____\\   \\/  /
   \\_____  \\\\   __\\__  \\\\   __\\  |  \\/  ___/\\     /
   /        \\|  |  / __ \\|  | |  |  /\\___ \\ /     \\
  /_______  /|__| (____  /__| |____//____  >___/\\  \\
          \\/           \\/                \\/      \\_/
  `);

ui.logEntry(`Generating Identity....`);
ui.logEntry(`Connecting to Peers....`);
ui.logEntry(`Rejoining Channels....`);

(async () => {
  const status = new StatusJSClient();
  await status.connectToNode("ws://localhost:8546")
  const userPubKey = await status.getPublicKey();

  ui.logEntry(`PK:  ${userPubKey}`);
  ui.logEntry(`-----------------------------------------------------------`);

  const channelManager = new ChannelManager();

  ui.events.on("cmd", async (cmd: string) => {
    if (cmd.split(" ")[0] === "/join") {
      const channelName = cmd.split(" ")[1].replace("#", "");

      ui.logEntry("joining " + channelName);

      if (channelManager.getChannel(channelName)) {
        return ui.logEntry("you already joined this channel. you can switch channel with the /s <number> command");
      }

      let channel = await status.joinChannel(channelName);
      channelManager.addChannel(channelName, channel);

      channel.messagesObserver.subscribe((msg) => {
        channelManager.addMessage(channelName, msg.message, msg.pubkey, msg.username);
      });

      channel.usersObserver.subscribe((users) => {
        channelManager.updateChannelUsers(channelName, users);
      })

      channel.usersTypingObserver.subscribe((typingUsers) => {
        channelManager.updateChannelTypingUsers(channelName, typingUsers);
      });

      return;
    }

    if (cmd.split(" ")[0] === "/s") {
      const channelNumber = cmd.split(" ")[1];
      channelManager.switchChannelIndex(parseInt(channelNumber, 10));
      return;
    }

    const currentChannel = channelManager.getCurrentChannel();
    if (!currentChannel) {
      ui.logEntry("not in any channel; try /join #mytest");
      return;
    }

    channelManager.getCurrentChannel().channel.sendMessage(cmd);
  });

  ui.events.on("typing", (currentText: string) => {
    if (currentText[0] === "/") {
      return;
    }

    const currentChannel = channelManager.getCurrentChannel();
    if (!currentChannel) return;

    currentChannel.channel.typingEvent();
  });

  channelManager.events.on("newMessage", (channelName: string, username: string, message: string) => {
    const msg = (username + ">").green + " " + message;
    ui.logEntry(msg);
  });

  channelManager.events.on("channelSwitch", () => {
    const currentChannel = channelManager.getCurrentChannel();

    ui.logEntry("-------------------");
    ui.logEntry("now viewing #" + currentChannel.name);

    channelManager.dumpPendingMessages().forEach((message: any) => {
      const msg = (message.username + ">").green + " " + message.message;
      ui.logEntry(msg);
    });
  });

  channelManager.events.on("updateUsers", (channelName, users) => {
    if (channelName !== channelManager.getCurrentChannel().name) {
      return;
    }

    ui.availableUsers(users.map((x: any) => {
      return {name: x.username, status: (x.online ? "on" : "offline")};
    }));
  });

  channelManager.events.on("updateTypingUsers", (channelName, typingUsers) => {
    if (channelName !== channelManager.getCurrentChannel().name) {
      return;
    }

    if (typingUsers.length === 0) {
      return ui.setStatus("");
    }
    if (typingUsers.length === 1) {
      return ui.setStatus(typingUsers[0] + " is typing");
    }
    return ui.setStatus(typingUsers.join(", ") + " are typing");
  });

  channelManager.events.on("updateChannels", ui.availableChannels.bind(this));
})();
