import StatusJS from "status-js-api";
import UI from "./ui";
import ChannelManager from "./status-js-client/channelManager";

import StatusJSClient from "./status-js-client";

const DEFAULT_CHANNEL = "mytest";
const CONTACT_CODE_REGEXP = /^(0x)?[0-9a-f]{130}$/i;

let userPubKey: any;

const ui = new UI();

const channels = new ChannelManager();

const usersTyping = {};

channels.events.on("update", () => {
  ui.availableChannels(channels.getChannelList());
});

channels.events.on("channelSwitch", () => {
  ui.logEntry("-------------------");
  ui.logEntry("now viewing #" + channels.getCurrentChannel().name);
  channels.dumpPendingMessages().forEach((message: any) => {
    const msg = (message.username + ">").green + " " + message.message;
    ui.logEntry(msg);
  });
});

channels.events.on("newMessage", (channelName: string, username: string, message: string) => {
  const msg = (username + ">").green + " " + message;
  ui.logEntry(msg);
});

const updateUsers = () => {
  const users = channels.getUsersInCurrentChannel().map((x: any) => {
    return {name: x.username, status: (x.online ? "on" : "offline")};
  });
  ui.availableUsers(users);
};

const handleProtocolMessages = (channelName: string, data: any) => {
  // TODO: yes this is ugly, can be moved to the lib level
  const msg = JSON.parse(JSON.parse(data.payload)[1][0]);
  const fromUser = data.data.sig;

  if (msg.type === "ping") {
    const user = channels.allUsers.addOrUpdateUserKey(fromUser, data.username);
    const channel = channels.getChannel(channelName);
    channel.users.addUserOrUpdate(user);
    channels.events.emit("update");
  }

  if (msg.type === "typing") {
    if (fromUser === userPubKey) {
      return; // ignore typing events from self
    }
    usersTyping[fromUser] = (new Date().getTime());
  }
};

channels.events.on("update", updateUsers);
channels.events.on("channelSwitch", updateUsers);

setInterval(() => {
  const typingUsers = [];
  const currentTime = (new Date().getTime());
  for (const pubkey of Object.keys(usersTyping)) {
    const lastTyped = usersTyping[pubkey];
    if (currentTime - lastTyped > 3 * 1000 || currentTime < lastTyped) {
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

  ui.consoleState.setContent(typingUsers.join(", ") + " are typing");
}, 0.5 * 1000);

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
  const status = new StatusJS();

  await status.connect("ws://localhost:8546");
  userPubKey = await status.getPublicKey();
  const userName = await status.getUserName();

  ui.logEntry(`PK:  ${userPubKey}`);
  ui.logEntry(`-----------------------------------------------------------`);

  const fs = require("fs");
  fs.writeFile("/tmp/test", await status.getPublicKey(), (err: any) => {
    if (err) {
      return console.log(err);
    }
  });

  setInterval(() => {
    const channel = channels.getCurrentChannel();
    if (!channel.pubKey) {
      // TODO: JSON message is being displayed in the chat box of status
      status.sendJsonMessage(channel.name, {type: "ping"});
      channels.allUsers.updateUsersState();
    }
  }, 5 * 1000);

  status.joinChat(DEFAULT_CHANNEL, () => {
    ui.logEntry(("Joined #" + DEFAULT_CHANNEL).green.underline);

    channels.addChannel(DEFAULT_CHANNEL, "channel");

    status.onMessage(DEFAULT_CHANNEL, (err: any, data: any) => {
      const msg = JSON.parse(data.payload)[1][0];

      if (JSON.parse(data.payload)[1][1] === "content/json") {
        handleProtocolMessages(DEFAULT_CHANNEL, data);
      } else {
        usersTyping[data.data.sig] = 0; // user is likley no longer typing if a message was received
        channels.addMessage(DEFAULT_CHANNEL, msg, data.data.sig, data.username);
      }
    });
  });

  status.onMessage((err: any, data: any) => {
    channels.addChannel(data.username, "contact", {pubKey: data.data.sig});
    const msg = JSON.parse(data.payload)[1][0];
    if (JSON.parse(data.payload)[1][1] === "content/json") {
      handleProtocolMessages(data.username, data);
    } else {
      channels.addMessage(data.username, msg, data.data.sig, data.username);
    }
  });

  ui.events.on("cmd", (cmd: string) => {
    if (cmd.split(" ")[0] === "/join") {
      const channelName = cmd.split(" ")[1].replace("#", "");
      ui.logEntry("joining " + channelName);
      status.joinChat(channelName).then(() => {
        ui.logEntry("joined #" + channelName);

        channels.addChannel(channelName, "channel");

        status.onMessage(channelName, (err: any, data: any) => {
          const msg = JSON.parse(data.payload)[1][0];

          if (JSON.parse(data.payload)[1][1] === "content/json") {
            handleProtocolMessages(channelName, data);
          } else {
            channels.addMessage(channelName, msg, data.data.sig, data.username);
          }
        });

      });
      return;
    }
    if (cmd.split(" ")[0] === "/s") {
      const channelNumber = cmd.split(" ")[1];
      channels.switchChannelIndex(parseInt(channelNumber, 10));
      return;
    }

    if (cmd.split(" ")[0] === "/msg") {
      const destination = cmd.substr(5);

      if (!(CONTACT_CODE_REGEXP.test(destination) || (/^[a-z0-9A-Z\s]{4,}$/).test(destination))) {
        ui.logEntry(`Invalid account`.red);
        return;
      }

      // TODO:resolve ens username
      const user: any = Object.values(channels.allUsers.users).find((x: any) => x.username === destination);
      if (user) {
        channels.addChannel(user.username, "contact", {pubKey: user.pubkey});
        channels.switchChannelIndex(channels.channels.length - 1);
      } else {
        status.getUserName(destination).then((username: string) => {
          channels.addChannel(username, "contact", {pubKey: destination});
          channels.switchChannelIndex(channels.channels.length - 1);
        });
      }

      return;
    }

    const channel = channels.getCurrentChannel();
    if (channel.pubKey) {
      status.sendMessage(channel.pubKey, cmd);
      channels.addMessage(channel.name, cmd, channel.pubKey, userName);
    } else {
      status.sendMessage(channel.name, cmd);
    }
  });

  // keep track of each channel typing sent for throttling purposes
  const typingNotificationsTimestamp = {};

  ui.events.on("typing", (currentText: string) => {
    // TODO: use async.cargo instead and/or a to avoid unnecessary requests
    if (currentText[0] === "/") {
      return;
    }
    const channel = channels.getCurrentChannel();
    if (!channel.pubKey) {
      const channelName = channels.getCurrentChannel().name;
      if (!typingNotificationsTimestamp[channelName]) {
        typingNotificationsTimestamp[channelName] = {
          lastEvent: 0,
          timeout: 0,
        };
      }
      const now = (new Date().getTime());

      clearTimeout(typingNotificationsTimestamp[channelName].timeout);
      if (typingNotificationsTimestamp[channelName].lastEvent === 0 || now - typingNotificationsTimestamp[channelName].lastEvent > 3 * 1000) {
        typingNotificationsTimestamp[channelName].lastEvent = (new Date().getTime());
        status.sendJsonMessage(channelName, {type: "typing"});
      }

      typingNotificationsTimestamp[channelName].timeout = setTimeout(() => {
        typingNotificationsTimestamp[channelName].lastEvent = (new Date().getTime());
        status.sendJsonMessage(channelName, {type: "typing"});
      }, 3 * 1000);
    }
  });

})();
