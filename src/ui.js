require('colors');
const blessed = require("neo-blessed");
const Events = require("events");

class UI {
  constructor(_options) {
    let options = _options || {};
    this.events = new Events();

    this.color = options.color || "green";
    this.minimal = options.minimal || false;

    this.screen = blessed.screen({
      smartCSR: true,
      title: options.title || ("StatusX"),
      dockBorders: false,
      fullUnicode: true,
      autoPadding: true
    });

    this.layoutLog();
    this.layoutUsers();
    this.layoutChannels();
    this.layoutCmd();

    this.screen.key(["C-c"], function () {
      process.exit(0);
    });

    this.logEntry = this.logEntry.bind(this);
    this.availableUsers = this.availableUsers.bind(this);
    this.availableChannels = this.availableChannels.bind(this);

    this.screen.render();
    this.input.focus();
  }

  availableUsers(users) {
    let stateColors = {
      'on':  'green',
      'off': 'grey'
    };

    let user_list = Object.keys(users).map((user) => {
      let userObj = users[user];
      if (userObj.status in stateColors) {
        let color = stateColors[userObj.status];
        return userObj.name[color];
      }
      return userObj.name;
    });

    this.users.setContent(user_list.join('\n'));
    this.screen.render();
  }

  availableChannels(channels) {
    this.channels.setContent(channels.join('\n'));
    this.screen.render();
  }

  setStatus(status) {
    this.operations.setContent(status);
    this.screen.render();
  }

  logEntry() {
    this.logText.log(...arguments);
    this.screen.render();
  }

  layoutLog() {
    this.log = blessed.box({
      label: "Logs",
      padding: 1,
      width: "73%",
      height: "95%",
      left: "7%",
      top: "0%",
      border: {
        type: "line"
      },
      style: {
        fg: -1,
        border: {
          fg: this.color
        }
      }
    });

    this.logText = blessed.log({
      parent: this.log,
      tags: true,
      width: "100%-5",
      //height: '90%',
      scrollable: true,
      input: false,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        inverse: true
      },
      keys: false,
      vi: false,
      mouse: true
    });

    this.screen.append(this.log);
  }

  layoutUsers() {

    this.wrapper = blessed.layout({
      width: "20%",
      height: "100%",
      top: "0%",
      left: "80%",
      layout: "grid"
    });

    this.users = blessed.box({
      parent: this.wrapper,
      label: "Users",
      tags: true,
      padding: this.minimal ? {
        left: 1
      } : 1,
      width: "100%",
      height: "95%",
      valign: "top",
      border: {
        type: "line"
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        inverse: true
      },
      style: {
        fg: -1,
        border: {
          fg: this.color
        }
      }
    });

    this.screen.append(this.wrapper);
  }

  layoutChannels() {

    this.wrapper = blessed.layout({
      width: "7%",
      height: "100%",
      top: "0%",
      left: "0%",
      layout: "grid"
    });

    this.channels = blessed.box({
      parent: this.wrapper,
      label: "Channels",
      tags: true,
      padding: this.minimal ? {
        left: 1
      } : 1,
      width: "100%",
      height: "95%",
      valign: "top",
      border: {
        type: "line"
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        inverse: true
      },
      style: {
        fg: -1,
        border: {
          fg: this.color
        }
      }
    });

    this.screen.append(this.wrapper);
  }


  layoutCmd() {
    this.consoleBox = blessed.box({
      label: 'Messages',
      tags: true,
      padding: 0,
      width: '100%',
      height: '6%',
      left: '0%',
      top: '95%',
      border: {
        type: 'line'
      },
      style: {
        fg: 'black',
        border: {
          fg: this.color
        }
      }
    });

    this.input = blessed.textbox({
      parent: this.consoleBox,
      name: 'input',
      input: true,
      keys: false,
      top: 0,
      left: 1,
      height: '50%',
      width: '100%-2',
      inputOnFocus: true,
      style: {
        fg: 'green',
        bg: 'black',
        focus: {
          bg: 'black',
          fg: 'green'
        }
      }
    });

    let self = this;

    this.input.key(["C-c"], function () {
      self.events.emit('exit');
      process.exit(0);
    });

    this.input.key(["C-w"], function () {
      self.input.clearValue();
      self.input.focus();
    });

    this.input.on('submit', this.submitCmd.bind(this));

    this.screen.append(this.consoleBox);
  }

  submitCmd(cmd) {
    if (cmd !== '') {
      this.events.emit('cmd', cmd);
    }
    this.input.clearValue();
    this.input.focus();
  }

}

module.exports = UI;
