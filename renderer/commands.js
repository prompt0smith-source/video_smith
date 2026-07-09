class CommandStack {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.onChange = null;
  }
  notifyChange() {
    if (typeof this.onChange === "function") this.onChange(this);
  }
  do(cmd) {
    cmd.do();
    this.undoStack.push(cmd);
    this.redoStack = [];
    this.notifyChange();
  }
  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
    this.notifyChange();
  }
  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.do();
    this.undoStack.push(cmd);
    this.notifyChange();
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }
}

window.CommandStack = CommandStack;
