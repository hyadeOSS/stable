// Legacy name of the app SDK, kept on purpose. The real file is hyadeos-app.js.
//
// Before the rename the project was spelled "hyadeOSS". Store apps written back then load
// ./hyadeoss-app.js or /desktop/assets/sdk/hyadeoss-app.js: this file loads the current SDK from the
// same place, which also defines window.hyadeOSS as an alias of window.hyadeOS. New apps should use
// hyadeos-app.js and window.hyadeOS.
(function () {
  "use strict";
  var current = document.currentScript;
  var src = current && current.src
    ? current.src.replace(/hyadeoss-app\.js(?=([?#].*)?$)/, "hyadeos-app.js")
    : "/desktop/assets/sdk/hyadeos-app.js";
  if (document.readyState === "loading") {
    // document.write keeps the load synchronous, like the <script> tag that asked for this file:
    // the app's next line can already use the SDK.
    document.write('<script src="' + src.replace(/"/g, "%22") + '"><\/script>');
  } else {
    var script = document.createElement("script");
    script.src = src;
    document.head.appendChild(script);
  }
})();
