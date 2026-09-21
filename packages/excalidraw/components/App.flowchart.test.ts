import { shouldCommitKeyboardFlowchartOnKeyUp } from "./App.flowchart";

describe("AppFlowchart", () => {
  it("does not commit a pointer drag on keyup", () => {
    expect(shouldCommitKeyboardFlowchartOnKeyUp(false, true, false)).toBe(
      false,
    );
  });

  it("commits only an active keyboard flowchart on modifier release", () => {
    expect(shouldCommitKeyboardFlowchartOnKeyUp(false, true, true)).toBe(true);
    expect(shouldCommitKeyboardFlowchartOnKeyUp(true, true, true)).toBe(false);
    expect(shouldCommitKeyboardFlowchartOnKeyUp(false, false, true)).toBe(
      false,
    );
  });
});
