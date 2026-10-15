import { loadConfig } from "./config";
import { createDaemon } from "./server";

const config = loadConfig();
createDaemon(config).listen(config.port, config.host, () => {
  console.log(`vmc-daemon listening on ${config.host}:${config.port}`);
});
