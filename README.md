# reflow-api
Reflow observer WebExtension API for the Firefox UI

This experimental WebExtension API allows a WebExtension to monitor the Firefox UI for uninterruptible reflows.

# Usage

After installation, have your WebExtension request the "experiments.reflow" permission.

You can then add a listener for uninterruptible reflows across all browser windows like so:

    let listener = (windowId, start, stop, stack) => {
      // windowId is, unsuprisingly the ID of the window that had the reflow occur
      // start is the timestamp for when the reflow started
      // stop is the timestamp for when the reflow ended
      // stack is a string with the JavaScript dump.
    };

    browser.reflows.onUninterruptibleReflow(listener);
    
There are some uninterruptible reflows that do not appear to provide a stack, so the stack string will be empty. In those cases, the API will call `Math.sin()` on the main thread of the parent process, which a native debugger can break on (breaking on `js::math_sin`) to get the native stack.
