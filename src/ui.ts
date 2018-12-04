require("colors");
const blessed = require("neo-blessed");
const Events = require("events");

class UI {
  public events: any;
  private color: string;
  private minimal: boolean;
  private screen: any;
  private input: any;
  private consoleBox: any;
  private consoleStateContainer: any;
  public consoleState: any;
  private wrapper: any;
  private users: any;
  private channels: any;
  private log: any;
  private logText: any;
  private operations: any;

  constructor(options: any = {}) {
    this.events = new Events();

    this.color = options.color || "green";
    this.minimal = options.minimal || false;

    this.screen = blessed.screen({
      autoPadding: true,
      dockBorders: false,
      fullUnicode: true,
      smartCSR: true,
      title: options.title || ("StatusX"),
    });

    this.layoutLog();
    this.layoutUsers();
    this.layoutChannels();
    this.layoutCmd();
    this.layoutState();

    this.screen.key(["C-c"], () => {
      process.exit(0);
    });

    this.logEntry = this.logEntry.bind(this);
    this.availableUsers = this.availableUsers.bind(this);
    this.availableChannels = this.availableChannels.bind(this);

    this.screen.render();
    this.input.focus();
  }

  public availableUsers(users: any) {
    const stateColors = {
      off: "grey",
      on:  "green",
    };

    const userList = Object.keys(users).map((user) => {
      const userObj = users[user];
      if (userObj.status in stateColors) {
        const color = stateColors[userObj.status];
        return userObj.name[color];
      }
      return userObj.name;
    });

    this.users.setContent(userList.join("\n"));
    this.screen.render();
  }

  public availableChannels(channels: string[]) {
    this.channels.setContent(channels.map((c, i) => `(${i}) ${c}`).join("\n"));
    this.screen.render();
  }

  // TODO: to remove, might not be used anymore
  private setStatus(status: string) {
    this.operations.setContent(status);
    this.screen.render();
  }

  public logEntry(...args: any[]) {
    this.logText.log(...args);
    this.screen.render();
  }

  private layoutLog() {
    this.log = blessed.box({
      border: {
        type: "line",
      },
      height: "92%",
      label: "Logs",
      left: "12%",
      padding: 1,
      style: {
        border: {
          fg: this.color,
        },
        fg: -1,
      },
      top: "0%",
      width: "68%",
    });

    this.logText = blessed.log({
      alwaysScroll: true,
      // height: "90%",
      input: false,
      keys: false,
      mouse: true,
      parent: this.log,
      scrollable: true,
      scrollbar: {
        ch: " ",
        inverse: true,
      },
      tags: true,
      vi: false,
      width: "100%-5",
    });

    this.screen.append(this.log);
  }

  private layoutUsers() {
    this.wrapper = blessed.layout({
      height: "100%",
      layout: "grid",
      left: "80%",
      top: "0%",
      width: "20%",
    });

    this.users = blessed.box({
      alwaysScroll: true,
      border: {
        type: "line",
      },
      height: "95%",
      label: "Users",
      padding: this.minimal ? {
        left: 1,
      } : 1,
      parent: this.wrapper,
      scrollable: true,
      scrollbar: {
        ch: " ",
        inverse: true,
      },
      style: {
        border: {
          fg: this.color,
        },
        fg: -1,
      },
      tags: true,
      valign: "top",
      width: "100%",
    });

    this.screen.append(this.wrapper);
  }

  private layoutChannels() {

    this.wrapper = blessed.layout({
      height: "100%",
      layout: "grid",
      left: "0%",
      top: "0%",
      width: "12%",
    });

    this.channels = blessed.box({
      alwaysScroll: true,
      border: {
        type: "line",
      },
      height: "95%",
      label: "Channels",
      padding: this.minimal ? {
        left: 1,
      } : 1,
      parent: this.wrapper,
      scrollable: true,
      scrollbar: {
        ch: " ",
        inverse: true,
      },
      style: {
        border: {
          fg: this.color,
        },
        fg: -1,
      },
      tags: true,
      valign: "top",
      width: "100%",
    });

    this.screen.append(this.wrapper);
  }

  private layoutCmd() {
    this.consoleBox = blessed.box({
      border: {
        type: "line",
      },
      height: "6%",
      label: "Messages",
      left: "0%",
      padding: 0,
      style: {
        border: {
          fg: this.color,
        },
        fg: "black",
      },
      tags: true,
      top: "95%",
      width: "100%",
    });

    this.input = blessed.textbox({
      height: "50%",
      input: true,
      inputOnFocus: true,
      keys: false,
      left: 1,
      name: "input",
      parent: this.consoleBox,
      style: {
        bg: "black",
        fg: "green",
        focus: {
          bg: "black",
          fg: "green",
        },
      },
      top: 0,
      width: "100%-2",
    });

    this.input.key(["C-c"], () => {
      this.events.emit("exit");
      process.exit(0);
    });

    this.input.key(["C-w"], () => {
      this.input.clearValue();
      this.input.focus();
    });

    this.input.key("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), () => {
      this.events.emit("typing", this.input.value);
    });

    this.input.on("submit", this.submitCmd.bind(this));

    this.screen.append(this.consoleBox);
  }

  private layoutState() {
    this.consoleStateContainer = blessed.layout({
      height: "5%",
      layout: "grid",
      left: "12%",
      top: "92%",
      width: "68%",
    });

    this.consoleState = blessed.box({
      border: {
        type: "line",
      },
      height: "100%",
      label: "",
      padding: {
        left: 1,
      },
      parent: this.consoleStateContainer,
      style: {
        border: {
          fg: this.color,
        },
        fg: -1,
      },
      tags: true,
      valign: "middle",
      width: "100%",
    });

    this.screen.append(this.consoleStateContainer);
  }

  private submitCmd(cmd: string) {
    if (cmd !== "") {
      this.events.emit("cmd", cmd);
    }
    this.input.clearValue();
    this.input.focus();
  }

}

export default UI;
