import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Printer } from '@bcyesil/capacitor-plugin-printer';
import { CapacitorContacts } from '@capgo/capacitor-contacts';

window.Capacitor = Capacitor;
window.CapacitorShare = Share;
window.CapacitorFilesystem = Filesystem;
window.CapacitorDirectory = Directory;
window.CapacitorFirebaseAuthentication = FirebaseAuthentication;
window.CapacitorPrinter = Printer;
window.CapacitorContacts = CapacitorContacts;

if (window.Capacitor) {
    if (!window.Capacitor.Plugins) window.Capacitor.Plugins = {};
    window.Capacitor.Plugins.Share = Share;
    window.Capacitor.Plugins.Filesystem = Filesystem;
    window.Capacitor.Plugins.Directory = Directory;
    window.Capacitor.Plugins.FirebaseAuthentication = FirebaseAuthentication;
    window.Capacitor.Plugins.Printer = Printer;
    window.Capacitor.Plugins.CapacitorContacts = CapacitorContacts;
    window.Capacitor.Plugins.Contacts = CapacitorContacts;
}
