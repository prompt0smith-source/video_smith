class CommandStack {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
  }
  do(cmd) {
    cmd.do();
    this.undoStack.push(cmd);
    this.redoStack = [];
  }
  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
  }
  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.do();
    this.undoStack.push(cmd);
  }
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

window.CommandStack = CommandStack;
