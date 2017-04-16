const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "ExtensionUtils",
                                  "resource://gre/modules/ExtensionUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "ExtensionCommon",
                                  "resource://gre/modules/ExtensionCommon.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "ExtensionParent",
                                  "resource://gre/modules/ExtensionParent.jsm");

class API extends ExtensionAPI {
  getAPI(context) {
    const { windowManager } = context.extension;

    // SingletonEventManager was moved to ExtensionCommon in bug 1317697.
    let SingletonEventManager;
    if (ExtensionCommon.SingletonEventManager) {
      SingletonEventManager = ExtensionCommon.SingletonEventManager;
    } else {
      SingletonEventManager = ExtensionUtils.SingletonEventManager;
    }

    // Weakly maps XUL windows to their reflow observers.
    let windowMap = new WeakMap();

    return {
      reflows: {
        onUninterruptableReflow: new SingletonEventManager(context, "experiments.reflow", fire => {
          // Create a scope so that we don't accidentally leak windows in our various
          // function closures...
          {
            let windows = Array.from(windowManager.getAll(), win => win.window);

            for (let window of windows) {
              let observer = {
                reflow(start, end) {
                  // Grab the stack, but slice off the top frame inside this observer.
                  let stack = new Error().stack.split("\n").slice(1).join("\n");
                  // If the stack string is empty, call Math.sin() so that a native debugger
                  // has the opportunity to pause execution and get a native stack dump
                  if (!stack) {
                    let debug = Cc["@mozilla.org/xpcom/debug;1"].getService(Ci.nsIDebug2);
                    if (debug.isDebuggerAttached) {
                      debug.break("api.js", 36);
                    }
                  }

                  let id = ExtensionParent.apiManager.global.windowTracker.getId(window);
                  fire.async(id, start, end, stack);
                },
                reflowInterruptible(start, end) {},
                QueryInterface: XPCOMUtils.generateQI([Ci.nsIReflowObserver,
                                                       Ci.nsISupportsWeakReference])
              };

              let docShell = window.QueryInterface(Ci.nsIInterfaceRequestor)
                                   .getInterface(Ci.nsIWebNavigation)
                                   .QueryInterface(Ci.nsIDocShell);
              docShell.addWeakReflowObserver(observer);

              windowMap.set(window, observer);
            }
          }

          return () => {
            let windows = Array.from(windowManager.getAll(), win => win.window);
            for (let window of windows) {
              let observer = windowMap.get(window);
              if (observer) {
                let docShell = window.QueryInterface(Ci.nsIInterfaceRequestor)
                                     .getInterface(Ci.nsIWebNavigation)
                                     .QueryInterface(Ci.nsIDocShell);
                docShell.removeWeakReflowObserver(observer);
              }

              windowMap.delete(window);
            }
          }

        }).api()
      }
    };
  }
}
