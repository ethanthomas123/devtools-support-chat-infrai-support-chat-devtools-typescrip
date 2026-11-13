import { chooseChannel } from "./support-chat.ts";

const result = chooseChannel({ visitorId: "alice", message: "The release is stuck", release: "r42", diagnostic: "worker queue is paused" });
if (result.channel !== "support-alice") throw new Error(`unexpected channel: ${result.channel}`);
let rejected = false;
try { chooseChannel({ visitorId: "alice", message: "", release: "r42", diagnostic: "worker queue is paused" }); } catch { rejected = true; }
if (!rejected) throw new Error("empty support messages must be rejected");
console.log("support request boundary: passed");
