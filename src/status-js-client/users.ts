import User from "./user";

class Users {
  public users: any;

  constructor() {
    this.users = {};
  }

  public addUserOrUpdate(user: User) {
    this.users[user.pubkey] = user;
  }

  public addOrUpdateUserKey(pubkey: string, username: string) {
    if (!this.users[pubkey]) {
      this.users[pubkey] = new User(pubkey, username);
    }
    this.users[pubkey].lastSeen = (new Date().getTime());
    this.users[pubkey].online = true;
    return this.users[pubkey];
  }

  public getUsers() {
    const userList = [];
    for (const pubkey of Object.keys(this.users)) {
      userList.push(pubkey);
    }
    return userList;
  }

  public updateUsersState() {
    const currentTime = (new Date().getTime());
    for (const pubkey of Object.keys(this.users)) {
      const user = this.users[pubkey];
      if (currentTime - user.lastSeen > 10 * 1000) {
        user.online = false;
      }
    }
  }

}

export default Users;
