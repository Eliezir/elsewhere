import { Notification } from "electron";
import { createNotifier, type NotifySection } from "./notifier";
import { getPrefs } from "./prefs";

type Sink = (title: string, body: string, section: NotifySection) => void;

let open: (section: string) => void = () => undefined;
const alive = new Set<Notification>();

const sink: Sink = (title, body, section) => {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title, body });
  alive.add(notification);
  notification.on("click", () => open(section));
  notification.on("close", () => alive.delete(notification));
  notification.show();
};

export const notifier = createNotifier({ show: sink, now: () => Date.now(), prefs: getPrefs });

export function installNotifications(openSection: (section: string) => void): void {
  open = openSection;
}

export function sendTestNotification(): boolean {
  if (!Notification.isSupported()) return false;
  sink("Elsewhere notifications are on", "You'll hear from Elsewhere when a machine goes offline, a disk fills up, or a port can't be forwarded.", "settings");
  return true;
}
