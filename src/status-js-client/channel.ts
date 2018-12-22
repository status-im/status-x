import { Observable, fromEvent, interval } from 'rxjs';
import { throttle, map, distinctUntilChanged } from 'rxjs/operators';
import Events from 'events';
import isEqual from 'lodash.isequal';

class Channel {
  private channelName: string;
  private status: any;
  public messagesObserver: any;
  public usersTypingObserver: any;
  public usersObserver: any;
  private typingObserver: any;

  constructor(channelName: string, status: any) {
    this.status = status;
    this.channelName = channelName;
    this.events = new Events();
    this.usersTyping = {};
    this.users = {};
    this.typingObserver = fromEvent(this.events, 'typing');
    this.usersTypingObserver = fromEvent(this.events, 'usersTyping').pipe(
      throttle(val => interval(450)),
      map(() => Object.values(this.usersTyping).map(x => x.username)),
      distinctUntilChanged(isEqual),
    );
    this.usersObserver = fromEvent(this.events, 'users').pipe(
      throttle(val => interval(1000)),
      map(() => Object.values(this.users).map((x) => {
        return {username: x.username, online: x.online}
      })),
      distinctUntilChanged(isEqual),
    );
  }

  public joinChannel(cb) {
    this.status.joinChat(this.channelName, () => {
      this.pingChannel();
      this.listenToMessages();
      this.listenToTyping();
      this.listenToUsers();
      cb();
    });
  }

  private pingChannel() {
    this.status.sendJsonMessage(this.channelName, {type: "ping"});
    setInterval(() => {
      this.status.sendJsonMessage(this.channelName, {type: "ping"});
    }, 5 * 1000);
  }

  private listenToMessages() {
    this.messagesObserver = Observable.create((observer) => {
      this.status.onMessage(this.channelName, (err: any, data: any) => {
        if (err || !data) {
          console.dir("---- error ")
          console.dir(err)
          console.dir(data)

          return observer.error(err);
        }
        const msg = JSON.parse(data.payload)[1][0];

        if (JSON.parse(data.payload)[1][1] === "content/json") {
          return;
        }
        this.usersTyping[data.data.sig] = {username: data.username, lastTyped: 0}; // user is likley no longer typing if a message was received
        observer.next({message: msg, pubkey: data.data.sig, username: data.username});
        this.events.emit('users')
      });
    });

    this.status.onMessage(this.channelName, (err: any, data: any) => {
      if (JSON.parse(data.payload)[1][1] !== "content/json") {
        // usersTyping[data.data.sig] = 0; // user is likley no longer typing if a message was received
        return;
      }

      const msg = JSON.parse(JSON.parse(data.payload)[1][0]);
      const fromUser = data.data.sig;

      if (msg.type === "ping") {
        this.users[fromUser] = {
          username: data.username,
          lastSeen: (new Date().getTime()),
          online: true
        }
        this.events.emit('users')

        // const user = channels.allUsers.addOrUpdateUserKey(fromUser, data.username);
        // const channel = channels.getChannel(channelName);
        // channel.users.addUserOrUpdate(user);
        // channels.events.emit("update");
      }

      if (msg.type === "typing") {
        //if (fromUser === userPubKey) {
        //  return; // ignore typing events from self
        //}
        this.usersTyping[fromUser] = {username: data.username, lastTyped: (new Date().getTime()), online: true};
        this.events.emit('usersTyping')
        this.events.emit('users')
      }
    });
  }

  private listenToUsers() {
    this.events.emit('users')
    setInterval(() => {
      const currentTime = (new Date().getTime());
      for (const pubkey of Object.keys(this.users)) {
        const user = this.users[pubkey];
        if (currentTime - user.lastSeen > 10 * 1000) {
          user.online = false;
        }
      }

      this.events.emit('users')
    }, 5000);
  }

  public listenToTyping() {
    this.typingObserver.pipe(throttle(val => interval(3000))).subscribe(() => {
      this.status.sendJsonMessage(this.channelName, {type: "typing"});
    })

    setInterval(() => {
      const currentTime = (new Date().getTime());
      for (const pubkey of Object.keys(this.usersTyping)) {
        const lastTyped = this.usersTyping[pubkey].lastTyped;

        if (currentTime - lastTyped > 3 * 1000 || currentTime < lastTyped) {
          delete this.usersTyping[pubkey];
        }
      }

      this.events.emit('usersTyping')
    }, 500);
  }

  public typingEvent() {
    this.events.emit('typing')
  }

  public sendMessage(msg: string) {
    this.status.sendMessage(this.channelName, msg);
  }

}

export default Channel;
